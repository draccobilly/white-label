import { formatPercentChange, percentChange } from "@/lib/periods";

export type Kpi = {
  key: string;
  label: string;
  value: string;
  /** Raw numbers used for the change chip; omit to hide it. */
  current?: number | null;
  previous?: number | null;
  /** True when a drop is good news (CPA, fees). */
  invert?: boolean;
  hint?: string;
  /** Short explanation of the formula. */
  formula?: string;
};

export function KpiGrid({ items, compareLabel }: { items: Kpi[]; compareLabel?: string }) {
  return (
    <div className="kpi-grid">
      {items.map((item) => {
        const hasChange =
          item.current !== undefined &&
          item.current !== null &&
          item.previous !== undefined &&
          item.previous !== null;
        const change = hasChange ? percentChange(item.current as number, item.previous as number) : undefined;
        const good = change === null ? true : change === undefined ? true : item.invert ? change <= 0 : change >= 0;
        return (
          <div key={item.key} className="kpi" title={item.formula}>
            <span className="kpi-label">{item.label}</span>
            <strong className="kpi-value">{item.value}</strong>
            {change !== undefined ? (
              <small
                className={`kpi-change${change === 0 ? "" : good ? " is-up" : " is-down"}`}
                title={compareLabel}
              >
                {formatPercentChange(change)}
                {compareLabel ? <span> {compareLabel}</span> : null}
              </small>
            ) : item.hint ? (
              <small className="kpi-hint">{item.hint}</small>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
