"use client";

import { Heart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/utils";
import { recentSupportCopy } from "@/lib/social-proof";

export type SocialDonation = {
  id: string;
  name: string;
  amount: number;
  currency: string;
};

type Props = {
  donations: SocialDonation[];
  supporterCount?: number;
};

export function SocialProofCarousel({ donations, supporterCount = 0 }: Props) {
  const slides = useMemo(() => {
    const headline = {
      id: "headline",
      text: recentSupportCopy(supporterCount),
    };
    const donationSlides = donations.map((donation) => ({
      id: donation.id,
      text: `${donation.name} donated ${formatMoney(donation.amount, donation.currency)} recently`,
    }));
    return [headline, ...donationSlides];
  }, [donations, supporterCount]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="social-carousel" aria-live="polite">
      <div className="social-carousel-viewport">
        {slides.map((slide, slideIndex) => (
          <div
            key={slide.id}
            className={`social-carousel-slide ${slideIndex === index ? "is-active" : ""}`}
          >
            <Heart size={16} strokeWidth={1.75} />
            <span>{slide.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
