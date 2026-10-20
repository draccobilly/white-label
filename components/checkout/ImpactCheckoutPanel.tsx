"use client";

import { Check, CreditCard, HandHeart, Heart, Info, ShieldCheck, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { splitCheckoutCharge } from "@/lib/checkout-tip";
import { parseDonationInput, publicDonationTickets } from "@/lib/donation-ticket";
import { isAnonymousDonorName } from "@/lib/social-proof";
import { EmbeddedStripeCheckout } from "@/components/checkout/EmbeddedStripeCheckout";
import { PayPalPayButton } from "@/components/checkout/PayPalPayButton";
import { ImpactCheckoutHeart } from "@/components/checkout/ImpactCheckoutHeart";
import { ImpactProgressRing } from "@/components/campaign/ImpactProgressRing";
import { StageGoal } from "@/components/campaign/StageGoal";
import {
  useCheckoutPayment,
  type CheckoutPaymentProps,
  type CheckoutRecentDonation,
} from "@/components/checkout/useCheckoutPayment";
import {
  clearPendingComment,
  readPendingComment,
  savePendingComment,
} from "@/lib/pending-comment";
import type { Messages } from "@/lib/i18n/types";

const WARM_MESSAGE_MAX = 280;
const TIP_BRAND = "GoFundMe";

function ImpactRecentTicker({
  items,
}: {
  items: Array<{ id: string; label: string }>;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (!items.length) return null;
  const item = items[index] ?? items[0];

  return (
    <div className="impact-donate-ticker" aria-live="polite">
      <div key={`${item.id}-${index}`} className="impact-donate-ticker-item">
        <HandHeart size={18} strokeWidth={1.6} aria-hidden />
        <span>{item.label}</span>
      </div>
    </div>
  );
}

type Props = CheckoutPaymentProps & {
  showMissionTip?: boolean;
  missionTipBold?: boolean;
  recentDonations?: CheckoutRecentDonation[];
  siteName: string;
  termsHref: string;
  privacyHref: string;
  refundHref: string;
  sticky?: {
    percent: number;
    raised: string;
    raisedSuffix: string;
    ofLabel: string;
    goal: string;
    stageCompletedLabel?: string | null;
    socialProof: string;
    proofHref: string;
    showYou?: boolean;
  };
};

function intlMoneyLocale(locale: string, currency?: string) {
  if (locale === "es-AR" || currency === "ARS") return "es-AR";
  if (locale === "es-MX" || currency === "MXN") return "es-MX";
  return "en-US";
}

function withBrand(template: string, brand: string) {
  return template.replaceAll("{brand}", brand);
}

function formatExact(cents: number, currency: string, locale: string) {
  return new Intl.NumberFormat(intlMoneyLocale(locale, currency), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
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

function WarmMessageBlock({
  messages,
  enabled,
  posted,
  editing,
  onEnabledChange,
  onEdit,
  draft,
  onDraftChange,
  onPost,
  toast,
}: {
  messages: Messages;
  enabled: boolean;
  posted: boolean;
  editing: boolean;
  onEnabledChange: (value: boolean) => void;
  onEdit: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onPost: () => void;
  toast: string | null;
}) {
  const headingId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const showCompose = enabled && (!posted || editing);

  useEffect(() => {
    if (!showCompose) return;
    textareaRef.current?.focus();
  }, [showCompose]);
  return (
    <section
      className={`impact-donate-message${posted && !editing ? " is-posted" : ""}`}
      aria-labelledby={headingId}
    >
      <label
        className={`impact-donate-message-toggle${posted ? " is-posted" : ""}`}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
        />
        <span className="impact-donate-message-tick" aria-hidden>
          {enabled ? <Check size={13} strokeWidth={3.2} /> : null}
        </span>
        <span id={headingId}>{messages.checkout.warmMessageHeading}</span>
      </label>
      {showCompose ? (
        <div className="impact-donate-message-compose">
          <textarea
            className="impact-donate-message-input"
            value={draft}
            maxLength={WARM_MESSAGE_MAX}
            rows={4}
            placeholder={messages.checkout.warmMessagePlaceholder}
            onChange={(event) => onDraftChange(event.target.value)}
            ref={textareaRef}
          />
          <button
            type="button"
            className="impact-donate-message-post"
            onClick={onPost}
            disabled={!draft.trim()}
          >
            {messages.checkout.warmMessagePost}
          </button>
        </div>
      ) : null}
      {enabled && posted && !editing ? (
        <button
          type="button"
          className="impact-donate-message-edit"
          onClick={onEdit}
        >
          {messages.checkout.warmMessageEdit}
        </button>
      ) : null}
      {toast ? (
        <p className="impact-donate-toast" role="status">
          {toast}
        </p>
      ) : null}
    </section>
  );
}

export function ImpactCheckoutPanel({
  showMissionTip = true,
  missionTipBold = false,
  recentDonations = [],
  termsHref,
  privacyHref,
  refundHref,
  sticky,
  paypalClientId = "",
  ...payment
}: Props & { paypalClientId?: string }) {
  const checkout = useCheckoutPayment(payment);
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
    setError,
    name,
    setName,
    email,
    setEmail,
    invalidField,
    method,
    setMethod,
    argentina,
    submit,
    clearSession,
  } = checkout;
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { currency, locale = "en", options } = payment;
  const tickets = publicDonationTickets(currency, options);
  const [customRaw, setCustomRaw] = useState("");
  const [customOn, setCustomOn] = useState(false);
  const [hideName, setHideName] = useState(false);
  const [missionTipOn, setMissionTipOn] = useState(false);
  const [messageEnabled, setMessageEnabled] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [postedMessage, setPostedMessage] = useState("");
  const [messageEditing, setMessageEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const tickerItems = recentDonations.map((donation) => ({
    id: donation.id,
    label: messages.checkout.recentDonor(
      isAnonymousDonorName(donation.name)
        ? messages.campaign.anonymous
        : donation.name,
      formatChipMoney(donation.amount, donation.currency, locale),
    ),
  }));
  const customCents = customOn ? parseDonationInput(customRaw, currency) : null;
  const activeOption = customOn
    ? customCents
      ? options.find((item) => item.amount === customCents) ?? {
          id: `amt-${customCents}`,
          amount: customCents,
          suggested: false,
          paymentLinkId: null,
        }
      : null
    : tickets.find((item) => item.id === selectedId) ??
      tickets[0] ??
      selected;
  const donationCents = activeOption?.amount ?? 0;
  const tipOn = showMissionTip && missionTipOn;
  const missionTipCents = embedded && tipOn ? 500 : 0;
  const baseTotals = splitCheckoutCharge(donationCents, 0);
  const totals = {
    ...baseTotals,
    tipAmount: missionTipCents,
    chargeAmount: baseTotals.donationAmount + missionTipCents,
  };
  const moneyParts = currencyParts(currency, locale);

  useEffect(() => {
    const draft = readPendingComment(payment.affiliatePageId);
    if (!draft?.body) return;
    setMessageEnabled(true);
    setMessageDraft(draft.body);
    setPostedMessage(draft.body);
    setMessageEditing(false);
  }, [payment.affiliatePageId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function selectOption(id: string) {
    const ticket = tickets.find((item) => item.id === id) ?? options.find((item) => item.id === id);
    if (!ticket) return;
    setCustomOn(false);
    setSelectedId(id);
    setCustomRaw(centsToField(ticket.amount));
  }

  function postedComment() {
    if (!messageEnabled) return null;
    return postedMessage.trim() || null;
  }

  const [payStarted, setPayStarted] = useState(false);
  const embedKey = useRef("");

  function donate() {
    if (!activeOption) return;
    void (async () => {
      const invalid = await submit(activeOption, {
        hideName,
        comment: postedComment(),
        tipCents: embedded && tipOn ? 500 : 0,
      });
      if (invalid === "name") {
        nameRef.current?.focus();
        nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      } else if (invalid === "email") {
        emailRef.current?.focus();
        emailRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    })();
  }

  function checkoutKey() {
    if (!activeOption) return "";
    return `${activeOption.amount}:${hideName}:${postedMessage}:${tipOn}`;
  }

  function startStripePay() {
    if (!activeOption || loading) return;
    const key = checkoutKey();
    embedKey.current = key;
    setPayStarted(true);
    donate();
  }

  useEffect(() => {
    if (!embedded || !payStarted || !activeOption) return;
    const key = `${activeOption.amount}:${hideName}:${postedMessage}:${tipOn}`;
    if (embedKey.current === key) return;
    embedKey.current = key;
    const timer = window.setTimeout(() => donate(), 300);
    return () => window.clearTimeout(timer);
  }, [embedded, payStarted, activeOption?.amount, hideName, postedMessage, tipOn]);

  const showCard = pagnovo && payment.cardAvailable && !argentina;
  const showSpei = pagnovo && !argentina;
  const showBankTransfer = pagnovo && argentina;
  const amountLabel = formatChipMoney(donationCents, currency, locale);
  const donateAmountLabel = messages.checkout.donateNow(amountLabel);
  const ctaLabel = loading
    ? pagnovo || embedded
      ? messages.checkout.processing
      : messages.checkout.redirecting
    : pagnovo && method === "SPEI"
      ? messages.checkout.payWithSpei
      : pagnovo && method === "BANK_TRANSFER"
        ? messages.checkout.payWithTransfer
      : donateAmountLabel;

  const messageBlock = (
    <WarmMessageBlock
      messages={messages}
      enabled={messageEnabled}
      posted={Boolean(postedMessage.trim())}
      editing={messageEditing}
      onEnabledChange={(value) => {
        setMessageEnabled(value);
        if (!value) {
          setMessageDraft("");
          setPostedMessage("");
          setMessageEditing(false);
          clearPendingComment(payment.affiliatePageId);
          return;
        }
        setMessageEditing(true);
      }}
      onEdit={() => setMessageEditing(true)}
      draft={messageDraft}
      onDraftChange={setMessageDraft}
      onPost={() => {
        const next = messageDraft.trim();
        if (!next) return;
        setPostedMessage(next);
        setMessageDraft(next);
        setMessageEditing(false);
        savePendingComment(payment.affiliatePageId, next, name);
        setToast(messages.checkout.warmMessageUploaded);
      }}
      toast={toast}
    />
  );

  return (
    <div className="impact-donate-panel">
      <h2 className="sr-only">{messages.checkout.chooseAmount}</h2>

      <div className="impact-donate-frequency-block">
        <p className="impact-donate-frequency" role="status">
          <span>{messages.checkout.oneTime}</span>
          <ImpactCheckoutHeart />
        </p>
        <p className="impact-donate-kindness">
          <span className="impact-donate-kindness-text">
            {messages.checkout.kindnessLine}
          </span>
          <svg
            className="impact-donate-kindness-arrow"
            viewBox="0 0 24 24"
            width={20}
            height={20}
            fill="none"
            aria-hidden
          >
            <path
              d="M21.048 12.8102L19.478 6.57021C19.4283 6.37774 19.3053 6.21238 19.1352 6.10957C18.9651 6.00676 18.7614 5.97468 18.568 6.02021L12.328 7.60021C12.1357 7.6559 11.9734 7.7857 11.8768 7.96105C11.7802 8.13639 11.7573 8.34293 11.813 8.53521C11.8687 8.72749 11.9985 8.88977 12.1738 8.98635C12.3492 9.08293 12.5557 9.1059 12.748 9.05021L17.168 7.94021C15.748 10.5902 11.518 17.1302 3.57797 19.0202C3.39912 19.0624 3.24198 19.1687 3.13634 19.319C3.0307 19.4694 2.98393 19.6533 3.0049 19.8358C3.02587 20.0183 3.11312 20.1868 3.25009 20.3093C3.38706 20.4318 3.56423 20.4997 3.74797 20.5002H3.91797C12.538 18.4502 16.918 11.5502 18.458 8.66021L19.598 13.1902C19.6398 13.3524 19.7341 13.4962 19.8661 13.5993C19.9981 13.7023 20.1605 13.7589 20.328 13.7602H20.508C20.6082 13.7374 20.7026 13.694 20.7852 13.6327C20.8677 13.5715 20.9366 13.4936 20.9874 13.4043C21.0382 13.3149 21.0698 13.2159 21.0803 13.1136C21.0907 13.0113 21.0797 12.908 21.048 12.8102Z"
              fill="#02A95C"
            />
          </svg>
        </p>
      </div>

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
            value={customOn ? customRaw : centsToField(donationCents)}
            placeholder="0"
            aria-label={messages.checkout.customAmount}
            onFocus={() => setCustomOn(true)}
            onChange={(event) => {
              setCustomOn(true);
              setCustomRaw(event.target.value);
            }}
          />
          {!hasDecimalInput(customOn ? customRaw : centsToField(donationCents)) ? (
            <span
              className={`donate-amount-cents${(customOn ? customRaw : centsToField(donationCents)).trim() ? "" : " is-muted"}`}
              aria-hidden
            >
              {moneyParts.centsSuffix}
            </span>
          ) : null}
        </span>
      </label>

      <ImpactRecentTicker items={tickerItems} />

      {!pagnovo ? (
        <div className="donate-mission">
          <p className="donate-mission-note">{messages.checkout.beneficiaryNote}</p>
          {showMissionTip ? (
          <label className={`donate-mission-tip${missionTipBold ? " is-bold" : ""}`}>
            <input
              type="checkbox"
              checked={missionTipOn}
              onChange={(event) => setMissionTipOn(event.target.checked)}
            />
            <span className="glass-mission-pray" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                <path
                  d="M12 21c-1.2-2.2-4.2-4.4-6.2-6.6C4.2 12.6 3.5 11 4.2 9.4 5 7.6 7 7.2 8.4 8.4L12 11.6l3.6-3.2c1.4-1.2 3.4-.8 4.2 1 0.7 1.6 0 3.2-1.6 5C16.2 16.6 13.2 18.8 12 21Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 4.2c.4-1.2 1.6-2 2.6-1.4.8.4 1 1.4.6 2.2L12 8.2 8.8 5c-.4-.8-.2-1.8.6-2.2 1-.6 2.2.2 2.6 1.4Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>{messages.checkout.missionTip}</span>
          </label>
          ) : null}
        </div>
      ) : null}

      {pagnovo ? (
        <section className="impact-donate-pay" aria-labelledby="impact-donate-pay-heading">
          <h3 id="impact-donate-pay-heading">{messages.checkout.paymentMethod}</h3>
          <div className="impact-donate-methods">
            {showCard ? (
              <div className={`impact-donate-method ${method === "CREDIT_CARD" ? "is-selected" : ""}`}>
                <button
                  type="button"
                  className="impact-donate-method-row"
                  aria-pressed={method === "CREDIT_CARD"}
                  onClick={() => setMethod("CREDIT_CARD")}
                >
                  <span className="impact-donate-radio" aria-hidden />
                  <CreditCard size={18} strokeWidth={1.7} aria-hidden />
                  <span>{messages.checkout.creditDebit}</span>
                </button>
                {method === "CREDIT_CARD" ? (
                  <div className="impact-donate-method-fields">
                    <div
                      id={`pagnovo-card-${cardMountId}`}
                      className="pagnovo-card-mount impact-donate-card-mount"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {showBankTransfer ? (
              <div className={`impact-donate-method ${method === "BANK_TRANSFER" ? "is-selected" : ""}`}>
                <button
                  type="button"
                  className="impact-donate-method-row"
                  aria-pressed={method === "BANK_TRANSFER"}
                  onClick={() => setMethod("BANK_TRANSFER")}
                >
                  <span className="impact-donate-radio" aria-hidden />
                  <span>{messages.checkout.bankTransferTab}</span>
                </button>
                <p className="impact-donate-fixed-note">
                  {messages.checkout.arsRailNotice}
                </p>
              </div>
            ) : null}

            {showSpei ? (
              <div className={`impact-donate-method ${method === "SPEI" ? "is-selected" : ""}`}>
                <button
                  type="button"
                  className="impact-donate-method-row"
                  aria-pressed={method === "SPEI"}
                  onClick={() => setMethod("SPEI")}
                >
                  <span className="impact-donate-radio" aria-hidden />
                  <span>{messages.checkout.speiTab}</span>
                </button>
              </div>
            ) : null}

            <form
              ref={formRef}
              id="impact-donate-form"
              className="impact-donate-method-fields impact-donate-donor"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                donate();
              }}
            >
              <label>
                <span className="sr-only">{messages.checkout.nameLabel}</span>
                <input
                  ref={nameRef}
                  id="impact-donate-name"
                  className={`impact-donate-input${invalidField === "name" ? " is-invalid" : ""}`}
                  value={name}
                  autoComplete="name"
                  required
                  minLength={2}
                  aria-invalid={invalidField === "name"}
                  aria-describedby={invalidField === "name" ? "impact-donate-error" : undefined}
                  placeholder={messages.checkout.nameLabel}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                <span className="sr-only">{messages.checkout.emailAddress}</span>
                <input
                  ref={emailRef}
                  id="impact-donate-email"
                  className={`impact-donate-input${invalidField === "email" ? " is-invalid" : ""}`}
                  type="email"
                  value={email}
                  autoComplete="email"
                  required
                  aria-invalid={invalidField === "email"}
                  aria-describedby={invalidField === "email" ? "impact-donate-error" : undefined}
                  placeholder={messages.checkout.emailAddress}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            </form>
          </div>
        </section>
      ) : null}

      {messageBlock}

      {error ? (
        <p className="impact-donate-error" id="impact-donate-error" role="alert">
          {error}
        </p>
      ) : null}

      <label className="impact-donate-check">
        <input
          type="checkbox"
          checked={hideName}
          onChange={(event) => setHideName(event.target.checked)}
        />
        <span>{messages.checkout.hideNameLabel}</span>
        <span
          className="impact-donate-check-info"
          title={messages.checkout.hideNameHelp}
        >
          <Info size={16} strokeWidth={1.8} aria-hidden />
          <span className="sr-only">{messages.checkout.hideNameHelp}</span>
        </span>
      </label>

      <section className="impact-donate-summary" aria-labelledby="impact-donate-summary-heading">
        <h3 id="impact-donate-summary-heading">{messages.checkout.summaryTitle}</h3>
        <div className="impact-donate-summary-row">
          <span>{messages.checkout.summaryDonation}</span>
          <span>{formatExact(totals.donationAmount, currency, locale)}</span>
        </div>
        {totals.tipAmount > 0 ? (
          <div className="impact-donate-summary-row">
            <span>{withBrand(messages.checkout.summaryTip, embedded ? "the Church" : TIP_BRAND)}</span>
            <span>{formatExact(totals.tipAmount, currency, locale)}</span>
          </div>
        ) : null}
        <div className="impact-donate-summary-row is-total">
          <span>{messages.checkout.summaryTotal}</span>
          <strong>{formatExact(totals.chargeAmount, currency, locale)}</strong>
        </div>
      </section>

      {embedded ? (
        <div className="impact-donate-cta-wrap" id="impact-donate-cta">
          {clientSecret && publishableKey ? (
            <div className="stripe-pay-layer" role="dialog" aria-modal="true" aria-label={messages.checkout.paymentMethod}>
              <button type="button" className="stripe-pay-backdrop" aria-label={messages.nav.closeMenu} onClick={clearSession} />
              <div className="stripe-pay-modal">
                <button type="button" className="stripe-pay-close" onClick={clearSession}>
                  <X size={18} strokeWidth={2.2} aria-hidden />
                  <span className="sr-only">{messages.nav.closeMenu}</span>
                </button>
                <EmbeddedStripeCheckout
                  publishableKey={publishableKey}
                  clientSecret={clientSecret}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="impact-donate-cta"
              onClick={startStripePay}
              disabled={loading || !activeOption}
            >
              <span className="impact-donate-cta-label">
                {loading ? messages.checkout.processing : donateAmountLabel}
              </span>
            </button>
          )}
          <p className="impact-donate-legal-inline">
            {messages.checkout.legalBefore}{" "}
            <a href={termsHref}>{messages.checkout.legalTerms}</a>{" "}
            {messages.checkout.legalAnd}{" "}
            <a href={privacyHref}>{messages.checkout.legalPrivacy}</a>
            {messages.checkout.legalAfter}
          </p>
        </div>
      ) : (
      <div className="impact-donate-cta-wrap" id="impact-donate-cta">
        <button
          type={pagnovo ? "submit" : "button"}
          form={pagnovo ? "impact-donate-form" : undefined}
          className="impact-donate-cta"
          onClick={pagnovo ? undefined : () => donate()}
          disabled={loading || !activeOption}
        >
          <span className="impact-donate-cta-label">{ctaLabel}</span>
        </button>
        <p className="impact-donate-legal-inline">
          {messages.checkout.legalBefore}{" "}
          <a href={termsHref}>{messages.checkout.legalTerms}</a>{" "}
          {messages.checkout.legalAnd}{" "}
          <a href={privacyHref}>{messages.checkout.legalPrivacy}</a>
          {messages.checkout.legalAfter}
        </p>
      </div>
      )}

      {paypalClientId ? (
        <PayPalPayButton
          affiliatePageId={payment.affiliatePageId}
          campaignPath={payment.campaignPath}
          clientId={paypalClientId}
          currency={currency}
          locale={locale}
          donationOptionId={
            /^[0-9a-f-]{36}$/i.test(activeOption?.id ?? "") ? activeOption?.id : undefined
          }
          donationCents={donationCents}
          tipCents={embedded && tipOn ? 500 : 0}
          comment={postedComment()}
          googlePixelId={payment.googlePixelId}
          tiktokPixelId={payment.tiktokPixelId}
          disabled={loading || !activeOption}
          hidden={false}
          onError={setError}
        />
      ) : null}

      <aside className="impact-donate-protect">
        <ShieldCheck size={28} strokeWidth={1.6} aria-hidden />
        <div>
          <h3>{messages.checkout.protectHeading}</h3>
          <p>
            {messages.checkout.protectBody}{" "}
            <a href={refundHref}>{messages.checkout.protectLink}</a>
          </p>
        </div>
      </aside>

      {sticky ? (
        <div className="impact-sticky-bar">
          <div className="impact-sticky-stats">
            <ImpactProgressRing percent={sticky.percent} showYou={sticky.showYou} />
            <div className="impact-sticky-copy">
              <p className="impact-sticky-raised">
                <strong>
                  {sticky.raised} {sticky.raisedSuffix}
                </strong>{" "}
                {sticky.ofLabel}{" "}
                <StageGoal
                  amount={sticky.goal}
                  stageCompletedLabel={sticky.stageCompletedLabel}
                />
              </p>
              <a href={sticky.proofHref} className="impact-sticky-proof">
                {sticky.socialProof}
                <span aria-hidden> ›</span>
              </a>
            </div>
          </div>
          <div className="impact-sticky-actions is-solo">
            <button
              type="button"
              className="impact-sticky-donate"
              onClick={() => {
                if (pagnovo && formRef.current) {
                  formRef.current.requestSubmit();
                  return;
                }
                if (embedded) {
                  startStripePay();
                  return;
                }
                donate();
              }}
              disabled={loading || !activeOption || Boolean(embedded && clientSecret)}
            >
              <span className="impact-sticky-donate-label">{ctaLabel}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
