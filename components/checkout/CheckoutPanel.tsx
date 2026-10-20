"use client";

import { Heart, LockKeyhole } from "lucide-react";
import { SocialProofCarousel } from "@/components/campaign/SocialProofCarousel";
import { formatMoney } from "@/lib/utils";
import { EmbeddedStripeCheckout } from "@/components/checkout/EmbeddedStripeCheckout";
import {
  useCheckoutPayment,
  type CheckoutOption,
  type CheckoutPaymentProps,
  type CheckoutRecentDonation,
} from "@/components/checkout/useCheckoutPayment";

type Props = CheckoutPaymentProps & {
  recentDonations?: CheckoutRecentDonation[];
  supporterCount?: number;
};

export function CheckoutPanel({
  recentDonations = [],
  supporterCount = 0,
  ...payment
}: Props) {
  const {
    messages,
    pagnovo,
    embedded,
    clientSecret,
    publishableKey,
    cardMountId,
    selectedId,
    setSelectedId,
    selected,
    loading,
    error,
    name,
    setName,
    email,
    setEmail,
    invalidField,
    method,
    setMethod,
    argentina,
    submit,
  } = useCheckoutPayment(payment);
  const { currency, locale = "en", options, cardAvailable } = payment;

  return (
    <div className="checkout-panel">
      <h2>{messages.checkout.chooseAmount}</h2>
      <div className="amount-grid">
        {options.map((option: CheckoutOption) => (
          <button
            type="button"
            className={`amount-button ${selectedId === option.id ? "selected" : ""}`}
            aria-pressed={selectedId === option.id}
            key={option.id}
            onClick={() => setSelectedId(option.id)}
          >
            {option.suggested && (
              <span className="suggested-badge">
                <Heart size={11} fill="currentColor" /> {messages.checkout.suggested}
              </span>
            )}
            {formatMoney(option.amount, currency, locale)}
          </button>
        ))}
      </div>

      <SocialProofCarousel
        donations={recentDonations}
        supporterCount={supporterCount}
      />

      {pagnovo ? (
        <form
          id="classic-pagnovo-form"
          className="pagnovo-fields"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label>
            {messages.checkout.nameLabel}
            <input
              className={`admin-input${invalidField === "name" ? " is-invalid" : ""}`}
              value={name}
              autoComplete="name"
              required
              minLength={2}
              aria-invalid={invalidField === "name"}
              placeholder={messages.checkout.namePlaceholder}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            {messages.checkout.emailLabel}
            <input
              className={`admin-input${invalidField === "email" ? " is-invalid" : ""}`}
              type="email"
              value={email}
              autoComplete="email"
              required
              aria-invalid={invalidField === "email"}
              placeholder={messages.checkout.emailPlaceholder}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <div className="pagnovo-tabs" role="tablist">
            {cardAvailable && !argentina ? (
              <button
                type="button"
                role="tab"
                aria-selected={method === "CREDIT_CARD"}
                className={`pagnovo-tab ${method === "CREDIT_CARD" ? "is-active" : ""}`}
                onClick={() => setMethod("CREDIT_CARD")}
              >
                {messages.checkout.cardTab}
              </button>
            ) : null}
            <button
              type="button"
              role="tab"
              aria-selected={method === (argentina ? "BANK_TRANSFER" : "SPEI")}
              className={`pagnovo-tab ${
                method === (argentina ? "BANK_TRANSFER" : "SPEI") ? "is-active" : ""
              }`}
              onClick={() => setMethod(argentina ? "BANK_TRANSFER" : "SPEI")}
            >
              {argentina
                ? messages.checkout.bankTransferTab
                : messages.checkout.speiTab}
            </button>
          </div>
          {argentina ? (
            <p className="admin-help">{messages.checkout.arsRailNotice}</p>
          ) : null}
          {method === "CREDIT_CARD" && cardAvailable ? (
            <div id={`pagnovo-card-${cardMountId}`} className="pagnovo-card-mount" />
          ) : null}
        </form>
      ) : null}

      {error && (
        <p role="alert" style={{ color: "#b42318", fontSize: ".88rem" }}>
          {error}
        </p>
      )}

      {embedded && clientSecret && publishableKey ? (
        <EmbeddedStripeCheckout
          publishableKey={publishableKey}
          clientSecret={clientSecret}
        />
      ) : null}

      {embedded && clientSecret ? null : (
      <button
        type={pagnovo ? "submit" : "button"}
        form={pagnovo ? "classic-pagnovo-form" : undefined}
        className="primary-button checkout-cta"
        onClick={pagnovo ? undefined : () => void submit()}
        disabled={loading || !selected}
      >
        {loading
          ? pagnovo || embedded
            ? messages.checkout.processing
            : messages.checkout.redirecting
          : pagnovo && method === "SPEI"
            ? messages.checkout.payWithSpei
            : pagnovo && method === "BANK_TRANSFER"
              ? messages.checkout.payWithTransfer
              : messages.checkout.donateNow(
                  selected ? formatMoney(selected.amount, currency, locale) : "",
                )}
      </button>
      )}

      <div className="trust-row">
        <LockKeyhole size={15} />
        {pagnovo
          ? argentina
            ? messages.payment.safePagnovoBank
            : messages.payment.safePagnovo
          : messages.payment.safeStripe}
      </div>
    </div>
  );
}
