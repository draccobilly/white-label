import { decryptSecret } from "@/lib/crypto";

/** United States (default desk) may inherit Direct Team Utmify. Other desks must not. */
export function inheritAffiliateUtmify(companyIsDefault: boolean | null | undefined) {
  return companyIsDefault !== false;
}

export function envUtmifyApiToken() {
  return process.env.UTMIFY_API_TOKEN?.trim() || null;
}

export function resolvedUtmifyPixelScript(
  pageScript: string | null | undefined,
  affiliateScript: string | null | undefined,
  companyIsDefault: boolean | null | undefined,
) {
  const page = pageScript?.trim() || null;
  if (page) return page;
  if (!inheritAffiliateUtmify(companyIsDefault)) return null;
  return affiliateScript?.trim() || null;
}

export function resolvedUtmifyTokenEnc(
  pageTokenEnc: string | null | undefined,
  affiliateTokenEnc: string | null | undefined,
  companyIsDefault: boolean | null | undefined,
) {
  if (pageTokenEnc) return pageTokenEnc;
  if (!inheritAffiliateUtmify(companyIsDefault)) return null;
  return affiliateTokenEnc ?? null;
}

export function resolveDeliverableUtmifyToken(input: {
  pageTokenEnc?: string | null;
  affiliateTokenEnc?: string | null;
  companyIsDefault?: boolean | null;
}) {
  const enc = resolvedUtmifyTokenEnc(
    input.pageTokenEnc,
    input.affiliateTokenEnc,
    input.companyIsDefault,
  );
  if (enc && process.env.ENCRYPTION_KEY) {
    try {
      const token = decryptSecret(enc, process.env.ENCRYPTION_KEY).trim();
      if (token) return token;
    } catch {
      // Fall through to the instance token.
    }
  }
  if (!inheritAffiliateUtmify(input.companyIsDefault)) return null;
  return envUtmifyApiToken();
}

/** Stamp Utmify on a new campaign page: US inherits Direct Team; other desks only copy their own. */
export function utmifyTrackingForNewPage(input: {
  companyIsDefault: boolean | null | undefined;
  pageScript?: string | null;
  pageTokenEnc?: string | null;
  pageWebhookUrl?: string | null;
  affiliateScript?: string | null;
  affiliateTokenEnc?: string | null;
  affiliateWebhookUrl?: string | null;
}) {
  const pageScript = input.pageScript?.trim() || null;
  const affiliateScript = input.affiliateScript?.trim() || null;
  if (inheritAffiliateUtmify(input.companyIsDefault)) {
    return {
      utmifyPixelScript: pageScript || affiliateScript,
      utmifyTokenEnc: input.pageTokenEnc || input.affiliateTokenEnc || null,
      utmifyWebhookUrl: input.pageWebhookUrl || input.affiliateWebhookUrl || null,
    };
  }
  return {
    utmifyPixelScript: pageScript,
    utmifyTokenEnc: input.pageTokenEnc || null,
    utmifyWebhookUrl: input.pageWebhookUrl || null,
  };
}
