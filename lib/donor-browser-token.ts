import { decryptSecret, encryptSecret, sha256Hex } from "@/lib/crypto";

const TOKEN_VERSION = 1;
export const DONOR_BROWSER_COOKIE_MAX_AGE = 180 * 24 * 60 * 60;
export const PENDING_CHECKOUT_COOKIE_MAX_AGE = 24 * 60 * 60;
export const CONFIRMED_VISIT_COOKIE_MAX_AGE = 15 * 60;

type ConfirmedVisitToken = {
  version: typeof TOKEN_VERSION;
  purpose: "confirmed";
  affiliatePageId: string;
  checkoutIntentId: string;
  stripeCheckoutSessionId: string;
  issuedAt: number;
};

type DonorBrowserToken = {
  version: typeof TOKEN_VERSION;
  affiliatePageId: string;
  checkoutIntentId: string;
  authorized: boolean;
  showInlineThankYou: boolean;
  issuedAt: number;
};

export function donorBrowserCookieName(affiliatePageId: string) {
  return `arc_donor_${sha256Hex(affiliatePageId).slice(0, 24)}`;
}

export function pendingCheckoutCookieName(affiliatePageId: string) {
  return `arc_checkout_${sha256Hex(affiliatePageId).slice(0, 24)}`;
}

export function confirmedVisitCookieName(affiliatePageId: string) {
  return `arc_confirmed_${sha256Hex(affiliatePageId).slice(0, 24)}`;
}

export function createConfirmedVisitToken(
  input: {
    affiliatePageId: string;
    checkoutIntentId: string;
    stripeCheckoutSessionId: string;
  },
  secret: string,
  now = Date.now(),
) {
  const payload: ConfirmedVisitToken = {
    version: TOKEN_VERSION,
    purpose: "confirmed",
    affiliatePageId: input.affiliatePageId,
    checkoutIntentId: input.checkoutIntentId,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    issuedAt: now,
  };
  return encryptSecret(JSON.stringify(payload), secret);
}

export function readConfirmedVisitToken(
  token: string,
  secret: string,
  now = Date.now(),
): ConfirmedVisitToken | null {
  try {
    const payload = JSON.parse(decryptSecret(token, secret)) as Partial<ConfirmedVisitToken>;
    const maxAgeMs = CONFIRMED_VISIT_COOKIE_MAX_AGE * 1000;
    if (
      payload.version !== TOKEN_VERSION ||
      payload.purpose !== "confirmed" ||
      typeof payload.affiliatePageId !== "string" ||
      typeof payload.checkoutIntentId !== "string" ||
      typeof payload.stripeCheckoutSessionId !== "string" ||
      typeof payload.issuedAt !== "number" ||
      payload.issuedAt > now + 5 * 60 * 1000 ||
      now - payload.issuedAt > maxAgeMs
    ) {
      return null;
    }
    return payload as ConfirmedVisitToken;
  } catch {
    return null;
  }
}

export function createDonorBrowserToken(
  input: {
    affiliatePageId: string;
    checkoutIntentId: string;
    authorized?: boolean;
    showInlineThankYou?: boolean;
  },
  secret: string,
  now = Date.now(),
) {
  const payload: DonorBrowserToken = {
    version: TOKEN_VERSION,
    affiliatePageId: input.affiliatePageId,
    checkoutIntentId: input.checkoutIntentId,
    authorized: input.authorized === true,
    showInlineThankYou:
      input.authorized === true && input.showInlineThankYou === true,
    issuedAt: now,
  };
  return encryptSecret(JSON.stringify(payload), secret);
}

export function readDonorBrowserToken(
  token: string,
  secret: string,
  now = Date.now(),
): DonorBrowserToken | null {
  try {
    const payload = JSON.parse(decryptSecret(token, secret)) as Partial<DonorBrowserToken>;
    const maxAgeMs = DONOR_BROWSER_COOKIE_MAX_AGE * 1000;
    if (
      payload.version !== TOKEN_VERSION ||
      typeof payload.affiliatePageId !== "string" ||
      typeof payload.checkoutIntentId !== "string" ||
      typeof payload.authorized !== "boolean" ||
      typeof payload.showInlineThankYou !== "boolean" ||
      typeof payload.issuedAt !== "number" ||
      payload.issuedAt > now + 5 * 60 * 1000 ||
      now - payload.issuedAt > maxAgeMs
    ) {
      return null;
    }
    return payload as DonorBrowserToken;
  } catch {
    return null;
  }
}
