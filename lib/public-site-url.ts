export const DEFAULT_PUBLIC_SITE_URL = "http://localhost:3000";
export const MEXICO_PUBLIC_PREFIX = "/mexico";
export const ARGENTINA_PUBLIC_PREFIX = "/argentina";
export const PUBLIC_PREFIX_HEADER = "x-public-prefix";
export const KNOWN_PUBLIC_PREFIXES = [
  MEXICO_PUBLIC_PREFIX,
  ARGENTINA_PUBLIC_PREFIX,
] as const;

function stripSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function isLocalUrl(value: string) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
}

function liveOriginFromEnv() {
  const explicit = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim();
  if (explicit) return stripSlash(explicit);

  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) return stripSlash(app);

  return null;
}

/** Live storefront URL copied into affiliate ads. */
export function publicSiteUrl() {
  return liveOriginFromEnv() ?? DEFAULT_PUBLIC_SITE_URL;
}

/** Donor-facing links in email. */
export function emailPublicSiteUrl(_institutional = false) {
  return publicSiteUrl();
}

export function emailAbsoluteUrl(
  path: string,
  prefix?: string | null,
  institutional = false,
) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${emailPublicSiteUrl(institutional)}${withPublicPrefix(prefix, normalized)}`;
}

export function publicHostname() {
  try {
    return new URL(publicSiteUrl()).hostname;
  } catch {
    return new URL(DEFAULT_PUBLIC_SITE_URL).hostname;
  }
}

export function normalizePublicPrefix(prefix?: string | null) {
  if (!prefix) return "";
  const trimmed = prefix.trim();
  if (!trimmed || trimmed === "/") return "";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return stripSlash(withSlash);
}

export const normalizePublicPathPrefix = normalizePublicPrefix;

export function companyPublicPrefix(company: {
  publicPathPrefix?: string | null;
  locale?: string | null;
  slug?: string | null;
  siteMode?: string | null;
}) {
  if (company.siteMode === "INSTITUTIONAL") return "";
  const prefix = normalizePublicPrefix(company.publicPathPrefix);
  if (prefix) return prefix;
  if (company.locale === "es-MX" || company.slug === "arc-mexico") {
    return MEXICO_PUBLIC_PREFIX;
  }
  if (company.locale === "es-AR" || company.slug === "arc-argentina") {
    return ARGENTINA_PUBLIC_PREFIX;
  }
  return "";
}

export function withPublicPrefix(prefix: string | null | undefined, path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const pre = normalizePublicPrefix(prefix);
  if (!pre) return normalized;
  if (
    normalized === "/api" ||
    normalized.startsWith("/api/") ||
    normalized.startsWith("/api?")
  ) {
    return normalized;
  }
  if (normalized === "/") return pre;
  if (normalized === pre || normalized.startsWith(`${pre}/`)) return normalized;
  return `${pre}${normalized}`;
}

export function stripPublicPrefix(pathname: string, prefix = MEXICO_PUBLIC_PREFIX) {
  const pre = normalizePublicPrefix(prefix);
  if (!pre) return pathname;
  if (pathname === pre) return "/";
  if (pathname.startsWith(`${pre}/`)) {
    return pathname.slice(pre.length) || "/";
  }
  return pathname;
}

export function publicPrefixFromPathname(pathname: string) {
  for (const prefix of KNOWN_PUBLIC_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return prefix;
    }
  }
  return null;
}

/** On localhost, a path prefix wins. Bare /c uses the default company, not the admin cookie. */
export function requestCompanySource(input: {
  publicPrefix: string | null | undefined;
  isLocalHost: boolean;
}): "public-prefix" | "admin-cookie" | "host" {
  if (normalizePublicPrefix(input.publicPrefix)) return "public-prefix";
  return "host";
}

export function companyResolutionPlan(input: {
  prefix: string | null | undefined;
  hostname?: string;
  isLocalHost: boolean;
}):
  | { by: "prefix"; prefix: string }
  | { by: "admin-cookie" }
  | { by: "host"; hostname?: string } {
  const prefix = normalizePublicPrefix(input.prefix);
  if (prefix) return { by: "prefix", prefix };
  return { by: "host", hostname: input.hostname };
}

export function publicAbsoluteUrl(path: string, prefix?: string | null) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${publicSiteUrl()}${withPublicPrefix(prefix, normalized)}`;
}

export function pagnovoPostbackUrl() {
  return publicAbsoluteUrl("/api/webhooks/pagnovo");
}

export function campaignPublicPath(
  prefix: string | null | undefined,
  campaignSlug: string,
  affiliateSlug: string,
  suffix = "",
  options?: { short?: boolean },
) {
  const extra = suffix
    ? suffix.startsWith("/")
      ? suffix
      : `/${suffix}`
    : "";
  if (options?.short) {
    return withPublicPrefix(prefix, `/c/${campaignSlug}${extra}`);
  }
  return withPublicPrefix(prefix, `/c/${campaignSlug}/${affiliateSlug}${extra}`);
}

export const publicCampaignPath = campaignPublicPath;

export function withSearchParams(
  path: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.append(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    }
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function consentStorageKey(prefix?: string | null) {
  const normalized = normalizePublicPrefix(prefix);
  if (normalized === MEXICO_PUBLIC_PREFIX || prefix === "mexico") {
    return "giving_marketing_consent_mexico";
  }
  if (normalized === ARGENTINA_PUBLIC_PREFIX || prefix === "argentina") {
    return "giving_marketing_consent_argentina";
  }
  return "giving_marketing_consent";
}
