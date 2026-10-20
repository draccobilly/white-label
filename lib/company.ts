import { cache } from "react";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { COMPANY_COOKIE, hostnameFromHost, isLocalHost } from "@/lib/app-role";
import {
  normalizeCampaignLayout,
  publicFaviconUrl,
  publicLogoUrl,
  type CampaignLayout,
} from "@/lib/campaign-layout";
import { normalizeSiteMode, type SiteMode } from "@/lib/site-mode";
import {
  companyPublicPrefix,
  companyResolutionPlan,
  ARGENTINA_PUBLIC_PREFIX,
  MEXICO_PUBLIC_PREFIX,
  normalizePublicPathPrefix,
  PUBLIC_PREFIX_HEADER,
  publicHostname,
} from "@/lib/public-site-url";

const DEFAULT_COMPANY = {
  name: "Giving Site",
  slug: "giving-site",
  isDefault: true,
  siteName: "Giving Site",
  landingTitle: "Giving Site",
  landingBody:
    "We help institutions raise verified, one-time gifts. This page presents the organization only.",
  footerText: "Direct help, verified attribution, human impact.",
};

export async function ensureDefaultCompany() {
  let existing = await prisma.company.findFirst({
    where: { isDefault: true },
  });
  if (existing) {
    if (!existing.domain) {
      existing = await prisma.company.update({
        where: { id: existing.id },
        data: { domain: publicHostname() },
      });
    }
    await prisma.campaign.updateMany({
      where: { companyId: null },
      data: { companyId: existing.id },
    });
    return existing;
  }

  const settings = await prisma.siteSettings.findUnique({
    where: { id: "default" },
  });

  const company = await prisma.company.create({
    data: {
      ...DEFAULT_COMPANY,
      domain: publicHostname(),
      siteName: settings?.siteName ?? DEFAULT_COMPANY.siteName,
      logoUrl: settings?.logoUrl,
      primaryColor: settings?.primaryColor ?? "#0d3654",
      accentColor: settings?.accentColor ?? "#02a95c",
      footerText: settings?.footerText ?? DEFAULT_COMPANY.footerText,
      legalText: settings?.legalText ?? "Secure one-time donation. Terms and privacy apply.",
      stripeWebhookSecretEnc: settings?.stripeWebhookSecretEnc,
    },
  });

  await prisma.campaign.updateMany({
    data: { companyId: company.id },
  });

  return company;
}

export async function listCompanies() {
  await ensureDefaultCompany();
  return prisma.company.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function getDefaultCompany() {
  await ensureDefaultCompany();
  const company = await prisma.company.findFirst({
    where: { isDefault: true },
  });
  if (!company) throw new Error("Default company is missing");
  return company;
}

export async function resolveCompanyByHost(host?: string | null) {
  const hostname = hostnameFromHost(host);
  if (!isLocalHost(hostname)) {
    const matched = await prisma.company.findFirst({
      where: { domain: hostname },
    });
    if (matched) return matched;
  }
  return getDefaultCompany();
}

export async function resolveCompanyByPathPrefix(prefix?: string | null) {
  const normalized = normalizePublicPathPrefix(prefix);
  if (!normalized) return null;
  const matched = await prisma.company.findFirst({
    where: { publicPathPrefix: normalized },
  });
  if (matched) return matched;
  if (normalized === MEXICO_PUBLIC_PREFIX) {
    const mexico = await prisma.company.findFirst({
      where: { slug: "mexico" },
    });
    if (!mexico) return null;
    if (normalizePublicPathPrefix(mexico.publicPathPrefix) === MEXICO_PUBLIC_PREFIX) {
      return mexico;
    }
    return prisma.company.update({
      where: { id: mexico.id },
      data: { publicPathPrefix: MEXICO_PUBLIC_PREFIX },
    });
  }
  if (normalized === ARGENTINA_PUBLIC_PREFIX) {
    const argentina = await prisma.company.findFirst({
      where: { slug: "argentina" },
    });
    if (!argentina) return null;
    if (
      normalizePublicPathPrefix(argentina.publicPathPrefix) ===
      ARGENTINA_PUBLIC_PREFIX
    ) {
      return argentina;
    }
    return prisma.company.update({
      where: { id: argentina.id },
      data: { publicPathPrefix: ARGENTINA_PUBLIC_PREFIX },
    });
  }
  return null;
}

export const getRequestCompany = cache(async function getRequestCompany() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const hostname = hostnameFromHost(host);
  const prefix = normalizePublicPathPrefix(headerStore.get(PUBLIC_PREFIX_HEADER));
  const plan = companyResolutionPlan({
    prefix,
    hostname,
    isLocalHost: isLocalHost(hostname),
  });
  if (plan.by === "prefix") {
    const matched = await resolveCompanyByPathPrefix(plan.prefix);
    if (matched) return matched;
    return getDefaultCompany();
  }
  if (plan.by === "admin-cookie") {
    return getAdminCompany();
  }
  return resolveCompanyByHost(host);
});

export async function getAdminCompany() {
  await ensureDefaultCompany();
  const cookieStore = await cookies();
  const selectedId = cookieStore.get(COMPANY_COOKIE)?.value;
  if (selectedId) {
    const selected = await prisma.company.findUnique({
      where: { id: selectedId },
    });
    if (selected) return selected;
  }
  return getDefaultCompany();
}

export function companyBrand(company: {
  siteName: string;
  logoUrl: string | null;
  impactLogoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  footerText: string;
  legalText: string;
  locale?: string | null;
  slug?: string | null;
  paymentGateway?: "STRIPE" | "PAGNOVO" | null;
  publicPathPrefix?: string | null;
  campaignLayout?: CampaignLayout | string | null;
  siteMode?: SiteMode | string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  nonprofitEin?: string | null;
  nonprofitName?: string | null;
}) {
  return {
    siteName: company.siteName,
    logoUrl: publicLogoUrl(company),
    impactLogoUrl: company.impactLogoUrl ?? null,
    faviconUrl: publicFaviconUrl(company),
    primaryColor: company.primaryColor,
    accentColor: company.accentColor,
    footerText: company.footerText,
    legalText: company.legalText,
    siteMode: normalizeSiteMode(company.siteMode),
    contactEmail: company.contactEmail?.trim() || null,
    contactPhone: company.contactPhone?.trim() || null,
    contactAddress: company.contactAddress?.trim() || null,
    nonprofitEin: company.nonprofitEin?.trim() || null,
    nonprofitName: company.nonprofitName?.trim() || null,
    locale:
      company.locale === "es-AR"
        ? ("es-AR" as const)
        : company.locale === "es-MX"
          ? ("es-MX" as const)
          : ("en" as const),
    paymentGateway:
      company.paymentGateway === "PAGNOVO" ? ("PAGNOVO" as const) : ("STRIPE" as const),
    pathPrefix: companyPublicPrefix(company),
    campaignLayout: normalizeCampaignLayout(company.campaignLayout),
  };
}
