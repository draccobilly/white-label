"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type ProgressSale = {
  id: string;
  checkoutIntentId: string;
  amount: number;
  paidAt: string | null;
  livemode: boolean;
  trackingCode: string | null;
  customerName?: string | null;
  hasComment?: boolean;
  hasReply?: boolean;
};

type Props = {
  currentAmount: number;
  goalAmount: number;
  personalSale: ProgressSale | null;
  label?: string;
};

const CLEARANCE_MS = 24 * 60 * 60 * 1000;

export function PersonalDonationProgress({
  currentAmount,
  goalAmount,
  personalSale,
  label,
}: Props) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const personal = useMemo(() => {
    if (!personalSale?.livemode) return null;
    const confirmedAt = personalSale.paidAt
      ? new Date(personalSale.paidAt).getTime()
      : null;
    return {
      amount: personalSale.amount,
      includedInCurrent: true,
      trackingCode: personalSale.trackingCode,
      cleared:
        confirmedAt !== null && now - confirmedAt >= CLEARANCE_MS,
    };
  }, [now, personalSale]);

  const safeGoal = Math.max(1, goalAmount);
  const confirmedBase = Math.max(
    0,
    currentAmount - (personal?.includedInCurrent ? personal.amount : 0),
  );
  const baseWidth = Math.min(100, (confirmedBase / safeGoal) * 100);
  const actualPersonalWidth = personal
    ? Math.min(100 - baseWidth, (personal.amount / safeGoal) * 100)
    : 0;
  const personalWidth = personal
    ? Math.min(100 - baseWidth, Math.max(1, actualPersonalWidth))
    : 0;
  const totalForAria =
    currentAmount + (personal && !personal.includedInCurrent ? personal.amount : 0);
  const totalPercent = Math.min(100, (totalForAria / safeGoal) * 100);
  const trackingHref = personal?.trackingCode
    ? `/track-your-donation?code=${encodeURIComponent(personal.trackingCode)}`
    : "/track-your-donation";

  return (
    <div className="personal-progress-wrap">
      <div
        className="living-progress personal-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(totalPercent)}
        aria-label={label ?? `Campaign progress ${totalPercent}%`}
      >
        <div
          className="living-progress-fill"
          style={{ width: `${baseWidth}%` }}
        >
          <span className="living-progress-sheen" aria-hidden />
        </div>
        {personal ? (
          <button
            type="button"
            className={`personal-progress-segment ${
              personal.cleared ? "is-cleared" : "is-pending"
            }`}
            style={{ width: `${personalWidth}%` }}
            aria-label="Your donation status"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="personal-progress-you">you</span>
          </button>
        ) : null}
      </div>
      {open && personal ? (
        <div className="personal-progress-popover">
          <p>
            {personal.cleared
              ? "Your donation was received successfully."
              : "Waiting for donation clearance."}
          </p>
          <Link
            className="personal-progress-track"
            href={trackingHref}
          >
            Track your donation &gt;
          </Link>
        </div>
      ) : null}
      {personal ? (
        <Link className="personal-progress-cta" href={trackingHref}>
          Track your donation
        </Link>
      ) : null}
    </div>
  );
}
