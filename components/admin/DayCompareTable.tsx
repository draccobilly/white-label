import { formatCount, formatMultiple, formatRate, type DayMetrics } from "@/lib/analytics";
import { formatReportingChartDay, formatReportingWeekday, type DateRange } from "@/lib/date-range";
import { formatPercentChange, pairDays, percentChange } from "@/lib/periods";
import { formatMoney } from "@/lib/utils";

/**
 * Day by day, each day beside the matching day of the comparison period
 * (first day with first day, and so on), the way Stripe lines up periods.
 */
export function DayCompareTable({
  range,
  days,
  compareRange,
  compareDays,
  currency,
}: {
  range: DateRange;
  days: DayMetrics[];
  compareRange: DateRange | null;
  compareDays: DayMetrics[] | null;
  currency: string;
}) {
  const byDay = new Map(days.map((row) => [row.day, row]));
  const compareByDay = new Map((compareDays ?? []).map((row) => [row.day, row]));
  const pairs = pairDays(range, compareRange);
  const money = (value: number) => formatMoney(value, currency);
  const totals = days.reduce(
    (sum, row) => ({ revenue: sum.revenue + row.revenue, gifts: sum.gifts + row.gifts, clicks: sum.clicks + row.clicks, spend: sum.spend + row.spend }),
    { revenue: 0, gifts: 0, clicks: 0, spend: 0 },
  );
  // Ad columns only when some ad spend was entered in the period.
  const showSpend = totals.spend > 0;
  const compareTotals = (compareDays ?? []).reduce((sum, row) => sum + row.revenue, 0);
  const totalChange = compareRange ? percentChange(totals.revenue, compareTotals) : undefined;

  return (
    <div className="metric-table-wrap">
      <table className="metric-table day-table">
        <caption className="sr-only">Vendas dia a dia</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Receita</th>
            {compareRange ? <th scope="col">Comparação</th> : null}
            <th scope="col">Doações</th>
            <th scope="col">Cliques</th>
            <th scope="col">Conv.</th>
            {showSpend ? <th scope="col">Invest.</th> : null}
            {showSpend ? <th scope="col">ROAS</th> : null}
          </tr>
        </thead>
        <tbody>
          {pairs.map(({ day, compareDay }) => {
            const row = byDay.get(day);
            const other = compareDay ? compareByDay.get(compareDay) : undefined;
            const change = other ? percentChange(row?.revenue ?? 0, other.revenue) : undefined;
            return (
              <tr key={day}>
                <th scope="row" className="metric-name">
                  <span>
                    {formatReportingWeekday(day)} {formatReportingChartDay(day)}
                  </span>
                </th>
                <td data-label="Receita" className="is-strong">
                  {money(row?.revenue ?? 0)}
                  {change !== undefined ? (
                    <span
                      className={`dash-change${change === null ? " is-new" : change < 0 ? " is-down" : change > 0 ? " is-up" : ""}`}
                    >
                      {formatPercentChange(change)}
                    </span>
                  ) : null}
                </td>
                {compareRange ? (
                  <td data-label="Comparação" className="is-muted">
                    {compareDay ? (
                      <>
                        <small>{formatReportingWeekday(compareDay)} {formatReportingChartDay(compareDay)}</small>{" "}
                        {money(other?.revenue ?? 0)}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                ) : null}
                <td data-label="Doações">{formatCount(row?.gifts ?? 0)}</td>
                <td data-label="Cliques">{formatCount(row?.clicks ?? 0)}</td>
                <td data-label="Conv.">{formatRate(row?.conversion ?? null)}</td>
                {showSpend ? <td data-label="Invest.">{row?.spend ? money(row.spend) : "—"}</td> : null}
                {showSpend ? <td data-label="ROAS">{formatMultiple(row?.roas ?? null)}</td> : null}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="metric-name">
              <span>Total</span>
            </th>
            <td data-label="Receita" className="is-strong">
              {money(totals.revenue)}
              {totalChange !== undefined ? (
                <span
                  className={`dash-change${totalChange === null ? " is-new" : totalChange < 0 ? " is-down" : totalChange > 0 ? " is-up" : ""}`}
                >
                  {formatPercentChange(totalChange)}
                </span>
              ) : null}
            </td>
            {compareRange ? (
              <td data-label="Comparação" className="is-muted">
                {money(compareTotals)}
              </td>
            ) : null}
            <td data-label="Doações">{formatCount(totals.gifts)}</td>
            <td data-label="Cliques">{formatCount(totals.clicks)}</td>
            <td data-label="Conv.">{formatRate(totals.clicks ? totals.gifts / totals.clicks : null)}</td>
            {showSpend ? <td data-label="Invest.">{money(totals.spend)}</td> : null}
            {showSpend ? <td data-label="ROAS">{formatMultiple(totals.revenue / totals.spend)}</td> : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
