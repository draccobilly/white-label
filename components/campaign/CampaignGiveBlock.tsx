"use client";

import { Heart, ShieldCheck, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { LivingProgressBar } from "@/components/campaign/LivingProgressBar";
import { EmbeddedStripeCheckout } from "@/components/checkout/EmbeddedStripeCheckout";
import { PayPalPayButton } from "@/components/checkout/PayPalPayButton";
import { WalletPayButton } from "@/components/checkout/WalletPayButton";
import {
  useCheckoutPayment,
  type CheckoutOption,
  type CheckoutRecentDonation,
} from "@/components/checkout/useCheckoutPayment";
import { parseDonationInput, publicDonationTickets } from "@/lib/donation-ticket";

function MissionTipLabel({ label }: { label: string }) {
  const trimmed = label.trim();
  const cut = trimmed.lastIndexOf(" ");
  const lead = cut === -1 ? "" : `${trimmed.slice(0, cut)} `;
  const tail = cut === -1 ? trimmed : trimmed.slice(cut + 1);
  return (
    <span className="donate-mission-tip-copy">
      {lead}
      <span className="donate-tip-tail">
        {tail}
        <span className="donate-tip-heart" aria-hidden>
          <Heart size={16} fill="currentColor" />
        </span>
      </span>
    </span>
  );
}

function intlMoneyLocale(locale: string, currency?: string) {
  if (locale === "es-AR" || currency === "ARS") return "es-AR";
  if (locale === "es-MX" || currency === "MXN") return "es-MX";
  return "en-US";
}

function formatChipMoney(cents: number, currency: string, locale: string) {
  return new Intl.NumberFormat(intlMoneyLocale(locale, currency), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function currencyParts(currency: string, locale: string) {
  const parts = new Intl.NumberFormat(intlMoneyLocale(locale, currency), {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(0);
  const decimal =
    new Intl.NumberFormat(intlMoneyLocale(locale, currency), {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    })
      .formatToParts(1)
      .find((part) => part.type === "decimal")?.value ?? ".";
  return {
    symbol: parts.find((part) => part.type === "currency")?.value ?? "$",
    code: currency.toUpperCase(),
    centsSuffix: `${decimal}00`,
  };
}

function centsToField(cents: number) {
  if (!cents) return "";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

function hasDecimalInput(value: string) {
  return /[.,]/.test(value.trim());
}

export function CampaignGiveBlock({
  affiliatePageId,
  campaignPath,
  campaignTitle: _campaignTitle,
  currency,
  locale,
  options,
  showMissionTip = true,
  missionTipBold = false,
  percent,
  recentDonations: _recentDonations,
  googlePixelId,
  tiktokPixelId,
  publishableKey,
  paypalClientId = "",
  causeSlug,
}: {
  affiliatePageId: string;
  campaignPath: string;
  campaignTitle: string;
  currency: string;
  locale: string;
  options: CheckoutOption[];
  showMissionTip?: boolean;
  missionTipBold?: boolean;
  percent: number;
  recentDonations: CheckoutRecentDonation[];
  googlePixelId?: string | null;
  tiktokPixelId?: string | null;
  publishableKey: string;
  paypalClientId?: string;
  causeSlug?: string;
}) {
  const payment = useCheckoutPayment({
    affiliatePageId,
    campaignPath,
    currency,
    locale,
    options,
    embeddedCheckout: true,
    googlePixelId,
    tiktokPixelId,
    causeSlug,
  });
  const {
    messages,
    selectedId,
    setSelectedId,
    loading,
    error,
    clientSecret,
    publishableKey: sessionKey,
    submit,
    clearSession,
  } = payment;
  const tickets = useMemo(
    () => publicDonationTickets(currency, options),
    [currency, options],
  );
  const suggested = tickets.find((item) => item.suggested) ?? tickets[0];
  const [customRaw, setCustomRaw] = useState(() =>
    suggested ? centsToField(suggested.amount) : "",
  );
  const [customOn, setCustomOn] = useState(false);
  const [missionTipOn, setMissionTipOn] = useState(false);
  const [messageOn, setMessageOn] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const messageFieldId = useId();
  const [mounted, setMounted] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const tipOn = showMissionTip && missionTipOn;
  const tipCents = tipOn ? 500 : 0;
  const typedTotal = customOn ? parseDonationInput(customRaw, currency) : null;
  const customBase =
    typedTotal == null ? null : Math.max(0, typedTotal - tipCents);
  const activeOption = customOn
    ? customBase
      ? options.find((item) => item.amount === customBase) ?? {
          id: `amt-${customBase}`,
          amount: customBase,
          suggested: false,
          paymentLinkId: null,
        }
      : null
    : tickets.find((item) => item.id === selectedId) ?? suggested ?? null;
  const donationCents = activeOption?.amount ?? 0;
  const totalCents = donationCents + tipCents;
  const moneyParts = currencyParts(currency, locale);
  const fieldValue = customOn ? customRaw : centsToField(totalCents);
  const amountLabel = formatChipMoney(totalCents, currency, locale);
  const donationComment = messageOn ? messageDraft.trim() || null : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  function selectOption(id: string) {
    const ticket = tickets.find((item) => item.id === id);
    if (!ticket) return;
    setCustomOn(false);
    setSelectedId(id);
    setCustomRaw(centsToField(ticket.amount));
  }

  function startCardPay() {
    if (!activeOption || loading) return;
    setPayOpen(true);
    void submit(activeOption, { tipCents, comment: donationComment });
  }

  function closePay() {
    setPayOpen(false);
    clearSession();
  }

  function setTip(next: boolean) {
    if (customOn) {
      const typed = parseDonationInput(customRaw, currency);
      if (typed != null) {
        const base = missionTipOn ? Math.max(0, typed - 500) : typed;
        setCustomRaw(centsToField(next ? base + 500 : base));
      }
    }
    setMissionTipOn(next);
    if (payOpen && activeOption) {
      void submit(activeOption, {
        tipCents: next ? 500 : 0,
        comment: messageOn ? messageDraft.trim() || null : null,
      });
    }
  }

  return (
    <section className="campaign-give" id="give">
      <LivingProgressBar percent={percent} tone="lime" />

      <div className="impact-donate-amounts" role="group" aria-label={messages.checkout.chooseAmount}>
        {tickets.map((option) => (
          <button
            type="button"
            key={option.id}
            className={`impact-donate-amount ${!customOn && selectedId === option.id ? "is-selected" : ""}`}
            aria-pressed={!customOn && selectedId === option.id}
            onClick={() => selectOption(option.id)}
          >
            <span className="impact-donate-amount-value">
              {formatChipMoney(option.amount, currency, locale)}
            </span>
            {option.suggested ? (
              <span className="impact-donate-suggested">
                <Heart size={10} fill="currentColor" aria-hidden />
                {messages.checkout.suggested}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <p className="campaign-give-enter">{messages.checkout.enterDonation}</p>
      <label className={`impact-donate-custom donate-amount-box ${customOn ? "is-selected" : ""}`}>
        <span className="donate-amount-mark">
          <span className="donate-amount-symbol" aria-hidden>
            {moneyParts.symbol}
          </span>
          <span className="donate-amount-code">{moneyParts.code}</span>
        </span>
        <span className="donate-amount-figure">
          <input
            className="donate-amount-input"
            inputMode="decimal"
            value={fieldValue}
            placeholder="0"
            aria-label={messages.checkout.customAmount}
            onFocus={() => {
              if (!customOn) setCustomRaw(centsToField(donationCents + tipCents));
              setCustomOn(true);
            }}
            onChange={(event) => {
              setCustomOn(true);
              setCustomRaw(event.target.value);
            }}
          />
          {!hasDecimalInput(fieldValue) ? (
            <span className={`donate-amount-cents${fieldValue.trim() ? "" : " is-muted"}`} aria-hidden>
              {moneyParts.centsSuffix}
            </span>
          ) : null}
        </span>
      </label>

      {showMissionTip ? (
        <label className={`donate-mission-tip${missionTipBold ? " is-bold" : ""}`}>
          <input
            type="checkbox"
            checked={missionTipOn}
            onChange={(event) => setTip(event.target.checked)}
          />
          <MissionTipLabel label={messages.checkout.missionTip} />
        </label>
      ) : null}

      <label className="campaign-give-message" htmlFor={messageFieldId}>
        <input
          id={messageFieldId}
          type="checkbox"
          checked={messageOn}
          onChange={(event) => setMessageOn(event.target.checked)}
        />
        <span>{messages.checkout.warmMessageHeading}</span>
      </label>
      {messageOn ? (
        <textarea
          className="campaign-give-message-input"
          value={messageDraft}
          maxLength={280}
          rows={3}
          placeholder={messages.checkout.warmMessagePlaceholder}
          aria-label={messages.checkout.warmMessageHeading}
          onChange={(event) => setMessageDraft(event.target.value)}
        />
      ) : null}

      {error ? (
        <p className="impact-donate-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="campaign-give-cta"
        disabled={loading || !activeOption}
        onClick={startCardPay}
      >
        {loading && !payOpen
          ? messages.checkout.processing
          : messages.checkout.donateNow(amountLabel)}
      </button>

      {publishableKey && !payOpen ? (
        <WalletPayButton
          affiliatePageId={affiliatePageId}
          donationOptionId={/^[0-9a-f-]{36}$/i.test(activeOption?.id ?? "") ? activeOption?.id : undefined}
          donationCents={donationCents}
          tipCents={tipCents}
          currency={currency}
          campaignTitle={messages.checkout.lineItemName}
          publishableKey={publishableKey}
          appleLabel={messages.checkout.donateWithApplePay}
          googleLabel={messages.checkout.donateWithGooglePay}
          comment={donationComment}
          disabled={loading || !activeOption}
          onError={payment.setError}
          onPaid={() => window.location.assign(campaignPath)}
          causeSlug={causeSlug}
        />
      ) : null}

      {paypalClientId ? (
        <PayPalPayButton
          affiliatePageId={affiliatePageId}
          campaignPath={campaignPath}
          clientId={paypalClientId}
          currency={currency}
          locale={locale}
          donationOptionId={/^[0-9a-f-]{36}$/i.test(activeOption?.id ?? "") ? activeOption?.id : undefined}
          donationCents={donationCents}
          tipCents={tipCents}
          comment={donationComment}
          googlePixelId={googlePixelId}
          tiktokPixelId={tiktokPixelId}
          disabled={loading || !activeOption}
          hidden={payOpen}
          causeSlug={causeSlug}
          onError={payment.setError}
        />
      ) : null}

      {mounted && payOpen
        ? createPortal(
            <StripePayModal
              campaignTitle={messages.checkout.lineItemName}
              clientSecret={clientSecret}
              publishableKey={sessionKey}
              showMissionTip={showMissionTip}
              missionTipBold={missionTipBold}
              missionTipOn={tipOn}
              missionTipLabel={messages.checkout.missionTip}
              protectedLabel={messages.campaign.protectedGift}
              closeLabel={messages.nav.closeMenu}
              paymentLabel={messages.checkout.paymentMethod}
              onTipChange={setTip}
              onClose={closePay}
            />,
            document.body,
          )
        : null}
    </section>
  );
}

function StripePayModal({
  campaignTitle,
  clientSecret,
  publishableKey,
  showMissionTip,
  missionTipBold,
  missionTipOn,
  missionTipLabel,
  protectedLabel,
  closeLabel,
  paymentLabel,
  onTipChange,
  onClose,
}: {
  campaignTitle: string;
  clientSecret: string | null;
  publishableKey: string | null;
  showMissionTip: boolean;
  missionTipBold: boolean;
  missionTipOn: boolean;
  missionTipLabel: string;
  protectedLabel: string;
  closeLabel: string;
  paymentLabel: string;
  onTipChange: (next: boolean) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const scrollY = window.scrollY;
    const { body, documentElement } = document;
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      htmlOverflow: documentElement.style.overflow,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    documentElement.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      documentElement.style.overflow = previous.htmlOverflow;
      window.removeEventListener("keydown", onKey);
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  return (
    <div className="stripe-pay-layer" role="dialog" aria-modal="true" aria-label={paymentLabel}>
      <button type="button" className="stripe-pay-backdrop" aria-label={closeLabel} onClick={onClose} />
      <div className="stripe-pay-modal">
        <button type="button" className="stripe-pay-close" onClick={onClose}>
          <X size={18} strokeWidth={2.2} aria-hidden />
          <span className="sr-only">{closeLabel}</span>
        </button>
        <header className="stripe-pay-head">
          <p>
            <ShieldCheck size={16} strokeWidth={2.2} aria-hidden />
            {protectedLabel}
          </p>
          <strong>{campaignTitle}</strong>
        </header>
        {showMissionTip ? (
          <label className={`donate-mission-tip stripe-pay-tip${missionTipBold ? " is-bold" : ""}`}>
            <input
              type="checkbox"
              checked={missionTipOn}
              onChange={(event) => onTipChange(event.target.checked)}
            />
            <MissionTipLabel label={missionTipLabel} />
          </label>
        ) : null}
        <div className="stripe-pay-body">
          {clientSecret && publishableKey ? (
            <EmbeddedStripeCheckout key={clientSecret} publishableKey={publishableKey} clientSecret={clientSecret} />
          ) : (
            <div className="stripe-pay-skeleton" aria-busy="true" aria-live="polite">
              <span className="stripe-pay-spinner" aria-hidden />
              <span>{paymentLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
