export const STANDARD_DONATION_AMOUNTS = [
  2500, 5000, 10000, 15000, 20000, 50000,
];

export const STANDARD_SUGGESTED_AMOUNT = 2500;
export const STANDARD_MIN_AMOUNT = 2500;

/** Mexico tickets in centavos: $100–$15,000 MXN. */
export const MXN_DONATION_AMOUNTS = [
  10_000, 20_000, 30_000, 50_000, 75_000, 100_000, 200_000, 300_000, 500_000,
  750_000, 1_000_000, 1_500_000,
] as const;

export const MXN_SUGGESTED_AMOUNT = 10_000;

/** Argentina tickets in centavos. Floor is AR$ 2.000 (Pagnovo ARS minimum). */
export const ARS_DONATION_AMOUNTS = [
  200_000, 300_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000,
  3_000_000, 4_000_000, 5_000_000, 7_500_000,
] as const;

export const ARS_SUGGESTED_AMOUNT = 200_000;
export const ARS_MIN_AMOUNT = 200_000;

export function isSpanishCurrency(currency?: string | null) {
  return currency === "MXN" || currency === "ARS";
}

export function minDonationCents(currency?: string | null) {
  if (currency === "MXN") return MXN_DONATION_AMOUNTS[0];
  if (currency === "ARS") return ARS_MIN_AMOUNT;
  return STANDARD_MIN_AMOUNT;
}

export function displayTicketCents(currency?: string | null) {
  if (currency === "MXN") return [...MXN_DONATION_AMOUNTS].slice(0, 6);
  if (currency === "ARS") return [...ARS_DONATION_AMOUNTS].slice(0, 6);
  return [...STANDARD_DONATION_AMOUNTS];
}

function donationCatalog(currency?: string | null) {
  if (currency === "MXN") return MXN_DONATION_AMOUNTS;
  if (currency === "ARS") return ARS_DONATION_AMOUNTS;
  if (!currency || currency === "USD") return STANDARD_DONATION_AMOUNTS;
  return null;
}

/** Saved ticket order, unless the campaign still uses the untouched desk catalog. */
export function publicTicketAmounts(
  currency: string | null | undefined,
  amountsInOrder: number[],
) {
  if (!amountsInOrder.length) return displayTicketCents(currency);
  const catalog = donationCatalog(currency);
  const untouched =
    catalog != null &&
    amountsInOrder.length === catalog.length &&
    amountsInOrder.every((amount, index) => amount === catalog[index]);
  if (untouched) return displayTicketCents(currency);
  return amountsInOrder;
}

type PublicTicket = {
  id: string;
  amount: number;
  suggested: boolean;
  paymentLinkId: string | null;
};

export function publicDonationTickets<T extends PublicTicket>(
  currency: string | null | undefined,
  options: T[],
) {
  const amounts = publicTicketAmounts(
    currency,
    options.map((option) => option.amount),
  );
  return amounts.map((amount) => {
    const match = options.find((item) => item.amount === amount);
    if (match) return match;
    return {
      id: `amt-${amount}`,
      amount,
      suggested: amount === amounts[0],
      paymentLinkId: null,
    } as T;
  });
}

export function parseDonationInput(raw: string, currency?: string | null) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const dollars = Number.parseFloat(cleaned);
  if (!Number.isFinite(dollars)) return null;
  const cents = Math.round(dollars * 100);
  const min = minDonationCents(currency);
  if (cents < min) return null;
  return Math.min(cents, 100_000_000);
}
