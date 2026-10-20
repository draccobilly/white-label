import { campaignNameTag, isNewCampaign } from "@/lib/campaign-label";

export function CampaignIdentity({
  title,
  slug,
  currency,
  createdAt,
  compact = false,
}: {
  title: string;
  slug?: string | null;
  currency?: string | null;
  createdAt?: Date | string | null;
  compact?: boolean;
}) {
  const tag = campaignNameTag(title);
  return (
    <div className={`campaign-identity${compact ? " is-compact" : ""}`}>
      <div className="ledger-campaign-tags">
        <span className="campaign-name-tag">{tag}</span>
        {isNewCampaign(createdAt) ? <span className="campaign-new-flag">New</span> : null}
        {slug ? <span className="campaign-id-tag">{slug}</span> : null}
        {currency ? <span className="campaign-id-tag">{currency}</span> : null}
      </div>
      <strong className="campaign-identity-title">{title}</strong>
    </div>
  );
}
