/** Tips are display-only; payment-link amounts must not change. */
export const DEFAULT_TIP_PERCENT = 0;
export const TIP_PERCENT_MIN = 0;
export const TIP_PERCENT_MAX = 30;
export const TIP_SLIDER_TICKS = [0, 5, 10, 15, 20, 25, 30] as const;

export function clampTipPercent(percent: number) {
  if (!Number.isFinite(percent)) return DEFAULT_TIP_PERCENT;
  return Math.min(TIP_PERCENT_MAX, Math.max(TIP_PERCENT_MIN, percent));
}

export function tipCentsForPercent(donationCents: number, percent: number) {
  const donation = Math.max(0, Math.round(donationCents));
  return Math.max(0, Math.round(donation * (clampTipPercent(percent) / 100)));
}

export function tipPercentFromCents(donationCents: number, tipCents: number) {
  if (donationCents <= 0) return 0;
  return (Math.max(0, tipCents) / donationCents) * 100;
}

/**
 * Donation stays the option amount. Chargeable tip is disabled for fixed
 * payment-link amounts — callers should pass 0.
 */
export function splitCheckoutCharge(
  donationCents: number,
  tipCents: number | null | undefined,
) {
  const donationAmount = Math.max(0, Math.round(donationCents));
  void tipCents;
  return {
    donationAmount,
    tipAmount: 0,
    chargeAmount: donationAmount,
  };
}
