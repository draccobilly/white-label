/**
 * Coarse visitor location for the live globe. Resolved on the server from
 * the request: first from location headers a CDN may already add, then from a
 * free IP lookup service, with an in-memory cache so a visitor's second event
 * costs nothing. The IP itself is never stored.
 *
 * Environment:
 *   GEOIP_LOOKUP=off               disables the network lookup (headers only)
 *   GEOIP_PROVIDER=geojs|ipwhois|freeipapi   lookup service (default geojs)
 *   GEOIP_LOOKUPS_PER_MINUTE=40    cap on lookups per minute per process
 */

export type GeoPoint = {
  /** ISO 3166-1 alpha-2, upper case. */
  country: string;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

const CACHE_TTL_MS = 24 * 60 * 60_000;
const NEGATIVE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 20_000;
const LOOKUP_TIMEOUT_MS = 2500;

type CacheEntry = { geo: GeoPoint | null; expires: number };

const globalGeo = globalThis as unknown as {
  __geoCache?: Map<string, CacheEntry>;
  __geoBudget?: { minute: number; used: number };
};

function cache() {
  if (!globalGeo.__geoCache) globalGeo.__geoCache = new Map();
  return globalGeo.__geoCache;
}

function clean(value: string | null | undefined, max = 80) {
  const text = value?.trim();
  if (!text) return null;
  return text.slice(0, max);
}

function toNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function normalizeCountry(value: string | null | undefined) {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "T1" ? code : null;
}

function decodeHeader(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Location headers added by a CDN in front of the site (Cloudflare "visitor
 * location headers", Vercel). Free and instant when present.
 */
export function geoFromHeaders(headers: Headers): GeoPoint | null {
  const country =
    normalizeCountry(headers.get("cf-ipcountry")) ??
    normalizeCountry(headers.get("x-vercel-ip-country")) ??
    normalizeCountry(headers.get("x-geo-country"));
  if (!country) return null;
  const latitude = toNumber(headers.get("cf-iplatitude") ?? headers.get("x-vercel-ip-latitude") ?? headers.get("x-geo-latitude"));
  const longitude = toNumber(
    headers.get("cf-iplongitude") ?? headers.get("x-vercel-ip-longitude") ?? headers.get("x-geo-longitude"),
  );
  return {
    country,
    region: clean(decodeHeader(headers.get("cf-region") ?? headers.get("x-vercel-ip-country-region") ?? headers.get("x-geo-region"))),
    city: clean(decodeHeader(headers.get("cf-ipcity") ?? headers.get("x-vercel-ip-city") ?? headers.get("x-geo-city"))),
    latitude,
    longitude,
  };
}

/** Private, loopback, link-local and carrier-grade NAT ranges have no location. */
export function isPublicIp(ip: string) {
  const value = ip.trim();
  if (!value || value === "unknown") return false;
  if (value.includes(":")) {
    const lower = value.toLowerCase();
    if (lower === "::1" || lower === "::") return false;
    if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return false;
    if (lower.startsWith("::ffff:")) return isPublicIp(lower.slice(7));
    return /^[0-9a-f:]+$/.test(lower);
  }
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 169 && b === 254) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
}

export function lookupEnabled() {
  return (process.env.GEOIP_LOOKUP ?? "").trim().toLowerCase() !== "off";
}

/** Location already known for this IP (from a previous lookup), or null. */
export function cachedGeo(ip: string): GeoPoint | null | undefined {
  const entry = cache().get(ip);
  if (!entry) return undefined;
  if (entry.expires < Date.now()) {
    cache().delete(ip);
    return undefined;
  }
  return entry.geo;
}

function remember(ip: string, geo: GeoPoint | null) {
  const store = cache();
  if (store.size >= CACHE_MAX) {
    // Drop the oldest entries; Map keeps insertion order.
    let drop = Math.ceil(CACHE_MAX / 10);
    for (const key of store.keys()) {
      store.delete(key);
      if (--drop <= 0) break;
    }
  }
  store.set(ip, { geo, expires: Date.now() + (geo ? CACHE_TTL_MS : NEGATIVE_TTL_MS) });
}

function takeBudget() {
  const limit = Number(process.env.GEOIP_LOOKUPS_PER_MINUTE ?? 40);
  const minute = Math.floor(Date.now() / 60_000);
  const budget = globalGeo.__geoBudget ?? { minute, used: 0 };
  if (budget.minute !== minute) {
    budget.minute = minute;
    budget.used = 0;
  }
  globalGeo.__geoBudget = budget;
  if (budget.used >= (Number.isFinite(limit) && limit > 0 ? limit : 40)) return false;
  budget.used += 1;
  return true;
}

type Provider = { url: (ip: string) => string; parse: (body: Record<string, unknown>) => GeoPoint | null };

const PROVIDERS: Record<string, Provider> = {
  geojs: {
    url: (ip) => `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`,
    parse: (body) => {
      const country = normalizeCountry(body.country_code as string | undefined);
      if (!country) return null;
      return {
        country,
        region: clean(body.region as string | undefined),
        city: clean(body.city as string | undefined),
        latitude: toNumber(body.latitude),
        longitude: toNumber(body.longitude),
      };
    },
  },
  ipwhois: {
    url: (ip) => `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code,region,city,latitude,longitude`,
    parse: (body) => {
      if (body.success === false) return null;
      const country = normalizeCountry(body.country_code as string | undefined);
      if (!country) return null;
      return {
        country,
        region: clean(body.region as string | undefined),
        city: clean(body.city as string | undefined),
        latitude: toNumber(body.latitude),
        longitude: toNumber(body.longitude),
      };
    },
  },
  freeipapi: {
    url: (ip) => `https://freeipapi.com/api/json/${encodeURIComponent(ip)}`,
    parse: (body) => {
      const country = normalizeCountry(body.countryCode as string | undefined);
      if (!country) return null;
      return {
        country,
        region: clean(body.regionName as string | undefined),
        city: clean(body.cityName as string | undefined),
        latitude: toNumber(body.latitude),
        longitude: toNumber(body.longitude),
      };
    },
  },
};

export function parseProviderBody(provider: string, body: Record<string, unknown>) {
  return (PROVIDERS[provider] ?? PROVIDERS.geojs).parse(body);
}

/**
 * Resolves the location of a public IP through the configured service.
 * Never throws: an unknown or failed lookup is cached as null for a while.
 */
export async function lookupGeo(ip: string): Promise<GeoPoint | null> {
  const known = cachedGeo(ip);
  if (known !== undefined) return known;
  if (!lookupEnabled() || !isPublicIp(ip)) return null;
  if (!takeBudget()) return null;
  const name = (process.env.GEOIP_PROVIDER ?? "geojs").trim().toLowerCase();
  const provider = PROVIDERS[name] ?? PROVIDERS.geojs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(provider.url(ip), {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "giving-admin-geo/1" },
    });
    if (!response.ok) {
      remember(ip, null);
      return null;
    }
    const body = (await response.json()) as Record<string, unknown>;
    const geo = provider.parse(body);
    remember(ip, geo);
    return geo;
  } catch {
    remember(ip, null);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Columns written on a tracking event. */
export function geoColumns(geo: GeoPoint | null | undefined) {
  if (!geo) return {};
  return {
    country: geo.country,
    region: geo.region,
    city: geo.city,
    latitude: geo.latitude,
    longitude: geo.longitude,
  };
}
