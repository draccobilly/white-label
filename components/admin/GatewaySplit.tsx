import { gatewayLabel } from "@/lib/gateways";
import { formatPercentChange, percentChange } from "@/lib/periods";
import { formatMoney } from "@/lib/utils";

export type GatewayTotals = {
  gateway: string;
  amount: number;
  count: number;
  fees: number;
  /** Same gateway in the comparison period. */
  previousAmount?: number;
};

/** Stripe vs PayPal (vs PagNovo) for the selected period, side by side. */
export function GatewaySplit({
  rows,
  currency,
  compact = false,
}: {
  rows: GatewayTotals[];
  currency: string;
  compact?: boolean;
}) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <div className={`dash-list gateway-split${compact ? " is-compact" : ""}`}>
      {rows.map((row) => {
        const share = total > 0 ? (row.amount / total) * 100 : 0;
        const change = row.previousAmount === undefined ? undefined : percentChange(row.amount, row.previousAmount);
        return (
          <div key={row.gateway} className={`gateway-row is-${row.gateway}`}>
            <span className="gateway-mark" aria-hidden />
            <div className="gateway-copy">
              <strong>{gatewayLabel(row.gateway)}</strong>
              <small>
                {row.count} {row.count === 1 ? "payment" : "payments"}, {Math.round(share)}%
                {row.fees > 0 ? `, fees ${formatMoney(row.fees, currency)}` : ""}
              </small>
            </div>
            <div className="gateway-meta">
              <em>{formatMoney(row.amount, currency)}</em>
              {change !== undefined ? (
                <span
                  className={`dash-change${change === null ? " is-new" : change < 0 ? " is-down" : change > 0 ? " is-up" : ""}`}
                  title={`before: ${formatMoney(row.previousAmount ?? 0, currency)}`}
                >
                  {formatPercentChange(change)}
                </span>
              ) : null}
            </div>
            <span className="dash-rank-bar" aria-hidden>
              <i style={{ width: `${Math.max(2, Math.min(100, share))}%` }} />
            </span>
          </div>
        );
      })}
      {!rows.length ? <p className="dash-empty">No payments in this period.</p> : null}
    </div>
  );
}
