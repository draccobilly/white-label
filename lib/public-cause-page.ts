import { CampaignStatus } from "@/generated/prisma/enums";
import { getDefaultCompany } from "@/lib/company";
import { STANDARD_DONATION_AMOUNTS } from "@/lib/donation-ticket";
import { CAUSE_PAGE_ID } from "@/lib/foundation-causes";
import { prisma } from "@/lib/prisma";

const SLUG = "public-causes";

/**
 * Card and PayPal gifts on a public cause need a real affiliate page.
 * The public pages are hardcoded, so this keeps one unlisted campaign for them.
 */
export async function ensurePublicCausePage() {
  const linked = await prisma.affiliatePage.findUnique({
    where: { id: CAUSE_PAGE_ID },
    include: { campaign: true, affiliate: true },
  });
  if (linked) {
    if (!linked.active) {
      await prisma.affiliatePage.update({
        where: { id: linked.id },
        data: { active: true },
      });
    }
    if (!linked.affiliate.active) {
      await prisma.affiliate.update({
        where: { id: linked.affiliateId },
        data: { active: true },
      });
    }
    if (linked.campaign.status !== CampaignStatus.ACTIVE) {
      await prisma.campaign.update({
        where: { id: linked.campaignId },
        data: {
          status: CampaignStatus.ACTIVE,
          publishedAt: linked.campaign.publishedAt ?? new Date(),
        },
      });
    }
    return linked.id;
  }

  const institutional = await prisma.company.findFirst({
    where: { siteMode: "INSTITUTIONAL", paymentGateway: "STRIPE" },
    orderBy: { isDefault: "desc" },
  });
  const company = institutional ?? (await getDefaultCompany());
  const affiliate = await prisma.affiliate.upsert({
    where: { slug: SLUG },
    update: { active: true },
    create: {
      name: "Public causes",
      slug: SLUG,
      active: true,
    },
  });

  const existingCampaign = await prisma.campaign.findUnique({
    where: { companyId_slug: { companyId: company.id, slug: SLUG } },
  });
  let campaign = existingCampaign;
  if (!campaign) {
    try {
      campaign = await prisma.campaign.create({
        data: {
          companyId: company.id,
          slug: SLUG,
          title: "Public causes",
          organizerName: company.siteName,
          summary: "One-time gifts chosen on the public cause pages.",
          story: "Card and PayPal gifts from the public causes are recorded on this page.",
          goalAmount: 100_000_000,
          currency: "USD",
          unlisted: true,
          status: CampaignStatus.ACTIVE,
          publishedAt: new Date(),
          showMissionTip: true,
          options: {
            create: STANDARD_DONATION_AMOUNTS.map((amount, index) => ({
              amount,
              suggested: amount === 10_000,
              sortOrder: index,
            })),
          },
        },
      });
    } catch (error) {
      campaign = await prisma.campaign.findUnique({
        where: { companyId_slug: { companyId: company.id, slug: SLUG } },
      });
      if (!campaign) throw error;
    }
  }
  if (!campaign) throw new Error("Public cause campaign is missing");
  if (campaign.status !== CampaignStatus.ACTIVE || !campaign.unlisted) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: CampaignStatus.ACTIVE,
        unlisted: true,
        publishedAt: campaign.publishedAt ?? new Date(),
      },
    });
  }

  const page = await prisma.affiliatePage.upsert({
    where: {
      campaignId_affiliateId: {
        campaignId: campaign.id,
        affiliateId: affiliate.id,
      },
    },
    update: { active: true },
    create: {
      id: CAUSE_PAGE_ID,
      campaignId: campaign.id,
      affiliateId: affiliate.id,
      active: true,
    },
  });
  return page.id;
}
