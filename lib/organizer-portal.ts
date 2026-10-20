import "server-only";
import { PayoutStatus, SaleStatus } from "@/generated/prisma/enums";
import { campaignStageView } from "@/lib/campaign-stages";
import { prisma } from "@/lib/prisma";
import { publicCampaignPath } from "@/lib/public-site-url";
import { excludeSocialSeedSales, giftAmountCents } from "@/lib/sale-filters";

/** Donations the organizer sees: confirmed, live-mode, never the social-proof seed rows. */
export function organizerDonationsWhere(campaignId: string) {
  return {
    campaignId,
    status: SaleStatus.PAID,
    livemode: true,
    ...excludeSocialSeedSales,
  };
}

/** First public page of a campaign, enough to build its URL. */
export const campaignPagesInclude = {
  pages: {
    where: { active: true },
    orderBy: { createdAt: "asc" as const },
    take: 1,
    select: { affiliate: { select: { slug: true } } },
  },
} as const;

export async function organizerCampaigns(organizerId: string) {
  return prisma.campaign.findMany({
    where: { organizerId },
    include: campaignPagesInclude,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function organizerCampaign(organizerId: string, campaignId: string) {
  return prisma.campaign.findFirst({
    where: { id: campaignId, organizerId },
    include: campaignPagesInclude,
  });
}

export type OrganizerCampaign = NonNullable<Awaited<ReturnType<typeof organizerCampaign>>>;

export function publicHrefFor(
  pathPrefix: string | null | undefined,
  campaign: { slug: string; pages: { affiliate: { slug: string } }[] },
) {
  const page = campaign.pages[0];
  if (!page) return null;
  return publicCampaignPath(pathPrefix, campaign.slug, page.affiliate.slug, "");
}

/** The goal the public page shows right now (the open stage when the campaign has a ladder). */
export function publishedGoal(campaign: OrganizerCampaign) {
  return campaignStageView(campaign).goalAmount;
}

/** Verified gifts, in cents, excluding tips kept by the organization. */
export async function verifiedGiftTotals(campaignId: string) {
  const sales = await prisma.sale.findMany({
    where: organizerDonationsWhere(campaignId),
    select: { amount: true, tipAmount: true },
  });
  const total = sales.reduce((sum, sale) => sum + giftAmountCents(sale), 0);
  return { total, count: sales.length };
}

export async function recentDonations(campaignId: string, take: number) {
  return prisma.sale.findMany({
    where: organizerDonationsWhere(campaignId),
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      amount: true,
      tipAmount: true,
      currency: true,
      customerName: true,
      paidAt: true,
      createdAt: true,
    },
  });
}

const RESERVED_STATUSES: PayoutStatus[] = [
  PayoutStatus.PENDING,
  PayoutStatus.APPROVED,
  PayoutStatus.PAID,
];

/** Gifts not yet claimed by a payout that is pending, approved, or paid. */
export async function payoutAvailability(campaignId: string) {
  const [gifts, reserved] = await Promise.all([
    verifiedGiftTotals(campaignId),
    prisma.payoutRequest.aggregate({
      where: { campaignId, status: { in: RESERVED_STATUSES } },
      _sum: { amount: true },
    }),
  ]);
  const held = reserved._sum.amount ?? 0;
  return {
    raised: gifts.total,
    giftCount: gifts.count,
    reserved: held,
    available: Math.max(0, gifts.total - held),
  };
}

/** Bank fields the organizer sees back: only the tail of the account number. */
export function maskAccountNumber(value: string) {
  const digits = value.replace(/\s+/g, "");
  if (digits.length <= 4) return "••••";
  return `${"•".repeat(Math.min(8, digits.length - 4))}${digits.slice(-4)}`;
}
