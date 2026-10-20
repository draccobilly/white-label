import { publicSiteUrl } from "@/lib/public-site-url";

export type AdClick = {
  src?: string | null;
  sck?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  landingUrl?: string | null;
  referrer?: string | null;
};

export const AD_CLICK_COOKIE = "arc_ad_click";
export const AD_CLICK_MAX_AGE = 7 * 24 * 60 * 60;

function present(value?: string | null) {
  return Boolean(value && value.trim());
}

export function hasAdClick(click: AdClick | null | undefined) {
  if (!click) return false;
  return Boolean(
    present(click.utmCampaign) ||
      present(click.utmSource) ||
      present(click.utmMedium) ||
      present(click.sck) ||
      present(click.src),
  );
}

/**
 * Meta only fills {{campaign.name}} and the other macros when the click goes
 * through ad delivery. A shared ad, the Instagram ad-activity list, or the ad
 * preview sends the braces as written, and Utmify then cannot match the sale.
 */
export function hasUnresolvedAdMacros(click: AdClick | null | undefined) {
  if (!click) return false;
  return [
    click.utmSource,
    click.utmMedium,
    click.utmCampaign,
    click.utmContent,
    click.utmTerm,
    click.src,
    click.sck,
  ].some((value) => typeof value === "string" && /\{\{|%7B%7B/i.test(value));
}

function isInternalLanding(url?: string | null) {
  if (!url) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  } catch {
    return true;
  }
}

function landingScore(url?: string | null) {
  if (!url || isInternalLanding(url)) return 0;
  try {
    const params = new URL(url).searchParams;
    let score = 1;
    if (params.get("fbclid") || params.get("sck")) score += 8;
    if (params.get("utm_campaign")) score += 4;
    if (params.get("utm_medium")) score += 2;
    if (!url.includes("/checkout")) score += 2;
    return score;
  } catch {
    return 1;
  }
}

export function pickLandingUrl(
  stored?: string | null,
  incoming?: string | null,
) {
  return landingScore(stored) >= landingScore(incoming) ? stored : incoming;
}

export function mergeAdClick(
  stored: AdClick | null | undefined,
  incoming: AdClick | null | undefined,
): AdClick {
  const base = stored ?? {};
  const next = incoming ?? {};
  const cookies = {
    fbp: next.fbp || base.fbp || null,
    fbc: next.fbc || base.fbc || null,
  };
  if (!hasAdClick(next) && !hasAdClick(base)) {
    return cookies.fbp || cookies.fbc ? cookies : {};
  }
  if (!hasAdClick(next)) return { ...base, ...cookies };
  // A later visit that reopened the ad outside delivery arrives with the
  // macros unfilled. The first, filled click stays the label for this donor;
  // only the Meta cookies refresh.
  if (hasUnresolvedAdMacros(next) && hasAdClick(base) && !hasUnresolvedAdMacros(base)) {
    return { ...base, ...cookies };
  }
  return {
    src: next.src || base.src || next.utmSource || base.utmSource || null,
    sck: next.sck || base.sck || null,
    utmSource: next.utmSource || base.utmSource || null,
    utmMedium: next.utmMedium || base.utmMedium || null,
    utmCampaign: next.utmCampaign || base.utmCampaign || null,
    utmContent: next.utmContent || base.utmContent || null,
    utmTerm: next.utmTerm || base.utmTerm || null,
    fbp: next.fbp || base.fbp || null,
    fbc: next.fbc || base.fbc || null,
    landingUrl: pickLandingUrl(base.landingUrl, next.landingUrl) || null,
    referrer: base.referrer || next.referrer || null,
  };
}

export function adClickFromSearchParams(
  search: URLSearchParams,
  pageUrl: string,
  referrer?: string | null,
): AdClick {
  const fbclid = search.get("fbclid");
  const sck = search.get("sck") || fbclid;
  return {
    src: search.get("src") || search.get("utm_source"),
    sck,
    utmSource: search.get("utm_source"),
    utmMedium: search.get("utm_medium"),
    utmCampaign: search.get("utm_campaign"),
    utmContent: search.get("utm_content"),
    utmTerm: search.get("utm_term"),
    fbp: null,
    fbc: search.get("fbclid")
      ? `fb.1.${Date.now()}.${search.get("fbclid")}`
      : null,
    landingUrl: pageUrl.slice(0, 4000),
    referrer: referrer?.slice(0, 4000) || null,
  };
}

function toBase64Url(text: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(text, "utf8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeAdClickCookie(click: AdClick) {
  return toBase64Url(JSON.stringify(click));
}

export function decodeAdClickCookie(value?: string | null): AdClick | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(value)) as AdClick;
    return hasAdClick(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

type CookieReader = {
  cookies: { get(name: string): { value: string } | undefined };
  nextUrl: { searchParams: URLSearchParams; href: string; pathname: string };
  headers: { get(name: string): string | null };
};

type CookieWriter = {
  cookies: {
    set(options: {
      name: string;
      value: string;
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax";
      path: string;
      maxAge: number;
    }): void;
  };
};

export function readAdClickCookie(request: CookieReader) {
  return decodeAdClickCookie(request.cookies.get(AD_CLICK_COOKIE)?.value);
}

function nextUrlQuery(searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function stampAdClickCookie(request: CookieReader, response: CookieWriter) {
  if (!request.nextUrl.pathname.includes("/c/")) return response;
  const publicHref =
    `${publicSiteUrl()}${request.nextUrl.pathname}${nextUrlQuery(request.nextUrl.searchParams)}`.slice(
      0,
      4000,
    );
  const incoming = adClickFromSearchParams(
    request.nextUrl.searchParams,
    publicHref,
    request.headers.get("referer"),
  );
  const stored = readAdClickCookie(request);
  const merged = mergeAdClick(stored, incoming);
  if (!hasAdClick(merged)) return response;
  response.cookies.set({
    name: AD_CLICK_COOKIE,
    value: encodeAdClickCookie(merged),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AD_CLICK_MAX_AGE,
  });
  return response;
}
