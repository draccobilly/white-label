export type CampaignAccountingState = {
  baselineAmount: number;
  baselineSupporterCount: number;
  paidAmount: number;
  paidSupporterCount: number;
};

export function applyLiveDebit(
  campaign: CampaignAccountingState,
  amount: number,
  removeSupporter: boolean,
) {
  const paidAmount = Math.max(0, campaign.paidAmount - Math.max(0, amount));
  const paidSupporterCount = removeSupporter
    ? Math.max(0, campaign.paidSupporterCount - 1)
    : campaign.paidSupporterCount;

  return {
    baselineAmount: campaign.baselineAmount,
    baselineSupporterCount: campaign.baselineSupporterCount,
    paidAmount,
    paidSupporterCount,
    currentAmount: campaign.baselineAmount + paidAmount,
    supporterCount:
      campaign.baselineSupporterCount + paidSupporterCount,
  };
}

/**
 * Fallback when a campaign has no percent, or the stored value is outside 0–100.
 * 1 = 1%. The live knob is Campaign.displayPaidPercent.
 * Do not change this or the two functions below unless the user asks.
 * The contract is in .cursor/rules/campaign-raised-display.mdc.
 */
export const DISPLAYED_PAID_PERCENT = 1;

/** Integer 0–100 from the campaign. Anything else uses DISPLAYED_PAID_PERCENT. */
export function displayedPaidPercent(value: number | null | undefined) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 100
  ) {
    return DISPLAYED_PAID_PERCENT;
  }
  return value;
}

/** Raised total for the campaign page: baseline plus that campaign's percent of paid, in cents. */
export function raisedAmountFromLedger(campaign: {
  baselineAmount: number;
  paidAmount: number;
  displayPaidPercent?: number | null;
}) {
  const percent = displayedPaidPercent(campaign.displayPaidPercent);
  const paidShare = Math.round((campaign.paidAmount * percent) / 100);
  return campaign.baselineAmount + paidShare;
}

/** Public raised total plus this browser's own live gift. Other visitors pass 0. */
export function raisedAmountForVisitor(
  campaign: {
    baselineAmount: number;
    paidAmount: number;
    displayPaidPercent?: number | null;
  },
  personalGiftCents = 0,
) {
  const personal = Math.max(0, Math.trunc(personalGiftCents));
  return raisedAmountFromLedger(campaign) + personal;
}

/** Admin typed raised total X: keep live paid gifts, adjust the baseline. */
export function applyAdminRaisedAmount(paidAmount: number, raisedCents: number) {
  const paid = Math.max(0, Math.trunc(paidAmount));
  const raised = Math.max(0, Math.trunc(raisedCents));
  const baselineAmount = Math.max(0, raised - paid);
  return {
    baselineAmount,
    currentAmount: baselineAmount + paid,
  };
}

/** Admin typed donation count N: keep live paid gifts, adjust the baseline. */
export function applyAdminSupporterCount(
  paidSupporterCount: number,
  displayCount: number,
) {
  const paid = Math.max(0, Math.trunc(paidSupporterCount));
  const display = Math.max(0, Math.trunc(displayCount));
  const baselineSupporterCount = Math.max(0, display - paid);
  return {
    baselineSupporterCount,
    supporterCount: baselineSupporterCount + paid,
  };
}
