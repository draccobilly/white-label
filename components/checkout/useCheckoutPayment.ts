"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { readAttribution, visitSessionId } from "@/components/tracking/AttributionCapture";
import { trackAffiliatePixelEvent } from "@/lib/affiliate-pixels";
import { messagesFor } from "@/lib/i18n";
import { clearPendingComment } from "@/lib/pending-comment";

export function checkoutErrorMessage(
  raw: string | undefined,
  fallback: string,
  messages: ReturnType<typeof messagesFor>,
) {
  const text = raw ?? "";
  if (/Mexico store|PAGNOVO_ARS_SECRET_KEY still points/i.test(text)) {
    return messages.checkout.arsMexicoStore;
  }
  if (/adquirente|opera na moeda ARS|no ARS acquirer/i.test(text)) {
    return messages.checkout.arsAcquirerMissing;
  }
  return raw || fallback;
}

export type CheckoutOption = {
  id: string;
  amount: number;
  suggested: boolean;
  paymentLinkId: string | null;
};

export type CheckoutRecentDonation = {
  id: string;
  name: string;
  amount: number;
  currency: string;
};

type PagnovoCard = {
  mount: (selector: string) => Promise<void>;
  tokenize: (input: { name: string }) => Promise<{
    token: string;
    brand?: string;
    last4?: string;
  }>;
  confirmAction: (clientSecret: string) => Promise<void>;
};

declare global {
  interface Window {
    Pagnovo?: {
      card: (opts: { tokenizationKey: string }) => PagnovoCard;
    };
  }
}

export type CheckoutPaymentProps = {
  affiliatePageId: string;
  campaignPath: string;
  currency: string;
  locale?: string;
  options: CheckoutOption[];
  initialOptionId?: string;
  googlePixelId?: string | null;
  tiktokPixelId?: string | null;
  gateway?: "STRIPE" | "PAGNOVO";
  embeddedCheckout?: boolean;
  cardAvailable?: boolean;
  tokenizationKey?: string | null;
  causeSlug?: string;
};

export type CheckoutSubmitExtras = {
  hideName?: boolean;
  comment?: string | null;
  tipCents?: number;
};

export type PagnovoDonorField = "name" | "email";
export type PagnovoCheckoutMethod = "CREDIT_CARD" | "SPEI" | "BANK_TRANSFER";

export function pagnovoDonorInvalid(
  name: string,
  email: string,
): PagnovoDonorField | null {
  if (name.trim().length < 2) return "name";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "email";
  return null;
}

function loadPagnovoScript() {
  if (document.querySelector("script[data-pagnovo-sdk]")) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://portal.pagnovo.com/sdk/pagnovo.js";
    script.async = true;
    script.dataset.pagnovoSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load card checkout"));
    document.head.appendChild(script);
  });
}

export function nearestCheckoutOption(
  cents: number,
  options: CheckoutOption[],
) {
  if (!options.length) return undefined;
  return options.reduce((best, option) =>
    Math.abs(option.amount - cents) < Math.abs(best.amount - cents) ? option : best,
  );
}

