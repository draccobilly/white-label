export const SITE_MODES = ["CAMPAIGN", "INSTITUTIONAL"] as const;

export type SiteMode = (typeof SITE_MODES)[number];

export function normalizeSiteMode(value?: string | null): SiteMode {
  return value === "INSTITUTIONAL" ? "INSTITUTIONAL" : "CAMPAIGN";
}

export function isInstitutionalSiteMode(value?: string | null): boolean {
  return normalizeSiteMode(value) === "INSTITUTIONAL";
}
