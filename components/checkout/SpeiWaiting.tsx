"use client";

import { Check, Copy, HandHeart, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ImpactCheckoutHeart } from "@/components/checkout/ImpactCheckoutHeart";
import { messagesFor } from "@/lib/i18n";
import { PUBLIC_PREFIX_HEADER } from "@/lib/public-site-url";
import { formatMoney } from "@/lib/utils";

export type SpeiRecentGift = {
  id: string;
  name: string;
  amount: number;
  currency: string;
};

function displayClabe(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function SpeiConfirmTicker({
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

export function SpeiWaiting({
  intentId,
  checkoutHref,
  pathPrefix,
  locale,
  initialClabe,
  amount,
  currency,
  recentGifts = [],
  refundHref,
}: {
  intentId: string;
  checkoutHref: string;
  pathPrefix?: string | null;
  locale: string;
  initialClabe?: string | null;
  amount: number;
  currency: string;
  recentGifts?: SpeiRecentGift[];
  refundHref: string;
}) {
  const messages = messagesFor(locale);
  const argentina = currency === "ARS";
  const [clabe, setClabe] = useState(initialClabe ?? "");
  const [beneficiary, setBeneficiary] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedOnce, setCopiedOnce] = useState(false);
  const [status, setStatus] = useState<"PENDING" | "PAID" | "EXPIRED">("PENDING");
  const amountLabel = formatMoney(amount, currency, locale);
  const accountLabel = argentina
    ? messages.payment.cvuLabel
    : messages.payment.clabeLabel;
  const copyLabel = argentina
    ? messages.payment.copyCvu
    : messages.payment.copyClabe;
  const generatingLabel = argentina
    ? messages.payment.generatingCvu
    : messages.payment.generatingClabe;
  const steps = [
    argentina ? messages.payment.stepCopyCvu : messages.payment.stepCopy,
    messages.payment.stepBank,
    messages.payment.stepSend,
  ];
  const tickerItems = recentGifts.map((gift) => ({
    id: gift.id,
    label: messages.checkout.recentDonor(
      gift.name,
      formatMoney(gift.amount, gift.currency, locale),
    ),
  }));

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    async function poll() {
      const response = await fetch(
        `/api/pagnovo/status?intent=${encodeURIComponent(intentId)}`,
        {
          cache: "no-store",
          headers: pathPrefix
            ? { [PUBLIC_PREFIX_HEADER]: pathPrefix }
            : undefined,
        },
      );
      const result = await response.json();
      if (cancelled || !response.ok) return;
      if (typeof result.cvu === "string" && result.cvu.trim()) {
        setClabe(result.cvu);
      } else if (typeof result.clabe === "string" && result.clabe.trim()) {
        setClabe(result.clabe);
      }
      if (typeof result.beneficiary === "string" && result.beneficiary.trim()) {
        setBeneficiary(result.beneficiary);
      }
      if (result.status === "PAID") {
        setStatus("PAID");
        window.clearInterval(timer);
        window.setTimeout(() => {
          if (cancelled) return;
          window.location.replace(
            `/api/pagnovo/complete?intent=${encodeURIComponent(intentId)}`,
          );
        }, 700);
        return;
      }
      if (result.status === "EXPIRED") {
        setStatus("EXPIRED");
        window.clearInterval(timer);
      }
    }

    void poll();
    timer = window.setInterval(() => {
      void poll();
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [intentId, pathPrefix]);

  async function copy() {
    if (!clabe) return;
    await navigator.clipboard.writeText(clabe.replace(/\D/g, "") || clabe);
    setCopied(true);
    setCopiedOnce(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="impact-spei">
      <section
        className={`impact-spei-listen${status === "PAID" ? " is-paid" : ""}`}
        aria-live="polite"
      >
        <div className="impact-spei-listen-mark" aria-hidden>
          <span className="impact-spei-ring" />
          {status === "PAID" ? (
            <Check size={28} strokeWidth={2.4} />
          ) : (
            <ImpactCheckoutHeart />
          )}
        </div>
        <div>
          <p className="impact-spei-badge">
            <ShieldCheck size={14} strokeWidth={2.2} aria-hidden />
            {messages.payment.secureBadge}
          </p>
          <strong>
            {status === "PAID"
              ? messages.payment.paidConfirmed
              : status === "EXPIRED"
                ? messages.payment.expired
                : messages.payment.waiting}
          </strong>
          {status === "PENDING" ? <p>{messages.payment.waitingHint}</p> : null}
        </div>
      </section>

      <section className="impact-spei-amount">
        <span>{messages.payment.exactAmount}</span>
        <p>{amountLabel}</p>
        <small>
          {argentina ? messages.payment.bankHintArs : messages.payment.bankHint}
        </small>
      </section>

      <section className="impact-spei-clabe">
        {beneficiary ? (
          <p className="impact-spei-beneficiary">
            <span>{messages.payment.beneficiaryLabel}</span>
            <strong className="impact-spei-beneficiary-name">{beneficiary}</strong>
          </p>
        ) : null}
        <span>{accountLabel}</span>
        {clabe ? (
          <strong>{displayClabe(clabe)}</strong>
        ) : (
          <strong className="impact-spei-clabe-pending" aria-busy>
            {generatingLabel}
          </strong>
        )}
        <button
          className={`impact-donate-cta impact-spei-copy${copied ? " is-copied" : ""}`}
          type="button"
          onClick={() => void copy()}
          disabled={!clabe || status === "EXPIRED"}
        >
          {copied ? (
            <Check size={18} strokeWidth={2.6} aria-hidden />
          ) : (
            <Copy size={18} aria-hidden />
          )}
          <span className="impact-spei-copy-label">
            {copied ? messages.payment.copied : copyLabel}
          </span>
        </button>
      </section>

      <ol className="impact-spei-steps">
        {steps.map((step, index) => {
          const done = index === 0 && copiedOnce;
          return (
            <li className={done ? "is-done" : undefined} key={step}>
              <span>{done ? <Check size={14} strokeWidth={2.8} aria-hidden /> : index + 1}</span>
              {step}
            </li>
          );
        })}
      </ol>

      {status === "EXPIRED" ? (
        <p className="impact-spei-expired" role="alert">
          {messages.payment.expired}{" "}
          <a href={checkoutHref}>{messages.checkout.backToCampaign}</a>
        </p>
      ) : null}

      <section className="impact-spei-confirms">
        <h2>{messages.payment.confirmationsHeading}</h2>
        {tickerItems.length ? (
          <SpeiConfirmTicker items={tickerItems} />
        ) : (
          <p>
            {argentina
              ? messages.payment.confirmationsEmptyArs
              : messages.payment.confirmationsEmpty}
          </p>
        )}
      </section>

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
    </div>
  );
}
