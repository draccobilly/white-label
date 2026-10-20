import { SaleStatus } from "@/generated/prisma/enums";
import { SOCIAL_SEED_SESSION_PREFIX } from "@/lib/social-proof";

/** PagNovo sales have no Stripe session id; `NOT startsWith` would drop those rows. */
export const excludeSocialSeedSales = {
  OR: [
    { stripeCheckoutSessionId: null },
    {
      stripeCheckoutSessionId: {
        not: { startsWith: SOCIAL_SEED_SESSION_PREFIX },
      },
    },
  ],
};

export function paidLiveSalesWhere(companyId: string) {
  return {
    status: SaleStatus.PAID,
    livemode: true,
    ...excludeSocialSeedSales,
    campaign: { companyId },
  };
}

export const MISSION_TIP_CENTS = 500;

export function resolvedMissionTipCents(sale: {
  amount: number;
  tipAmount?: number | null;
  intentTipAmount?: number | null;
  donationOptionAmount?: number | null;
  stripeTipAmount?: number | null;
  campaignOptionAmounts?: number[] | null;
}) {
  const stored = Math.max(0, sale.tipAmount ?? 0);
  if (stored > 0) return stored;
  const option = sale.donationOptionAmount;
  const stripeTip = Math.max(0, sale.stripeTipAmount ?? 0);
  if (stripeTip > 0 && sale.amount >= stripeTip) {
    if (option == null || sale.amount - stripeTip === option) return stripeTip;
  }
  if (
    option != null &&
    sale.amount - option === MISSION_TIP_CENTS
  ) {
    return MISSION_TIP_CENTS;
  }
  const fromIntent = Math.max(0, sale.intentTipAmount ?? 0);
  if (fromIntent > 0 && sale.amount >= fromIntent) {
    if (option == null || sale.amount - fromIntent === option) return fromIntent;
  }
  const tickets = sale.campaignOptionAmounts ?? [];
  if (tickets.length) {
    const gift = sale.amount - MISSION_TIP_CENTS;
    if (tickets.includes(gift) && !tickets.includes(sale.amount)) {
      return MISSION_TIP_CENTS;
    }
  }
  return 0;
}

export function giftAmountCents(sale: { amount: number; tipAmount?: number | null }) {
  return Math.max(0, sale.amount - Math.max(0, sale.tipAmount ?? 0));
}

export function tipAmountCents(sale: { tipAmount?: number | null }) {
  return Math.max(0, sale.tipAmount ?? 0);
}

export function hasMissionTip(sale: { tipAmount?: number | null }) {
  return tipAmountCents(sale) > 0;
}
