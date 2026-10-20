import { OrganizerAvatar } from "@/components/campaign/OrganizerAvatar";
import { ImpactProgressRing } from "@/components/campaign/ImpactProgressRing";
import { ImpactShareButton } from "@/components/campaign/ImpactShareButton";
import { DonateTrigger } from "@/components/campaign/DonateModalContext";
import { StageGoal } from "@/components/campaign/StageGoal";
import { campaignStageView } from "@/lib/campaign-stages";
import { formatMoney, formatRelativeTime } from "@/lib/utils";
import type { CampaignLayoutProps } from "@/components/campaign/layouts/types";

type Props = Pick<
  CampaignLayoutProps,
  "campaign" | "locale" | "messages" | "checkoutHref" | "percent"
> & {
  raisedAmount: number;
  organizerName: string;
  organizerImageUrl?: string | null;
  showYou?: boolean;
};

export function ImpactUpdates({
  campaign,
  raisedAmount,
  locale,
  messages,
  checkoutHref,
  percent,
  organizerName,
  organizerImageUrl,
  showYou = false,
}: Props) {
  const updates = campaign.updates ?? [];
  if (!updates.length) return null;
  const stage = campaignStageView({ ...campaign, currentAmount: raisedAmount });

  return (
    <section className="impact-updates" id="updates" aria-labelledby="impact-updates-heading">
      <div className="impact-activity-head">
        <h2 id="impact-updates-heading" className="impact-activity-title">
          {messages.campaign.updates}
        </h2>
        <span className="impact-count-badge">
          {updates.length.toLocaleString(locale)}
        </span>
      </div>

      <ul className="impact-updates-list">
        {updates.map((update) => {
          const author = (update.authorName ?? "").trim() || organizerName;
          return (
            <li key={update.id} className="impact-update">
              <div className="impact-update-head">
                <OrganizerAvatar
                  className="impact-organizer-avatar"
                  name={author}
                  imageUrl={
                    author === organizerName ? organizerImageUrl : null
                  }
                />
                <div className="impact-update-byline">
                  <p className="impact-update-name">{author}</p>
                  <p className="impact-update-meta">
                    <span>{messages.campaign.organizerRole}</span>
                    <span className="impact-organizers-dot" aria-hidden>
                      {" · "}
                    </span>
                    <time dateTime={new Date(update.createdAt).toISOString()}>
                      {formatRelativeTime(update.createdAt, locale)}
                    </time>
                  </p>
                  {update.title ? (
                    <h3 className="impact-update-title">{update.title}</h3>
                  ) : null}
                  <p className="impact-update-body">{update.body}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="impact-updates-progress">
        <div className="impact-overview">
          <ImpactProgressRing percent={percent} showYou={showYou} />
          <div className="impact-overview-copy">
            <h3 className="impact-raised">
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
            </h3>
          </div>
        </div>
        <div className="impact-actions">
          <DonateTrigger href={checkoutHref} className="impact-cta">
            {messages.campaign.donateNow}
          </DonateTrigger>
          <ImpactShareButton
            campaignId={campaign.id}
            title={campaign.title}
            shareLabel={messages.campaign.share}
            copiedLabel={messages.campaign.linkCopied}
            className="impact-share"
          />
        </div>
      </div>
    </section>
  );
}
