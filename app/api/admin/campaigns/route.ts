import { NextResponse } from "next/server";
import { CampaignStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin, isAuthError } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/admin-role";
import { affiliatePageTrackingFrom } from "@/lib/affiliates";
import { assignedCampaignWhere, ensureOperatorAffiliate } from "@/lib/operator-affiliate";
import { applyAdminRaisedAmount, applyAdminSupporterCount } from "@/lib/campaign-accounting";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { campaignSchema, campaignSchemaError } from "@/lib/validators";
import {
  canAttachAffiliateToCompany,
  trackingForNewAffiliatePage,
} from "@/lib/pixel-isolation";
import { createSocialProofSeed } from "@/lib/social-proof";
import {
  ensureCampaignHasAffiliatePage,
  guaranteeCampaignSocialProof,
} from "@/lib/seed-social-activity";
import {
  applyDeskCreateDefaults,
  isPagnovoCompany,
  isSpanishDesk,
  mexicoLocalizedCampaignCopy,
  MEXICO_EDITOR_COPY,
} from "@/lib/campaign-defaults";
import { syncCampaignDonationAmounts } from "@/lib/campaign-donation-options";
import { paidLiveSalesWhere } from "@/lib/sale-filters";
import {
  inheritDuplicatedAffiliateAssets,
  inheritMissingPaymentLinksFromCompany,
} from "@/lib/inherit-campaign-assets";
import {
  isRecentCampaignRetry,
  uniqueCampaignSlug,
} from "@/lib/campaign-slug";
import { settleCampaignGatewayNames } from "@/lib/campaign-gateway-names";
import { gatewayNameProblem } from "@/lib/gateway-name-rules";
import { GATEWAY_AI_VOICE } from "@/lib/gateway-product-names";
import { goalStagesLadder, goalStagesProblem } from "@/lib/campaign-stages";

/** A typed product name that breaks the gateway rules blocks the save with a clear reason. */
function gatewayNamesError(names: string[] | undefined, title: string) {
  for (const name of names ?? []) {
    if (!name.trim()) continue;
    const problem = gatewayNameProblem(name, { title, allow: GATEWAY_AI_VOICE.allowWords });
    if (problem) return `Product name on Stripe/PayPal: "${name.trim().slice(0, 60)}" ${problem}.`;
  }
  return null;
}

type CampaignUpdateInput = {
  id?: string;
  title?: string | null;
  body: string;
};

function campaignCopyWrites(
  data: {
    category?: string | null;
    storyHeading?: string;
    commentsDescription?: string;
    thankYouTitle?: string;
    thankYouMessage?: string;
  },
  company: { locale?: string | null; slug?: string | null; paymentGateway?: string | null },
) {
  if (isSpanishDesk(company)) {
    const copy = mexicoLocalizedCampaignCopy({
      category: data.category,
      storyHeading: data.storyHeading,
      commentsDescription: data.commentsDescription,
      thankYouTitle: data.thankYouTitle,
      thankYouMessage: data.thankYouMessage,
    });
    return {
      category: copy.category ?? MEXICO_EDITOR_COPY.category,
      storyHeading: copy.storyHeading ?? MEXICO_EDITOR_COPY.storyHeading,
      commentsDescription:
        copy.commentsDescription ?? MEXICO_EDITOR_COPY.commentsDescription,
      thankYouTitle: copy.thankYouTitle ?? MEXICO_EDITOR_COPY.thankYouTitle,
      thankYouMessage: copy.thankYouMessage ?? MEXICO_EDITOR_COPY.thankYouMessage,
    };
  }
  return {
    category: data.category || "Urgent cause",
    storyHeading: data.storyHeading || "Why this campaign matters",
    commentsDescription:
      data.commentsDescription ||
      "Comments unlock only after a successful donation — one note per gift.",
    thankYouTitle: data.thankYouTitle || "Thank you!",
    thankYouMessage:
      data.thankYouMessage ||
      "Here’s your confirmation — and the official record of your gift.",
  };
}

function campaignUpdateWriteData(update: CampaignUpdateInput) {
  return {
    title: update.title?.trim() || null,
    body: update.body,
  };
}

async function syncCampaignUpdates(
  tx: Prisma.TransactionClient,
  campaignId: string,
  updates: CampaignUpdateInput[] | undefined,
) {
  if (!updates) return;
  const keepIds = updates
    .map((update) => update.id)
    .filter((id): id is string => Boolean(id));
  await tx.campaignUpdate.deleteMany({
    where: {
      campaignId,
      ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
    },
  });
  for (const update of updates) {
    if (update.id) {
      const existing = await tx.campaignUpdate.findFirst({
        where: { id: update.id, campaignId },
        select: { id: true },
      });
      if (existing) {
        await tx.campaignUpdate.update({
          where: { id: update.id },
          data: campaignUpdateWriteData(update),
        });
        continue;
      }
    }
    await tx.campaignUpdate.create({
      data: { campaignId, ...campaignUpdateWriteData(update) },
    });
  }
}

