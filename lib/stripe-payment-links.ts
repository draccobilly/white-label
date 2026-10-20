import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  normalizePublicCheckoutUrl,
  normalizeStripeDestination,
  stripeCheckoutMode,
  stripeSecretMode,
} from "@/lib/checkout-links";
import { formatMoney } from "@/lib/utils";

export type StripePaymentLinkCache = {
  byNormalizedUrl?: Map<string, string>;
};

function normalizedLink(value: string) {
  const url = new URL(value);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${url.protocol}//${url.hostname.toLowerCase()}${path}`;
}

function amountLabel(amount: number, currency?: string) {
  return formatMoney(amount, currency ?? "USD");
}

function modeMismatchError(input: {
  amount: number;
  currency?: string;
  urlMode: "test" | "live";
  keyMode: "test" | "live";
}) {
  const label = amountLabel(input.amount, input.currency);
  if (input.urlMode === "live" && input.keyMode === "test") {
    return `${label} is a live Stripe Payment Link, but STRIPE_SECRET_KEY is a test key. Put the live sk_live_ key in .env, or paste a test link (buy.stripe.com/test/...).`;
  }
  return `${label} is a test Stripe Payment Link, but STRIPE_SECRET_KEY is a live key. Paste the live buy.stripe.com URL from that account.`;
}

async function paymentLinkIdsByUrl(stripe: Stripe, cache: StripePaymentLinkCache) {
  if (cache.byNormalizedUrl) return cache.byNormalizedUrl;
  const byNormalizedUrl = new Map<string, string>();
  let startingAfter: string | undefined;
  for (let page = 0; page < 40; page += 1) {
    const list = await stripe.paymentLinks.list({
      limit: 100,
      starting_after: startingAfter,
    });
    for (const item of list.data) {
      byNormalizedUrl.set(normalizedLink(item.url), item.id);
    }
    if (!list.has_more || list.data.length === 0) break;
    startingAfter = list.data.at(-1)?.id;
  }
  cache.byNormalizedUrl = byNormalizedUrl;
  return byNormalizedUrl;
}

export async function resolveStripePaymentLink(input: {
  publicUrl: string;
  stripeDestination: string;
  expectedAmount: number;
  currency?: string;
  cache?: StripePaymentLinkCache;
}) {
  const publicUrl = normalizePublicCheckoutUrl(input.publicUrl);
  const destination = normalizeStripeDestination(input.stripeDestination);
  let stripePaymentLinkId = destination.stripePaymentLinkId;
  let stripeCheckoutUrl = destination.stripeCheckoutUrl;
  const label = amountLabel(input.expectedAmount, input.currency);
  const cache = input.cache ?? {};
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  const keyMode = stripeSecretMode(secret);

  if (stripeCheckoutUrl && keyMode) {
    const urlMode = stripeCheckoutMode(stripeCheckoutUrl);
    if (urlMode !== keyMode) {
      throw new Error(
        modeMismatchError({
          amount: input.expectedAmount,
          currency: input.currency,
          urlMode,
          keyMode,
        }),
      );
    }
  }

  if (!secret) {
    if (!stripePaymentLinkId) {
      throw new Error(
        `${label}: paste the plink_ id from Stripe, or add STRIPE_SECRET_KEY so buy.stripe.com can be resolved.`,
      );
    }
    return { url: publicUrl, stripeCheckoutUrl, stripePaymentLinkId };
  }

  const stripe = getStripe();
  if (!stripePaymentLinkId && stripeCheckoutUrl) {
    const index = await paymentLinkIdsByUrl(stripe, cache);
    stripePaymentLinkId = index.get(normalizedLink(stripeCheckoutUrl)) ?? null;
  }
  if (!stripePaymentLinkId) {
    throw new Error(
      `${label}: that buy.stripe.com URL was not found in this Stripe account. Copy the plink_ id from the Payment Link in Stripe.`,
    );
  }

  const paymentLink = await stripe.paymentLinks.retrieve(stripePaymentLinkId);
  stripeCheckoutUrl = paymentLink.url;
  try {
    const items = await stripe.paymentLinks.listLineItems(stripePaymentLinkId, {
      limit: 1,
      expand: ["data.price"],
    });
    const price = items.data[0]?.price;
    const unitAmount = typeof price === "object" && price ? price.unit_amount : null;
    if (unitAmount != null && unitAmount !== input.expectedAmount) {
      throw new Error(
        `${label}: that Stripe Payment Link is for ${amountLabel(unitAmount, input.currency)}, not this amount.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("not this amount")) throw error;
  }
  return { url: publicUrl, stripeCheckoutUrl, stripePaymentLinkId };
}

export async function restoreStripeHostedConfirmation(stripePaymentLinkId: string) {
  if (!process.env.STRIPE_SECRET_KEY) return;
  await getStripe().paymentLinks.update(stripePaymentLinkId, {
    after_completion: {
      type: "hosted_confirmation",
    },
  });
}
