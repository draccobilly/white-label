"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminSheet } from "@/components/admin/AdminSheet";
import {
  addCalendarDays,
  inclusiveDayCount,
  isoDate,
  orderedRange,
  parseIsoDate,
  reportingIsoDate,
  type DateRange,
} from "@/lib/date-range";
import {
  COMPARE_MODES,
  PERIOD_PRESETS,
  comparisonLabel,
  isIsoDay,
  periodFromPreset,
  periodLabel,
  presetFor,
  previousPeriod,
  resolveComparison,
  sameRangeLastYear,
  type CompareMode,
  type Comparison,
} from "@/lib/periods";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function monthCells(month: Date) {
  const first = startOfMonth(month);
  const weekday = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < weekday; i += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  return cells;
}

export type PeriodSelection = {
  range: DateRange;
  compare: CompareMode;
  compareRange?: DateRange;
};

/**
 * Stripe-style period control: quick chips for the common windows plus a
 * sheet with presets, free dates (any day, any length) and "compare with".
 * Works with the thumb: every target is at least 40px tall.
 */
export function PeriodPicker({
  value,
  comparison,
  onApply,
}: {
  value: DateRange;
  comparison: Comparison;
  onApply: (selection: PeriodSelection) => void;
}) {
  const today = reportingIsoDate();
  const preset = presetFor(value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const [mode, setMode] = useState<CompareMode>(comparison.mode);
  const [customCompare, setCustomCompare] = useState<DateRange>(
    comparison.mode === "custom" && comparison.range ? comparison.range : previousPeriod(value),
  );
  const [month, setMonth] = useState(startOfMonth(parseIsoDate(value.from)));
  const [anchor, setAnchor] = useState<string | null>(null);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 2017 }, (_, index) => 2018 + index);
  }, []);

  const draftComparison = resolveComparison(draft, mode, customCompare.from, customCompare.to);
  const draftDays = inclusiveDayCount(draft.from, draft.to);

  function openSheet() {
    setDraft(value);
    setMode(comparison.mode);
    setCustomCompare(
      comparison.mode === "custom" && comparison.range ? comparison.range : previousPeriod(value),
    );
    setMonth(startOfMonth(parseIsoDate(value.from)));
    setAnchor(null);
    setOpen(true);
  }

  function quick(id: "today" | "yesterday" | "7d" | "30d") {
    const range = periodFromPreset(id);
    onApply({ range, compare: comparison.mode === "custom" ? "prev" : comparison.mode });
  }

  // Slides the window by its own length: a single day steps one day at a
  // time (anteontem → ontem → hoje), a week steps one week.
  const windowDays = inclusiveDayCount(value.from, value.to);
  const canStepForward = value.to < today;
  function step(direction: -1 | 1) {
    const from = addCalendarDays(value.from, direction * windowDays);
    const to = addCalendarDays(value.to, direction * windowDays);
    if (from > today) return;
    onApply({
      range: { from, to: to > today ? today : to },
      compare: comparison.mode === "custom" ? "prev" : comparison.mode,
    });
  }

  function pickDay(date: Date) {
    const next = isoDate(date);
    if (next > today) return;
    if (!anchor) {
      setDraft({ from: next, to: next });
      setAnchor(next);
      return;
    }
    setDraft(orderedRange(anchor, next));
    setAnchor(null);
  }

  function setDraftDate(key: "from" | "to", raw: string) {
    if (!isIsoDay(raw) || raw > today) return;
    const next = { ...draft, [key]: raw };
    setDraft(orderedRange(next.from, next.to));
    setMonth(startOfMonth(parseIsoDate(raw)));
    setAnchor(null);
  }

  function apply() {
    onApply({
      range: draft,
      compare: mode,
      compareRange: mode === "custom" ? orderedRange(customCompare.from, customCompare.to) : undefined,
    });
    setOpen(false);
  }

  const sheetLabel = `${periodLabel(value)} · ${comparisonLabel(comparison)}`;

  return (
    <>
      <div className="dash-chips period-chips" role="group" aria-label="Period">
        <button
          type="button"
          className={preset === "today" ? "is-active" : undefined}
          onClick={() => quick("today")}
        >
          Today
        </button>
        <button
          type="button"
          className={preset === "yesterday" ? "is-active" : undefined}
          onClick={() => quick("yesterday")}
        >
          Yesterday
        </button>
        <button type="button" className={preset === "7d" ? "is-active" : undefined} onClick={() => quick("7d")}>
          7D
        </button>
        <button type="button" className={preset === "30d" ? "is-active" : undefined} onClick={() => quick("30d")}>
          30D
        </button>
        <button
          type="button"
          className={`period-trigger${!["today", "yesterday", "7d", "30d"].includes(preset) ? " is-active" : ""}`}
          onClick={openSheet}
          aria-haspopup="dialog"
          title={sheetLabel}
        >
          <CalendarDays size={15} aria-hidden />
          <span>{periodLabel(value)}</span>
          <small>{comparison.range ? comparisonLabel(comparison) : "no comparison"}</small>
        </button>
        <span className="period-step" role="group" aria-label="Change the period">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={windowDays === 1 ? "Previous day" : `${windowDays} days earlier`}
            title={windowDays === 1 ? "Previous day" : `${windowDays} days earlier`}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!canStepForward}
            aria-label={windowDays === 1 ? "Next day" : `${windowDays} days later`}
            title={windowDays === 1 ? "Next day" : `${windowDays} days later`}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </span>
      </div>

      <AdminSheet open={open} title="Period and comparison" onClose={() => setOpen(false)}>
        <div className="period-sheet">
          <section className="period-block">
            <h3>Period</h3>
            <div className="period-presets">
              {PERIOD_PRESETS.map((item) => {
                const range = periodFromPreset(item.id);
                const active = range.from === draft.from && range.to === draft.to;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={active ? "is-active" : undefined}
                    onClick={() => {
                      setDraft(range);
                      setMonth(startOfMonth(parseIsoDate(range.from)));
                      setAnchor(null);
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="period-dates">
              <label>
                <span>From</span>
                <input
                  className="admin-input"
                  type="date"
                  value={draft.from}
                  max={today}
                  onChange={(event) => setDraftDate("from", event.target.value)}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  className="admin-input"
                  type="date"
                  value={draft.to}
                  max={today}
                  onChange={(event) => setDraftDate("to", event.target.value)}
                />
              </label>
              <p className="period-days">
                {draftDays} {draftDays === 1 ? "day" : "days"}
              </p>
            </div>
            <div className="dash-cal">
              <div className="dash-cal-nav">
                <button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
                  ‹
                </button>
                <strong>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
                <select
                  value={month.getFullYear()}
                  aria-label="Year"
                  onChange={(event) =>
                    setMonth(new Date(Number(event.target.value), month.getMonth(), 1))
                  }
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setMonth(addMonths(month, 1))}
                  aria-label="Next month"
                  disabled={isoDate(addMonths(month, 1)) > addCalendarDays(today, 31)}
                >
                  ›
                </button>
              </div>
              <div className="dash-cal-weekdays">
                {WEEKDAYS.map((day, index) => (
                  <span key={`${day}-${index}`}>{day}</span>
                ))}
              </div>
              <div className="dash-cal-days">
                {monthCells(month).map((day, index) =>
                  day ? (
                    <button
                      type="button"
                      key={isoDate(day)}
                      disabled={isoDate(day) > today}
                      className={[
                        isoDate(day) === draft.from ? "is-start" : "",
                        isoDate(day) === draft.to ? "is-end" : "",
                        isoDate(day) >= draft.from && isoDate(day) <= draft.to ? "is-in-range" : "",
                        draftComparison.range &&
                        isoDate(day) >= draftComparison.range.from &&
                        isoDate(day) <= draftComparison.range.to
                          ? "is-compare"
                          : "",
                        isoDate(day) === today ? "is-today" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => pickDay(day)}
                    >
                      {day.getDate()}
                    </button>
                  ) : (
                    <span key={`empty-${index}`} />
                  ),
                )}
              </div>
              <p className="dash-cal-hint">
                {anchor
                  ? "Now tap the last day."
                  : "Tap the first day, then the last. One tap selects a single day."}
              </p>
            </div>
          </section>

          <section className="period-block">
            <h3>Compare with</h3>
            <div className="period-compare" role="radiogroup" aria-label="Compare with">
              {COMPARE_MODES.map((item) => {
                const preview =
                  item.id === "prev"
                    ? periodLabel(previousPeriod(draft))
                    : item.id === "year"
                      ? periodLabel(sameRangeLastYear(draft))
                      : item.id === "custom"
                        ? periodLabel(orderedRange(customCompare.from, customCompare.to))
                        : "";
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={mode === item.id}
                    className={mode === item.id ? "is-active" : undefined}
                    onClick={() => setMode(item.id)}
                  >
                    <span>{item.label}</span>
                    {preview ? <small>{preview}</small> : null}
                  </button>
                );
              })}
            </div>
            {mode === "custom" ? (
              <div className="period-dates">
                <label>
                  <span>From</span>
                  <input
                    className="admin-input"
                    type="date"
                    value={customCompare.from}
                    max={today}
                    onChange={(event) =>
                      isIsoDay(event.target.value) &&
                      setCustomCompare({ ...customCompare, from: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>To</span>
                  <input
                    className="admin-input"
                    type="date"
                    value={customCompare.to}
                    max={today}
                    onChange={(event) =>
                      isIsoDay(event.target.value) &&
                      setCustomCompare({ ...customCompare, to: event.target.value })
                    }
                  />
                </label>
              </div>
            ) : null}
          </section>

          <div className="period-actions">
            <button type="button" className="primary-button" onClick={apply}>
              Apply: {periodLabel(draft)}
            </button>
          </div>
        </div>
      </AdminSheet>
    </>
  );
}
