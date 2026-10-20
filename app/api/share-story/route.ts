import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { inspectPublicForm } from "@/lib/form-guard";
import { sendShareStoryEmail } from "@/lib/mail";
import { getRequestCompany, companyBrand } from "@/lib/company";
import { isInstitutionalSiteMode } from "@/lib/site-mode";
import { isAllowedUploadFile } from "@/lib/media-file";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { fundraiserCurrency, priorWholeNumber } from "@/lib/fundraiser-prior";
import { formatMoneyExact } from "@/lib/utils";
import { shareStorySchema } from "@/lib/validators";
import {
  hashPassword,
  normalizeOrganizerEmail,
  passwordProblem,
  sessionCookieFor,
  verifyPassword,
} from "@/lib/organizer-auth";
import "@/lib/supabase/polyfill-websocket";

export const maxDuration = 60;

const BUCKET = "campaign-media";
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 8;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function safeFileName(name: string) {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  return cleaned.replace(/^-+|-+$/g, "") || "file";
}

async function readPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const files = form
      .getAll("media")
      .filter((item): item is File => item instanceof File && item.size > 0);
    return {
      fields: {
        about: String(form.get("about") ?? ""),
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        whatsapp: String(form.get("whatsapp") ?? ""),
        address: String(form.get("address") ?? ""),
        story: String(form.get("story") ?? ""),
        consentData: form.get("consentData") === "true",
        consentImage: form.get("consentImage") === "true",
        consentTerms: form.get("consentTerms") === "true",
        priorRaisedCents: priorWholeNumber(form.get("priorRaisedCents")),
        priorDonationCount: priorWholeNumber(form.get("priorDonationCount")),
      },
      guard: {
        formToken: String(form.get("formToken") ?? ""),
        companyUrl: String(form.get("companyUrl") ?? ""),
      },
      password: String(form.get("password") ?? ""),
      files,
    };
  }
  const json = (await request.json()) as Record<string, unknown>;
  return {
    fields: {
      about: json.about,
      name: json.name,
      email: json.email,
      whatsapp: json.whatsapp,
      address: json.address,
      story: json.story,
      consentData: json.consentData,
      consentImage: json.consentImage,
      consentTerms: json.consentTerms,
      priorRaisedCents: priorWholeNumber(json.priorRaisedCents),
      priorDonationCount: priorWholeNumber(json.priorDonationCount),
      mediaUrls: json.mediaUrls,
    },
    guard: {
      formToken: String(json.formToken ?? ""),
      companyUrl: String(json.companyUrl ?? ""),
    },
    password: typeof json.password === "string" ? json.password : "",
    files: [] as File[],
  };
}

/**
 * Portal account for the person sending the case. A new email gets an
 * account with the password they chose; an email that already has one must
 * present the same password, so nobody can take over a case by re-sending it.
 */
async function organizerForSubmission(input: {
  companyId: string;
  email: string;
  name: string;
  whatsapp: string;
  password: string;
}) {
  if (!input.password) return { organizer: null, error: null };
  const email = normalizeOrganizerEmail(input.email);
  const existing = await prisma.organizer.findUnique({
    where: { companyId_email: { companyId: input.companyId, email } },
  });
  if (existing) {
    if (!(await verifyPassword(input.password, existing.passwordHash))) {
      return {
        organizer: null,
        error:
          "This email already has an organizer account. Use the same password, or reset it from the sign-in page.",
      };
    }
    return { organizer: existing, error: null };
  }
  const problem = passwordProblem(input.password);
  if (problem) return { organizer: null, error: problem };
  const organizer = await prisma.organizer.create({
    data: {
      companyId: input.companyId,
      email,
      name: input.name,
      whatsapp: input.whatsapp,
      passwordHash: await hashPassword(input.password),
      lastLoginAt: new Date(),
    },
  });
  return { organizer, error: null };
}

