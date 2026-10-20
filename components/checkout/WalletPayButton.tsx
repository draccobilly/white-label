"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type PaymentRequest } from "@stripe/stripe-js";
import { readAttribution, visitSessionId } from "@/components/tracking/AttributionCapture";

function deviceWallet(): "apple" | "google" | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "apple";
  if (/Android/i.test(ua)) return "google";
  return null;
}

function countryFromCurrency(currency: string) {
  if (currency === "MXN") return "MX";
  if (currency === "ARS") return "AR";
  return "US";
}

export function WalletPayButton({
  affiliatePageId,
  donationOptionId,
  donationCents,
  tipCents,
  currency,
  campaignTitle,
  publishableKey,
  appleLabel,
  googleLabel,
  hideName,
  comment,
  disabled,
  onError,
  onPaid,
  causeSlug,
}: {
  affiliatePageId: string;
  donationOptionId?: string;
  donationCents: number;
  tipCents: number;
  currency: string;
  campaignTitle: string;
  publishableKey: string;
  appleLabel: string;
  googleLabel: string;
  hideName?: boolean;
  comment?: string | null;
  disabled?: boolean;
  onError: (message: string) => void;
  onPaid: () => void;
  causeSlug?: string;
}) {
  const wallet = deviceWallet();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestRef = useRef<PaymentRequest | null>(null);
  const onErrorRef = useRef(onError);
  const onPaidRef = useRef(onPaid);
  const commentRef = useRef(comment);
  onErrorRef.current = onError;
  onPaidRef.current = onPaid;
  commentRef.current = comment;
  const amount = donationCents + tipCents;

  useEffect(() => {
    if (!wallet || !publishableKey || amount < 50) {
      setAvailable(false);
      return;
    }
    let cancelled = false;
    let request: PaymentRequest | null = null;

    void (async () => {
      const stripe = await loadStripe(publishableKey);
      if (!stripe || cancelled) return;
      request = stripe.paymentRequest({
        country: countryFromCurrency(currency),
        currency: currency.toLowerCase(),
        total: {
          label: campaignTitle.slice(0, 40) || "Donation",
          amount,
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });
      const canPay = await request.canMakePayment();
      if (cancelled) return;
      const ok =
        wallet === "apple" ? Boolean(canPay?.applePay) : Boolean(canPay?.googlePay);
      setAvailable(ok);
      requestRef.current = ok ? request : null;
      if (!ok) return;

      request.on("paymentmethod", async (event) => {
        setBusy(true);
        try {
          const response = await fetch("/api/stripe/wallet-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              affiliatePageId,
              donationOptionId,
              amountCents: donationCents,
              tipCents,
              attribution: readAttribution(affiliatePageId),
              hideName: hideName === true,
              comment: commentRef.current?.trim() || null,
              visitorSessionId: visitSessionId(),
              causeSlug,
            }),
          });
          const result = await response.json();
          if (!response.ok || !result.clientSecret) {
            throw new Error(result.error ?? "Unable to start wallet payment");
          }
          const confirmed = await stripe.confirmCardPayment(
            result.clientSecret,
            { payment_method: event.paymentMethod.id },
            { handleActions: false },
          );
          if (confirmed.error) {
            event.complete("fail");
            onErrorRef.current(confirmed.error.message ?? "Unable to confirm payment");
            return;
          }
          event.complete("success");
          let paidIntent = confirmed.paymentIntent;
          if (paidIntent?.status === "requires_action") {
            const extra = await stripe.confirmCardPayment(result.clientSecret);
            if (extra.error) {
              onErrorRef.current(extra.error.message ?? "Unable to confirm payment");
              return;
            }
            paidIntent = extra.paymentIntent;
          }
          if (paidIntent?.id) {
            await fetch("/api/stripe/wallet-confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentIntentId: paidIntent.id }),
            });
          }
          onPaidRef.current();
        } catch (cause) {
          event.complete("fail");
          onErrorRef.current(
            cause instanceof Error ? cause.message : "Unable to start wallet payment",
          );
        } finally {
          setBusy(false);
        }
      });
    })();

    return () => {
      cancelled = true;
      requestRef.current = null;
    };
  }, [
    affiliatePageId,
    amount,
    campaignTitle,
    currency,
    donationCents,
    donationOptionId,
    hideName,
    publishableKey,
    tipCents,
    wallet,
  ]);

  if (!wallet || !available) return null;

  return (
    <button
      type="button"
      className="wallet-pay-btn"
      disabled={disabled || busy || amount < 50}
      onClick={() => requestRef.current?.show()}
    >
      {wallet === "apple" ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path
            fill="currentColor"
            d="M16.7 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8s-1.8-.8-3-.8c-1.5 0-3 .9-3.7 2.3-1.6 2.8-.4 6.9 1.1 9.1.8 1.1 1.7 2.3 2.9 2.2 1.1-.1 1.6-.8 3-.8s1.8.8 3 .7c1.3 0 2.1-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.4-1-2.5-3.4ZM14.8 6.4c.6-.8 1.1-1.9.9-3-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.5 2.9-1.4Z"
          />
        </svg>
      ) : (
        <span className="wallet-pay-g" aria-hidden>
          G
        </span>
      )}
      <span>{busy ? "…" : wallet === "apple" ? appleLabel : googleLabel}</span>
    </button>
  );
}
