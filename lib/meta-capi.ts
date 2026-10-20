import { sha256Hex } from "@/lib/crypto";
import { publicAbsoluteUrl, publicCampaignPath } from "@/lib/public-site-url";
import { sanitizeMetaPixelId } from "@/lib/validators";

export const META_CAPI_GRAPH_VERSION = "v21.0";

export type MetaCapiPurchasePayload = {
  pixelId: string;
  event: {
    event_name: "Purchase";
    event_time: number;
    event_id: string;
    action_source: "website";
    event_source_url?: string;
    user_data: Record<string, unknown>;
    custom_data: {
      value: number;
      currency: string;
      content_ids: string[];
      content_type: "product";
      order_id: string;
    };
  };
  testEventCode?: string;
};

function present(value?: string | null) {
  return Boolean(value && value.trim());
}

export function hashMetaUserValue(value?: string | null) {
  if (!present(value)) return null;
  return sha256Hex(value!.trim().toLowerCase());
}

export function queryParam(url: string | null | undefined, key: string) {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get(key);
  } catch {
    return null;
  }
}

export function facebookClickId(input: {
  sck?: string | null;
  landingUrl?: string | null;
}) {
  return input.sck?.trim() || queryParam(input.landingUrl, "fbclid") || queryParam(input.landingUrl, "sck") || null;
}

export function buildFacebookClickCookie(
  fbc?: string | null,
  clickId?: string | null,
  eventTimeMs = Date.now(),
) {
  const existing = fbc?.trim();
  if (existing) return existing;
  const id = clickId?.trim();
  if (!id) return null;
  if (id.startsWith("fb.1.")) return id;
  return `fb.1.${Math.floor(eventTimeMs)}.${id}`;
}

export function resolvedFbPixelId(
  pagePixel?: string | null,
  affiliateDefault?: string | null,
) {
  return (
    sanitizeMetaPixelId(pagePixel) ||
    sanitizeMetaPixelId(affiliateDefault) ||
    sanitizeMetaPixelId(process.env.META_PIXEL_ID) ||
    null
  );
}

export function isMetaCapiConfigured() {
  return Boolean(process.env.META_CAPI_ACCESS_TOKEN?.trim());
}

export function metaEventSourceUrl(input: {
  landingUrl?: string | null;
  campaignSlug: string;
  affiliateSlug: string;
  pathPrefix?: string | null;
}) {
  const landing = input.landingUrl?.trim();
  if (landing && /^https?:\/\//i.test(landing)) {
    try {
      const host = new URL(landing).hostname.toLowerCase();
      if (host && host !== "localhost" && host !== "127.0.0.1" && host !== "0.0.0.0") {
        return landing.slice(0, 2048);
      }
    } catch {
      /* use the public campaign URL */
    }
  }
  return publicAbsoluteUrl(
    publicCampaignPath(input.pathPrefix, input.campaignSlug, input.affiliateSlug),
  );
}

function compactRecord(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value == null || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );
}

export function buildMetaPurchasePayload(input: {
  saleId: string;
  pixelId: string;
  amountCents: number;
  currency: string;
  paidAt?: Date | null;
  email?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  sck?: string | null;
  landingUrl?: string | null;
  campaignSlug: string;
  affiliateSlug: string;
  affiliatePageId: string;
  pathPrefix?: string | null;
  livemode?: boolean;
}): MetaCapiPurchasePayload | null {
  const pixelId = sanitizeMetaPixelId(input.pixelId);
  if (!pixelId) return null;

  const eventTime = Math.floor((input.paidAt?.getTime() ?? Date.now()) / 1000);
  const clickId = facebookClickId({
    sck: input.sck,
    landingUrl: input.landingUrl,
  });
  const fbc = buildFacebookClickCookie(input.fbc, clickId, eventTime * 1000);
  const emailHash = hashMetaUserValue(input.email);
  const userData = compactRecord({
    em: emailHash ? [emailHash] : undefined,
    client_ip_address: input.clientIp?.trim() || undefined,
    client_user_agent: input.userAgent?.trim() || undefined,
    fbp: input.fbp?.trim() || undefined,
    fbc: fbc || undefined,
    external_id: emailHash ? [emailHash] : undefined,
  });
  if (Object.keys(userData).length === 0) return null;

  const testEventCode =
    input.livemode === false
      ? process.env.META_CAPI_TEST_EVENT_CODE?.trim() || undefined
      : undefined;

  return {
    pixelId,
    event: {
      event_name: "Purchase",
      event_time: eventTime,
      event_id: input.saleId,
      action_source: "website",
      event_source_url: metaEventSourceUrl({
        landingUrl: input.landingUrl,
        campaignSlug: input.campaignSlug,
        affiliateSlug: input.affiliateSlug,
        pathPrefix: input.pathPrefix,
      }),
      user_data: userData,
      custom_data: {
        value: Number((input.amountCents / 100).toFixed(2)),
        currency: input.currency.toUpperCase(),
        content_ids: [input.affiliatePageId],
        content_type: "product",
        order_id: input.saleId,
      },
    },
    testEventCode,
  };
}

export async function sendMetaCapiPurchase(payload: MetaCapiPurchasePayload) {
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("META_CAPI_ACCESS_TOKEN is not configured");
  }
  const body: Record<string, unknown> = {
    data: [payload.event],
    access_token: token,
  };
  if (payload.testEventCode) {
    body.test_event_code = payload.testEventCode;
  }
  const response = await fetch(
    `https://graph.facebook.com/${META_CAPI_GRAPH_VERSION}/${encodeURIComponent(payload.pixelId)}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Meta CAPI ${response.status}: ${text.slice(0, 600)}`);
  }
  return text;
}
