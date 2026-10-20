import { STANDARD_DONATION_AMOUNTS } from "@/lib/donation-ticket";
import { canAttachAffiliateToCompany } from "@/lib/pixel-isolation";

const USD_MIN_CENTS = 100_000;
const USD_MAX_CENTS = 200_000;

export function createSocialProofSeed(optionAmounts: number[] = []) {
  const tickets = [...optionAmounts]
    .filter((amount) => amount > 0)
    .sort((a, b) => a - b);
  const minTicket = tickets[0] ?? 2_500;
  const usdStyle = minTicket < 50_000;

  if (usdStyle) {
    const raised =
      USD_MIN_CENTS + Math.round(Math.random() * (USD_MAX_CENTS - USD_MIN_CENTS));
    const currentAmount = Math.round(raised / 100) * 100;
    const typicalGifts = tickets.filter(
      (amount) => amount >= 2_500 && amount <= 20_000,
    );
    const baseline = typicalGifts[0] ?? 5_000;
    const averageGift = Math.round(baseline * (1.15 + Math.random() * 0.85));
    const supporterCount = Math.max(
      14,
      Math.min(52, Math.round(currentAmount / Math.max(averageGift, 2_500))),
    );
    return { currentAmount, supporterCount };
  }

  const giftCount = 10 + Math.round(Math.random() * 8);
  const currentAmount = minTicket * giftCount;
  const supporterCount = giftCount;
  return { currentAmount, supporterCount };
}

export const SOCIAL_SEED_SESSION_PREFIX = "seed-social-";

export function socialSeedSessionId(campaignId: string, index: number) {
  return `${SOCIAL_SEED_SESSION_PREFIX}${campaignId}-${index}`;
}

export function isSocialSeedSession(sessionId: string | null | undefined) {
  return Boolean(sessionId?.startsWith(SOCIAL_SEED_SESSION_PREFIX));
}

export function splitSocialProofGifts(
  totalCents: number,
  donorCount: number,
  tickets: readonly number[] = STANDARD_DONATION_AMOUNTS,
) {
  const sorted = [...tickets].filter((amount) => amount > 0).sort((a, b) => a - b);
  const min = sorted[0] ?? 2500;
  const total = Math.max(0, Math.round(totalCents));
  if (total < min) return total > 0 ? [sorted.find((amount) => amount <= total) ?? min] : [];

  const maxCount = Math.floor(total / min);
  const count = Math.max(1, Math.min(Math.round(donorCount), maxCount));
  const amounts = Array.from({ length: count }, () => min);
  let leftover = total - min * count;

  let cursor = 0;
  let guard = 0;
  while (leftover > 0 && guard < count * sorted.length * 2) {
    const index = cursor % amounts.length;
    const current = amounts[index]!;
    const next = sorted.find(
      (amount) => amount > current && amount - current <= leftover,
    );
    if (next) {
      leftover -= next - current;
      amounts[index] = next;
    }
    cursor += 1;
    guard += 1;
    if (cursor % amounts.length === 0) {
      const canUpgrade = amounts.some((amount) =>
        sorted.some((ticket) => ticket > amount && ticket - amount <= leftover),
      );
      if (!canUpgrade) break;
    }
  }

  return amounts;
}

export function isAnonymousDonorName(name: string | null | undefined) {
  return !name || /^(anonymous|an[oó]nimo)$/i.test(name.trim());
}

export function recentSupportCopy(supporterCount: number) {
  const count = Math.max(1, supporterCount);
  const people = count === 1 ? "person" : "people";
  return `${count.toLocaleString()} other good-hearted ${people} just donated today`;
}

export function shouldSeedSocialTotals(currentAmount: number) {
  return currentAmount <= 0;
}

export type SocialActivitySeedPlan = "seed" | "skip" | "fill-gaps";

export function socialActivitySeedPlan(input: {
  replace?: boolean;
  seedSaleCount: number;
  livePaidSaleCount: number;
  expectedDonors: number;
}): SocialActivitySeedPlan {
  if (input.replace) return "seed";
  if (input.expectedDonors <= 0) return "skip";
  if (input.seedSaleCount >= input.expectedDonors) return "skip";
  if (input.seedSaleCount > 0) return "fill-gaps";
  if (input.livePaidSaleCount > 0) return "skip";
  return "seed";
}

export type SeedAffiliateCandidate = {
  id: string;
  slug: string;
  usedByThisCompany: boolean;
  usedByOtherCompany: boolean;
};

export function pickAffiliateForCampaignSeed(
  candidates: SeedAffiliateCandidate[],
): SeedAffiliateCandidate | null {
  const attachable = candidates.filter((item) =>
    canAttachAffiliateToCompany({
      usedByThisCompany: item.usedByThisCompany,
      usedByOtherCompany: item.usedByOtherCompany,
    }),
  );
  return (
    attachable.find((item) => item.slug === "direct-team") ??
    attachable.find((item) => item.usedByThisCompany) ??
    attachable[0] ??
    null
  );
}

export function pickAffiliateForCampaignSeedFallback(
  candidates: SeedAffiliateCandidate[],
): SeedAffiliateCandidate | null {
  return pickAffiliateForCampaignSeed(candidates);
}
