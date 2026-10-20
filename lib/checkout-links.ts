const TCO_PATH = /^\/[A-Za-z0-9]{4,40}$/;
const PLINK_ID = /^plink_[A-Za-z0-9]+$/;
const BLOCKED_PUBLIC_HOSTS = new Set([
  "api.utmify.com.br",
  "hooks.stripe.com",
  "localhost",
]);

function httpsUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Enter a link");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (parsed.protocol !== "https:") {
    throw new Error("Use an https link");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Links cannot include credentials");
  }
  return parsed;
}

export function normalizePublicCheckoutUrl(raw: string) {
  const parsed = httpsUrl(raw);
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_PUBLIC_HOSTS.has(host) || host.endsWith(".utmify.com.br")) {
    throw new Error("That URL is not a public checkout shortlink");
  }
  if (host !== "t.co") {
    throw new Error("Campaign checkout links must use a t.co handoff");
  }
  if (!TCO_PATH.test(parsed.pathname)) {
    throw new Error("Paste a full t.co shortlink, like https://t.co/7nPwhgJBAF");
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function parseStripePaymentLinkId(raw: string) {
  const trimmed = raw.trim();
  if (PLINK_ID.test(trimmed)) return trimmed;
  return null;
}

export function stripeCheckoutMode(url: string): "test" | "live" {
  const path = new URL(url).pathname.toLowerCase();
  if (path === "/test" || path.startsWith("/test/") || path.startsWith("/test_")) {
    return "test";
  }
  return "live";
}

export function stripeSecretMode(key: string): "test" | "live" | null {
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  return null;
}

export function normalizeStripeDestination(raw: string) {
  const trimmed = raw.trim();
  const plink = parseStripePaymentLinkId(trimmed);
  if (plink) {
    return { stripeCheckoutUrl: null as string | null, stripePaymentLinkId: plink };
  }
  const parsed = httpsUrl(trimmed);
  if (parsed.hostname !== "buy.stripe.com") {
    throw new Error("The original link must be buy.stripe.com or a plink_ id");
  }
  parsed.search = "";
  parsed.hash = "";
  return {
    stripeCheckoutUrl: parsed.toString(),
    stripePaymentLinkId: null as string | null,
  };
}

export function isOpaqueShortlink(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "t.co" || host === "twitter.com" || host === "x.com";
  } catch {
    return false;
  }
}

type CheckoutAttribution = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  sck?: string | null;
};

export function stripeHandoffUrl(input: {
  stripeCheckoutUrl: string | null;
  intentId: string;
  attribution?: CheckoutAttribution;
}) {
  if (!input.stripeCheckoutUrl) {
    throw new Error("This amount has no original Stripe Payment Link to hand off to");
  }
  if (isOpaqueShortlink(input.stripeCheckoutUrl)) {
    throw new Error("Checkout must hand off to buy.stripe.com, not t.co");
  }
  const parsed = new URL(input.stripeCheckoutUrl);
  parsed.searchParams.set("client_reference_id", input.intentId);
  const attribution = input.attribution ?? {};
  const params = {
    utm_source: attribution.utmSource,
    utm_medium: attribution.utmMedium,
    utm_campaign: attribution.utmCampaign,
    utm_content: attribution.utmContent,
    utm_term: attribution.utmTerm,
    sck: attribution.sck,
  };
  for (const [key, value] of Object.entries(params)) {
    if (value) parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}
