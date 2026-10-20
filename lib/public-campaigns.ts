import { cache } from "react";
import { CampaignStatus, SaleStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createSocialProofSeed } from "@/lib/social-proof";
import { backfillMissingSocialActivity, refreshDailySeededSocialProof } from "@/lib/seed-social-activity";
import { isSpanishDesk, mexicoLocalizedCampaignCopy } from "@/lib/campaign-defaults";
import { companyBrand, getRequestCompany } from "@/lib/company";
import { messagesFor } from "@/lib/i18n";
import { isImpactCampaignLayout } from "@/lib/campaign-layout";
import { isInstitutionalSiteMode } from "@/lib/site-mode";
import { companyPublicPrefix, publicCampaignPath, withPublicPrefix } from "@/lib/public-site-url";
import { notFound } from "next/navigation";
import { campaignStageView } from "@/lib/campaign-stages";
import { progressPercent } from "@/lib/utils";
import {
  commentsStampOnePhrase,
  commentUsesRejectedSubject,
  commentUsesStampedClause,
  isGenericSocialComment,
  withoutAiDashes,
} from "@/lib/campaign-comments";
import type { CampaignLiveSnapshot } from "@/lib/campaign-live";

async function ensureSocialProof<
  T extends { id: string; currentAmount: number; supporterCount: number; options?: Array<{ amount: number }> },
>(campaign: T) {
  if (campaign.currentAmount > 0) return campaign;
  const seed = createSocialProofSeed(campaign.options?.map((option) => option.amount) ?? []);
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      ...seed,
      baselineAmount: seed.currentAmount,
      baselineSupporterCount: seed.supporterCount,
    },
  });
  return { ...campaign, ...seed };
}

