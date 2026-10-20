"use client";

import { useEffect, useState } from "react";

function remainingLabel(milliseconds: number) {
  const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${hours}h ${minutes}m`;
}

export function ReceiptCountdown({
  receiptToken,
  availableAt,
}: {
  receiptToken: string;
  availableAt: string;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const destination = `/api/receipt?token=${encodeURIComponent(receiptToken)}`;
    const update = () => {
      const next = new Date(availableAt).getTime() - Date.now();
      if (next <= 0) {
        window.location.replace(destination);
        return;
      }
      setRemaining(next);
    };

    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [availableAt, receiptToken]);

  return (
    <div className="receipt-wait-status" aria-live="polite">
      <span className="receipt-wait-spinner" aria-hidden />
      <div>
        <strong>Receipt preparation in progress</strong>
        <p>
          {remaining === null
            ? "Checking availability…"
            : `Estimated availability in ${remainingLabel(remaining)}.`}
        </p>
      </div>
    </div>
  );
}