export function useCheckoutPayment({
  affiliatePageId,
  campaignPath,
  currency,
  locale = "en",
  options,
  initialOptionId,
  googlePixelId,
  tiktokPixelId,
  gateway = "STRIPE",
  embeddedCheckout = false,
  cardAvailable = false,
  tokenizationKey = null,
  causeSlug,
}: CheckoutPaymentProps) {
  const messages = messagesFor(locale);
  const pagnovo = gateway === "PAGNOVO";
  const embedded = embeddedCheckout && !pagnovo;
  const argentina = currency === "ARS";
  const cardMountId = useId().replace(/:/g, "");
  const cardRef = useRef<PagnovoCard | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const firstAvailable = useMemo(() => {
    const ready = (option: CheckoutOption) =>
      pagnovo || embedded ? true : Boolean(option.paymentLinkId);
    return (
      options.find((option) => option.id === initialOptionId && ready(option)) ??
      options.find((option) => option.suggested && ready(option)) ??
      options.find(ready) ??
      options[0]
    );
  }, [embedded, initialOptionId, options, pagnovo]);
  const [selectedId, setSelectedId] = useState(firstAvailable?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [invalidField, setInvalidField] = useState<PagnovoDonorField | null>(
    null,
  );
  const [method, setMethod] = useState<PagnovoCheckoutMethod>(
    argentina ? "BANK_TRANSFER" : cardAvailable ? "CREDIT_CARD" : "SPEI",
  );
  const selected = options.find((option) => option.id === selectedId);

  useEffect(() => {
    if (
      !pagnovo ||
      method !== "CREDIT_CARD" ||
      !cardAvailable ||
      !tokenizationKey ||
      argentina
    ) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await loadPagnovoScript();
        if (cancelled || !window.Pagnovo) return;
        const card = window.Pagnovo.card({ tokenizationKey });
        await card.mount(`#pagnovo-card-${cardMountId}`);
        cardRef.current = card;
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : messages.checkout.unableToOpen,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      cardRef.current = null;
    };
  }, [
    cardAvailable,
    cardMountId,
    messages.checkout.unableToOpen,
    method,
    pagnovo,
    tokenizationKey,
    argentina,
  ]);

  async function donateStripe(option = selected, extras?: CheckoutSubmitExtras) {
    if (!option?.paymentLinkId) {
      setError(messages.checkout.amountNotReady);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/redirect/${affiliatePageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentLinkId: option.paymentLinkId,
          attribution: readAttribution(affiliatePageId),
          hideName: extras?.hideName === true,
          comment: extras?.comment?.trim() || null,
          visitorSessionId: visitSessionId(),
          causeSlug,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? messages.checkout.unableToOpen);
      clearPendingComment(affiliatePageId);
      trackAffiliatePixelEvent("InitiateCheckout", {
        googlePixelId,
        tiktokPixelId,
        valueCents: option.amount,
        currency,
      });
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : messages.checkout.unableToOpen);
      setLoading(false);
    }
  }

  async function donatePagnovo(option = selected, extras?: CheckoutSubmitExtras) {
    if (!option) {
      setError(messages.checkout.amountNotReady);
      return;
    }
    const donorField = pagnovoDonorInvalid(name, email);
    if (donorField) {
      setInvalidField(donorField);
      setError(
        donorField === "name"
          ? messages.checkout.nameRequired
          : messages.checkout.emailRequired,
      );
      return donorField;
    }
    setInvalidField(null);
    if (method === "CREDIT_CARD" && (!cardAvailable || !cardRef.current)) {
      setError(messages.checkout.cardUnavailable);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let creditCard:
        | { token: string; holder: string; brand?: string; last4?: string }
        | undefined;
      if (method === "CREDIT_CARD" && cardRef.current) {
        const tokenized = await cardRef.current.tokenize({ name: name.trim() });
        creditCard = {
          token: tokenized.token,
          holder: name.trim(),
          brand: tokenized.brand,
          last4: tokenized.last4,
        };
      }
      const response = await fetch("/api/pagnovo/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliatePageId,
          donationOptionId: option.id,
          paymentMethod: method,
          name: name.trim(),
          email: email.trim(),
          attribution: readAttribution(affiliatePageId),
          hideName: extras?.hideName === true,
          comment: extras?.comment?.trim() || null,
          visitorSessionId: visitSessionId(),
          causeSlug,
          creditCard,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          checkoutErrorMessage(result.error, messages.checkout.unableToOpen, messages),
        );
      }
      clearPendingComment(affiliatePageId);
      trackAffiliatePixelEvent("InitiateCheckout", {
        googlePixelId,
        tiktokPixelId,
        valueCents: option.amount,
        currency,
      });
      if (result.requiresAction && result.clientSecret && cardRef.current) {
        await cardRef.current.confirmAction(result.clientSecret);
      }
      const payUrl = `${campaignPath}/pay?intent=${encodeURIComponent(result.intentId)}`;
      window.location.assign(payUrl);
    } catch (cause) {
      setError(
        checkoutErrorMessage(
          cause instanceof Error ? cause.message : undefined,
          messages.checkout.unableToOpen,
          messages,
        ),
      );
      setLoading(false);
    }
  }

  async function donateEmbedded(option = selected, extras?: CheckoutSubmitExtras) {
    if (!option) {
      setError(messages.checkout.amountNotReady);
      return;
    }
    setLoading(true);
    setError(null);
    setClientSecret(null);
    try {
      const response = await fetch("/api/stripe/embedded-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliatePageId,
          donationOptionId: /^[0-9a-f-]{36}$/i.test(option.id)
            ? option.id
            : undefined,
          amountCents: option.amount,
          tipCents: extras?.tipCents ?? 0,
          attribution: readAttribution(affiliatePageId),
          hideName: extras?.hideName === true,
          comment: extras?.comment?.trim() || null,
          visitorSessionId: visitSessionId(),
          causeSlug,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? messages.checkout.unableToOpen);
      }
      clearPendingComment(affiliatePageId);
      trackAffiliatePixelEvent("InitiateCheckout", {
        googlePixelId,
        tiktokPixelId,
        valueCents: option.amount,
        currency,
      });
      if (!result.clientSecret || !result.publishableKey) {
        throw new Error(result.error ?? messages.checkout.unableToOpen);
      }
      setPublishableKey(result.publishableKey);
      setClientSecret(result.clientSecret);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : messages.checkout.unableToOpen);
    } finally {
      setLoading(false);
    }
  }

  function submit(option = selected, extras?: CheckoutSubmitExtras) {
    if (pagnovo) return donatePagnovo(option, extras);
    if (embedded) return donateEmbedded(option, extras);
    return donateStripe(option, extras);
  }

  function chooseAmount(id: string) {
    setSelectedId(id);
    setClientSecret(null);
    setPublishableKey(null);
  }

  return {
    messages,
    pagnovo,
    embedded,
    clientSecret,
    publishableKey,
    cardMountId,
    selectedId,
    setSelectedId: chooseAmount,
    selected,
    loading,
    error,
    setError,
    name,
    setName: (value: string) => {
      setName(value);
      setInvalidField((current) => (current === "name" ? null : current));
    },
    email,
    setEmail: (value: string) => {
      setEmail(value);
      setInvalidField((current) => (current === "email" ? null : current));
    },
    invalidField,
    method,
    setMethod,
    argentina,
    submit,
    clearSession() {
      setClientSecret(null);
      setPublishableKey(null);
      setLoading(false);
    },
  };
}
