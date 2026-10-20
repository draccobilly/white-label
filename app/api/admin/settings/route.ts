import { encryptSecret } from "@/lib/crypto";
import { requireOwner, isAuthError, authHttpStatus } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const settingsSchema = z.object({
  siteName: z.string().trim().min(2).max(100),
  logoUrl: z.string().url().optional().nullable().or(z.literal("")),
  impactLogoUrl: z.string().url().optional().nullable().or(z.literal("")),
  faviconUrl: z.string().url().optional().nullable().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  footerText: z.string().trim().max(500),
  legalText: z.string().trim().max(2000),
  siteMode: z.enum(["CAMPAIGN", "INSTITUTIONAL"]).optional(),
  contactEmail: z
    .union([z.literal(""), z.string().trim().email().max(320)])
    .optional()
    .nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  contactAddress: z.string().trim().max(500).optional().nullable(),
  nonprofitEin: z.string().trim().max(40).optional().nullable(),
  stripeWebhookSecret: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export async function PATCH(request: Request) {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid settings" },
        { status: 400 },
      );
    }
    const stripeWebhookSecret = parsed.data.stripeWebhookSecret?.trim() ?? "";
    if (stripeWebhookSecret && !stripeWebhookSecret.startsWith("whsec_")) {
      return NextResponse.json(
        { error: "The Stripe signing secret must start with whsec_" },
        { status: 400 },
      );
    }
    const { stripeWebhookSecret: _ignored, ...brand } = parsed.data;
    const updated = await prisma.company.update({
      where: { id: company.id },
      data: {
        siteName: brand.siteName,
        logoUrl: brand.logoUrl || null,
        impactLogoUrl: brand.impactLogoUrl || null,
        faviconUrl: brand.faviconUrl || null,
        primaryColor: brand.primaryColor,
        accentColor: brand.accentColor,
        footerText: brand.footerText,
        legalText: brand.legalText,
        siteMode: brand.siteMode ?? company.siteMode,
        contactEmail: brand.contactEmail?.trim() || null,
        contactPhone: brand.contactPhone?.trim() || null,
        contactAddress: brand.contactAddress?.trim() || null,
        nonprofitEin: brand.nonprofitEin?.trim() || null,
        ...(stripeWebhookSecret
          ? {
              stripeWebhookSecretEnc: encryptSecret(
                stripeWebhookSecret,
                process.env.ENCRYPTION_KEY!,
              ),
            }
          : {}),
      },
      select: {
        siteName: true,
        logoUrl: true,
        impactLogoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        accentColor: true,
        footerText: true,
        legalText: true,
        siteMode: true,
        contactEmail: true,
        contactPhone: true,
        contactAddress: true,
        nonprofitEin: true,
        stripeWebhookSecretEnc: true,
      },
    });
    if (company.isDefault) {
      await prisma.siteSettings.upsert({
        where: { id: "default" },
        update: {
          siteName: updated.siteName,
          logoUrl: updated.logoUrl,
          primaryColor: updated.primaryColor,
          accentColor: updated.accentColor,
          footerText: updated.footerText,
          legalText: updated.legalText,
          stripeWebhookSecretEnc: updated.stripeWebhookSecretEnc,
        },
        create: {
          id: "default",
          siteName: updated.siteName,
          logoUrl: updated.logoUrl,
          primaryColor: updated.primaryColor,
          accentColor: updated.accentColor,
          footerText: updated.footerText,
          legalText: updated.legalText,
          stripeWebhookSecretEnc: updated.stripeWebhookSecretEnc,
        },
      });
    }
    return NextResponse.json({
      settings: {
        ...updated,
        hasStripeWebhookSecret: Boolean(updated.stripeWebhookSecretEnc),
        stripeWebhookSecretEnc: undefined,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to save settings" },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}
