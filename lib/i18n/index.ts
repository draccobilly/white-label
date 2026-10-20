import { en } from "@/lib/i18n/en";
import { esMX } from "@/lib/i18n/es-MX";
import type { AppLocale, Messages } from "@/lib/i18n/types";

export type { AppLocale, Messages };

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "en" || value === "es-MX" || value === "es-AR";
}

export function isSpanishLocale(value: string | null | undefined) {
  return value === "es-MX" || value === "es-AR";
}

export function messagesFor(locale: string | null | undefined): Messages {
  return isSpanishLocale(locale) ? esMX : en;
}

export function moneyLocale(locale: string | null | undefined, currency: string) {
  if (locale === "es-AR" || currency === "ARS") return "es-AR";
  if (locale === "es-MX" || currency === "MXN") return "es-MX";
  return "en-US";
}
