"use client";

import { messagesFor } from "@/lib/i18n";

export function PaymentMethodBadges({
  gateway = "STRIPE",
  locale = "en",
  currency,
}: {
  gateway?: "STRIPE" | "PAGNOVO";
  locale?: string;
  currency?: string;
}) {
  const messages = messagesFor(locale);
  const pagnovo = gateway === "PAGNOVO";
  const argentina = currency === "ARS";
  const transferLabel = argentina
    ? messages.payment.bankTransfer
    : messages.payment.spei;
  const safeLabel = argentina
    ? messages.payment.safePagnovoBank
    : messages.payment.safePagnovo;
  return (
    <div className="payment-methods">
      <div className="payment-methods-head">
        <strong>
          {pagnovo ? safeLabel : messages.payment.safeStripe}
        </strong>
        {pagnovo ? (
          <span className="stripe-badge">{transferLabel}</span>
        ) : (
          <span className="stripe-badge">{messages.payment.poweredByStripe}</span>
        )}
      </div>
      <div className="payment-logos">
        <span className="pay-logo">VISA</span>
        <span className="pay-logo pay-logo--mc" aria-label="Mastercard">
          <i />
          <i />
        </span>
        {pagnovo ? (
          <span className="pay-logo">{transferLabel}</span>
        ) : (
          <>
            <span className="pay-logo">Amex</span>
            <span className="pay-logo">Discover</span>
            <span className="pay-logo">Apple Pay</span>
            <span className="pay-logo">Google Pay</span>
          </>
        )}
      </div>
    </div>
  );
}
