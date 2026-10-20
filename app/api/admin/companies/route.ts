import { NextResponse } from "next/server";
import { requireOwner, isAuthError, authHttpStatus } from "@/lib/auth";
import { ensureDefaultCompany, listCompanies } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { slugify } from "@/lib/utils";
import { companySchema } from "@/lib/validators";
import { companyPublicPrefix } from "@/lib/public-site-url";

export async function GET() {
  try {
    await requireOwner();
    const companies = await listCompanies();
    return NextResponse.json({ companies });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to list companies" },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner();
    await ensureDefaultCompany();
    const parsed = companySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid company" },
        { status: 400 },
      );
    }
    const slug =
      parsed.data.slug ||
      slugify(parsed.data.name) ||
      `company-${Date.now().toString(36)}`;
    const domain = parsed.data.domain?.trim() || null;
    const spanish =
      parsed.data.locale === "es-MX" || parsed.data.locale === "es-AR";
    const pagnovoSecret = parsed.data.pagnovoWebhookSecret?.trim() || "";
    const publicPathPrefix =
      companyPublicPrefix({
        publicPathPrefix: parsed.data.publicPathPrefix,
        locale: parsed.data.locale,
        slug,
      }) || null;
    const company = await prisma.company.create({
      data: {
        name: parsed.data.name,
        slug,
        domain,
        publicPathPrefix,
        landingTitle: parsed.data.landingTitle || parsed.data.name,
        landingBody: parsed.data.landingBody || "",
        siteName: parsed.data.name,
        locale: parsed.data.locale ?? "en",
        paymentGateway: parsed.data.paymentGateway ?? "STRIPE",
        siteMode: parsed.data.siteMode ?? "CAMPAIGN",
        contactEmail: parsed.data.contactEmail?.trim() || null,
        contactPhone: parsed.data.contactPhone?.trim() || null,
        contactAddress: parsed.data.contactAddress?.trim() || null,
        nonprofitListed: parsed.data.nonprofitListed ?? true,
        nonprofitName: parsed.data.nonprofitName?.trim() || null,
        nonprofitDescription: parsed.data.nonprofitDescription?.trim() || null,
        nonprofitLogoUrl: parsed.data.nonprofitLogoUrl?.trim() || null,
        footerText: spanish
          ? "Tu donativo hace una diferencia real."
          : undefined,
        legalText: spanish
          ? "Donativo único y seguro. Aplican términos y privacidad."
          : undefined,
        ...(pagnovoSecret && process.env.ENCRYPTION_KEY
          ? {
              pagnovoWebhookSecretEnc: encryptSecret(
                pagnovoSecret,
                process.env.ENCRYPTION_KEY,
              ),
            }
          : {}),
      },
    });
    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    console.error("company create failed", error);
    const duplicate =
      typeof error === "object" && error && "code" in error && error.code === "P2002";
    return NextResponse.json(
      {
        error: isAuthError(error)
          ? "Unauthorized"
          : duplicate
            ? "That slug, domain, or path prefix is already used"
            : "Unable to create company",
      },
      { status: isAuthError(error) ? authHttpStatus(error) : duplicate ? 400 : 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await requireOwner();
    const body = await request.json();
    const companyId = body.companyId as string | undefined;
    const parsed = companySchema.safeParse(body);
    if (!companyId || !parsed.success) {
      return NextResponse.json(
        {
          error: parsed.success
            ? "Invalid company update"
            : parsed.error.issues[0]?.message ?? "Invalid company update",
        },
        { status: 400 },
      );
    }
    const pagnovoSecret = parsed.data.pagnovoWebhookSecret?.trim() || "";
    const existing = await prisma.company.findUnique({
      where: { id: companyId },
      select: { slug: true },
    });
    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: parsed.data.name,
        domain: parsed.data.domain?.trim() || null,
        publicPathPrefix:
          companyPublicPrefix({
            publicPathPrefix: parsed.data.publicPathPrefix,
            locale: parsed.data.locale,
            slug: existing?.slug,
          }) || null,
        landingTitle: parsed.data.landingTitle || parsed.data.name,
        landingBody: parsed.data.landingBody ?? "",
        locale: parsed.data.locale ?? "en",
        paymentGateway: parsed.data.paymentGateway ?? "STRIPE",
        ...(parsed.data.siteMode ? { siteMode: parsed.data.siteMode } : {}),
        contactEmail: parsed.data.contactEmail?.trim() || null,
        contactPhone: parsed.data.contactPhone?.trim() || null,
        contactAddress: parsed.data.contactAddress?.trim() || null,
        nonprofitListed: parsed.data.nonprofitListed ?? true,
        nonprofitName: parsed.data.nonprofitName?.trim() || null,
        nonprofitDescription: parsed.data.nonprofitDescription?.trim() || null,
        nonprofitLogoUrl: parsed.data.nonprofitLogoUrl?.trim() || null,
        ...(pagnovoSecret && process.env.ENCRYPTION_KEY
          ? {
              pagnovoWebhookSecretEnc: encryptSecret(
                pagnovoSecret,
                process.env.ENCRYPTION_KEY,
              ),
            }
          : {}),
      },
    });
    return NextResponse.json({ company });
  } catch (error) {
    const duplicate =
      typeof error === "object" && error && "code" in error && error.code === "P2002";
    return NextResponse.json(
      {
        error: isAuthError(error)
          ? "Unauthorized"
          : duplicate
            ? "That domain or path prefix is already used"
            : "Unable to update company",
      },
      { status: isAuthError(error) ? authHttpStatus(error) : duplicate ? 400 : 500 },
    );
  }
}
