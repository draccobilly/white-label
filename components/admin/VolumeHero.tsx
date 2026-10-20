import type { ReactNode } from "react";

export function VolumeHero({
  label,
  value,
  delta,
  positive,
  compareLabel,
  compareValue,
  children,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  /** e.g. "período anterior: 18/09 – 24/09" */
  compareLabel?: string;
  /** Formatted total of the comparison period. */
  compareValue?: string;
  children?: ReactNode;
}) {
  const down = positive === false;
  const flat = delta ? /^[+-]?0(\.0)?%/.test(delta) || delta === "new" : false;
  return (
    <section className="dash-hero" aria-label={`${label}: ${value}`}>
      <div className="dash-hero-head">
        <p className="dash-hero-label">{label}</p>
        <p className="dash-hero-value">{value}</p>
        {delta ? (
          <p className={`dash-delta${down ? " is-down" : ""}${flat ? " is-flat" : ""}`}>
            {flat ? null : <span aria-hidden>{down ? "▼" : "▲"}</span>}
            {delta.replace(/^[+-]/, "")}
            {flat ? null : <span className="sr-only">{down ? " (down)" : " (up)"}</span>}
          </p>
        ) : null}
        {compareLabel ? (
          <p className="dash-hero-compare">
            {compareLabel}
            {compareValue ? <strong> {compareValue}</strong> : null}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
