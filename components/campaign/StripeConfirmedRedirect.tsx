"use client";

import { useEffect } from "react";

export function StripeConfirmedRedirect({
  campaignPath,
  sessionId,
  continueToThankYou,
  returningLabel,
  testReturningLabel,
}: {
  campaignPath: string;
  sessionId: string;
  continueToThankYou: boolean;
  returningLabel?: string;
  testReturningLabel?: string;
}) {
  useEffect(() => {
    const destination = continueToThankYou
      ? campaignPath.includes("payment_return=")
        ? campaignPath
        : `${campaignPath}?payment_return=1&session_id=${encodeURIComponent(sessionId)}`
      : campaignPath.split("?")[0] ?? campaignPath;
    const delayMs = continueToThankYou ? 1200 : 5000;
    const timer = window.setTimeout(() => {
      window.location.replace(destination);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [campaignPath, continueToThankYou, sessionId]);

  return (
    <p className="receipt-wait-disclaimer" aria-live="polite">
      {continueToThankYou
        ? returningLabel ?? "Payment confirmed. Returning to the campaign…"
        : testReturningLabel ??
          "Test payment confirmed. Returning to the campaign in a few seconds…"}
    </p>
  );
}
