"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { CoverMedia } from "@/components/campaign/CoverMedia";
import { LivingProgressBar } from "@/components/campaign/LivingProgressBar";
import { formatMoney, progressPercent } from "@/lib/utils";

export type RelatedCampaignCard = {
  id: string;
  href: string;
  title: string;
  organizerName?: string;
  category: string | null;
  coverImageUrl: string | null;
  coverFocusX?: number;
  coverFocusY?: number;
  currentAmount: number;
  goalAmount: number;
  currency: string;
};

const DEFAULT_HEADING =
  "More ways to make a difference. Find campaigns inspired by what matters to you.";

type Props = {
  items: RelatedCampaignCard[];
  heading?: string;
  ofGoalLabel?: string;
  percentLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  showWorldwideCta?: boolean;
  worldwideHref?: string;
  worldwideLabel?: string;
};

function formatPercentLabel(template: string | undefined, percent: number) {
  if (!template) return `${percent}% to reach the goal`;
  return template.replace("{percent}", String(percent));
}

export function RelatedCampaignsCarousel({
  items,
  heading = DEFAULT_HEADING,
  ofGoalLabel = "of",
  percentLabel,
  previousLabel = "Previous campaigns",
  nextLabel = "Next campaigns",
  showWorldwideCta = false,
  worldwideHref,
  worldwideLabel = "Happening worldwide",
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: -1 | 1) {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * 300, behavior: "smooth" });
  }

  if (!items.length) return null;

  return (
    <section className="related-section">
      <div className="shell">
        <div className="related-head">
          <div className="related-intro">
            <h2>{heading}</h2>
            {showWorldwideCta && worldwideHref ? (
              <Link className="related-worldwide" href={worldwideHref}>
                {worldwideLabel}
              </Link>
            ) : null}
          </div>
          <div className="related-nav">
            <button
              type="button"
              className="related-nav-btn"
              aria-label={previousLabel}
              onClick={() => scrollByCard(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="related-nav-btn"
              aria-label={nextLabel}
              onClick={() => scrollByCard(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="related-row" ref={scrollerRef}>
          {items.map((item) => {
            const percent = progressPercent(item.currentAmount, item.goalAmount);
            return (
              <Link className="related-card" href={item.href} key={item.id}>
                <div className="related-image">
                  {item.coverImageUrl ? (
                    <CoverMedia
                      src={item.coverImageUrl}
                      alt=""
                      sizes="280px"
                      focusX={item.coverFocusX}
                      focusY={item.coverFocusY}
                    />
                  ) : null}
                  {item.category ? (
                    <span className="related-tag">{item.category}</span>
                  ) : null}
                </div>
                <div className="related-body">
                  <h3>{item.title}</h3>
                  <p className="related-raised">
                    <strong>
                      {formatMoney(item.currentAmount, item.currency)}
                    </strong>{" "}
                    {ofGoalLabel} {formatMoney(item.goalAmount, item.currency)}
                  </p>
                  <LivingProgressBar percent={percent} tone="lime" />
                  <p className="related-percent">
                    {formatPercentLabel(percentLabel, percent)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="related-scroll-line" aria-hidden />
      </div>
    </section>
  );
}