async function uploadMedia(files: File[]) {
  if (!files.length) return [] as string[];
  const supabase = serviceClient();
  if (!supabase) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }
  const urls: string[] = [];
  for (const file of files.slice(0, MAX_FILES)) {
    if (file.size > MAX_BYTES) {
      throw new Error("Each photo or video must be under 20MB.");
    }
    if (!isAllowedUploadFile(file)) {
      throw new Error("Use a JPG, PNG, WEBP, or MP4.");
    }
    const path = `help-requests/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const options = { upsert: false, contentType: file.type || "application/octet-stream" };
    let { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, options);
    if (uploadError && /bucket|not found/i.test(uploadError.message)) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_BYTES,
      });
      if (createError && !/already exists/i.test(createError.message)) {
        throw createError;
      }
      ({ error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, options));
    }
    if (uploadError) throw uploadError;
    urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`share-story:${ip}`, 5, 60 * 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const company = await getRequestCompany();
    const brand = companyBrand(company);
    if (!isInstitutionalSiteMode(brand.siteMode)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { fields, files, guard, password } = await readPayload(request);
    const verdict = inspectPublicForm({
      formToken: guard.formToken,
      companyUrl: guard.companyUrl,
      email: fields.email,
      texts: [fields.name],
      prose: [fields.address, fields.story],
    });
    if (!verdict.ok) {
      if (verdict.silent) return NextResponse.json({ ok: true });
      return NextResponse.json({ error: verdict.message }, { status: 400 });
    }
    const parsed = shareStorySchema.safeParse(fields);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Check the form fields." },
        { status: 400 },
      );
    }
    if (files.length && !parsed.data.consentImage) {
      return NextResponse.json(
        { error: "Image and video consent is required when you attach files." },
        { status: 400 },
      );
    }

    const account = await organizerForSubmission({
      companyId: company.id,
      email: parsed.data.email,
      name: parsed.data.name,
      whatsapp: parsed.data.whatsapp,
      password,
    });
    if (account.error) {
      return NextResponse.json({ error: account.error }, { status: 400 });
    }

    let mediaUrls = parsed.data.mediaUrls ?? [];
    if (files.length) {
      mediaUrls = await uploadMedia(files);
    }

    try {
      await prisma.helpRequest.create({
        data: {
          companyId: company.id,
          about: parsed.data.about,
          name: parsed.data.name,
          email: parsed.data.email,
          whatsapp: parsed.data.whatsapp,
          address: parsed.data.address,
          story: parsed.data.story,
          mediaUrls,
          consentData: true,
          consentImage: parsed.data.consentImage,
          consentTerms: true,
          organizerId: account.organizer?.id ?? null,
          priorRaisedCents: parsed.data.priorRaisedCents,
          priorDonationCount: parsed.data.priorDonationCount,
          priorRaisedCurrency: fundraiserCurrency(company.locale),
        },
      });
    } catch (error) {
      console.error("help request persist failed", error);
    }

    const inbox =
      process.env.RESEND_FROM?.match(/<([^>]+)>/)?.[1] ||
      process.env.RESEND_FROM?.trim();
    const to =
      brand.contactEmail ||
      process.env.ADMIN_EMAIL?.trim() ||
      inbox;

    if (to && process.env.RESEND_API_KEY) {
      await sendShareStoryEmail({
        ...parsed.data,
        mediaUrls,
        siteName: brand.siteName,
        to,
        priorRaised: formatMoneyExact(
          parsed.data.priorRaisedCents,
          fundraiserCurrency(company.locale),
        ),
        priorDonations: String(parsed.data.priorDonationCount),
      });
    }

    const response = NextResponse.json({ ok: true, portal: Boolean(account.organizer) });
    if (account.organizer) {
      const cookie = sessionCookieFor(account.organizer);
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return response;
  } catch (error) {
    console.error("share story failed", error);
    const message =
      error instanceof Error && /20MB|JPG|PNG|STORAGE/i.test(error.message)
        ? error.message
        : "We couldn’t send your note. Please try again shortly.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
