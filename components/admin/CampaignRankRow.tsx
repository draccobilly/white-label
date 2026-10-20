import Link from "next/link";
import { campaignNameTag, isNewCampaign } from "@/lib/campaign-label";
import { formatPercentChange, percentChange } from "@/lib/periods";
import { formatMoney } from "@/lib/utils";

export function CampaignRankRow({
  href,
  title,
  slug,
  currency,
  createdAt,
  amount,
  count,
  share,
  active,
  rank,
  previousAmount,
}: {
  href: string;
  title: string;
  slug?: string | null;
  currency: string;
  createdAt?: Date | string | null;
  amount: number;
  count: number;
  share: number;
  active?: boolean;
  rank?: number;
  /** Same campaign in the comparison period; shows a change chip when set. */
  previousAmount?: number;
}) {
  const percent = Math.round(share);
  const change = previousAmount === undefined ? undefined : percentChange(amount, previousAmount);
  return (
    <Link
      href={href}
      className={`dash-rank${active ? " is-active" : ""}`}
      aria-current={active ? "true" : undefined}
      title={slug ? `${title} · /${slug}` : title}
    >
      {rank ? (
        <span className="dash-rank-pos" aria-hidden>
          {rank}
        </span>
      ) : null}
      <div className="dash-rank-copy">
        <strong>
          {campaignNameTag(title)}
          {isNewCampaign(createdAt) ? <span className="campaign-new-flag">New</span> : null}
        </strong>
        <span>{title}</span>
      </div>
      <div className="dash-rank-meta">
        <em>
          {formatMoney(amount, currency)}
          {change !== undefined ? (
            <span
              className={`dash-change${change === null ? " is-new" : change < 0 ? " is-down" : change > 0 ? " is-up" : ""}`}
              title={`before: ${formatMoney(previousAmount ?? 0, currency)}`}
            >
              {formatPercentChange(change)}
            </span>
          ) : null}
        </em>
        <small>
          {count} {count === 1 ? "payment" : "payments"}, {percent}%
        </small>
      </div>
      <span className="dash-rank-bar" aria-hidden>
        <i style={{ width: `${Math.max(2, Math.min(100, share))}%` }} />
      </span>
    </Link>
  );
}
