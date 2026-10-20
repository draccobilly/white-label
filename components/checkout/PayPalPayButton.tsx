"use client";

import { useEffect, useRef } from "react";
import { readAttribution, visitSessionId } from "@/components/tracking/AttributionCapture";
import { trackAffiliatePixelEvent } from "@/lib/affiliate-pixels";
import { messagesFor } from "@/lib/i18n";
import { clearPendingComment } from "@/lib/pending-comment";

type PaypalButtons = {
  render: (target: HTMLElement) => Promise<void>;
  close: () => Promise<void> | void;
  hasReturned?: () => boolean;
  resume?: () => Promise<void>;
};

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        appSwitchWhenAvailable?: boolean;
        style?: Record<string, string | number | boolean>;
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onCancel?: () => void;
        onError?: (error: unknown) => void;
      }) => PaypalButtons;
    };
  }
}

function paypalPageUrl() {
  const href = window.location.href;
  const hash = href.indexOf("#");
  return hash === -1 ? href : href.slice(0, hash);
}

function loadPaypalSdk(clientId: string, currency: string) {
  const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture&disable-funding=card,credit,paylater,venmo`;
  const existing = document.querySelector<HTMLScriptElement>("script[data-paypal-sdk]");
  if (existing?.dataset.paypalSrc === src && window.paypal) return Promise.resolve();
  existing?.remove();
  delete window.paypal;
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.paypalSdk = "true";
    script.dataset.paypalSrc = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load PayPal"));
    document.head.appendChild(script);
  });
}

export function PayPalPayButton({
  affiliatePageId,
  campaignPath,
  clientId,
  currency,
  locale,
  donationOptionId,
  donationCents,
  tipCents,
  comment,
  googlePixelId,
  tiktokPixelId,
  disabled,
  hidden,
  onError,
  causeSlug,
}: {
  affiliatePageId: string;
  campaignPath: string;
  clientId: string;
  currency: string;
  locale: string;
  donationOptionId?: string;
  donationCents: number;
  tipCents: number;
  comment: string | null;
  googlePixelId?: string | null;
  tiktokPixelId?: string | null;
  disabled: boolean;
  hidden: boolean;
  onError: (message: string) => void;
  causeSlug?: string;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const payloadRef = useRef({
    donationOptionId,
    donationCents,
    tipCents,
    comment,
    disabled,
    causeSlug,
  });
  payloadRef.current = { donationOptionId, donationCents, tipCents, comment, disabled, causeSlug };
  const messages = messagesFor(locale);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || !clientId) return;
    let cancelled = false;
    let buttons: PaypalButtons | null = null;

    void (async () => {
      try {
        await loadPaypalSdk(clientId, currency);
        if (cancelled || !slotRef.current || !window.paypal) return;
        buttons = window.paypal.Buttons({
          appSwitchWhenAvailable: true,
          style: { layout: "vertical", shape: "pill", label: "paypal", height: 45, tagline: false },
          createOrder: async () => {
            const payload = payloadRef.current;
            if (payload.disabled || payload.donationCents < 1) {
              throw new Error(messages.checkout.amountNotReady);
            }
            const response = await fetch("/api/paypal/order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                affiliatePageId,
                donationOptionId: /^[0-9a-f-]{36}$/i.test(payload.donationOptionId ?? "")
                  ? payload.donationOptionId
                  : undefined,
                amountCents: payload.donationCents,
                tipCents: payload.tipCents,
                attribution: readAttribution(affiliatePageId),
                comment: payload.comment,
                visitorSessionId: visitSessionId(),
                causeSlug: payload.causeSlug,
                returnUrl: paypalPageUrl(),
              }),
            });
            const result = await response.json();
            if (!response.ok || !result.orderId) {
              throw new Error(result.error || messages.checkout.unableToOpen);
            }
            clearPendingComment(affiliatePageId);
            trackAffiliatePixelEvent("InitiateCheckout", {
              googlePixelId,
              tiktokPixelId,
              valueCents: payload.donationCents,
              currency,
            });
            return result.orderId as string;
          },
          onApprove: async (data) => {
            const response = await fetch("/api/paypal/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: data.orderID }),
            });
            const result = await response.json();
            if (response.status === 202) {
              onError(messages.checkout.paypalPending);
              return;
            }
            if (!response.ok || !result.intentId) {
              onError(result.error || messages.checkout.unableToOpen);
              return;
            }
            const url = new URL(campaignPath, window.location.origin);
            url.searchParams.set("payment_return", "1");
            url.searchParams.set("intent", result.intentId);
            window.location.assign(`${url.pathname}${url.search}`);
          },
          onError: () => onError(messages.checkout.unableToOpen),
        });
        if (cancelled || !slotRef.current) return;
        if (buttons.hasReturned?.()) {
          await buttons.resume?.();
        } else {
          await buttons.render(slotRef.current);
        }
      } catch (cause) {
        if (!cancelled) {
          onError(cause instanceof Error ? cause.message : messages.checkout.unableToOpen);
        }
      }
    })();

    return () => {
      cancelled = true;
      void buttons?.close();
      if (slot) slot.replaceChildren();
    };
  }, [
    affiliatePageId,
    campaignPath,
    clientId,
    currency,
    googlePixelId,
    messages.checkout.amountNotReady,
    messages.checkout.paypalPending,
    messages.checkout.unableToOpen,
    onError,
    tiktokPixelId,
  ]);

  return (
    <div
      ref={slotRef}
      className={`paypal-pay-slot${disabled ? " is-disabled" : ""}`}
      hidden={hidden}
      aria-label={messages.checkout.donateWithPayPal}
    />
  );
}