export const maxDuration = 60;

const campaignEditorInclude = {
  options: { orderBy: { sortOrder: "asc" as const } },
  updates: { orderBy: { createdAt: "desc" as const } },
};

export async function GET() {
  try {
    const admin = await requireAdmin();
    const company = await getAdminCompany();
    const operatorAffiliate = isOwnerAdmin(admin) ? null : await ensureOperatorAffiliate(admin);
    const campaigns = await prisma.campaign.findMany({
      where: {
        companyId: company.id,
        ...(operatorAffiliate ? assignedCampaignWhere(operatorAffiliate.id) : {}),
      },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        _count: {
          select: {
            pages: true,
            sales: { where: paidLiveSalesWhere(company.id) },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ campaigns });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to list campaigns" },
      { status: isAuthError(error) ? 401 : 500 },
    );
  }
}

export async function POST(request: Request) {
  let requestedSlug = "";
  let requestedCompanyId = "";
  let actingAdminId = "";
  let actingIsOwner = false;
  try {
    const admin = await requireAdmin();
    actingAdminId = admin.id;
    actingIsOwner = isOwnerAdmin(admin);
    const body = await request.json();
    const parsed = campaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: campaignSchemaError(parsed.error) },
        { status: 400 },
      );
    }
    const namesError = gatewayNamesError(parsed.data.gatewayNames, parsed.data.title);
    if (namesError) return NextResponse.json({ error: namesError }, { status: 400 });
    const duplicateFromId =
      typeof body.duplicateFromId === "string" && body.duplicateFromId
        ? body.duplicateFromId
        : null;
    const assignAffiliateId =
      typeof body.assignAffiliateId === "string" ? body.assignAffiliateId.trim() : "";
    const assignAll = assignAffiliateId === "all";
    if (isOwnerAdmin(admin) && !assignAll) {
      const chosen = await prisma.affiliate.findFirst({
        where: { id: assignAffiliateId, active: true },
        select: { id: true },
      });
      if (!chosen) {
        return NextResponse.json(
          { error: "Choose an affiliate for this campaign." },
          { status: 400 },
        );
      }
    }
    const company = await getAdminCompany();
    requestedCompanyId = company.id;
    requestedSlug = parsed.data.slug;
    const data = applyDeskCreateDefaults(parsed.data, company, false);
    const stagesError = goalStagesProblem(data.goalAmount, data.nextGoals);
    if (stagesError) return NextResponse.json({ error: stagesError }, { status: 400 });
    const socialProof = createSocialProofSeed(data.amounts);
    const explicitRaised =
      typeof data.currentAmount === "number" && data.currentAmount > 0;
    const explicitSupporters =
      typeof data.supporterCount === "number" && data.supporterCount > 0;
    const raisedTotals = explicitRaised
      ? applyAdminRaisedAmount(0, data.currentAmount ?? 0)
      : {
          currentAmount: socialProof.currentAmount,
          baselineAmount: socialProof.currentAmount,
        };
    const supporterTotals = explicitSupporters
      ? applyAdminSupporterCount(0, data.supporterCount ?? 0)
      : explicitRaised && raisedTotals.currentAmount <= 0
        ? { supporterCount: 0, baselineSupporterCount: 0 }
        : {
            supporterCount: socialProof.supporterCount,
            baselineSupporterCount: socialProof.supporterCount,
          };
    const copy = campaignCopyWrites(data, company);
    const collision = await prisma.campaign.findFirst({
      where: { companyId: company.id, slug: data.slug },
      include: campaignEditorInclude,
    });
    if (
      collision &&
      isRecentCampaignRetry(collision, data.title) &&
      (isOwnerAdmin(admin) || collision.createdByAdminId === admin.id)
    ) {
      return NextResponse.json({ campaign: collision, existing: true });
    }
    const slug = collision
      ? await uniqueCampaignSlug(prisma, company.id, data.slug)
      : data.slug;
    const campaign = await prisma.$transaction(
      async (tx) => {
        const created = await tx.campaign.create({
          data: {
            companyId: company.id,
            createdByAdminId: admin.id,
            slug,
            title: data.title,
            organizerName: data.organizerName.trim() || company.siteName,
            organizerImageUrl: data.organizerImageUrl || null,
            organizerVerified: data.organizerVerified ?? true,
            organizerBoldText: data.organizerBoldText?.trim() || "",
            titleBoldText: data.titleBoldText?.trim() || "",
            summary: data.summary,
            story: data.story,
            category: copy.category,
            coverImageUrl: data.coverImageUrl || null,
            coverFocusX: data.coverFocusX ?? 50,
            coverFocusY: data.coverFocusY ?? 50,
            galleryImageUrls: data.galleryImageUrls ?? [],
            verificationDocumentUrls: data.verificationDocumentUrls ?? [],
            verificationNote: data.verificationNote?.trim() || "",
            videoUrl: data.videoUrl || null,
            checkoutSubtitle: data.checkoutSubtitle || null,
            socialProofText: data.socialProofText || null,
            storyHeading: copy.storyHeading,
            recentDonationsDescription: data.recentDonationsDescription,
            commentsDescription: copy.commentsDescription,
            thankYouTitle: copy.thankYouTitle,
            thankYouMessage: copy.thankYouMessage,
            goalAmount: data.goalAmount,
            goalStages: goalStagesLadder(data.goalAmount, data.nextGoals),
            currentAmount: raisedTotals.currentAmount,
            supporterCount: supporterTotals.supporterCount,
            baselineAmount: raisedTotals.baselineAmount,
            baselineSupporterCount: supporterTotals.baselineSupporterCount,
            displayPaidPercent: data.displayPaidPercent,
            currency: data.currency,
            showMissionTip: data.showMissionTip,
            missionTipBold: data.missionTipBold,
            unlisted: data.unlisted,
            status: data.status as CampaignStatus,
            publishedAt: data.status === "ACTIVE" ? new Date() : null,
            options: {
              create: data.amounts.map((amount, index) => ({
                amount,
                suggested: amount === data.suggestedAmount,
                sortOrder: index,
              })),
            },
            ...(data.updates?.length
              ? {
                  updates: {
                    create: data.updates.map((update) =>
                      campaignUpdateWriteData(update),
                    ),
                  },
                }
              : {}),
          },
          include: {
            options: { orderBy: { sortOrder: "asc" } },
            updates: { orderBy: { createdAt: "desc" } },
          },
        });
        let operatorAffiliateId: string | null = null;
        if (!isOwnerAdmin(admin)) {
          const operatorAffiliate = await ensureOperatorAffiliate(admin);
          operatorAffiliateId = operatorAffiliate.id;
          await tx.affiliatePage.create({
            data: {
              campaignId: created.id,
              affiliateId: operatorAffiliate.id,
              ...affiliatePageTrackingFrom(operatorAffiliate),
            },
          });
        } else if (assignAll) {
          const existingPages = await tx.affiliatePage.findMany({
            select: {
              affiliateId: true,
              campaign: { select: { companyId: true } },
            },
          });
          const usedHere = new Set(
            existingPages
              .filter((page) => page.campaign.companyId === company.id)
              .map((page) => page.affiliateId),
          );
          const usedElsewhere = new Set(
            existingPages
              .filter(
                (page) =>
                  page.campaign.companyId &&
                  page.campaign.companyId !== company.id,
              )
              .map((page) => page.affiliateId),
          );
          const affiliates = (
            await tx.affiliate.findMany({
              where: { active: true },
            })
          ).filter((affiliate) =>
            canAttachAffiliateToCompany({
              usedByThisCompany: usedHere.has(affiliate.id),
              usedByOtherCompany: usedElsewhere.has(affiliate.id),
            }),
          );
          if (affiliates.length) {
            const pages = await Promise.all(
              affiliates.map(async (affiliate) => ({
                campaignId: created.id,
                affiliateId: affiliate.id,
                ...(await trackingForNewAffiliatePage(tx, affiliate, company.id)),
              })),
            );
            await tx.affiliatePage.createMany({
              data: pages,
              skipDuplicates: true,
            });
          }
        } else {
          const chosen = await tx.affiliate.findFirst({
            where: { id: assignAffiliateId, active: true },
          });
          if (!chosen) throw new Error("AFFILIATE_REQUIRED");
          await tx.affiliatePage.create({
            data: {
              campaignId: created.id,
              affiliateId: chosen.id,
              ...(await trackingForNewAffiliatePage(tx, chosen, company.id)),
            },
          });
        }

        if (duplicateFromId) {
          const source = await tx.campaign.findFirst({
            where: {
              id: duplicateFromId,
              companyId: company.id,
              ...(operatorAffiliateId ? assignedCampaignWhere(operatorAffiliateId) : {}),
            },
            include: {
              pages: {
                include: {
                  paymentLinks: {
                    where: { active: true },
                    include: {
                      donationOption: { select: { amount: true } },
                    },
                  },
                },
              },
            },
          });
          if (source) {
            const copyTracking = source.companyId === company.id;
            const onlyAffiliateId =
              operatorAffiliateId ||
              (assignAffiliateId && assignAffiliateId !== "all" ? assignAffiliateId : "");
            const sourcePages = onlyAffiliateId
              ? source.pages.filter((page) => page.affiliateId === onlyAffiliateId)
              : source.pages;
            await inheritDuplicatedAffiliateAssets(tx, {
              sourcePages: sourcePages.map((page) => ({
                affiliateId: page.affiliateId,
                fbPixelId: page.fbPixelId,
                googlePixelId: page.googlePixelId,
                tiktokPixelId: page.tiktokPixelId,
                utmifyTokenEnc: page.utmifyTokenEnc,
                utmifyPixelScript: page.utmifyPixelScript,
                utmifyWebhookUrl: page.utmifyWebhookUrl,
                paymentLinks: page.paymentLinks.map((link) => ({
                  amount: link.donationOption.amount,
                  url: link.url,
                  stripeCheckoutUrl: link.stripeCheckoutUrl,
                  stripePaymentLinkId: link.stripePaymentLinkId,
                })),
              })),
              targetCampaignId: created.id,
              targetOptions: created.options,
              copyTracking,
            });
          }
        }

        await ensureCampaignHasAffiliatePage(tx, {
          campaignId: created.id,
          companyId: company.id,
        });

        return created;
      },
      { timeout: 20_000, maxWait: 8_000 },
    );

    if (!isPagnovoCompany(company)) {
      try {
        await inheritMissingPaymentLinksFromCompany(prisma, {
          targetCampaignId: campaign.id,
          companyId: company.id,
          targetOptions: campaign.options,
        });
      } catch (error) {
        console.error("payment link inherit failed", error);
      }
    }
    void guaranteeCampaignSocialProof(campaign.id, {
      preserveTotals: explicitRaised || explicitSupporters,
    }).catch((error) => {
      console.error(
        `campaign social proof guarantee failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    });
    const gatewayNames = await settleCampaignGatewayNames({
      campaignId: campaign.id,
      source: {
        title: data.title,
        category: copy.category,
        summary: data.summary,
        story: data.story,
      },
      requested: data.gatewayNames,
      stored: null,
    });
    return NextResponse.json(
      { campaign: { ...campaign, gatewayNames: gatewayNames.names }, gatewayNames },
      { status: 201 },
    );
  } catch (error) {
    console.error("campaign create failed", error);
    const prismaCode =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";
    const uniqueSlug = prismaCode === "P2002";
    const missingTable = prismaCode === "P2021";
    if (uniqueSlug && requestedSlug && requestedCompanyId) {
      const existing = await prisma.campaign.findFirst({
        where: { companyId: requestedCompanyId, slug: requestedSlug },
        include: campaignEditorInclude,
      });
      if (
        existing &&
        (actingIsOwner || existing.createdByAdminId === actingAdminId)
      ) {
        return NextResponse.json({ campaign: existing, existing: true });
      }
    }
    return NextResponse.json(
      {
        error: isAuthError(error)
          ? "Unauthorized"
          : uniqueSlug
            ? "That public slug is already in use. Open the existing campaign from the list instead of creating again."
            : missingTable
              ? "Database is missing a required table. Run prisma db push, then try again."
              : "Unable to create campaign",
      },
      {
        status: isAuthError(error) ? 401 : uniqueSlug ? 409 : 500,
      },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const campaignId = body.campaignId as string | undefined;
    const parsed = campaignSchema.safeParse(body.campaign);
    if (!campaignId || !parsed.success) {
      return NextResponse.json(
        {
          error: parsed.success
            ? "Invalid campaign update"
            : campaignSchemaError(parsed.error),
        },
        { status: 400 },
      );
    }
    const namesError = gatewayNamesError(parsed.data.gatewayNames, parsed.data.title);
    if (namesError) return NextResponse.json({ error: namesError }, { status: 400 });
    const company = await getAdminCompany();
    const data = applyDeskCreateDefaults(parsed.data, company, true);
    const stagesError = goalStagesProblem(data.goalAmount, data.nextGoals);
    if (stagesError) return NextResponse.json({ error: stagesError }, { status: 400 });
    const operatorAffiliate = isOwnerAdmin(admin) ? null : await ensureOperatorAffiliate(admin);
    const existing = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        companyId: company.id,
        ...(operatorAffiliate ? assignedCampaignWhere(operatorAffiliate.id) : {}),
      },
      select: {
        currentAmount: true,
        supporterCount: true,
        paidAmount: true,
        paidSupporterCount: true,
        gatewayNames: true,
        gatewayNamesHash: true,
        gatewayNamesSource: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    const explicitRaised =
      typeof data.currentAmount === "number" && data.currentAmount > 0;
    const explicitSupporters =
      typeof data.supporterCount === "number" && data.supporterCount > 0;
    const socialProof =
      !explicitRaised &&
      !explicitSupporters &&
      existing.currentAmount <= 0
        ? createSocialProofSeed(data.amounts)
        : null;
    const raisedTotals = explicitRaised
      ? applyAdminRaisedAmount(existing.paidAmount, data.currentAmount ?? 0)
      : null;
    const supporterTotals = explicitSupporters
      ? applyAdminSupporterCount(
          existing.paidSupporterCount,
          data.supporterCount ?? 0,
        )
      : null;
    const copy = campaignCopyWrites(data, company);
    const slug = await uniqueCampaignSlug(prisma, company.id, data.slug, campaignId);
    const campaign = await prisma.$transaction(
      async (tx) => {
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          slug,
          title: data.title,
          organizerName: data.organizerName.trim() || company.siteName,
          organizerImageUrl: data.organizerImageUrl || null,
          organizerVerified: data.organizerVerified ?? true,
          organizerBoldText: data.organizerBoldText?.trim() || "",
          titleBoldText: data.titleBoldText?.trim() || "",
          summary: data.summary,
          story: data.story,
          category: copy.category,
          coverImageUrl: data.coverImageUrl || null,
          coverFocusX: data.coverFocusX ?? 50,
          coverFocusY: data.coverFocusY ?? 50,
          galleryImageUrls: data.galleryImageUrls ?? [],
          verificationDocumentUrls: data.verificationDocumentUrls ?? [],
          verificationNote: data.verificationNote?.trim() || "",
          videoUrl: data.videoUrl || null,
          checkoutSubtitle: data.checkoutSubtitle || null,
          socialProofText: data.socialProofText || null,
          storyHeading: copy.storyHeading,
          recentDonationsDescription: data.recentDonationsDescription,
          commentsDescription: copy.commentsDescription,
          thankYouTitle: copy.thankYouTitle,
          thankYouMessage: copy.thankYouMessage,
          goalAmount: data.goalAmount,
          ...(data.nextGoals
            ? { goalStages: goalStagesLadder(data.goalAmount, data.nextGoals) }
            : {}),
          currency: data.currency,
          showMissionTip: data.showMissionTip,
          missionTipBold: data.missionTipBold,
          unlisted: data.unlisted,
          status: data.status as CampaignStatus,
          publishedAt: data.status === "ACTIVE" ? new Date() : null,
          ...(raisedTotals ?? {}),
          ...(supporterTotals ?? {}),
          displayPaidPercent: data.displayPaidPercent,
          ...(socialProof
            ? {
                ...socialProof,
                baselineAmount: socialProof.currentAmount,
                baselineSupporterCount: socialProof.supporterCount,
              }
            : {}),
        },
      });
      await syncCampaignUpdates(tx, campaignId, data.updates);
      await syncCampaignDonationAmounts(
        tx,
        campaignId,
        data.amounts,
        data.suggestedAmount,
      );
      return tx.campaign.findUniqueOrThrow({
        where: { id: campaignId },
        include: {
          options: { orderBy: { sortOrder: "asc" } },
          updates: { orderBy: { createdAt: "desc" } },
        },
      });
    },
      { timeout: 30_000, maxWait: 10_000 },
    );
    if (socialProof) {
      void guaranteeCampaignSocialProof(campaignId, { preserveTotals: true }).catch(
        (error) => {
          console.error(
            `campaign social proof guarantee failed: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );
        },
      );
    }
    const gatewayNames = await settleCampaignGatewayNames({
      campaignId,
      source: {
        title: data.title,
        category: copy.category,
        summary: data.summary,
        story: data.story,
      },
      requested: data.gatewayNames,
      stored: existing,
    });
    return NextResponse.json({
      campaign: { ...campaign, gatewayNames: gatewayNames.names },
      gatewayNames,
    });
  } catch (error) {
    console.error("campaign update failed", error);
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to update campaign" },
      { status: isAuthError(error) ? 401 : 500 },
    );
  }
}
