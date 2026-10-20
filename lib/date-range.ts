export type DateRange = {
  from: string;
  to: string;
};

export type DatePresetId =
  | "today"
  | "7d"
  | "4w"
  | "6m"
  | "12m"
  | "mtd"
  | "qtd"
  | "ytd"
  | "all";

/** Same calendar as Utmify and Facebook Ads. */
export const REPORTING_TIME_ZONE = "America/Los_Angeles";

export const DATE_PRESETS: { id: DatePresetId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "4w", label: "Last 4 weeks" },
  { id: "6m", label: "Last 6 months" },
  { id: "12m", label: "Last 12 months" },
  { id: "mtd", label: "Month to date" },
  { id: "qtd", label: "Quarter to date" },
  { id: "ytd", label: "Year to date" },
  { id: "all", label: "All time" },
];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function partsInTimeZone(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function offsetMsAt(date: Date, timeZone: string) {
  const parts = partsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

/** Civil YYYY-MM-DD of a local Date — used by the calendar UI. */
export function isoDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Civil YYYY-MM-DD in America/Los_Angeles. */
export function reportingIsoDate(date = new Date()) {
  const { year, month, day } = partsInTimeZone(date, REPORTING_TIME_ZONE);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Naive `YYYY-MM-DD HH:MM:SS` in America/Los_Angeles — admin charts only. Utmify stays UTC. */
export function formatReportingDateTime(date: Date) {
  const { year, month, day, hour, minute, second } = partsInTimeZone(
    date,
    REPORTING_TIME_ZONE,
  );
  return `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

export function addCalendarDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days))
    .toISOString()
    .slice(0, 10);
}

function addCalendarMonths(iso: string, months: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1 + months, day ?? 1))
    .toISOString()
    .slice(0, 10);
}

export function inclusiveDayCount(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Instant when YYYY-MM-DD starts in America/Los_Angeles (DST-aware). */
export function zonedStartOfDay(
  iso: string,
  timeZone = REPORTING_TIME_ZONE,
) {
  const [year, month, day] = iso.split("-").map(Number);
  const wallAsUtc = Date.UTC(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
  const first = new Date(wallAsUtc - offsetMsAt(new Date(wallAsUtc), timeZone));
  return new Date(wallAsUtc - offsetMsAt(first, timeZone));
}

export function reportingStartOfDay(now = new Date()) {
  return zonedStartOfDay(reportingIsoDate(now));
}

export function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function rangeFromPreset(id: DatePresetId, now = new Date()): DateRange {
  const to = reportingIsoDate(now);
  let from = to;

  switch (id) {
    case "today":
      break;
    case "7d":
      from = addCalendarDays(to, -6);
      break;
    case "4w":
      from = addCalendarDays(to, -27);
      break;
    case "6m":
      from = addCalendarMonths(to, -6);
      break;
    case "12m":
      from = addCalendarMonths(to, -12);
      break;
    case "mtd":
      from = `${to.slice(0, 7)}-01`;
      break;
    case "qtd": {
      const month = Number(to.slice(5, 7));
      const quarterStart = Math.floor((month - 1) / 3) * 3 + 1;
      from = `${to.slice(0, 4)}-${pad2(quarterStart)}-01`;
      break;
    }
    case "ytd":
      from = `${to.slice(0, 4)}-01-01`;
      break;
    case "all":
      from = "2020-01-01";
      break;
  }

  return { from, to };
}

export function formatDisplayDate(value: string) {
  const date = parseIsoDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatReportingChartDay(iso: string) {
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatReportingWeekday(iso: string) {
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

export function parseDisplayDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = parseIsoDate(trimmed);
    return Number.isNaN(date.getTime()) ? null : isoDate(date);
  }
  const match = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return isoDate(date);
}

export function orderedRange(from: string, to: string): DateRange {
  return from <= to ? { from, to } : { from: to, to: from };
}

export function lastDaysRange(days: number, now = new Date()): DateRange {
  const to = reportingIsoDate(now);
  return { from: addCalendarDays(to, 1 - days), to };
}

export type HomeRangeId = "today" | "7" | "30";

export function homeRangeFromQuery(range?: string | null): HomeRangeId {
  if (range === "today" || range === "1") return "today";
  if (range === "7") return "7";
  return "30";
}

export function homeRangeDays(id: HomeRangeId) {
  return id === "today" ? 1 : Number(id);
}

export function reportingHour(date: Date) {
  return partsInTimeZone(date, REPORTING_TIME_ZONE).hour;
}

export function formatReportingHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12} ${suffix}`;
}

export type PeriodChip = "today" | "7d" | "30d" | "custom";

export function periodChipFor(range: DateRange, now = new Date()): PeriodChip {
  const today = rangeFromPreset("today", now);
  if (range.from === today.from && range.to === today.to) return "today";
  const week = lastDaysRange(7, now);
  if (range.from === week.from && range.to === week.to) return "7d";
  const month = lastDaysRange(30, now);
  if (range.from === month.from && range.to === month.to) return "30d";
  return "custom";
}

export function defaultSalesRange() {
  return lastDaysRange(7);
}

export function dayBounds(range: DateRange) {
  const fromDate = zonedStartOfDay(range.from);
  const toDate = new Date(zonedStartOfDay(addCalendarDays(range.to, 1)).getTime() - 1);
  return { fromDate, toDate };
}

/** @deprecated Use dayBounds — days are America/Los_Angeles, not UTC. */
export function utcDayBounds(range: DateRange) {
  return dayBounds(range);
}
