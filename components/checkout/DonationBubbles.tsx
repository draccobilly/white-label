"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/utils";

export type BubbleDonation = {
  id: string;
  name: string;
  amount: number;
  currency: string;
};

type Props = {
  donations: BubbleDonation[];
};

type ActiveBubble = BubbleDonation & {
  key: string;
  side: "left" | "right";
  top: number;
};

export function DonationBubbles({ donations }: Props) {
  const [active, setActive] = useState<ActiveBubble[]>([]);

  useEffect(() => {
    if (!donations.length) return;
    let tick = 0;
    const spawn = () => {
      const donation = donations[tick % donations.length];
      tick += 1;
      const key = `${donation.id}-${Date.now()}`;
      const side = tick % 2 === 0 ? "left" : "right";
      const top = 16 + Math.round(Math.random() * 66);
      setActive([{ ...donation, key, side, top }]);
      window.setTimeout(() => {
        setActive((current) => current.filter((item) => item.key !== key));
      }, 7600);
    };

    const initialTimer = window.setTimeout(spawn, 2400);
    const timer = window.setInterval(spawn, 12000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [donations]);

  if (!donations.length) return null;

  return (
    <div className="donation-bubbles" aria-live="polite">
      {active.map((bubble) => (
        <div
          key={bubble.key}
          className={`donation-bubble donation-bubble--${bubble.side}`}
          style={{ top: `${bubble.top}%` }}
        >
          <strong>{bubble.name}</strong>
          <span>just donated {formatMoney(bubble.amount, bubble.currency)}</span>
        </div>
      ))}
    </div>
  );
}
