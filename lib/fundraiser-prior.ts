import { parseMajorAmount } from "@/lib/money-input";

export const FUNDRAISER_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "BRL",
  "CAD",
  "MXN",
  "ARS",
] as const;

export type FundraiserCurrency = (typeof FUNDRAISER_CURRENCIES)[number];

/** Desk currency for the amount an organizer already raised. */
export function fundraiserCurrency(
  locale: string | null | undefined,
): FundraiserCurrency {
  if (locale === "es-MX") return "MXN";
  if (locale === "es-AR") return "ARS";
  return "USD";
}

export function asFundraiserCurrency(
  value: string | null | undefined,
): FundraiserCurrency {
  return (FUNDRAISER_CURRENCIES as readonly string[]).includes(value ?? "")
    ? (value as FundraiserCurrency)
    : "USD";
}

/**
 * Cents from the Raised field. Empty or zero is 0. Anything that is not a
 * positive amount in that currency is null so the form can ask again.
 */
export function priorRaisedCentsFromInput(raw: string, currency: string) {
  const trimmed = raw.trim();
  if (!trimmed || /^0+(?:[.,]0+)?$/.test(trimmed)) return 0;
  const major = parseMajorAmount(trimmed, currency);
  if (major == null) return null;
  const cents = Math.round(major * 100);
  if (cents <= 0 || cents > 1_000_000_000) return null;
  return cents;
}

/** Whole donation count. Empty or zero is 0. Decimals and text are null. */
export function priorDonationCountFromInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed || /^0+$/.test(trimmed)) return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  const count = Number(trimmed);
  if (!Number.isInteger(count) || count < 0 || count > 10_000_000) return null;
  return count;
}

/**
 * Form fields and JSON both arrive here. A blank value is zero. Anything that
 * is not a whole number becomes -1 so the schema rejects it.
 */
export function priorWholeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  if (!/^\d+$/.test(raw)) return -1;
  return Number(raw);
}
