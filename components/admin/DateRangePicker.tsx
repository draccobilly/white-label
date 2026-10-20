"use client";

import { useMemo, useState } from "react";
import { AdminSheet } from "@/components/admin/AdminSheet";
import {
  addCalendarDays,
  formatDisplayDate,
  isoDate,
  lastDaysRange,
  orderedRange,
  parseIsoDate,
  periodChipFor,
  rangeFromPreset,
  reportingIsoDate,
  type DateRange,
} from "@/lib/date-range";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

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

function formatRange(range: DateRange) {
  const from = formatDisplayDate(range.from);
  const to = formatDisplayDate(range.to);
  return from === to ? from : `${from} – ${to}`;
}

export function DateRangePicker({
  value,
  onApply,
}: {
  value: DateRange;
  onApply: (range: DateRange) => void;
}) {
  const chip = periodChipFor(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(startOfMonth(parseIsoDate(value.from)));
  const [anchor, setAnchor] = useState<string | null>(null);
  const [draft, setDraft] = useState(value);
  const today = reportingIsoDate();
  const preview = draft;

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 2017 }, (_, index) => 2018 + index);
  }, []);

  function openCalendar() {
    setDraft(value);
    setMonth(startOfMonth(parseIsoDate(value.from)));
    setAnchor(null);
    setOpen(true);
  }

  function closeCalendar() {
    if (anchor) onApply(draft);
    setOpen(false);
    setAnchor(null);
  }

  function pickDay(date: Date) {
    const next = isoDate(date);
    if (next > today) return;
    if (!anchor) {
      const range = { from: next, to: next };
      setAnchor(next);
      setDraft(range);
      return;
    }
    const range = orderedRange(anchor, next);
    setDraft(range);
    setAnchor(null);
    onApply(range);
    setOpen(false);
  }

  return (
    <>
      <div className="dash-chips" role="group" aria-label="Date range">
        <button
          type="button"
          className={chip === "today" ? "is-active" : undefined}
          onClick={() => onApply(rangeFromPreset("today"))}
        >
          Today
        </button>
        <button
          type="button"
          className={chip === "7d" ? "is-active" : undefined}
          onClick={() => onApply(lastDaysRange(7))}
        >
          7D
        </button>
        <button
          type="button"
          className={chip === "30d" ? "is-active" : undefined}
          onClick={() => onApply(lastDaysRange(30))}
        >
          30D
        </button>
        <button
          type="button"
          className={chip === "custom" || open ? "is-active" : undefined}
          onClick={openCalendar}
        >
          {chip === "custom" ? formatRange(value) : "Custom"}
        </button>
      </div>

      <AdminSheet open={open} title="Select dates" onClose={closeCalendar}>
        <div className="dash-cal">
          <div className="dash-cal-nav">
            <button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
              ‹
            </button>
            <strong>
              {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </strong>
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
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
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
                    isoDate(day) === preview.from ? "is-start" : "",
                    isoDate(day) === preview.to ? "is-end" : "",
                    isoDate(day) >= preview.from && isoDate(day) <= preview.to
                      ? "is-in-range"
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
          <p className="dash-cal-hint">Tap a start day, then an end day. Filters as soon as you pick both.</p>
        </div>
      </AdminSheet>
    </>
  );
}
