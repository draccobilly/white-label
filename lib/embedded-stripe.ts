import { isInstitutionalSiteMode } from "@/lib/site-mode";
import { stripeSecretMode } from "@/lib/checkout-links";

export const EMBEDDED_CHECKOUT_KIND = "embedded";
export const WALLET_CHECKOUT_KIND = "wallet";

export function usesEmbeddedStripeCheckout(company: {
  paymentGateway?: string | null;
  siteMode?: string | null;
}) {
  return (
    company.paymentGateway === "STRIPE" &&
    isInstitutionalSiteMode(company.siteMode)
  );
}

export function stripePublishableKey() {
  return (
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}

export function publishableKeyMode(key: string): "test" | "live" | null {
  if (key.startsWith("pk_live_")) return "live";
  if (key.startsWith("pk_test_")) return "test";
  return null;
}

export function embeddedCheckoutKeyError() {
  const publishable = stripePublishableKey();
  const secret = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!secret || !publishable) {
    return "Stripe embedded checkout needs STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY";
  }
  const secretMode = stripeSecretMode(secret);
  const publicMode = publishableKeyMode(publishable);
  if (!secretMode || secretMode !== publicMode) {
    return "Stripe publishable key must match the secret key mode (test or live)";
  }
  return null;
}

export function embeddedCheckoutReturnUrl(origin: string, affiliatePageId: string) {
  const base = origin.replace(/\/+$/, "");
  return `${base}/api/campaign-return?affiliate_page_id=${affiliatePageId}&session_id={CHECKOUT_SESSION_ID}`;
}

export function embeddedCheckoutMatchesIntent(input: {
  intentAmount: number;
  intentCurrency: string;
  sessionAmount: number | null;
  sessionCurrency: string | null;
  sessionPaymentLinkId: string | null;
  checkoutKind: string | null;
  pageActive: boolean;
  affiliateActive: boolean;
}) {
  return (
    (input.checkoutKind === EMBEDDED_CHECKOUT_KIND ||
      input.checkoutKind === WALLET_CHECKOUT_KIND) &&
    !input.sessionPaymentLinkId &&
    input.pageActive &&
    input.affiliateActive &&
    input.sessionAmount === input.intentAmount &&
    (input.sessionCurrency ?? "").toUpperCase() === input.intentCurrency.toUpperCase()
  );
}

export function walletPaymentMatchesIntent(input: {
  intentAmount: number;
  intentCurrency: string;
  paymentAmount: number;
  paymentCurrency: string;
  checkoutKind: string | null;
  pageActive: boolean;
  affiliateActive: boolean;
}) {
  return (
    input.checkoutKind === WALLET_CHECKOUT_KIND &&
    input.pageActive &&
    input.affiliateActive &&
    input.paymentAmount === input.intentAmount &&
    input.paymentCurrency.toUpperCase() === input.intentCurrency.toUpperCase()
  );
}