export async function backfillEmptyCampaignSocialProof() {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { currentAmount: { lte: 0 } },
      include: { options: { select: { amount: true } } },
    });
    await Promise.all(campaigns.map((campaign) => ensureSocialProof(campaign)));
    await backfillMissingSocialActivity();
  } catch (error) {
    console.error(
      `[social-proof] backfill failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}

export async function getSiteSettings() {
  const company = await getRequestCompany();
  return companyBrand(company);
}

export const getPublicChrome = cache(async function getPublicChrome() {
  const company = await getRequestCompany();
  const brand = companyBrand(company);
  return {
    company,
    brand,
    locale: brand.locale,
    paymentGateway: brand.paymentGateway,
    pathPrefix: brand.pathPrefix,
    messages: messagesFor(brand.locale),
    siteMode: brand.siteMode,
    institutional: isInstitutionalSiteMode(brand.siteMode),
    impact: isImpactCampaignLayout(brand.campaignLayout),
  };
});

export const getPublicPageChrome = cache(async function getPublicPageChrome() {
  const chrome = await getPublicChrome();
  const campaigns = chrome.impact
    ? await listPublicCompanyCampaigns()
    : [];
  const donateHref =
    campaigns[0]?.href ??
    withPublicPrefix(
      chrome.pathPrefix,
      chrome.institutional ? "/campaigns" : "/",
    );
  const searchOrgs = chrome.impact
    ? await listPublicSearchOrgs(withPublicPrefix(chrome.pathPrefix, "/"))
    : [];
  return {
    ...chrome,
    campaigns,
    searchOrgs,
    donateHref,
  };
});

export async function requireInstitutionalSite() {
  const chrome = await getPublicPageChrome();
  if (!chrome.institutional) notFound();
  return chrome;
}

export type PublicSearchOrg = {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  href: string;
};

export async function listPublicSearchOrgs(
  stayHref?: string,
): Promise<PublicSearchOrg[]> {
  const companies = await prisma.company.findMany({
    where: { nonprofitListed: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      siteName: true,
      logoUrl: true,
      impactLogoUrl: true,
      landingTitle: true,
      landingBody: true,
      footerText: true,
      publicPathPrefix: true,
      nonprofitName: true,
      nonprofitDescription: true,
      nonprofitLogoUrl: true,
    },
  });

  return companies.map((company) => {
    const name =
      company.nonprofitName?.trim() ||
      company.siteName.trim() ||
      company.name.trim();
    const description =
      company.nonprofitDescription?.trim() ||
      company.landingBody?.split(/\n{2,}/)[0]?.trim() ||
      company.footerText?.trim() ||
      null;
    const logoUrl =
      company.nonprofitLogoUrl || company.impactLogoUrl || company.logoUrl;

    return {
      id: company.id,
      name,
      logoUrl,
      description,
      href: stayHref || withPublicPrefix(companyPublicPrefix(company), "/about-us"),
    };
  });
}

const campaignPublicInclude = {
  options: { orderBy: { sortOrder: "asc" as const } },
  comments: {
    where: {
      hidden: false,
      parentId: null,
    },
    orderBy: { createdAt: "desc" as const },
    take: 40,
    include: {
      sale: {
        select: {
          amount: true,
          currency: true,
        },
      },
      replies: {
        where: { hidden: false },
        orderBy: { createdAt: "asc" as const },
        take: 3,
      },
    },
  },
  updates: { orderBy: { createdAt: "desc" as const }, take: 8 },
};

async function loadCampaignSales(campaignId: string) {
  return prisma.sale.findMany({
    where: {
      campaignId,
      status: SaleStatus.PAID,
      livemode: true,
    },
    orderBy: { paidAt: "desc" },
    take: 50,
    select: {
      id: true,
      customerName: true,
      amount: true,
      currency: true,
      paidAt: true,
    },
  });
}

const commentRewrites = new Map<string, Promise<boolean>>();
const commentRewriteQuietUntil = new Map<string, number>();

function seededCommentsAreStale(
  comments: Array<{ body: string; replies?: Array<{ body: string }> }>,
) {
  const bodies = comments.flatMap((comment) => [
    comment.body,
    ...(comment.replies ?? []).map((reply) => reply.body),
  ]);
  return (
    bodies.some(
      (body) =>
        isGenericSocialComment(body) ||
        commentUsesRejectedSubject(body) ||
        commentUsesStampedClause(body),
    ) || commentsStampOnePhrase(bodies)
  );
}

/**
 * Seeded notes are written once, when the campaign is created. The VPS cron
 * never calls the daily rewrite, so a bad subject such as "Little" stays on
 * the page until something reads the campaign. This rewrites those rows on
 * that first read and returns the fresh comments.
 */
async function replaceStaleSeedComments<T extends { body: string; replies?: Array<{ body: string }> }>(
  campaignId: string,
  comments: T[],
) {
  if (!seededCommentsAreStale(comments)) return null;
  const quiet = commentRewriteQuietUntil.get(campaignId) ?? 0;
  if (quiet > Date.now()) return null;

  let job = commentRewrites.get(campaignId);
  if (!job) {
    job = refreshDailySeededSocialProof(campaignId)
      .then((result) => {
        if (!result.updated) commentRewriteQuietUntil.set(campaignId, Date.now() + 60_000);
        return Boolean(result.updated);
      })
      .catch((error) => {
        console.error("[social-activity] comment rewrite failed", error);
        commentRewriteQuietUntil.set(campaignId, Date.now() + 60_000);
        return false;
      })
      .finally(() => {
        commentRewrites.delete(campaignId);
      });
    commentRewrites.set(campaignId, job);
  }
  if (!(await job)) return null;

  const fresh = await prisma.campaign.findFirst({
    where: { id: campaignId },
    select: { comments: campaignPublicInclude.comments },
  });
  return (fresh?.comments as T[] | undefined) ?? null;
}

export const getAffiliateCampaign = cache(async function getAffiliateCampaign(
  campaignSlug: string,
  affiliateSlug: string,
) {
  const company = await getRequestCompany();
  const affiliate = await prisma.affiliate.findFirst({
    where: { slug: affiliateSlug, active: true },
  });
  if (!affiliate) return null;

  const campaign = await prisma.campaign.findFirst({
    where: {
      slug: campaignSlug,
      companyId: company.id,
      status: { in: [CampaignStatus.ACTIVE, CampaignStatus.COMPLETED] },
    },
    include: campaignPublicInclude,
  });
  if (!campaign) return null;

  const page = await prisma.affiliatePage.findFirst({
    where: {
      active: true,
      affiliateId: affiliate.id,
      campaignId: campaign.id,
    },
    include: {
      paymentLinks: {
        where: { active: true },
        include: { donationOption: true },
      },
    },
  });

  if (!page) return null;
  const freshComments = await replaceStaleSeedComments(campaign.id, campaign.comments);
  const shown = freshComments ? { ...campaign, comments: freshComments } : campaign;
  const sales = await loadCampaignSales(shown.id);

  const stage = campaignStageView(shown);
  return {
    ...page,
    sales,
    affiliate,
    campaign:
      stage.goalAmount === shown.goalAmount
        ? shown
        : { ...shown, goalAmount: stage.goalAmount },
  };
});

export const getDefaultAffiliateCampaign = cache(async function getDefaultAffiliateCampaign(
  campaignSlug: string,
) {
  const company = await getRequestCompany();
  const campaign = await prisma.campaign.findFirst({
    where: {
      slug: campaignSlug,
      companyId: company.id,
      status: { in: [CampaignStatus.ACTIVE, CampaignStatus.COMPLETED] },
    },
    select: { id: true },
  });
  if (!campaign) return null;
  const preferred = await prisma.affiliatePage.findFirst({
    where: {
      campaignId: campaign.id,
      active: true,
      affiliate: { active: true, slug: "direct-team" },
    },
    select: { affiliate: { select: { slug: true } } },
  });
  const fallback = preferred
    ? null
    : await prisma.affiliatePage.findFirst({
        where: {
          campaignId: campaign.id,
          active: true,
          affiliate: { active: true },
        },
        orderBy: { createdAt: "asc" },
        select: { affiliate: { select: { slug: true } } },
      });
  const affiliateSlug = preferred?.affiliate.slug ?? fallback?.affiliate.slug;
  if (!affiliateSlug) return null;
  return getAffiliateCampaign(campaignSlug, affiliateSlug);
});

export type { CampaignLiveSnapshot } from "@/lib/campaign-live";

export async function getCampaignLiveSnapshot(
  campaignSlug: string,
): Promise<CampaignLiveSnapshot | null> {
  const company = await getRequestCompany();
  const campaign = await prisma.campaign.findFirst({
    where: {
      slug: campaignSlug,
      companyId: company.id,
      status: { in: [CampaignStatus.ACTIVE, CampaignStatus.COMPLETED] },
    },
    include: {
      comments: campaignPublicInclude.comments,
    },
  });
  if (!campaign) return null;
  const freshComments = await replaceStaleSeedComments(campaign.id, campaign.comments);
  const shown = freshComments ? { ...campaign, comments: freshComments } : campaign;
  const stage = campaignStageView(shown);
  const sales = await loadCampaignSales(shown.id);
  const anonymous =
    campaign.currency === "MXN" || campaign.currency === "ARS"
      ? "Anónimo"
      : "Anonymous";
  return {
    currentAmount: campaign.currentAmount,
    goalAmount: stage.goalAmount,
    supporterCount: campaign.supporterCount,
    currency: campaign.currency,
    percent: progressPercent(campaign.currentAmount, stage.goalAmount),
    donations: sales.map((sale) => ({
      id: sale.id,
      name: sale.customerName || anonymous,
      amount: sale.amount,
      currency: sale.currency,
      paidAt: sale.paidAt?.toISOString() ?? null,
    })),
    comments: shown.comments.map((comment) => ({
      id: comment.id,
      authorName: comment.authorName,
      body: withoutAiDashes(comment.body),
      createdAt: comment.createdAt.toISOString(),
      replies: comment.replies.map((reply) => ({
        id: reply.id,
        authorName: reply.authorName,
        body: withoutAiDashes(reply.body),
        createdAt: reply.createdAt.toISOString(),
      })),
    })),
  };
}

export async function getRelatedCampaigns(
  affiliateId: string,
  excludeCampaignId: string,
) {
  const company = await getRequestCompany();
  const pages = await prisma.affiliatePage.findMany({
    where: {
      affiliateId,
      active: true,
      campaignId: { not: excludeCampaignId },
      campaign: {
        companyId: company.id,
        status: CampaignStatus.ACTIVE,
        unlisted: false,
      },
    },
    include: { campaign: true, affiliate: true },
    orderBy: { campaign: { publishedAt: "desc" } },
    take: 8,
  });

  return pages;
}

export type PublicSearchCampaign = {
  href: string;
  title: string;
  category: string | null;
  coverImageUrl: string | null;
  organizer: string;
  currentAmount: number;
  goalAmount: number;
  currency: string;
  excerpt: string | null;
};

export async function listPublicCompanyCampaigns(
  preferredAffiliateId?: string,
): Promise<PublicSearchCampaign[]> {
  const company = await getRequestCompany();
  const brand = companyBrand(company);
  const campaigns = await prisma.campaign.findMany({
    where: {
      companyId: company.id,
      status: CampaignStatus.ACTIVE,
      unlisted: false,
      pages: { some: { active: true } },
    },
    include: {
      pages: {
        where: { active: true },
        include: { affiliate: { select: { id: true, slug: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return campaigns.flatMap((campaign) => {
    const preferred = preferredAffiliateId
      ? campaign.pages.find((page) => page.affiliateId === preferredAffiliateId)
      : undefined;
    const page = preferred ?? campaign.pages[0];
    if (!page) return [];
    const category = isSpanishDesk(company)
      ? mexicoLocalizedCampaignCopy({ category: campaign.category }).category
      : campaign.category;
    return [
      {
        href: publicCampaignPath(
          brand.pathPrefix,
          campaign.slug,
          page.affiliate.slug,
          "",
          { short: isInstitutionalSiteMode(company.siteMode) },
        ),
        title: campaign.title,
        category: category ?? null,
        coverImageUrl: campaign.coverImageUrl,
        organizer: (campaign.organizerName ?? "").trim() || brand.siteName,
        currentAmount: campaign.currentAmount,
        goalAmount: campaignStageView(campaign).goalAmount,
        currency: campaign.currency,
        excerpt: campaign.summary?.replace(/\s+/g, " ").trim() || null,
      },
    ];
  });
}
