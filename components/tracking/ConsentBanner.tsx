"use client";

export const CONSENT_KEY = "arc_direct_marketing_consent";
export const MEXICO_CONSENT_KEY = "arc_direct_marketing_consent_mexico";
export const ARGENTINA_CONSENT_KEY = "arc_direct_marketing_consent_argentina";

export function consentStorageKey(
  region?: "mexico" | "argentina" | "default" | string | null,
) {
  if (region === "mexico" || region === "/mexico") return MEXICO_CONSENT_KEY;
  if (region === "argentina" || region === "/argentina") {
    return ARGENTINA_CONSENT_KEY;
  }
  return CONSENT_KEY;
}

export function hasMarketingConsent() {
  return typeof window !== "undefined";
}

/** Measurement banner is not shown on the public site. Pixels load without a click. */
export function ConsentBanner(_props?: {
  locale?: string;
  region?: "mexico" | "default" | string | null;
}) {
  return null;
}
