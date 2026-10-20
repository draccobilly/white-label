import { campaignNameTag } from "@/lib/campaign-label";
import { formatMoneyExact, formatRelativeTime } from "@/lib/utils";

export function PaymentRow({
  customerName,
  amount,
  currency,
  paidAt,
  campaignTitle,
  campaignSlug,
  gatewayLabel,
  note,
}: {
  customerName: string;
  amount: number;
  currency: string;
  paidAt: Date | string | null;
  campaignTitle: string;
  campaignSlug?: string | null;
  gatewayLabel?: string | null;
  note?: string | null;
}) {
  const name = customerName || "Anonymous";
  const stamp = paidAt ? new Date(paidAt) : null;
  return (
    <article className="dash-row">
      <span className="dash-avatar" aria-hidden>
        {name.trim()[0]?.toUpperCase() ?? "A"}
      </span>
      <div className="dash-row-copy">
        <strong>{name}</strong>
        <p title={campaignSlug ? `${campaignTitle} · /${campaignSlug}` : campaignTitle}>
          <span className="dash-row-tag">{campaignNameTag(campaignTitle)}</span>
          {stamp ? (
            <time dateTime={stamp.toISOString()}>{formatRelativeTime(stamp)}</time>
          ) : null}
        </p>
        {gatewayLabel ? <span className="sale-gateway-tag">{gatewayLabel}</span> : null}
        {note ? <small className="dash-row-note">{note}</small> : null}
      </div>
      <em>{formatMoneyExact(amount, currency)}</em>
    </article>
  );
}
