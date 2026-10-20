import { formatMoney, formatMoneyExact } from "@/lib/utils";

export function formatTicketCents(cents: number, currency = "USD") {
  if (!Number.isFinite(cents)) return "";
  if (currency === "ARS") return formatMoney(cents, currency);
  return formatMoneyExact(cents, currency);
}

export function formatMajorAmount(major: number, currency = "USD") {
  if (!Number.isFinite(major) || major <= 0) return "";
  return formatTicketCents(Math.round(major * 100), currency);
}

function normalizeAmountDigits(raw: string, currency: string) {
  const trimmed = raw.trim().replace(/\s/g, "").replace(/[^\d.,]/g, "");
  if (!trimmed) return "";
  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");

  if (currency === "ARS") {
    if (hasComma && hasDot) return trimmed.replace(/\./g, "").replace(",", ".");
    if (hasComma) return trimmed.replace(",", ".");
    if (hasDot) {
      const parts = trimmed.split(".");
      if (parts.length > 2 || (parts[1]?.length === 3 && parts[0].length > 0)) {
        return trimmed.replace(/\./g, "");
      }
    }
    return trimmed;
  }

  if (hasComma && hasDot) return trimmed.replace(/,/g, "");
  if (hasComma && !hasDot) {
    const parts = trimmed.split(",");
    if (parts[1] && parts[1].length <= 2) return trimmed.replace(",", ".");
    return trimmed.replace(/,/g, "");
  }
  return trimmed;
}

export function parseMajorAmount(raw: string, currency = "USD") {
  const normalized = normalizeAmountDigits(raw, currency);
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}
