import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatMoney(
  amountInCents: number,
  currency = "USD",
  locale?: string,
) {
  return new Intl.NumberFormat(
    locale ??
      (currency === "MXN" ? "es-MX" : currency === "ARS" ? "es-AR" : "en-US"),
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    },
  ).format(amountInCents / 100);
}

export function formatMoneyExact(
  amountInCents: number,
  currency = "USD",
  locale?: string,
) {
  return new Intl.NumberFormat(
    locale ??
      (currency === "MXN" ? "es-MX" : currency === "ARS" ? "es-AR" : "en-US"),
    {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(amountInCents / 100);
}

export function progressPercent(current: number, goal: number) {
  if (goal <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / goal) * 1000) / 10));
}

export function formatRelativeTime(
  date: Date | string | null | undefined,
  locale?: string,
) {
  const es = locale === "es-MX" || locale === "es-AR";
  if (!date) return es ? "ahora" : "just now";
  const value = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.max(0, Math.round((Date.now() - value.getTime()) / 1000));
  if (seconds < 60) return es ? "ahora" : "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return es ? `hace ${minutes} min` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return es ? `hace ${hours} h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return es ? `hace ${days} d` : `${days}d ago`;
}

export function appendQuery(url: string, values: Record<string, string | null | undefined>) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(values)) {
    if (value) parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}

export function normalizeCheckoutUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Enter a payment link");
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Use an http or https payment link");
  }
  return parsed.toString();
}
