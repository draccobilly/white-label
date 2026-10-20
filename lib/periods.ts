import {
  addCalendarDays,
  formatDisplayDate,
  inclusiveDayCount,
  lastDaysRange,
  orderedRange,
  reportingIsoDate,
  type DateRange,
} from "@/lib/date-range";

export type PeriodPresetId =
  | "today"
  | "yesterday"
  | "day-before"
  | "7d"
  | "14d"
  | "30d"
  | "mtd"
  | "last-month"
  | "90d";

export const PERIOD_PRESETS: Array<{ id: PeriodPresetId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "day-before", label: "Day before" },
  { id: "7d", label: "Last 7 days" },
  { id: "14d", label: "Last 14 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "mtd", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "90d", label: "Last 90 days" },
];

export type CompareMode = "prev" | "year" | "custom" | "none";

export const COMPARE_MODES: Array<{ id: CompareMode; label: string }> = [
  { id: "prev", label: "Previous period" },
  { id: "year", label: "Same period last year" },
  { id: "custom", label: "Another period" },
  { id: "none", label: "No comparison" },
];

export type Comparison = {
  mode: CompareMode;
  range: DateRange | null;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: string | undefined): value is string {
  return Boolean(value && ISO.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

export function periodFromPreset(id: PeriodPresetId, now = new Date()): DateRange {
  const today = reportingIsoDate(now);
  switch (id) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const day = addCalendarDays(today, -1);
      return { from: day, to: day };
    }
    case "day-before": {
      const day = addCalendarDays(today, -2);
      return { from: day, to: day };
    }
    case "7d":
      return lastDaysRange(7, now);
    case "14d":
      return lastDaysRange(14, now);
    case "30d":
      return lastDaysRange(30, now);
    case "90d":
      return lastDaysRange(90, now);
    case "mtd":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "last-month": {
      const firstOfThisMonth = `${today.slice(0, 7)}-01`;
      const lastOfPrevious = addCalendarDays(firstOfThisMonth, -1);
      return { from: `${lastOfPrevious.slice(0, 7)}-01`, to: lastOfPrevious };
    }
  }
}

export function presetFor(range: DateRange, now = new Date()): PeriodPresetId | "custom" {
  for (const preset of PERIOD_PRESETS) {
    const candidate = periodFromPreset(preset.id, now);
    if (candidate.from === range.from && candidate.to === range.to) return preset.id;
  }
  return "custom";
}

/** The same number of days, ending the day before the range starts. */
export function previousPeriod(range: DateRange): DateRange {
  const days = inclusiveDayCount(range.from, range.to);
  const to = addCalendarDays(range.from, -1);
  return { from: addCalendarDays(to, 1 - days), to };
}

/** The same calendar dates one year earlier. */
export function sameRangeLastYear(range: DateRange): DateRange {
  const shift = (iso: string) => {
    const year = Number(iso.slice(0, 4)) - 1;
    const rest = iso.slice(4);
    const candidate = `${year}${rest}`;
    // 29 Feb has no twin the year before; use 28 Feb.
    return Number.isNaN(Date.parse(`${candidate}T00:00:00Z`)) ? `${year}-02-28` : candidate;
  };
  return { from: shift(range.from), to: shift(range.to) };
}

export function parseCompareMode(value: string | undefined): CompareMode {
  return value === "year" || value === "custom" || value === "none" ? value : "prev";
}

export function resolveComparison(
  range: DateRange,
  mode: CompareMode,
  customFrom?: string,
  customTo?: string,
): Comparison {
  switch (mode) {
    case "none":
      return { mode, range: null };
    case "year":
      return { mode, range: sameRangeLastYear(range) };
    case "custom":
      if (isIsoDay(customFrom) && isIsoDay(customTo)) {
        return { mode, range: orderedRange(customFrom, customTo) };
      }
      return { mode: "prev", range: previousPeriod(range) };
    default:
      return { mode: "prev", range: previousPeriod(range) };
  }
}

/** Query string pieces for links that must keep the current comparison. */
export function comparisonQuery(comparison: Comparison): Record<string, string> {
  if (comparison.mode === "custom" && comparison.range) {
    return { cmp: "custom", cfrom: comparison.range.from, cto: comparison.range.to };
  }
  if (comparison.mode === "prev") return {};
  return { cmp: comparison.mode };
}

export function shortDay(iso: string) {
  return formatDisplayDate(iso).slice(0, 5);
}

/** "25/09 – 01/10" or a single day. */
export function periodLabel(range: DateRange) {
  return range.from === range.to ? shortDay(range.from) : `${shortDay(range.from)} – ${shortDay(range.to)}`;
}

export function comparisonLabel(comparison: Comparison) {
  if (!comparison.range) return "no comparison";
  const prefix =
    comparison.mode === "year" ? "last year" : comparison.mode === "custom" ? "vs" : "previous period";
  return `${prefix}: ${periodLabel(comparison.range)}`;
}

/** Percentage change, null when the previous value is zero. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function formatPercentChange(change: number | null) {
  if (change === null) return "new";
  const rounded = Math.abs(change) >= 100 ? Math.round(change) : change;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

/**
 * Pairs each day of the range with the day in the same position of the
 * comparison range (day 1 with day 1, …). A shorter comparison leaves nulls.
 */
export function pairDays(range: DateRange, comparison: DateRange | null) {
  const days = inclusiveDayCount(range.from, range.to);
  const compareDays = comparison ? inclusiveDayCount(comparison.from, comparison.to) : 0;
  return Array.from({ length: days }, (_, index) => ({
    day: addCalendarDays(range.from, index),
    compareDay: comparison && index < compareDays ? addCalendarDays(comparison.from, index) : null,
  }));
}
