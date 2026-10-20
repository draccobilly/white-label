import type { Prisma } from "@/generated/prisma/client";
import {
  mapDuplicatedCampaignAssets,
  mergeSiblingLinksByAmount,
  type SourcePageCopy,
} from "@/lib/duplicate-campaign";
import { saveResolvedPaymentLinks } from "@/lib/payment-link-ownership";

type Db = Prisma.TransactionClient | Prisma.DefaultPrismaClient;

export async function inheritDuplicatedAffiliateAssets(
  tx: Db,
  input: {
    sourcePages: SourcePageCopy[];
    targetCampaignId: string;
    targetOptions: Array<{ id: string; amount: number }>;
    copyTracking: boolean;
  },
) {
  for (const page of input.sourcePages) {
    await tx.affiliatePage.upsert({
      where: {
        campaignId_affiliateId: {
          campaignId: input.targetCampaignId,
          affiliateId: page.affiliateId,
        },
      },
      update: { active: true },
      create: {
        campaignId: input.targetCampaignId,
        affiliateId: page.affiliateId,
        fbPixelId: input.copyTracking ? page.fbPixelId : null,
        googlePixelId: input.copyTracking ? page.googlePixelId : null,
        tiktokPixelId: input.copyTracking ? page.tiktokPixelId : null,
        utmifyTokenEnc: input.copyTracking ? page.utmifyTokenEnc : null,
        utmifyPixelScript: input.copyTracking ? page.utmifyPixelScript ?? null : null,
        utmifyWebhookUrl: input.copyTracking ? page.utmifyWebhookUrl ?? null : null,
      },
    });
  }

  const targetPages = await tx.affiliatePage.findMany({
    where: { campaignId: input.targetCampaignId },
    select: { id: true, affiliateId: true },
  });
  const assets = mapDuplicatedCampaignAssets({
    sourcePages: input.sourcePages,
    targetPages,
    targetOptions: input.targetOptions,
    copyTracking: input.copyTracking,
  });
  for (const asset of assets) {
    await tx.affiliatePage.update({
      where: { id: asset.pageId },
      data: asset.tracking,
    });
    if (asset.paymentLinks.length) {
      await saveResolvedPaymentLinks(tx, asset.pageId, asset.paymentLinks);
    }
  }
}

export async function inheritMissingPaymentLinksFromCompany(
  tx: Db,
  input: {
    targetCampaignId: string;
    companyId: string;
    targetOptions: Array<{ id: string; amount: number }>;
  },
) {
  const targetPages = await tx.affiliatePage.findMany({
    where: { campaignId: input.targetCampaignId },
    select: {
      id: true,
      affiliateId: true,
      fbPixelId: true,
      googlePixelId: true,
      tiktokPixelId: true,
      utmifyTokenEnc: true,
      utmifyPixelScript: true,
      utmifyWebhookUrl: true,
      paymentLinks: {
        where: { active: true },
        include: { donationOption: { select: { amount: true } } },
      },
    },
  });
  if (!targetPages.length) return 0;

  const siblings = await tx.affiliatePage.findMany({
    where: {
      affiliateId: { in: targetPages.map((page) => page.affiliateId) },
      campaignId: { not: input.targetCampaignId },
      campaign: { companyId: input.companyId },
    },
    include: {
      paymentLinks: {
        where: { active: true },
        include: { donationOption: { select: { amount: true } } },
      },
    },
  });
  const siblingsByAffiliate = new Map<string, typeof siblings>();
  for (const sibling of siblings) {
    const list = siblingsByAffiliate.get(sibling.affiliateId) ?? [];
    list.push(sibling);
    siblingsByAffiliate.set(sibling.affiliateId, list);
  }

  let copied = 0;
  for (const page of targetPages) {
    const affiliateSiblings = siblingsByAffiliate.get(page.affiliateId) ?? [];
    if (!affiliateSiblings.length) continue;
    const richest = [...affiliateSiblings].sort(
      (a, b) => b.paymentLinks.length - a.paymentLinks.length,
    )[0];
    if (
      richest &&
      !page.fbPixelId &&
      !page.googlePixelId &&
      !page.tiktokPixelId &&
      !page.utmifyTokenEnc &&
      !page.utmifyPixelScript
    ) {
      await tx.affiliatePage.update({
        where: { id: page.id },
        data: {
          fbPixelId: richest.fbPixelId,
          googlePixelId: richest.googlePixelId,
          tiktokPixelId: richest.tiktokPixelId,
          utmifyTokenEnc: richest.utmifyTokenEnc,
          utmifyPixelScript: richest.utmifyPixelScript,
          utmifyWebhookUrl: richest.utmifyWebhookUrl,
        },
      });
    }
    const links = mergeSiblingLinksByAmount({
      targetOptions: input.targetOptions,
      takenAmounts: page.paymentLinks.map((link) => link.donationOption.amount),
      siblings: affiliateSiblings.map((sibling) => ({
        paymentLinks: sibling.paymentLinks.map((link) => ({
          amount: link.donationOption.amount,
          url: link.url,
          stripeCheckoutUrl: link.stripeCheckoutUrl,
          stripePaymentLinkId: link.stripePaymentLinkId,
        })),
      })),
    });
    if (!links.length) continue;
    await saveResolvedPaymentLinks(tx, page.id, links);
    copied += links.length;
  }
  return copied;
}
