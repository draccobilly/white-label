"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/utils";
import { formatPercentChange, percentChange } from "@/lib/periods";

export type VolumeBucket = {
  /** Full label for the readout, e.g. "2026-10-02" or "2026-10-02 3 PM". */
  label: string;
  amount: number;
  /** Short axis label. Leave empty to skip the tick under this bar. */
  tick?: string;
  /** Marks the bucket that contains "now" (this hour, or today). */
  current?: boolean;
  /** Same bucket in the comparison period, when one is selected. */
  compare?: number;
  /** Label of the comparison bucket, e.g. "2026-09-25". */
  compareLabel?: string;
};

function prettyLabel(label: string) {
  const match = label.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(.+))?$/);
  if (!match) return label;
  const day = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00.000Z`).toLocaleDateString(
    "en-US",
    { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" },
  );
  return match[4] ? `${day}, ${match[4]}` : day;
}

function fallbackTick(label: string) {
  const match = label.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(.+))?$/);
  if (!match) return label;
  if (match[4]) return match[4];
  return `${Number(match[2])}/${Number(match[3])}`;
}

/**
 * Volume chart. Each bar is a button: tap or focus one to read its exact
 * value, which a phone cannot do with a hover tooltip. When a comparison
 * period is selected, its value shows as a lighter bar behind the current one.
 */
export function VolumeBars({
  buckets,
  currency,
}: {
  buckets: VolumeBucket[];
  currency: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const hasCompare = buckets.some((bucket) => bucket.compare !== undefined);
  const max = Math.max(
    1,
    ...buckets.map((bucket) => Math.max(bucket.amount, hasCompare ? (bucket.compare ?? 0) : 0)),
  );
  const peak = buckets.reduce(
    (best, bucket, index) => (bucket.amount > (buckets[best]?.amount ?? 0) ? index : best),
    0,
  );
  const hasVolume = buckets.some((bucket) => bucket.amount > 0);
  const currentIndex = buckets.findIndex((bucket) => bucket.current);
  const shown = selected ?? (currentIndex >= 0 ? currentIndex : peak);
  const shownBucket = buckets[shown];
  const hasTicks = buckets.some((bucket) => bucket.tick !== undefined);
  // Without explicit ticks, label the first, middle and last bars.
  const autoTicks = new Set([0, Math.floor((buckets.length - 1) / 2), buckets.length - 1]);
  const shownChange =
    shownBucket && shownBucket.compare !== undefined
      ? percentChange(shownBucket.amount, shownBucket.compare)
      : null;

  return (
    <div className="dash-chart">
      <p className="dash-chart-readout" aria-live="polite">
        {shownBucket ? (
          <>
            <span>
              {prettyLabel(shownBucket.label)}
              {selected === null && shownBucket.current
                ? /\d\s+\S/.test(shownBucket.label)
                  ? " (now)"
                  : " (today)"
                : ""}
              {selected === null && !shownBucket.current && hasVolume ? " (peak)" : ""}
            </span>
            <strong>
              {formatMoney(shownBucket.amount, currency)}
              {shownBucket.compare !== undefined ? (
                <small
                  className={
                    shownChange === null ? undefined : shownChange < 0 ? "is-down" : shownChange > 0 ? "is-up" : undefined
                  }
                  title={shownBucket.compareLabel ? prettyLabel(shownBucket.compareLabel) : undefined}
                >
                  {" "}
                  vs {formatMoney(shownBucket.compare, currency)}
                  {shownBucket.compare > 0 ? ` (${formatPercentChange(shownChange)})` : ""}
                </small>
              ) : null}
            </strong>
          </>
        ) : null}
      </p>
      <div
        className={`dash-bars${buckets.length > 16 ? " is-dense" : ""}${hasCompare ? " has-compare" : ""}`}
        role="group"
        aria-label="Volume over time"
      >
        {buckets.map((bucket, index) => {
          const height = bucket.amount > 0 ? Math.max(6, (bucket.amount / max) * 100) : 0;
          const ghost =
            bucket.compare !== undefined && bucket.compare > 0
              ? Math.max(4, (bucket.compare / max) * 100)
              : 0;
          const tick = hasTicks ? bucket.tick : autoTicks.has(index) ? fallbackTick(bucket.label) : "";
          const label = `${prettyLabel(bucket.label)}: ${formatMoney(bucket.amount, currency)}${
            bucket.compare !== undefined ? `, before ${formatMoney(bucket.compare, currency)}` : ""
          }`;
          return (
            <button
              type="button"
              key={bucket.label}
              className={[
                "dash-bar",
                bucket.current ? "is-current" : "",
                selected === index ? "is-selected" : "",
                bucket.amount > 0 ? "" : "is-empty",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={label}
              aria-pressed={selected === index}
              onClick={() => setSelected((value) => (value === index ? null : index))}
              onMouseEnter={() => setSelected(index)}
              onMouseLeave={() => setSelected(null)}
              onFocus={() => setSelected(index)}
              onBlur={() => setSelected(null)}
            >
              <span className="dash-bar-track">
                {hasCompare ? (
                  <span className="dash-bar-ghost" style={{ height: `${ghost}%` }} />
                ) : null}
                <span className="dash-bar-fill" style={{ height: `${height}%` }} />
              </span>
              <span className="dash-bar-tick" aria-hidden>
                {tick}
              </span>
            </button>
          );
        })}
      </div>
      {hasCompare ? (
        <p className="dash-chart-legend" aria-hidden>
          <span className="is-now" /> selected period
          <span className="is-ghost" /> comparison
        </p>
      ) : null}
    </div>
  );
}
