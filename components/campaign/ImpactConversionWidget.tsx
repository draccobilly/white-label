"use client";

import { useState, type ReactNode } from "react";
import { TrendingUp } from "lucide-react";
import { ImpactProgressRing } from "@/components/campaign/ImpactProgressRing";
import { ImpactShareButton } from "@/components/campaign/ImpactShareButton";
import { DonateTrigger } from "@/components/campaign/DonateModalContext";
import { isNewActivity } from "@/lib/campaign-comments";
import { StageGoal } from "@/components/campaign/StageGoal";
import { campaignStageView } from "@/lib/campaign-stages";
import { formatMoney } from "@/lib/utils";
import { messagesFor } from "@/lib/i18n";
import type { CampaignLayoutProps } from "@/components/campaign/layouts/types";

type Props = Pick<
  CampaignLayoutProps,
  "campaign" | "locale" | "checkoutHref" | "percent" | "donations"
> & {
  raisedAmount: number;
  showYou?: boolean;
  give?: ReactNode;
  socialProof?: string;
  donateLabel?: string;
};

function donorInitial(name: string) {
  const letter = name.trim().charAt(0);
  return letter ? letter.toUpperCase() : "?";
}

function relativeDonationTime(iso: string | null, locale: string) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function ImpactConversionWidget({
  campaign,
  raisedAmount,
  locale,
  checkoutHref,
  percent,
  donations,
  showYou = false,
  give,
  socialProof,
  donateLabel,
}: Props) {
  const messages = messagesFor(locale);
  const stage = campaignStageView({ ...campaign, currentAmount: raisedAmount });
  const [showAll, setShowAll] = useState(false);
  const visibleDonations = showAll ? donations : donations.slice(0, 5);
  const countLabel = campaign.supporterCount.toLocaleString(locale);
  const topAmount = Math.max(0, ...donations.map((donation) => donation.amount));

  return (
    <aside className="impact-widget">
      <div className={`impact-widget-card glass-panel${give ? " is-inline-give" : ""}`}>
        <div className="impact-overview">
          <ImpactProgressRing percent={percent} showYou={showYou} />
          <div className="impact-overview-copy">
            <h2 className="impact-raised">
              <strong>
                {formatMoney(raisedAmount, campaign.currency, locale)}
              </strong>
              <span className="impact-raised-goal">
                {messages.campaign.raisedOf}{" "}
                <StageGoal
                  amount={formatMoney(stage.goalAmount, campaign.currency, locale)}
                  stageCompletedLabel={stage.stageCompletedLabel}
                />
              </span>
            </h2>
            <p className="impact-supporters">
              {socialProof ?? messages.campaign.donationsCount(countLabel)}
              {socialProof ? <span aria-hidden> ›</span> : null}
            </p>
          </div>
        </div>

        <div className="impact-actions">
          <DonateTrigger href={checkoutHref} className="impact-cta">
            {donateLabel ?? messages.campaign.donateNow}
          </DonateTrigger>
          <ImpactShareButton
            campaignId={campaign.id}
            title={campaign.title}
            shareLabel={messages.campaign.share}
            copiedLabel={messages.campaign.linkCopied}
            className="impact-share"
          />
        </div>

        {give}

        <div id="recent-donations" className="impact-velocity glass-velocity">
          <span className="impact-velocity-icon" aria-hidden>
            <TrendingUp size={18} />
          </span>
          <span>{messages.campaign.recentDonations(countLabel)}</span>
        </div>

        {visibleDonations.length ? (
          <ul className={`impact-donors glass-donors${showAll ? " is-expanded" : ""}`}>
            {visibleDonations.map((donation, index) => {
              const when = relativeDonationTime(donation.paidAt, locale);
              const isNew = isNewActivity(donation.paidAt) || index === 0;
              const status =
                index === 0
                  ? messages.campaign.recentDonation
                  : donation.amount === topAmount
                    ? messages.campaign.topDonation
                    : when;
              return (
                <li key={donation.id} className="impact-donor glass-donor">
                  <span className="impact-donor-avatar" aria-hidden>
                    {donorInitial(donation.name)}
                  </span>
                  <div className="impact-donor-copy">
                    <span className="impact-donor-name">
                      {donation.name}
                      {isNew ? (
                        <span className="impact-new-tag">{messages.comments.newTag}</span>
                      ) : null}
                    </span>
                    <span className="impact-donor-meta">
                      <strong>
                        {formatMoney(donation.amount, donation.currency, locale)}
                      </strong>
                      {status ? (
                        <>
                          <span className="impact-donor-sep" aria-hidden>
                            ·
                          </span>
                          <span>{status}</span>
                        </>
                      ) : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {donations.length > 5 && !showAll ? (
          <div className="impact-widget-footer">
            <button
              type="button"
              className="impact-see-all"
              onClick={() => setShowAll(true)}
            >
              {messages.campaign.seeAll}
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
