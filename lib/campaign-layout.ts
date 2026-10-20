export const CAMPAIGN_LAYOUTS = ["CLASSIC", "IMPACT"] as const;

export type CampaignLayout = (typeof CAMPAIGN_LAYOUTS)[number];

export function normalizeCampaignLayout(
  value?: string | null,
): CampaignLayout {
  return value === "IMPACT" ? "IMPACT" : "CLASSIC";
}

export function isImpactCampaignLayout(value?: string | null): boolean {
  return normalizeCampaignLayout(value) === "IMPACT";
}

export function publicLogoUrl(company: {
  campaignLayout?: string | null;
  logoUrl?: string | null;
  impactLogoUrl?: string | null;
}) {
  if (
    isImpactCampaignLayout(company.campaignLayout) &&
    company.impactLogoUrl
  ) {
    return company.impactLogoUrl;
  }
  return company.logoUrl ?? null;
}

export const LOCAL_CHURCH_FAVICON = "/admin-icon-192.png";

export function publicFaviconUrl(company: {
  faviconUrl?: string | null;
  logoUrl?: string | null;
}) {
  return (
    company.faviconUrl?.trim() ||
    LOCAL_CHURCH_FAVICON
  );
}
