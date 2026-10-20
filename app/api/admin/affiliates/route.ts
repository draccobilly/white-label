import { NextResponse } from "next/server";
import { requireOwner, isAuthError, authHttpStatus, authErrorMessage } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { affiliatePageTrackingFrom, uniqueAffiliateSlug } from "@/lib/affiliates";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { assertTrackingExclusiveToCompany } from "@/lib/assert-pixel-isolation";
import { PixelConflictError } from "@/lib/pixel-isolation";
import {
  normalizeUtmifyPixelScript,
  normalizeUtmifyWebhookUrl,
  utmifyPixelIdFromConfig,
} from "@/lib/utmify-pixel";
import {
  affiliateSchema,
  sanitizePixelId,
} from "@/lib/validators";

function encryptUtmifyToken(token: string) {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY is not configured");
  }
  return encryptSecret(token, secret);
}

export async function GET() {
  try {
    await requireOwner();
    const affiliates = await prisma.affiliate.findMany({
      include: {
        _count: { select: { pages: true, sales: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ affiliates });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? authErrorMessage(error) : "Unable to list affiliates" },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner();
    const parsed = affiliateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid affiliate" },
        { status: 400 },
      );
    }
    const company = await getAdminCompany();
    const data = parsed.data;
    let webhookUrl: string | null = null;
    let pixelScript: string | null = null;
    try {
      webhookUrl = normalizeUtmifyWebhookUrl(data.utmifyWebhookUrl);
      pixelScript = normalizeUtmifyPixelScript(data.utmifyPixelScript);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid Utmify settings" },
        { status: 400 },
      );
    }
    const token = data.utmifyToken?.trim() || "";
    try {
      await assertTrackingExclusiveToCompany({
        companyId: company.id,
        tracking: {
          utmifyPixelScript: pixelScript,
          utmifyPixelId: utmifyPixelIdFromConfig(pixelScript),
          utmifyToken: token || null,
          pagnovoDesk: company.paymentGateway === "PAGNOVO",
        },
      });
    } catch (error) {
      if (error instanceof PixelConflictError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
    const affiliate = await prisma.$transaction(async (tx) => {
      const created = await tx.affiliate.create({
        data: {
          name: data.name,
          slug: await uniqueAffiliateSlug(tx, data.name),
          email: data.email || null,
          notes: data.notes || null,
          active: data.active,
          utmifyWebhookUrl: webhookUrl,
          utmifyPixelScript: pixelScript,
          defaultUtmifyTokenEnc: token ? encryptUtmifyToken(token) : null,
        },
      });
      const campaigns = await tx.campaign.findMany({
        where: { companyId: company.id },
        select: { id: true },
      });
      if (campaigns.length) {
        await tx.affiliatePage.createMany({
          data: campaigns.map((campaign) => ({
            campaignId: campaign.id,
            affiliateId: created.id,
            ...affiliatePageTrackingFrom(created),
          })),
          skipDuplicates: true,
        });
      }
      return created;
    });
    return NextResponse.json({ affiliate }, { status: 201 });
  } catch (error) {
    console.error("affiliate create failed", error);
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to create affiliate" },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await requireOwner();
    const body = await request.json();
    const affiliateId = body.affiliateId as string | undefined;
    if (!affiliateId) {
      return NextResponse.json({ error: "affiliateId is required" }, { status: 400 });
    }

    if (
      body.name ||
      "email" in body ||
      "notes" in body ||
      "utmifyWebhookUrl" in body ||
      "utmifyPixelScript" in body ||
      "utmifyToken" in body
    ) {
      const parsed = affiliateSchema.partial().safeParse({
        name: body.name,
        email: body.email,
        notes: body.notes,
        utmifyWebhookUrl: body.utmifyWebhookUrl,
        utmifyPixelScript: body.utmifyPixelScript,
        utmifyToken: body.utmifyToken,
      });
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid affiliate" },
          { status: 400 },
        );
      }
    }

    const company = await getAdminCompany();
    const update: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      update.name = body.name.trim();
      update.slug = await uniqueAffiliateSlug(prisma, body.name.trim(), affiliateId);
    }
    if (typeof body.email === "string") update.email = body.email.trim() || null;
    if (typeof body.notes === "string") update.notes = body.notes.trim() || null;
    if (typeof body.active === "boolean") update.active = body.active;
    if ("googlePixelId" in body) update.defaultGooglePixelId = sanitizePixelId(body.googlePixelId);
    if ("tiktokPixelId" in body) update.defaultTiktokPixelId = sanitizePixelId(body.tiktokPixelId);
    if ("utmifyWebhookUrl" in body) {
      try {
        update.utmifyWebhookUrl = normalizeUtmifyWebhookUrl(body.utmifyWebhookUrl);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Invalid webhook URL" },
          { status: 400 },
        );
      }
    }
    if ("utmifyPixelScript" in body) {
      try {
        update.utmifyPixelScript = normalizeUtmifyPixelScript(body.utmifyPixelScript);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Invalid pixel script" },
          { status: 400 },
        );
      }
    }
    if (typeof body.utmifyToken === "string" && body.utmifyToken.trim()) {
      update.defaultUtmifyTokenEnc = encryptUtmifyToken(body.utmifyToken.trim());
    }

    const tracking = {
      fbPixelId:
        typeof update.defaultFbPixelId === "string"
          ? update.defaultFbPixelId
          : undefined,
      googlePixelId:
        typeof update.defaultGooglePixelId === "string"
          ? update.defaultGooglePixelId
          : undefined,
      tiktokPixelId:
        typeof update.defaultTiktokPixelId === "string"
          ? update.defaultTiktokPixelId
          : undefined,
      utmifyPixelScript:
        typeof update.utmifyPixelScript === "string"
          ? update.utmifyPixelScript
          : undefined,
      utmifyPixelId: utmifyPixelIdFromConfig(
        typeof update.utmifyPixelScript === "string"
          ? update.utmifyPixelScript
          : null,
      ),
      utmifyToken:
        typeof body.utmifyToken === "string" ? body.utmifyToken.trim() : null,
      pagnovoDesk: company.paymentGateway === "PAGNOVO",
    };
    try {
      await assertTrackingExclusiveToCompany({
        companyId: company.id,
        excludeAffiliateId: affiliateId,
        includeAffiliateUtmifyDefaults: !company.isDefault,
        tracking,
      });
    } catch (error) {
      if (error instanceof PixelConflictError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const pageUtmify: Record<string, unknown> = {};
    if ("utmifyWebhookUrl" in update) {
      pageUtmify.utmifyWebhookUrl = update.utmifyWebhookUrl;
    }
    if ("utmifyPixelScript" in update) {
      pageUtmify.utmifyPixelScript = update.utmifyPixelScript;
    }
    if (typeof update.defaultUtmifyTokenEnc === "string") {
      pageUtmify.utmifyTokenEnc = update.defaultUtmifyTokenEnc;
    }
    const affiliateData = { ...update };
    if (!company.isDefault) {
      delete affiliateData.utmifyWebhookUrl;
      delete affiliateData.utmifyPixelScript;
      delete affiliateData.defaultUtmifyTokenEnc;
    }

    const affiliate = await prisma.$transaction(async (tx) => {
      const updated = await tx.affiliate.update({
        where: { id: affiliateId },
        data: affiliateData,
      });
      if (Object.keys(pageUtmify).length) {
        await tx.affiliatePage.updateMany({
          where: { affiliateId, campaign: { companyId: company.id } },
          data: pageUtmify,
        });
      }
      if (typeof update.defaultFbPixelId === "string") {
        await tx.affiliatePage.updateMany({
          where: { affiliateId, fbPixelId: null },
          data: { fbPixelId: update.defaultFbPixelId },
        });
      }
      return updated;
    });
    return NextResponse.json({ affiliate });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to update affiliate" },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}
