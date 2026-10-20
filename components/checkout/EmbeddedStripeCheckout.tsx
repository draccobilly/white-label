"use client";

import { useEffect, useRef } from "react";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";

export function EmbeddedStripeCheckout({
  publishableKey,
  clientSecret,
}: {
  publishableKey: string;
  clientSecret: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = mountRef.current;
    if (!node) return;
    let checkout: StripeEmbeddedCheckout | null = null;
    let cancelled = false;

    void (async () => {
      const stripe = await loadStripe(publishableKey);
      if (!stripe || cancelled) return;
      checkout = await stripe.createEmbeddedCheckoutPage({ clientSecret });
      if (cancelled) {
        checkout.destroy();
        return;
      }
      checkout.mount(node);
    })();

    return () => {
      cancelled = true;
      checkout?.destroy();
    };
  }, [clientSecret, publishableKey]);

  return <div className="embedded-stripe-checkout" ref={mountRef} />;
}
