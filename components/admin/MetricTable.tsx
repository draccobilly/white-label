import Link from "next/link";
import { formatCount, formatMultiple, formatRate, formatSignedRate, type EntityMetrics } from "@/lib/analytics";
import { formatPercentChange, percentChange } from "@/lib/periods";
import { formatMoney } from "@/lib/utils";

/**
 * Per-campaign / per-affiliate numbers. A real table on a desktop; on a
 * phone each row becomes a card with the figures in a small grid.
 */
export function MetricTable({
  rows,
  previous,
  currency,
  caption,
  emptyText,
}: {
  rows: EntityMetrics[];
  previous?: EntityMetrics[];
  currency: string;
  caption: string;
  emptyText: string;
}) {
  const before = new Map((previous ?? []).map((row) => [row.key, row]));
  const money = (value: number) => formatMoney(value, currency);
  // Ad columns only when some ad spend was entered for these rows.
  const showSpend = rows.some((row) => row.spend > 0);
  if (!rows.length) return <p className="dash-empty">{emptyText}</p>;
  return (
    <div className="metric-table-wrap">
      <table className="metric-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Receita</th>
            <th scope="col">Doações</th>
            <th scope="col">Ticket</th>
            <th scope="col" title="Receita por visitante">
              ARPU
            </th>
            <th scope="col">Cliques</th>
            <th scope="col" title="Doações por clique">
              Conv.
            </th>
            {showSpend ? (
              <>
                <th scope="col">Invest.</th>
                <th scope="col">CPA</th>
                <th scope="col">ROAS</th>
                <th scope="col">ROI</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const prior = before.get(row.key);
            const change = prior ? percentChange(row.revenue, prior.revenue) : undefined;
            return (
              <tr key={row.key}>
                <th scope="row" className="metric-name">
                  {row.href ? <Link href={row.href}>{row.label}</Link> : <span>{row.label}</span>}
                  {row.sublabel ? <small>{row.sublabel}</small> : null}
                </th>
                <td data-label="Receita" className="is-strong">
                  {money(row.revenue)}
                  {change !== undefined ? (
                    <span
                      className={`dash-change${change === null ? " is-new" : change < 0 ? " is-down" : change > 0 ? " is-up" : ""}`}
                      title={prior ? `antes: ${money(prior.revenue)}` : undefined}
                    >
                      {formatPercentChange(change)}
                    </span>
                  ) : null}
                </td>
                <td data-label="Doações">{formatCount(row.gifts)}</td>
                <td data-label="Ticket">{row.gifts ? money(row.ticket) : "—"}</td>
                <td data-label="ARPU">{row.arpu === null ? "—" : money(row.arpu)}</td>
                <td data-label="Cliques">{formatCount(row.clicks)}</td>
                <td data-label="Conv.">{formatRate(row.conversion)}</td>
                {showSpend ? (
                  <>
                    <td data-label="Invest.">{row.spend ? money(row.spend) : "—"}</td>
                    <td data-label="CPA">{row.cpa === null ? "—" : money(row.cpa)}</td>
                    <td data-label="ROAS" className={row.roas === null ? undefined : row.roas >= 2 ? "is-good" : row.roas < 1 ? "is-bad" : undefined}>
                      {formatMultiple(row.roas)}
                    </td>
                    <td data-label="ROI" className={row.roi === null ? undefined : row.roi >= 0 ? "is-good" : "is-bad"}>
                      {formatSignedRate(row.roi)}
                    </td>
                  </>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
