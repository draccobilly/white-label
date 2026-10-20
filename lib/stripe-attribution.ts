export function validateStripeAttribution(input: {
  expectedPaymentLinkId: string | null;
  receivedPaymentLinkId: string | null;
  expectedAmount: number;
  receivedAmount: number | null;
  expectedCurrency: string;
  receivedCurrency: string | null;
}) {
  const amountMatches = input.receivedAmount === input.expectedAmount;
  const currencyMatches =
    input.receivedCurrency?.toUpperCase() === input.expectedCurrency.toUpperCase();
  const linkMatches =
    Boolean(input.expectedPaymentLinkId) &&
    input.receivedPaymentLinkId === input.expectedPaymentLinkId;
  return {
    ok: amountMatches && currencyMatches && linkMatches,
    amountMatches,
    currencyMatches,
    linkMatches,
  };
}

export type PaymentLinkOwnerMatch = {
  stripePaymentLinkId: string;
  amount: number;
  currency: string;
  affiliatePageId: string;
};

export type PaymentLinkAttribution =
  | { ok: true; owner: PaymentLinkOwnerMatch }
  | {
      ok: false;
      reason:
        | "missing_payment_link"
        | "unknown_payment_link"
        | "duplicate_payment_link"
        | "amount_mismatch"
        | "currency_mismatch";
    };

export function attributeByStripePaymentLink(input: {
  receivedPaymentLinkId: string | null;
  receivedAmount: number | null;
  receivedCurrency: string | null;
  owners: PaymentLinkOwnerMatch[];
}): PaymentLinkAttribution {
  if (!input.receivedPaymentLinkId) {
    return { ok: false, reason: "missing_payment_link" };
  }
  if (input.owners.length === 0) {
    return { ok: false, reason: "unknown_payment_link" };
  }
  if (input.owners.length > 1) {
    return { ok: false, reason: "duplicate_payment_link" };
  }
  const owner = input.owners[0];
  const check = validateStripeAttribution({
    expectedPaymentLinkId: owner.stripePaymentLinkId,
    receivedPaymentLinkId: input.receivedPaymentLinkId,
    expectedAmount: owner.amount,
    receivedAmount: input.receivedAmount,
    expectedCurrency: owner.currency,
    receivedCurrency: input.receivedCurrency,
  });
  if (!check.amountMatches) return { ok: false, reason: "amount_mismatch" };
  if (!check.currencyMatches) return { ok: false, reason: "currency_mismatch" };
  if (!check.linkMatches) return { ok: false, reason: "unknown_payment_link" };
  return { ok: true, owner };
}

/**
 * Unique plink wins. The same buy.stripe.com may be pasted on every Direct Team
 * campaign; then the owner is only the checkout page in preferredAffiliatePageId
 * (from /c/{campaign}/direct-team), never an arbitrary page that shares the link.
 */
export function chooseStripePaymentLinkOwner(input: {
  receivedPaymentLinkId: string | null;
  receivedAmount: number | null;
  receivedCurrency: string | null;
  owners: PaymentLinkOwnerMatch[];
  preferredAffiliatePageId?: string | null;
}): PaymentLinkAttribution {
  const unique = attributeByStripePaymentLink(input);
  if (unique.ok) return unique;
  if (unique.reason === "amount_mismatch" && input.owners.length === 1) {
    return { ok: true, owner: input.owners[0] };
  }
  if (unique.reason !== "duplicate_payment_link") return unique;

  const currency = (input.receivedCurrency ?? "").toUpperCase();
  const amountMatches = input.owners.filter(
    (owner) =>
      owner.stripePaymentLinkId === input.receivedPaymentLinkId &&
      owner.currency.toUpperCase() === currency &&
      (input.receivedAmount == null || owner.amount === input.receivedAmount),
  );
  const currencyMatches = input.owners.filter(
    (owner) =>
      owner.stripePaymentLinkId === input.receivedPaymentLinkId &&
      owner.currency.toUpperCase() === currency,
  );
  const pool = amountMatches.length
    ? amountMatches
    : currencyMatches.length
      ? currencyMatches
      : input.owners.filter(
          (owner) => owner.stripePaymentLinkId === input.receivedPaymentLinkId,
        );
  if (pool.length === 0) return { ok: false, reason: "unknown_payment_link" };

  const preferred = input.preferredAffiliatePageId
    ? pool.find((owner) => owner.affiliatePageId === input.preferredAffiliatePageId)
    : null;
  if (!preferred) {
    return { ok: false, reason: "duplicate_payment_link" };
  }
  return { ok: true, owner: preferred };
}

export function intentBelongsToPaymentLinkOwner(input: {
  intentAffiliatePageId: string | null;
  ownerAffiliatePageId: string;
}) {
  return input.intentAffiliatePageId === input.ownerAffiliatePageId;
}

export function canReusePendingCheckoutIntent(input: {
  hasSale: boolean;
  expired: boolean;
  intentAffiliatePageId: string;
  ownerAffiliatePageId: string;
  intentPaymentLinkId: string;
  ownerPaymentLinkId: string;
}) {
  return (
    !input.hasSale &&
    !input.expired &&
    input.intentAffiliatePageId === input.ownerAffiliatePageId &&
    input.intentPaymentLinkId === input.ownerPaymentLinkId
  );
}

export function calculateRefundTransition(input: {
  saleAmount: number;
  previousRefunded: number;
  reportedRefunded: number;
}) {
  const refunded = Math.min(
    input.saleAmount,
    Math.max(0, input.reportedRefunded),
  );
  return {
    refunded,
    delta: Math.max(0, refunded - input.previousRefunded),
    fullyRefunded: refunded >= input.saleAmount,
  };
}
