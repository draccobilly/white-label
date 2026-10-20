import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { hasUnresolvedAdMacros, mergeAdClick, pickLandingUrl } from "@/lib/ad-click";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { applyLiveDebit, applyAdminRaisedAmount, applyAdminSupporterCount, DISPLAYED_PAID_PERCENT, raisedAmountForVisitor, raisedAmountFromLedger } from "@/lib/campaign-accounting";
import {
  createDonorBrowserToken,
  donorBrowserCookieName,
  pendingCheckoutCookieName,
  readDonorBrowserToken,
} from "@/lib/donor-browser-token";
import {
  attributeByStripePaymentLink,
  calculateRefundTransition,
  canReusePendingCheckoutIntent,
  chooseStripePaymentLinkOwner,
  intentBelongsToPaymentLinkOwner,
  validateStripeAttribution,
} from "@/lib/stripe-attribution";
import { buildUtmifyPayload, formatUtmifyDate, utmifyPaymentMethod } from "@/lib/utmify";
import {
  inheritAffiliateUtmify,
  resolvedUtmifyPixelScript,
  resolvedUtmifyTokenEnc,
  utmifyTrackingForNewPage,
  envUtmifyApiToken,
  resolveDeliverableUtmifyToken,
} from "@/lib/utmify-desk";
import {
  buildFacebookClickCookie,
  buildMetaPurchasePayload,
  hashMetaUserValue,
  resolvedFbPixelId,
} from "@/lib/meta-capi";
import { createSocialProofSeed, recentSupportCopy, splitSocialProofGifts, shouldSeedSocialTotals, socialActivitySeedPlan, pickAffiliateForCampaignSeed, pickAffiliateForCampaignSeedFallback, socialSeedSessionId, isAnonymousDonorName } from "@/lib/social-proof";
import { STANDARD_DONATION_AMOUNTS, MXN_DONATION_AMOUNTS, MXN_SUGGESTED_AMOUNT, ARS_DONATION_AMOUNTS, ARS_SUGGESTED_AMOUNT, publicDonationTickets, publicTicketAmounts } from "@/lib/donation-ticket";
import {
  applyArgentinaCreateDefaults,
  applyMexicoCreateDefaults,
  deskDirectTeamName,
  deskDirectTeamSlug,
  DEFAULT_GOAL_CENTS,
  isArgentinaCompany,
  isMexicoCompany,
  isPagnovoCompany,
  LEGACY_MEXICO_GOAL_CENTS,
  mexicoLocalizedText,
  MEXICO_EDITOR_COPY,
} from "@/lib/campaign-defaults";
import {
  deleteUnlistedDonationOptions,
  syncCampaignDonationAmounts,
} from "@/lib/campaign-donation-options";
import {
  duplicatedCampaignForm,
  mapDuplicatedCampaignAssets,
  mergeSiblingLinksByAmount,
} from "@/lib/duplicate-campaign";
import {
  normalizeUtmifyPixelScript,
  parseUtmifyPixelScript,
  utmifyPixelIdFromConfig,
} from "@/lib/utmify-pixel";
import {
  isOpaqueShortlink,
  normalizePublicCheckoutUrl,
  normalizeStripeDestination,
  stripeCheckoutMode,
  stripeHandoffUrl,
  stripeSecretMode,
} from "@/lib/checkout-links";
import {
  campaignStageView,
  goalStagesLadder,
  goalStagesProblem,
  nextGoalStages,
} from "@/lib/campaign-stages";
import { appendQuery, progressPercent, slugify } from "@/lib/utils";
import {
  DEFAULT_TIP_PERCENT,
  splitCheckoutCharge,
  tipCentsForPercent,
} from "@/lib/checkout-tip";
import {
  googleEventForPixel,
  trackAffiliatePixelEvent,
} from "@/lib/affiliate-pixels";
import { isRecentCampaignRetry } from "@/lib/campaign-slug";
import { emphasizeSegments } from "@/lib/emphasized-text";
import { isAllowedUploadFile, isPdfUrl, uploadFailureMessage } from "@/lib/media-file";
import { companyLayoutSchema, companySchema, campaignSchema, campaignSchemaError, sanitizeMetaPixelId, sanitizePixelId, commentSchema, sitePostSchema, shareStorySchema } from "@/lib/validators";
import {
  isImpactCampaignLayout,
  normalizeCampaignLayout,
} from "@/lib/campaign-layout";
import { nearestCheckoutOption } from "@/components/checkout/useCheckoutPayment";
import { companyBrand } from "@/lib/company";
import { impactMenu, impactFooterColumns } from "@/lib/public-nav";
import { en } from "@/lib/i18n/en";
import { companyDesk, companyDeskLabel } from "@/lib/company-desk";
import {
  dayBounds,
  formatReportingDateTime,
  homeRangeDays,
  homeRangeFromQuery,
  lastDaysRange,
  periodChipFor,
  rangeFromPreset,
  reportingHour,
  reportingIsoDate,
  zonedStartOfDay,
} from "@/lib/date-range";
import { campaignNameTag, isNewCampaign } from "@/lib/campaign-label";
import { plainStoryText, storySegments, toggleStoryBold } from "@/lib/story-text";
import { excludeSocialSeedSales, paidLiveSalesWhere, giftAmountCents, tipAmountCents, hasMissionTip, resolvedMissionTipCents, MISSION_TIP_CENTS } from "@/lib/sale-filters";
import {
  campaignCommentPool,
  commentsStampOnePhrase,
  commentUsesRejectedSubject,
  commentUsesStampedClause,
  extractCampaignSubject,
  isGenericSocialComment,
  isNewActivity,
  seededSocialNeedsRefresh,
  withoutAiDashes,
} from "@/lib/campaign-comments";
import { publicAbsoluteUrl, publicCampaignPath, publicHostname, publicSiteUrl, withPublicPrefix, companyResolutionPlan, companyPublicPrefix, publicPrefixFromPathname, ARGENTINA_PUBLIC_PREFIX, emailPublicSiteUrl } from "@/lib/public-site-url";
import { buildDonationThankYouEmail } from "@/lib/donation-thank-you-email";
import { hasCrossCompanyPixelConflict, canAttachAffiliateToCompany } from "@/lib/pixel-isolation";
import { consentStorageKey, CONSENT_KEY, MEXICO_CONSENT_KEY, ARGENTINA_CONSENT_KEY } from "@/components/tracking/ConsentBanner";
import {
  isReceiptAvailable,
  receiptAvailableAt,
} from "@/lib/receipt-timing";

describe("campaign helpers", () => {
  it("creates stable slugs and progress", () => {
    expect(slugify("Ajude a Cecília!")).toBe("ajude-a-cecilia");
    expect(progressPercent(3500, 10_000)).toBe(35);
    expect(progressPercent(11_000, 10_000)).toBe(100);
    expect(Math.round(progressPercent(154_800, 5_000_000))).toBe(3);
    expect(Math.round(progressPercent(154_800, 200_000_000))).toBe(0);
  });

  it("opens the next saved stage once the current goal is reached", () => {
    const ladder = {
      slug: "sample-campaign",
      goalAmount: 1_500_000,
      goalStages: [1_500_000, 10_000_000, 20_000_000],
    };
    const below = campaignStageView({ ...ladder, currentAmount: 1_499_999 });
    expect(below.goalAmount).toBe(1_500_000);
    expect(below.stageCompletedLabel).toBeNull();

    const closed = campaignStageView({ ...ladder, currentAmount: 1_500_000 });
    expect(closed.goalAmount).toBe(10_000_000);
    expect(closed.stageCompletedLabel).toBe("Stage 1 Completed");
    expect(progressPercent(1_500_000, closed.goalAmount)).toBe(15);

    expect(campaignStageView({ ...ladder, currentAmount: 10_000_000 })).toEqual({
      goalAmount: 20_000_000,
      stageCompletedLabel: "Stage 2 Completed",
    });
    expect(campaignStageView({ ...ladder, currentAmount: 25_000_000 })).toEqual({
      goalAmount: 20_000_000,
      stageCompletedLabel: "Stage 2 Completed",
    });

    const other = campaignStageView({
      slug: "another-campaign",
      currentAmount: 9_000_000,
      goalAmount: 5_000_000,
      goalStages: [],
    });
    expect(other.goalAmount).toBe(5_000_000);
    expect(other.stageCompletedLabel).toBeNull();
  });

  it("moves a saved ladder from the first goal to the last, one stage at a time", () => {
    const sample = {
      slug: "sample-campaign",
      goalAmount: 5_000_000,
      goalStages: [5_000_000, 15_000_000, 35_000_000],
    };
    const open = campaignStageView({ ...sample, currentAmount: 4_999_999 });
    expect(open.goalAmount).toBe(5_000_000);
    expect(open.stageCompletedLabel).toBeNull();

    const second = campaignStageView({ ...sample, currentAmount: 6_088_000 });
    expect(second.goalAmount).toBe(15_000_000);
    expect(second.stageCompletedLabel).toBe("Stage 1 Completed");
    expect(progressPercent(6_088_000, second.goalAmount)).toBe(40.6);

    expect(campaignStageView({ ...sample, currentAmount: 15_000_000 })).toEqual({
      goalAmount: 35_000_000,
      stageCompletedLabel: "Stage 2 Completed",
    });
    expect(campaignStageView({ ...sample, currentAmount: 40_000_000 })).toEqual({
      goalAmount: 35_000_000,
      stageCompletedLabel: "Stage 2 Completed",
    });
  });

  it("reads the goal ladder saved on the campaign before the per-slug table", () => {
    const saved = {
      slug: "any-campaign",
      goalAmount: 2_000_000,
      goalStages: [2_000_000, 6_000_000, 9_000_000],
    };
    expect(campaignStageView({ ...saved, currentAmount: 1_000 })).toEqual({
      goalAmount: 2_000_000,
      stageCompletedLabel: null,
    });
    expect(campaignStageView({ ...saved, currentAmount: 2_000_000 })).toEqual({
      goalAmount: 6_000_000,
      stageCompletedLabel: "Stage 1 Completed",
    });
    expect(campaignStageView({ ...saved, currentAmount: 6_000_000 })).toEqual({
      goalAmount: 9_000_000,
      stageCompletedLabel: "Stage 2 Completed",
    });
    expect(campaignStageView({ ...saved, currentAmount: 9_500_000 })).toEqual({
      goalAmount: 9_000_000,
      stageCompletedLabel: "Stage 2 Completed",
    });

    // The public loader swaps goalAmount for the open stage; the ladder still decides.
    expect(
      campaignStageView({ ...saved, goalAmount: 6_000_000, currentAmount: 2_000_000 }),
    ).toEqual({ goalAmount: 6_000_000, stageCompletedLabel: "Stage 1 Completed" });

    expect(
      campaignStageView({
        slug: "sample-campaign",
        goalAmount: 1_500_000,
        goalStages: [1_500_000, 5_000_000],
        currentAmount: 1_500_000,
      }).goalAmount,
    ).toBe(5_000_000);

    expect(nextGoalStages(saved)).toEqual([6_000_000, 9_000_000]);
    expect(
      nextGoalStages({ slug: "sample-campaign", goalAmount: 1_500_000, goalStages: [] }),
    ).toEqual([]);
    expect(nextGoalStages({ slug: "plain", goalAmount: 1_000, goalStages: null })).toEqual([]);
  });

  it("stores the ladder from the goal and the next goals, and rejects a ladder out of order", () => {
    expect(goalStagesLadder(5_000_000, [15_000_000, 35_000_000])).toEqual([
      5_000_000, 15_000_000, 35_000_000,
    ]);
    expect(goalStagesLadder(5_000_000, [])).toEqual([]);
    expect(goalStagesLadder(5_000_000, undefined)).toEqual([]);

    expect(goalStagesProblem(5_000_000, undefined)).toBeNull();
    expect(goalStagesProblem(5_000_000, [15_000_000, 35_000_000])).toBeNull();
    expect(goalStagesProblem(15_000_000, [15_000_000, 35_000_000])).toBeNull();
    expect(goalStagesLadder(15_000_000, [15_000_000, 35_000_000])).toEqual([
      15_000_000, 35_000_000,
    ]);
    expect(
      nextGoalStages({
        slug: "any-campaign",
        goalAmount: 15_000_000,
        goalStages: [5_000_000, 15_000_000, 35_000_000],
      }),
    ).toEqual([35_000_000]);
    expect(goalStagesProblem(5_000_000, [4_000_000])).toMatch(
      /stage 2 \(40000\) must be higher than the goal \(50000\)/,
    );
    expect(goalStagesProblem(5_000_000, [15_000_000, 12_000_000])).toMatch(
      /stage 3 \(120000\) must be higher than stage 2 \(150000\)/,
    );
    expect(goalStagesProblem(5_000_000, [15_000_000, 0])).toMatch(/stage 3 is not an amount/);
    expect(
      goalStagesProblem(5_000_000, [6, 7, 8, 9, 10, 11].map((n) => n * 1_000_000)),
    ).toMatch(/at most 5 goals/);
  });

  it("starts Mexico campaigns at 50,000 MXN instead of the old 2 million goal", () => {
    expect(LEGACY_MEXICO_GOAL_CENTS / 100).toBe(2_000_000);
    expect(DEFAULT_GOAL_CENTS / 100).toBe(50_000);
    const created = applyMexicoCreateDefaults(
      {
        currency: "USD",
        goalAmount: LEGACY_MEXICO_GOAL_CENTS,
        amounts: [...STANDARD_DONATION_AMOUNTS],
        suggestedAmount: 2500,
      },
      { locale: "es-MX", slug: "mexico", paymentGateway: "PAGNOVO" },
      false,
    );
    expect(created.currency).toBe("MXN");
    expect(created.goalAmount).toBe(DEFAULT_GOAL_CENTS);
    expect(created.amounts).toEqual([...MXN_DONATION_AMOUNTS]);
    expect(created.suggestedAmount).toBe(MXN_SUGGESTED_AMOUNT);
    expect(created.amounts.map((amount) => amount / 100)).toEqual([
      100, 200, 300, 500, 750, 1000, 2000, 3000, 5000, 7500, 10000, 15000,
    ]);
    expect(isAnonymousDonorName("Anónimo")).toBe(true);
  });

  it("starts Argentina campaigns at 50,000 ARS with a 2,000 floor", () => {
    const created = applyArgentinaCreateDefaults(
      {
        currency: "USD",
        goalAmount: DEFAULT_GOAL_CENTS,
        amounts: [...STANDARD_DONATION_AMOUNTS],
        suggestedAmount: 2500,
      },
      { locale: "es-AR", slug: "argentina", paymentGateway: "PAGNOVO" },
      false,
    );
    expect(created.currency).toBe("ARS");
    expect(created.goalAmount).toBe(DEFAULT_GOAL_CENTS);
    expect(created.amounts).toEqual([...ARS_DONATION_AMOUNTS]);
    expect(created.suggestedAmount).toBe(ARS_SUGGESTED_AMOUNT);
    expect(created.amounts[0]).toBe(200_000);
    expect(applyMexicoCreateDefaults(created, { locale: "es-AR", slug: "argentina" }, false)).toEqual(
      created,
    );
  });

  it("replaces stock English Mexico copy with Spanish", () => {
    expect(
      mexicoLocalizedText(
        "Why this campaign matters",
        MEXICO_EDITOR_COPY.storyHeading,
      ),
    ).toBe("Por qué importa esta campaña");
    expect(
      mexicoLocalizedText("A custom heading", MEXICO_EDITOR_COPY.storyHeading),
    ).toBe("A custom heading");
    const duplicated = applyMexicoCreateDefaults(
      {
        currency: "USD",
        goalAmount: DEFAULT_GOAL_CENTS,
        amounts: [...STANDARD_DONATION_AMOUNTS],
        suggestedAmount: 2500,
        storyHeading: "Why this campaign matters",
        category: "Urgent cause",
      },
      { locale: "es-MX", slug: "mexico", paymentGateway: "PAGNOVO" },
      false,
    );
    expect(duplicated.storyHeading).toBe("Por qué importa esta campaña");
    expect(duplicated.category).toBe("Causa urgente");
  });

  it("keeps custom Mexico amounts when saving an existing campaign", () => {
    const saved = applyMexicoCreateDefaults(
      {
        currency: "MXN",
        goalAmount: DEFAULT_GOAL_CENTS,
        amounts: [10_000, 99_000],
        suggestedAmount: 99_000,
      },
      { locale: "es-MX", slug: "mexico", paymentGateway: "PAGNOVO" },
      true,
    );
    expect(saved.amounts).toEqual([10_000, 99_000]);
    expect(saved.suggestedAmount).toBe(99_000);
  });

  it("keeps the public ticket order from the campaign, including a custom arrangement", () => {
    expect(publicTicketAmounts("USD", [...STANDARD_DONATION_AMOUNTS])).toEqual([
      ...STANDARD_DONATION_AMOUNTS,
    ]);
    const arranged = [20000, 15000, 10000, 6000, 5000, 2500];
    expect(publicTicketAmounts("USD", arranged)).toEqual(arranged);
    expect(publicTicketAmounts("MXN", [...MXN_DONATION_AMOUNTS])).toEqual(
      [...MXN_DONATION_AMOUNTS].slice(0, 6),
    );
    const tickets = publicDonationTickets("USD", [
      { id: "a", amount: 20000, suggested: false, paymentLinkId: null },
      { id: "b", amount: 15000, suggested: true, paymentLinkId: null },
    ]);
    expect(tickets.map((ticket) => ticket.amount)).toEqual([20000, 15000]);
    expect(tickets[1]?.suggested).toBe(true);
  });

  it("leaves United States create amounts and currency unchanged", () => {
    const us = {
      locale: "en",
      slug: "giving-site",
      paymentGateway: "STRIPE",
    };
    const input = {
      currency: "USD",
      goalAmount: DEFAULT_GOAL_CENTS,
      amounts: [...STANDARD_DONATION_AMOUNTS],
      suggestedAmount: 2500,
    };
    const created = applyMexicoCreateDefaults(input, us, false);
    expect(created).toEqual(input);
    expect(created.currency).toBe("USD");
    expect(created.amounts).toEqual([...STANDARD_DONATION_AMOUNTS]);
  });

  it("detects desks from company fields, not campaign currency", () => {
    const us = {
      locale: "en",
      slug: "giving-site",
      paymentGateway: "STRIPE",
    };
    expect(isMexicoCompany(us)).toBe(false);
    expect(isArgentinaCompany(us)).toBe(false);
    expect(
      isMexicoCompany({
        locale: "es-AR",
        slug: "argentina",
        paymentGateway: "PAGNOVO",
        publicPathPrefix: "/argentina",
      }),
    ).toBe(false);
    expect(
      isArgentinaCompany({
        locale: "es-AR",
        slug: "argentina",
        paymentGateway: "PAGNOVO",
        publicPathPrefix: "/argentina",
      }),
    ).toBe(true);
    expect(
      isPagnovoCompany({
        locale: "es-AR",
        slug: "argentina",
        paymentGateway: "PAGNOVO",
      }),
    ).toBe(true);
    expect(
      isMexicoCompany({
        paymentGateway: "PAGNOVO",
        locale: "en",
        slug: "something-else",
      }),
    ).toBe(false);
    const campaignHappensToBeMxn = {
      currency: "MXN",
      goalAmount: DEFAULT_GOAL_CENTS,
      amounts: [...STANDARD_DONATION_AMOUNTS],
      suggestedAmount: 2500,
    };
    const kept = applyMexicoCreateDefaults(campaignHappensToBeMxn, us, false);
    expect(kept.currency).toBe("MXN");
    expect(kept.amounts).toEqual([...STANDARD_DONATION_AMOUNTS]);
  });

  it("disconnects checkout intents before deleting unused donation options", async () => {
    const calls: string[] = [];
    const tx = {
      donationOption: {
        findMany: async () => {
          calls.push("find");
          return [{ id: "opt-old" }];
        },
        deleteMany: async () => {
          calls.push("delete");
          return { count: 1 };
        },
        upsert: async () => {
          throw new Error("upsert should not run while deleting unused tickets");
        },
      },
      paymentLink: {
        findMany: async () => {
          calls.push("links");
          return [{ id: "plink-1" }];
        },
      },
      checkoutIntent: {
        updateMany: async () => {
          calls.push("disconnect");
          return { count: 2 };
        },
      },
    };
    await deleteUnlistedDonationOptions(tx, "camp-1", [10_000]);
    expect(calls).toEqual(["find", "links", "disconnect", "delete"]);
  });

  it("upserts the kept donation tickets after removing unused ones", async () => {
    const upserted: Array<{
      campaignId: string;
      amount: number;
      suggested: boolean;
      sortOrder: number;
    }> = [];
    const tx = {
      donationOption: {
        findMany: async () => [],
        deleteMany: async () => ({ count: 0 }),
        upsert: async (args: {
          create: {
            campaignId: string;
            amount: number;
            suggested: boolean;
            sortOrder: number;
          };
        }) => {
          upserted.push(args.create);
        },
      },
      paymentLink: { findMany: async () => [] },
      checkoutIntent: { updateMany: async () => ({ count: 0 }) },
    };
    await syncCampaignDonationAmounts(tx, "camp-1", [10_000, 20_000], 10_000);
    expect(upserted).toEqual([
      { campaignId: "camp-1", amount: 10_000, suggested: true, sortOrder: 0 },
      { campaignId: "camp-1", amount: 20_000, suggested: false, sortOrder: 1 },
    ]);
  });

  it("keeps landing attribution when checkout receives the same Utmify UTMs", () => {
    expect(
      mergeAdClick(
        {
          utmSource: "FB",
          landingUrl: "https://giving.example.org/c/anok/direct-team?utm_source=FB",
        },
        {
          utmSource: "FB",
          utmCampaign: "CampanhaTesteUtms|0001",
          landingUrl: "https://giving.example.org/c/anok/direct-team/checkout?utm_source=FB",
        },
      ),
    ).toMatchObject({
      utmSource: "FB",
      utmCampaign: "CampanhaTesteUtms|0001",
      landingUrl: "https://giving.example.org/c/anok/direct-team?utm_source=FB",
    });
  });

  it("keeps the Facebook click id when Instagram checkout drops fbclid from the URL", () => {
    const click = mergeAdClick(
      {
        utmSource: "FB",
        utmCampaign: "goyito|120257092712500771",
        utmMedium: "adset|1",
        sck: "IwcGRvZgRleHRuClickFromFeed",
        landingUrl:
          "https://giving.example.org/c/goyito/direct-team?utm_campaign=goyito%7C120257092712500771&fbclid=IwcGRvZgRleHRuClickFromFeed",
      },
      {
        utmSource: "FB",
        utmCampaign: "goyito|120257092712500771",
        landingUrl:
          "https://giving.example.org/c/goyito/direct-team/checkout?utm_source=FB&utm_campaign=goyito%7C120257092712500771",
      },
    );
    expect(click.sck).toBe("IwcGRvZgRleHRuClickFromFeed");
    expect(click.utmMedium).toBe("adset|1");
    expect(click.landingUrl).toContain("fbclid=");
    expect(click.landingUrl).not.toContain("/checkout");
  });

  it("keeps the filled ad labels when a later visit arrives with Meta macros unfilled", () => {
    const click = mergeAdClick(
      {
        src: "FB",
        sck: "IwFirstClickFromTheAd",
        utmSource: "FB",
        utmCampaign: "ww family abo value|120257092712500771",
        utmMedium: "New Sales ad set|120257092712510771",
        utmContent: "ctv 2|120257092712520771",
        landingUrl:
          "https://donate.example.org/c/family/ads?utm_source=FB&utm_campaign=ww+family+abo+value%7C120257092712500771&fbclid=IwFirstClickFromTheAd",
        referrer: "https://instagram.com/",
      },
      {
        src: "FB",
        sck: "IwSecondVisitFromSharedAd",
        utmSource: "FB",
        utmCampaign: "{{campaign.name}}|{{campaign.id}}",
        utmMedium: "{{adset.name}}|{{adset.id}}",
        utmContent: "{{ad.name}}|{{ad.id}}",
        fbc: "fb.1.1759600000000.IwSecondVisitFromSharedAd",
        landingUrl:
          "https://donate.example.org/c/family/ads?utm_source=FB&utm_campaign=%7B%7Bcampaign.name%7D%7D%7C%7B%7Bcampaign.id%7D%7D&fbclid=IwSecondVisitFromSharedAd",
        referrer: "https://instagram.com/",
      },
    );
    expect(click.utmCampaign).toBe("ww family abo value|120257092712500771");
    expect(click.utmMedium).toBe("New Sales ad set|120257092712510771");
    expect(click.utmContent).toBe("ctv 2|120257092712520771");
    expect(click.sck).toBe("IwFirstClickFromTheAd");
    expect(click.fbc).toBe("fb.1.1759600000000.IwSecondVisitFromSharedAd");
    expect(click.landingUrl).not.toContain("%7B%7B");
    expect(hasUnresolvedAdMacros(click)).toBe(false);
  });

  it("still records a click whose only labels are unfilled Meta macros", () => {
    const click = mergeAdClick(
      {},
      {
        utmSource: "FB",
        utmCampaign: "{{campaign.name}}|{{campaign.id}}",
        landingUrl: "https://donate.example.org/c/family/ads?utm_source=FB",
      },
    );
    expect(click.utmCampaign).toBe("{{campaign.name}}|{{campaign.id}}");
    expect(hasUnresolvedAdMacros(click)).toBe(true);
    expect(hasUnresolvedAdMacros({ utmCampaign: "%7B%7Bcampaign.name%7D%7D" })).toBe(true);
    expect(hasUnresolvedAdMacros({ utmCampaign: "ww family abo value|120257092712500771" })).toBe(false);
  });

  it("lets a filled ad click replace earlier unfilled macros", () => {
    const click = mergeAdClick(
      { utmSource: "FB", utmCampaign: "{{campaign.name}}|{{campaign.id}}" },
      { utmSource: "FB", utmCampaign: "ww family abo value|120257092712500771" },
    );
    expect(click.utmCampaign).toBe("ww family abo value|120257092712500771");
  });

  it("does not keep nginx localhost as the ad landing URL", () => {
    expect(
      pickLandingUrl(
        "https://localhost:3001/c/goyito/direct-team?utm_source=FB&fbclid=ClickFromFeed",
        "https://giving.example.org/c/goyito/direct-team?utm_source=FB&fbclid=ClickFromFeed",
      ),
    ).toBe(
      "https://giving.example.org/c/goyito/direct-team?utm_source=FB&fbclid=ClickFromFeed",
    );
  });

  it("turns supporter counts into donation social proof copy", () => {
    expect(recentSupportCopy(47)).toBe(
      "47 other good-hearted people just donated today",
    );
    expect(recentSupportCopy(1)).toBe(
      "1 other good-hearted person just donated today",
    );
  });

  it("splits a campaign baseline into the 12 live ticket amounts", () => {
    const gifts = splitSocialProofGifts(134_500, 43);
    expect(gifts.length).toBeGreaterThanOrEqual(14);
    expect(gifts.length).toBeLessThanOrEqual(43);
    const tickets = new Set<number>(STANDARD_DONATION_AMOUNTS);
    expect(gifts.every((amount) => tickets.has(amount))).toBe(true);
    expect(gifts.reduce((sum, amount) => sum + amount, 0)).toBeLessThanOrEqual(134_500);
  });

  it("duplicates checkout copy and payment links without product-page identity", () => {
    const form = duplicatedCampaignForm({
      organizerName: "Hope Clinic",
      fallbackOrganizerName: "Giving Site",
      checkoutSubtitle: "Checkout line from source",
      socialProofText: "Someone just gave",
      storyHeading: "Why this campaign matters",
      recentDonationsDescription: "Recent gifts show here.",
      commentsDescription: "Comments after a gift.",
      thankYouTitle: "Thank you!",
      thankYouMessage: "Your gift is confirmed.",
      goalAmount: 5_000_000,
      currency: "USD",
      options: [
        { amount: 2500, suggested: false },
        { amount: 5000, suggested: true },
      ],
    });
    expect(form.title).toBe("");
    expect(form.slug).toBe("");
    expect(form.organizerName).toBe("Hope Clinic");
    expect(form.organizerVerified).toBe(true);
    expect(form.organizerBoldText).toBe("");
    expect(form.titleBoldText).toBe("");
    expect(form.summary).toBe("");
    expect(form.story).toBe("");
    expect(form.coverImageUrl).toBe("");
    expect(form.galleryImageUrls).toEqual([]);
    expect(form.verificationDocumentUrls).toEqual([]);
    expect(form.verificationNote).toBe("");
    expect(form.status).toBe("DRAFT");
    expect(form.checkoutSubtitle).toBe("Checkout line from source");
    expect(form.thankYouTitle).toBe("Thank you!");
    expect(form.amounts).toEqual([2500, 5000]);
    expect(form.suggestedAmount).toBe(5000);
    expect(form.showMissionTip).toBe(true);
    expect(form.missionTipBold).toBe(false);
    expect(form.unlisted).toBe(true);

    expect(emphasizeSegments("Murphslife Foundation", "Foundation")).toEqual([
      { text: "Murphslife ", bold: false },
      { text: "Foundation", bold: true },
    ]);
    expect(
      emphasizeSegments("Murphslife Foundation", JSON.stringify(["Murphslife", "Foundation"])),
    ).toEqual([
      { text: "Murphslife", bold: true },
      { text: " ", bold: false },
      { text: "Foundation", bold: true },
    ]);
    expect(isAllowedUploadFile({ name: "scan.png", type: "image/png" })).toBe(true);
    expect(isAllowedUploadFile({ name: "letter.PDF", type: "" })).toBe(true);
    expect(isPdfUrl("https://cdn.example.com/letter.pdf")).toBe(true);
    expect(uploadFailureMessage(502, "<html>")).toMatch(/restarting/i);

    const assets = mapDuplicatedCampaignAssets({
      sourcePages: [
        {
          affiliateId: "aff-1",
          fbPixelId: "pixel",
          googlePixelId: null,
          tiktokPixelId: null,
          utmifyTokenEnc: "enc-token",
          paymentLinks: [
            {
              amount: 2500,
              url: "https://t.co/abc",
              stripeCheckoutUrl: "https://buy.stripe.com/aaa",
              stripePaymentLinkId: "plink_aaa",
            },
            {
              amount: 9999,
              url: "https://t.co/skip",
              stripeCheckoutUrl: "https://buy.stripe.com/skip",
              stripePaymentLinkId: "plink_skip",
            },
          ],
        },
      ],
      targetPages: [
        { id: "page-1", affiliateId: "aff-1" },
        { id: "page-2", affiliateId: "aff-2" },
      ],
      targetOptions: [
        { id: "opt-25", amount: 2500 },
        { id: "opt-50", amount: 5000 },
      ],
    });
    expect(assets).toHaveLength(1);
    expect(assets[0]?.pageId).toBe("page-1");
    expect(assets[0]?.tracking.utmifyTokenEnc).toBe("enc-token");
    expect(
      mapDuplicatedCampaignAssets({
        sourcePages: [
          {
            affiliateId: "aff-1",
            fbPixelId: "pixel",
            googlePixelId: null,
            tiktokPixelId: null,
            utmifyTokenEnc: "enc-token",
            paymentLinks: [],
          },
        ],
        targetPages: [{ id: "page-1", affiliateId: "aff-1" }],
        targetOptions: [],
        copyTracking: false,
      })[0]?.tracking,
    ).toEqual({
      fbPixelId: null,
      googlePixelId: null,
      tiktokPixelId: null,
      utmifyTokenEnc: null,
      utmifyPixelScript: null,
      utmifyWebhookUrl: null,
    });
    expect(assets[0]?.paymentLinks).toEqual([
      {
        donationOptionId: "opt-25",
        url: "https://t.co/abc",
        stripeCheckoutUrl: "https://buy.stripe.com/aaa",
        stripePaymentLinkId: "plink_aaa",
      },
    ]);
    expect(
      mapDuplicatedCampaignAssets({
        sourcePages: [
          {
            affiliateId: "aff-1",
            fbPixelId: "pixel",
            googlePixelId: null,
            tiktokPixelId: null,
            utmifyTokenEnc: "enc-token",
            paymentLinks: [
              {
                amount: 2500,
                url: "https://t.co/abc",
                stripeCheckoutUrl: "https://buy.stripe.com/aaa",
                stripePaymentLinkId: "plink_aaa",
              },
            ],
          },
        ],
        targetPages: [],
        targetOptions: [{ id: "opt-25", amount: 2500 }],
      }),
    ).toEqual([]);

    const isolated = mapDuplicatedCampaignAssets({
      sourcePages: [
        {
          affiliateId: "aff-1",
          fbPixelId: "pixel",
          googlePixelId: null,
          tiktokPixelId: null,
          utmifyTokenEnc: "enc-token",
          paymentLinks: [],
        },
      ],
      targetPages: [{ id: "page-mx", affiliateId: "aff-1" }],
      targetOptions: [{ id: "opt-25", amount: 2500 }],
      copyTracking: false,
    });
    expect(isolated[0]?.tracking).toEqual({
      fbPixelId: null,
      googlePixelId: null,
      tiktokPixelId: null,
      utmifyTokenEnc: null,
      utmifyPixelScript: null,
      utmifyWebhookUrl: null,
    });

    expect(
      mergeSiblingLinksByAmount({
        targetOptions: [
          { id: "opt-25", amount: 2500 },
          { id: "opt-50", amount: 5000 },
          { id: "opt-60", amount: 6000 },
        ],
        takenAmounts: [2500],
        siblings: [
          {
            paymentLinks: [
              {
                amount: 2500,
                url: "https://t.co/old",
                stripeCheckoutUrl: "https://buy.stripe.com/old",
                stripePaymentLinkId: "plink_old",
              },
              {
                amount: 5000,
                url: "https://t.co/50",
                stripeCheckoutUrl: "https://buy.stripe.com/50",
                stripePaymentLinkId: "plink_50",
              },
            ],
          },
          {
            paymentLinks: [
              {
                amount: 6000,
                url: "https://t.co/60",
                stripeCheckoutUrl: "https://buy.stripe.com/60",
                stripePaymentLinkId: "plink_60",
              },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        donationOptionId: "opt-50",
        url: "https://t.co/50",
        stripeCheckoutUrl: "https://buy.stripe.com/50",
        stripePaymentLinkId: "plink_50",
      },
      {
        donationOptionId: "opt-60",
        url: "https://t.co/60",
        stripeCheckoutUrl: "https://buy.stripe.com/60",
        stripePaymentLinkId: "plink_60",
      },
    ]);
  });

  it("creates a herd-effect seed between $1000 and $2000 with matching donors", () => {
    for (let index = 0; index < 25; index += 1) {
      const seed = createSocialProofSeed([2500, 5000, 10000, 15000]);
      expect(seed.currentAmount).toBeGreaterThanOrEqual(100_000);
      expect(seed.currentAmount).toBeLessThanOrEqual(200_000);
      expect(seed.supporterCount).toBeGreaterThanOrEqual(14);
      expect(seed.supporterCount).toBeLessThanOrEqual(52);
      const average = seed.currentAmount / seed.supporterCount;
      expect(average).toBeGreaterThan(2_000);
      expect(average).toBeLessThan(20_000);
      const gifts = splitSocialProofGifts(seed.currentAmount, seed.supporterCount);
      expect(gifts.length).toBeGreaterThanOrEqual(14);
    }
  });

  it("scales Mexico and Argentina social proof to local tickets", () => {
    for (let index = 0; index < 15; index += 1) {
      const mexico = createSocialProofSeed([
        10_000, 20_000, 30_000, 50_000, 100_000,
      ]);
      expect(mexico.currentAmount).toBeGreaterThanOrEqual(100_000);
      expect(mexico.currentAmount).toBeLessThanOrEqual(200_000);
      expect(mexico.supporterCount).toBeGreaterThanOrEqual(14);
      const mexicoGifts = splitSocialProofGifts(
        mexico.currentAmount,
        mexico.supporterCount,
        [10_000, 20_000, 30_000, 50_000, 100_000],
      );
      expect(mexicoGifts.length).toBeGreaterThanOrEqual(10);

      const argentina = createSocialProofSeed([
        200_000, 300_000, 500_000, 1_000_000,
      ]);
      expect(argentina.supporterCount).toBeGreaterThanOrEqual(10);
      expect(argentina.supporterCount).toBeLessThanOrEqual(18);
      expect(argentina.currentAmount).toBe(
        200_000 * argentina.supporterCount,
      );
      const argentinaGifts = splitSocialProofGifts(
        argentina.currentAmount,
        argentina.supporterCount,
        [200_000, 300_000, 500_000, 1_000_000],
      );
      expect(argentinaGifts.length).toBe(argentina.supporterCount);
      expect(argentinaGifts.every((amount) => amount >= 200_000)).toBe(true);
    }
  });

  it("seeds social totals only when the raised amount is empty", () => {
    expect(shouldSeedSocialTotals(0)).toBe(true);
    expect(shouldSeedSocialTotals(162_600)).toBe(false);
  });

  it("is idempotent once seeded donors exist and fills gaps otherwise", () => {
    expect(
      socialActivitySeedPlan({
        seedSaleCount: 0,
        livePaidSaleCount: 0,
        expectedDonors: 33,
      }),
    ).toBe("seed");
    expect(
      socialActivitySeedPlan({
        seedSaleCount: 33,
        livePaidSaleCount: 0,
        expectedDonors: 33,
      }),
    ).toBe("skip");
    expect(
      socialActivitySeedPlan({
        seedSaleCount: 10,
        livePaidSaleCount: 0,
        expectedDonors: 33,
      }),
    ).toBe("fill-gaps");
    expect(
      socialActivitySeedPlan({
        seedSaleCount: 0,
        livePaidSaleCount: 2,
        expectedDonors: 33,
      }),
    ).toBe("skip");
    expect(
      socialActivitySeedPlan({
        replace: true,
        seedSaleCount: 33,
        livePaidSaleCount: 0,
        expectedDonors: 33,
      }),
    ).toBe("seed");
  });

  it("namespaces seeded Stripe session ids per campaign so shared slugs do not collide", () => {
    const us = "e7358355-b962-4e1c-bfaf-bd2a5d92783b";
    const mx = "cca5b9b6-801d-4d34-80b5-d556233cd77a";
    expect(socialSeedSessionId(us, 0)).toBe(`seed-social-${us}-0`);
    expect(socialSeedSessionId(mx, 0)).toBe(`seed-social-${mx}-0`);
    expect(socialSeedSessionId(us, 0)).not.toBe(socialSeedSessionId(mx, 0));
    expect(socialSeedSessionId(us, 0)).not.toBe("seed-social-goyito-0");
  });

  it("prefers Direct Team for the default company and a company-owned affiliate for Mexico", () => {
    const direct = {
      id: "direct",
      slug: "direct-team",
      usedByThisCompany: true,
      usedByOtherCompany: false,
    };
    const mexico = {
      id: "mx",
      slug: "mexico-team",
      usedByThisCompany: true,
      usedByOtherCompany: false,
    };
    const lockedDirect = {
      id: "direct",
      slug: "direct-team",
      usedByThisCompany: false,
      usedByOtherCompany: true,
    };
    expect(pickAffiliateForCampaignSeed([mexico, direct])?.slug).toBe(
      "direct-team",
    );
    expect(pickAffiliateForCampaignSeed([lockedDirect, mexico])?.slug).toBe(
      "mexico-team",
    );
    expect(pickAffiliateForCampaignSeed([lockedDirect])).toBeNull();
    expect(pickAffiliateForCampaignSeedFallback([lockedDirect])).toBeNull();
  });

  it("guarantees POST create seeds totals and activity after affiliate pages exist", () => {
    const source = readFileSync("app/api/admin/campaigns/route.ts", "utf8");
    expect(source).toContain("createSocialProofSeed");
    expect(source).toContain("ensureCampaignHasAffiliatePage");
    expect(source).toContain("guaranteeCampaignSocialProof");
    expect(source).not.toMatch(/locale === ["']es-MX["']/);
    expect(source).not.toMatch(/paymentGateway === ["']PAGNOVO["']/);
    const inheritAt = source.indexOf("await inheritDuplicatedAffiliateAssets");
    const inheritMissingAt = source.indexOf(
      "await inheritMissingPaymentLinksFromCompany",
    );
    const ensureAt = source.indexOf("await ensureCampaignHasAffiliatePage");
    const guaranteeAt = source.indexOf("void guaranteeCampaignSocialProof");
    expect(ensureAt).toBeGreaterThan(inheritAt);
    expect(inheritMissingAt).toBeGreaterThan(ensureAt);
    expect(guaranteeAt).toBeGreaterThan(ensureAt);
    expect(source).toContain("applyAdminRaisedAmount");
    expect(source).toContain("isRecentCampaignRetry");
    expect(source).toContain("data.currentAmount > 0");
    expect(source).toContain("data.supporterCount > 0");
  });

  it("treats a second create with the same slug as a retry only when it is recent", () => {
    const createdAt = new Date("2026-09-13T05:00:00.000Z");
    expect(
      isRecentCampaignRetry(
        { title: "Help the Blades family", createdAt },
        "Help the Blades family",
        createdAt.getTime() + 60_000,
      ),
    ).toBe(true);
    expect(
      isRecentCampaignRetry(
        { title: "Older campaign", createdAt },
        "Brand new campaign",
        createdAt.getTime() + 60_000,
      ),
    ).toBe(true);
    expect(
      isRecentCampaignRetry(
        { title: "Help the Blades family", createdAt },
        "Help the Blades family",
        createdAt.getTime() + 20 * 60_000,
      ),
    ).toBe(false);
    expect(
      isRecentCampaignRetry(
        { title: "Older campaign", createdAt },
        "Brand new campaign",
        createdAt.getTime() + 20 * 60_000,
      ),
    ).toBe(false);
  });

  it("allows long campaign titles and names the length error", () => {
    const longTitle = `Help the families rebuild after the storm ${"x".repeat(140)}`;
    expect(longTitle.length).toBeGreaterThan(140);
    expect(longTitle.length).toBeLessThanOrEqual(255);
    const base = {
      slug: "help-rebuild",
      organizerName: "Giving Site",
      summary: "Urgent support for a family that lost their home.",
      story: "This campaign exists so neighbors can send verified one-time gifts quickly.",
      recentDonationsDescription: "Every gift appears here.",
      goalAmount: 5_000_000,
      currency: "USD" as const,
      amounts: [2500, 5000],
      suggestedAmount: 5000,
      status: "ACTIVE" as const,
    };
    expect(campaignSchema.safeParse({ ...base, title: longTitle }).success).toBe(true);
    const tooLong = campaignSchema.safeParse({ ...base, title: "x".repeat(256) });
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      expect(campaignSchemaError(tooLong.error)).toMatch(/Campaign title is too long/);
    }
  });

  it("names oversized donation tickets as too large, not too long", () => {
    const base = {
      title: "Help a family rebuild after the storm",
      slug: "help-rebuild",
      organizerName: "Giving Site",
      summary: "Urgent support for a family that lost their home.",
      story: "This campaign exists so neighbors can send verified one-time gifts quickly.",
      recentDonationsDescription: "Every gift appears here.",
      goalAmount: 5_000_000,
      currency: "ARS" as const,
      amounts: [200_000, 15_000_000],
      suggestedAmount: 200_000,
      status: "ACTIVE" as const,
    };
    expect(campaignSchema.safeParse(base).success).toBe(true);
    const tooBig = campaignSchema.safeParse({
      ...base,
      amounts: [2_000_000_000],
    });
    expect(tooBig.success).toBe(false);
    if (!tooBig.success) {
      expect(campaignSchemaError(tooBig.error)).toMatch(/Donation amounts is too large/);
      expect(campaignSchemaError(tooBig.error)).not.toMatch(/characters/);
    }
  });

  it("formats donation tickets with locale decimals", async () => {
    const { formatMajorAmount, parseMajorAmount } = await import("@/lib/money-input");
    expect(parseMajorAmount("10.00", "USD")).toBe(10);
    expect(parseMajorAmount("20.000", "ARS")).toBe(20000);
    expect(parseMajorAmount("20,50", "ARS")).toBe(20.5);
    expect(formatMajorAmount(10, "USD")).toMatch(/10\.00/);
    expect(formatMajorAmount(20000, "ARS")).toMatch(/20\.000/);
  });

  it("accepts an optional raised amount and campaign updates", () => {
    const parsed = campaignSchema.safeParse({
      title: "Help a family rebuild after the storm",
      slug: "help-rebuild",
      organizerName: "Giving Site",
      summary: "Urgent support for a family that lost their home.",
      story: "This campaign exists so neighbors can send verified one-time gifts quickly.",
      recentDonationsDescription: "Every gift appears here.",
      goalAmount: 5_000_000,
      currentAmount: 154_800,
      supporterCount: 31,
      currency: "USD",
      amounts: [2500, 5000],
      suggestedAmount: 5000,
      status: "ACTIVE",
      updates: [{ body: "We reached the first hospital payment today." }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.currentAmount).toBe(154_800);
      expect(parsed.data.supporterCount).toBe(31);
      expect(parsed.data.updates?.[0]?.body).toContain("hospital");
    }
  });

  it("keeps extra case photos on the campaign gallery", () => {
    const parsed = campaignSchema.safeParse({
      title: "Help a family rebuild after the storm",
      slug: "help-rebuild",
      organizerName: "Giving Site",
      summary: "Urgent support for a family that lost their home.",
      story: "This campaign exists so neighbors can send verified one-time gifts quickly.",
      recentDonationsDescription: "Every gift appears here.",
      goalAmount: 5_000_000,
      currency: "USD",
      amounts: [2500, 5000],
      suggestedAmount: 5000,
      galleryImageUrls: [
        "https://cdn.example.com/case-1.jpg",
        "",
        "https://cdn.example.com/case-2.jpg",
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.galleryImageUrls).toEqual([
        "https://cdn.example.com/case-1.jpg",
        "https://cdn.example.com/case-2.jpg",
      ]);
    }
  });

  it("keeps verification documents and the banner note", () => {
    const parsed = campaignSchema.safeParse({
      title: "Help a family rebuild after the storm",
      slug: "help-rebuild",
      organizerName: "Giving Site",
      summary: "Urgent support for a family that lost their home.",
      story: "This campaign exists so neighbors can send verified one-time gifts quickly.",
      recentDonationsDescription: "Every gift appears here.",
      goalAmount: 5_000_000,
      currency: "USD",
      amounts: [2500, 5000],
      suggestedAmount: 5000,
      verificationDocumentUrls: [
        "https://cdn.example.com/letter.jpg",
        "",
        "https://cdn.example.com/id.jpg",
      ],
      verificationNote: "Verified by our team at the hospital",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.verificationDocumentUrls).toEqual([
        "https://cdn.example.com/letter.jpg",
        "https://cdn.example.com/id.jpg",
      ]);
      expect(parsed.data.verificationNote).toBe(
        "Verified by our team at the hospital",
      );
    }
  });

  it("shows the campaign page total as baseline plus the configured percent of paid", () => {
    const shareOf = (paidAmount: number) =>
      Math.round((paidAmount * DISPLAYED_PAID_PERCENT) / 100);
    expect(
      raisedAmountFromLedger({ baselineAmount: 140_000, paidAmount: 10_000 }),
    ).toBe(140_000 + shareOf(10_000));
    expect(
      raisedAmountFromLedger({ baselineAmount: 0, paidAmount: 150 }),
    ).toBe(shareOf(150));
  });

  it("uses the campaign percent, and falls back to 1 when the percent is missing or invalid", () => {
    const campaign = { baselineAmount: 10_000, paidAmount: 10_000 };
    expect(raisedAmountFromLedger({ ...campaign, displayPaidPercent: 1 })).toBe(10_100);
    expect(raisedAmountFromLedger({ ...campaign, displayPaidPercent: 0 })).toBe(10_000);
    expect(raisedAmountFromLedger({ ...campaign, displayPaidPercent: 10 })).toBe(11_000);
    expect(raisedAmountFromLedger({ ...campaign, displayPaidPercent: 150 })).toBe(10_100);
    expect(raisedAmountFromLedger(campaign)).toBe(10_100);
    expect(
      raisedAmountForVisitor({ ...campaign, displayPaidPercent: 10 }, 5_000),
    ).toBe(11_000 + 5_000);
  });

  it("adds only this visitor's gift on top of the public raised total", () => {
    const campaign = { baselineAmount: 140_000, paidAmount: 10_000 };
    const publicRaised = raisedAmountFromLedger(campaign);
    expect(raisedAmountForVisitor(campaign, 0)).toBe(publicRaised);
    expect(raisedAmountForVisitor(campaign, 5_000)).toBe(publicRaised + 5_000);
  });

  it("keeps artificial campaign baselines outside live refund accounting", () => {
    const partial = applyLiveDebit(
      {
        baselineAmount: 198_200,
        baselineSupporterCount: 46,
        paidAmount: 10_000,
        paidSupporterCount: 1,
      },
      4_000,
      false,
    );
    expect(partial.currentAmount).toBe(204_200);
    expect(partial.supporterCount).toBe(47);

    const full = applyLiveDebit(partial, 6_000, true);
    expect(full.currentAmount).toBe(198_200);
    expect(full.supporterCount).toBe(46);
    expect(full.paidAmount).toBe(0);
    expect(full.paidSupporterCount).toBe(0);
  });

  it("lets admin set a raised total without wiping live paid gifts", () => {
    expect(applyAdminRaisedAmount(10_000, 150_000)).toEqual({
      baselineAmount: 140_000,
      currentAmount: 150_000,
    });
    expect(applyAdminRaisedAmount(10_000, 4_000)).toEqual({
      baselineAmount: 0,
      currentAmount: 10_000,
    });
  });

  it("lets admin set a donation count without wiping live paid gifts", () => {
    expect(applyAdminSupporterCount(2, 31)).toEqual({
      baselineSupporterCount: 29,
      supporterCount: 31,
    });
    expect(applyAdminSupporterCount(8, 3)).toEqual({
      baselineSupporterCount: 0,
      supporterCount: 8,
    });
    expect(applyAdminRaisedAmount(0, 0)).toEqual({
      baselineAmount: 0,
      currentAmount: 0,
    });
  });

  it("releases a team-generated receipt only after 24 hours", () => {
    const confirmedAt = new Date("2026-08-25T06:00:00.000Z");
    const availableAt = receiptAvailableAt(confirmedAt);

    expect(availableAt.toISOString()).toBe("2026-08-26T06:00:00.000Z");
    expect(
      isReceiptAvailable(availableAt, availableAt.getTime() - 1),
    ).toBe(false);
    expect(isReceiptAvailable(availableAt, availableAt.getTime())).toBe(true);
  });

  it("appends Stripe-safe attribution without losing existing params", () => {
    const url = appendQuery("https://buy.stripe.com/example?locale=en", {
      client_reference_id: "intent-123",
      utm_source: "meta",
      utm_term: null,
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("locale")).toBe("en");
    expect(parsed.searchParams.get("client_reference_id")).toBe("intent-123");
    expect(parsed.searchParams.get("utm_source")).toBe("meta");
    expect(parsed.searchParams.has("utm_term")).toBe(false);
  });

  it("sanitizes t.co ads clicks and original Stripe Payment Links separately", () => {
    expect(normalizePublicCheckoutUrl("https://t.co/7nPwhgJBAF")).toBe(
      "https://t.co/7nPwhgJBAF",
    );
    expect(isOpaqueShortlink("https://t.co/7nPwhgJBAF")).toBe(true);
    expect(
      normalizeStripeDestination("https://buy.stripe.com/7sY0Ok05l1K9eGd5S9alM0N")
        .stripeCheckoutUrl,
    ).toContain("buy.stripe.com");
    expect(normalizeStripeDestination("plink_abc123").stripePaymentLinkId).toBe(
      "plink_abc123",
    );
    expect(stripeCheckoutMode("https://buy.stripe.com/fZu6oldWb74tgOlfsJaiMOU")).toBe(
      "live",
    );
    expect(stripeCheckoutMode("https://buy.stripe.com/test/abc")).toBe("test");
    expect(
      stripeCheckoutMode("https://buy.stripe.com/test_9B6dRabRsbU89Zz8Rd0480O"),
    ).toBe("test");
    expect(stripeSecretMode("sk_test_123")).toBe("test");
    expect(stripeSecretMode("sk_live_123")).toBe("live");
    expect(() =>
      normalizePublicCheckoutUrl("https://api.utmify.com.br/webhooks/stripe-sale?id=x"),
    ).toThrow();
    expect(() =>
      normalizePublicCheckoutUrl("https://buy.stripe.com/7sY0Ok05l1K9eGd5S9alM0N"),
    ).toThrow(/t\.co/);
    expect(() => normalizeStripeDestination("https://t.co/7nPwhgJBAF")).toThrow();
    const handoff = stripeHandoffUrl({
      stripeCheckoutUrl: "https://buy.stripe.com/7sY0Ok05l1K9eGd5S9alM0N",
      intentId: "intent-from-anok-direct-team",
      attribution: { utmSource: "meta", utmCampaign: "direct-team" },
    });
    const parsed = new URL(handoff);
    expect(parsed.hostname).toBe("buy.stripe.com");
    expect(parsed.searchParams.get("client_reference_id")).toBe(
      "intent-from-anok-direct-team",
    );
    expect(parsed.searchParams.get("utm_source")).toBe("meta");
    expect(
      new URL(
        stripeHandoffUrl({
          stripeCheckoutUrl: "https://buy.stripe.com/7sY0Ok05l1K9eGd5S9alM0N",
          intentId: "intent-from-anok-direct-team",
          attribution: {
            utmSource: "FB",
            sck: "PAcGRvZgJmZGlkExampleClick",
          },
        }),
      ).searchParams.get("sck"),
    ).toBe("PAcGRvZgJmZGlkExampleClick");
    expect(() =>
      stripeHandoffUrl({
        stripeCheckoutUrl: "https://t.co/7nPwhgJBAF",
        intentId: "intent-1",
      }),
    ).toThrow(/buy.stripe.com/);
  });

  it("never sends a paid buyer through t.co because Stripe drops client_reference_id", () => {
    const destination = stripeHandoffUrl({
      stripeCheckoutUrl: "https://buy.stripe.com/6oUcN55aM7Mj0dV9hCdby00",
      intentId: "95a4a4d1-9811-482a-abcf-10a07a8ba0b9",
    });
    expect(destination.startsWith("https://buy.stripe.com/")).toBe(true);
    expect(destination).toContain("client_reference_id=95a4a4d1-9811-482a-abcf-10a07a8ba0b9");
    expect(isOpaqueShortlink(destination)).toBe(false);
  });
});

describe("isolated credentials", () => {
  it("encrypts tokens with authenticated encryption", () => {
    const key = "test-key-with-more-than-32-characters";
    const encrypted = encryptSecret("utmify-affiliate-a", key);
    expect(encrypted).not.toContain("utmify-affiliate-a");
    expect(decryptSecret(encrypted, key)).toBe("utmify-affiliate-a");
  });

  it("binds donor access to one affiliate page and checkout intent", () => {
    const key = "test-key-with-more-than-32-characters";
    const token = createDonorBrowserToken(
      {
        affiliatePageId: "page-anok-direct",
        checkoutIntentId: "intent-live-donation",
      },
      key,
      1_000,
    );
    expect(readDonorBrowserToken(token, key, 2_000)).toMatchObject({
      affiliatePageId: "page-anok-direct",
      checkoutIntentId: "intent-live-donation",
      authorized: false,
      showInlineThankYou: false,
    });
    expect(readDonorBrowserToken(token, "different-secret", 2_000)).toBeNull();
    expect(donorBrowserCookieName("page-anok-direct")).not.toContain(
      "page-anok-direct",
    );
    expect(pendingCheckoutCookieName("page-anok-direct")).not.toBe(
      donorBrowserCookieName("page-anok-direct"),
    );
    const authorized = createDonorBrowserToken(
      {
        affiliatePageId: "page-anok-direct",
        checkoutIntentId: "intent-live-donation",
        authorized: true,
        showInlineThankYou: true,
      },
      key,
      1_500,
    );
    expect(readDonorBrowserToken(authorized, key, 2_000)?.authorized).toBe(true);
    expect(
      readDonorBrowserToken(authorized, key, 2_000)?.showInlineThankYou,
    ).toBe(true);
  });

  it("rejects script-like pixel identifiers", () => {
    expect(sanitizePixelId("1234567890")).toBe("1234567890");
    expect(sanitizePixelId("<script>alert(1)</script>")).toBeNull();
    expect(sanitizeMetaPixelId("123456789012345")).toBe("123456789012345");
    expect(sanitizeMetaPixelId("6a8d69876c8d0f2391cc660b")).toBeNull();
  });

  it("accepts an Utmify pixel snippet and blocks foreign scripts", () => {
    const parsed = parseUtmifyPixelScript(`
      <script>window.pixelId = "abcDEF123";</script>
      <script async src="https://cdn.utmify.com.br/scripts/pixel/pixel.js"></script>
    `);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.inline).toContain("abcDEF123");
    expect(parsed[1]?.src).toBe("https://cdn.utmify.com.br/scripts/pixel/pixel.js");
    expect(parseUtmifyPixelScript(`<script src="https://evil.example/x.js"></script>`)).toEqual([]);
    expect(() =>
      normalizeUtmifyPixelScript(`<script src="https://evil.example/x.js"></script>`),
    ).toThrow(/Utmify pixel/i);
  });

  it("stores a safe Utmify Pixel ID and displays only that ID in admin", () => {
    const normalized = normalizeUtmifyPixelScript("6a8d69876c8d0f2391cc660b");
    expect(normalized).toContain('window.pixelId = "6a8d69876c8d0f2391cc660b"');
    expect(normalized).toContain("https://cdn.utmify.com.br/scripts/pixel/pixel.js");
    expect(utmifyPixelIdFromConfig(normalized)).toBe("6a8d69876c8d0f2391cc660b");
    expect(() =>
      normalizeUtmifyPixelScript("<script>new Function(atob('unsafe'))()</script>"),
    ).toThrow(/Pixel ID shown on its Pixel card/i);
  });
});

describe("Utmify routing payload", () => {
  it("identifies the exact affiliate page and preserves UTMs", () => {
    const payload = buildUtmifyPayload({
      saleId: "sale-1",
      affiliatePageId: "page-affiliate-a",
      campaignTitle: "Emergency Support",
      affiliateName: "Affiliate A",
      amount: 5000,
      gatewayFee: 200,
      currency: "USD",
      customerName: "Donor",
      customerEmail: "donor@example.com",
      status: "paid",
      createdAt: new Date("2026-08-21T10:00:00.000Z"),
      paidAt: new Date("2026-08-21T10:01:00.000Z"),
      isTest: true,
      attribution: {
        utmSource: "facebook",
        utmCampaign: "affiliate-a-campaign",
      },
    });
    expect(payload.products[0]?.id).toBe("page-affiliate-a");
    expect(payload.products[0]?.name).toContain("Affiliate A");
    expect(payload.trackingParameters.utm_campaign).toBe(
      "affiliate-a-campaign",
    );
    expect(payload.commission.userCommissionInCents).toBe(4800);
    expect(payload.isTest).toBe(true);
  });

  it("puts Meta fbclid into sck so Instagram in-app purchases still match the ad", () => {
    const payload = buildUtmifyPayload({
      saleId: "sale-ig",
      affiliatePageId: "page-a",
      campaignTitle: "Jonatan",
      affiliateName: "Direct Team",
      amount: 2500,
      gatewayFee: 0,
      currency: "USD",
      customerName: "Donor",
      status: "paid",
      createdAt: new Date("2026-09-03T14:25:00.000Z"),
      paidAt: new Date("2026-09-03T14:25:40.000Z"),
      attribution: {
        utmSource: "FB",
        utmCampaign: "teste jonatan|120251291763070604",
        landingUrl:
          "https://giving.example.org/c/jonatan/direct-team?utm_source=FB&utm_campaign=teste+jonatan&fbclid=PAcGRvZgJmZGlkExampleClick",
      },
    });
    expect(payload.trackingParameters.sck).toBe("PAcGRvZgJmZGlkExampleClick");
    expect(payload.trackingParameters.utm_source).toBe("FB");
  });

  it("uses the Stripe payment intent id so Utmify can attach UTMs to the Stripe plugin order", () => {
    const payload = buildUtmifyPayload({
      saleId: "sale-local-uuid",
      orderId: "pi_stripePaymentIntent123",
      affiliatePageId: "page-a",
      campaignTitle: "Goyito",
      affiliateName: "Direct Team",
      amount: 2500,
      gatewayFee: 0,
      currency: "USD",
      customerName: "Donor",
      status: "paid",
      createdAt: new Date("2026-09-04T01:42:00.000Z"),
      paidAt: new Date("2026-09-04T01:42:04.000Z"),
      attribution: {
        sck: "IwcGRvZgClick",
        utmSource: "FB",
        utmCampaign: "jonatan|120257092843960771",
      },
    });
    expect(payload.orderId).toBe("pi_stripePaymentIntent123");
    expect(payload.platform).toBe("ArcHumanDirect");
    expect(payload.trackingParameters.sck).toBe("IwcGRvZgClick");
  });

  it("labels a PayPal sale with the PayPal capture id and leaves Stripe on the current platform", () => {
    const payload = buildUtmifyPayload({
      saleId: "sale-local-uuid",
      orderId: "CAPTURE123",
      platform: "PayPal",
      affiliatePageId: "page-a",
      campaignTitle: "Emergency Support",
      affiliateName: "Affiliate A",
      amount: 2500,
      gatewayFee: 103,
      currency: "USD",
      customerName: "Donor",
      paymentMethod: "paypal",
      status: "paid",
      createdAt: new Date("2026-10-01T01:42:00.000Z"),
      paidAt: new Date("2026-10-01T01:42:04.000Z"),
      attribution: { utmSource: "FB" },
    });
    expect(payload.orderId).toBe("CAPTURE123");
    expect(payload.platform).toBe("PayPal");
    expect(payload.paymentMethod).toBe("paypal");
    expect(payload.products[0]?.id).toBe("page-a");
    expect(payload.products[0]?.name).toBe("Emergency Support — Affiliate A");
  });

  it("maps SPEI to PIX on paid Utmify orders and does not treat pending as a sale", () => {
    expect(utmifyPaymentMethod("SPEI")).toBe("pix");
    expect(utmifyPaymentMethod("spei")).toBe("pix");
    expect(utmifyPaymentMethod("bank_transfer")).toBe("pix");
    expect(utmifyPaymentMethod("credit_card")).toBe("credit_card");
    expect(utmifyPaymentMethod("paypal")).toBe("paypal");
    const payload = buildUtmifyPayload({
      saleId: "sale-mx-pending",
      orderId: "pagnovo-txn-123",
      affiliatePageId: "page-mx",
      campaignTitle: "Jonatan",
      affiliateName: "Direct Team",
      amount: 50_000,
      gatewayFee: 0,
      currency: "MXN",
      customerName: "Ana Perez",
      customerEmail: "ana@correo.mx",
      paymentMethod: "SPEI",
      status: "paid",
      createdAt: new Date("2026-09-07T13:00:00.000Z"),
      paidAt: new Date("2026-09-07T13:05:00.000Z"),
      attribution: {
        utmSource: "FB",
        utmCampaign: "mexico-jonatan",
      },
    });
    expect(payload.status).toBe("paid");
    expect(payload.paymentMethod).toBe("pix");
    expect(payload.orderId).toBe("pagnovo-txn-123");
    expect(payload.approvedDate).toBe("2026-09-07 13:05:00");
    expect(payload.commission.currency).toBe("MXN");
  });

  it("names a generic cause in Utmify when the gift did not come from an ad", () => {
    const payload = buildUtmifyPayload({
      saleId: "sale-cause",
      affiliatePageId: "22222222-2222-4222-8222-222222222222",
      campaignTitle: "Public causes",
      affiliateName: "Public causes",
      amount: 10000,
      gatewayFee: 0,
      currency: "USD",
      customerName: "Donor",
      status: "paid",
      createdAt: new Date("2026-10-03T12:00:00.000Z"),
      paidAt: new Date("2026-10-03T12:00:20.000Z"),
      soldLabel: "Food bank groceries",
      attribution: {},
    });
    expect(payload.products[0]?.name).toBe("Food bank groceries");
    expect(payload.products[0]?.id).toContain("Food bank groceries");
    expect(payload.trackingParameters.utm_source).toBe("site");
    expect(payload.trackingParameters.utm_medium).toBe("direct");
    expect(payload.trackingParameters.utm_campaign).toBe("Food bank groceries");
  });

  it("keeps the ad campaign when the cause gift also has UTMs", () => {
    const payload = buildUtmifyPayload({
      saleId: "sale-cause-ad",
      affiliatePageId: "page-a",
      campaignTitle: "Public causes",
      affiliateName: "Public causes",
      amount: 5000,
      gatewayFee: 0,
      currency: "USD",
      customerName: "Donor",
      status: "paid",
      createdAt: new Date("2026-10-03T12:00:00.000Z"),
      paidAt: new Date("2026-10-03T12:00:20.000Z"),
      soldLabel: "Food bank groceries",
      attribution: { utmSource: "FB", utmCampaign: "ww sample campaign abo valor" },
    });
    expect(payload.products[0]?.name).toBe("Food bank groceries");
    expect(payload.trackingParameters.utm_source).toBe("FB");
    expect(payload.trackingParameters.utm_campaign).toBe("ww sample campaign abo valor");
  });

  it("labels a direct campaign visit with the campaign that was sold", () => {
    const payload = buildUtmifyPayload({
      saleId: "sale-direct",
      affiliatePageId: "page-humble",
      campaignTitle: "Let's bless this humble father",
      affiliateName: "Direct Team",
      amount: 2500,
      gatewayFee: 0,
      currency: "USD",
      customerName: "Donor",
      status: "paid",
      createdAt: new Date("2026-10-03T12:00:00.000Z"),
      paidAt: new Date("2026-10-03T12:00:20.000Z"),
      attribution: { landingUrl: "https://giving.example.org/c/humble/direct" },
    });
    expect(payload.products[0]?.name).toBe("Let's bless this humble father — Direct Team");
    expect(payload.trackingParameters.utm_source).toBe("site");
    expect(payload.trackingParameters.utm_campaign).toBe(
      "Let's bless this humble father — Direct Team",
    );
  });
});

describe("Meta CAPI Stripe purchase", () => {
  it("hashes email and builds fbc from fbclid so Purchase matches the ad without /confirmed", () => {
    expect(hashMetaUserValue("  Donor@Example.com ")).toBe(
      hashMetaUserValue("donor@example.com"),
    );
    expect(resolvedFbPixelId(null, "123456789012345")).toBe("123456789012345");
    expect(resolvedFbPixelId(null, "6a8d69876c8d0f2391cc660b")).toBeNull();
    expect(
      buildFacebookClickCookie(null, "PAcGRvZgJmZGlkExampleClick", 1_725_000_000_000),
    ).toBe("fb.1.1725000000000.PAcGRvZgJmZGlkExampleClick");

    const paidAt = new Date("2026-09-04T12:00:00.000Z");
    const payload = buildMetaPurchasePayload({
      saleId: "sale-stripe-1",
      pixelId: "123456789012345",
      amountCents: 5000,
      currency: "usd",
      paidAt,
      email: "donor@example.com",
      clientIp: "203.0.113.10",
      userAgent: "Mozilla/5.0",
      fbp: "fb.1.1725000000000.123",
      sck: "PAcGRvZgJmZGlkExampleClick",
      landingUrl:
        "https://giving.example.org/c/anok/direct-team?utm_source=FB&fbclid=PAcGRvZgJmZGlkExampleClick",
      campaignSlug: "anok",
      affiliateSlug: "direct-team",
      affiliatePageId: "page-anok",
      livemode: true,
    });
    expect(payload).not.toBeNull();
    expect(payload?.event.event_name).toBe("Purchase");
    expect(payload?.event.event_id).toBe("sale-stripe-1");
    expect(payload?.event.custom_data.value).toBe(50);
    expect(payload?.event.custom_data.currency).toBe("USD");
    expect(payload?.event.custom_data.order_id).toBe("sale-stripe-1");
    expect(payload?.event.user_data.fbc).toBe(
      `fb.1.${paidAt.getTime()}.PAcGRvZgJmZGlkExampleClick`,
    );
    expect(payload?.event.user_data.fbp).toBe("fb.1.1725000000000.123");
    expect(payload?.event.user_data.em).toEqual([
      hashMetaUserValue("donor@example.com"),
    ]);
    expect(payload?.testEventCode).toBeUndefined();
  });

  it("does not send localhost as Meta event_source_url behind nginx", () => {
    const payload = buildMetaPurchasePayload({
      saleId: "sale-stripe-2",
      pixelId: "123456789012345",
      amountCents: 2500,
      currency: "USD",
      email: "donor@example.com",
      landingUrl:
        "https://localhost:3001/c/goyito/direct-team?utm_source=FB&fbclid=ClickFromFeed",
      campaignSlug: "goyito",
      affiliateSlug: "direct-team",
      affiliatePageId: "page-goyito",
      livemode: true,
    });
    expect(payload?.event.event_source_url).toContain(
      "giving.example.org/c/goyito/direct-team",
    );
    expect(payload?.event.event_source_url).not.toContain("localhost");
  });
});

describe("Stripe webhook safeguards", () => {
  it("requires the exact page Payment Link, amount and currency", () => {
    expect(
      validateStripeAttribution({
        expectedPaymentLinkId: "plink_affiliate_a",
        receivedPaymentLinkId: "plink_affiliate_a",
        expectedAmount: 5000,
        receivedAmount: 5000,
        expectedCurrency: "USD",
        receivedCurrency: "usd",
      }).ok,
    ).toBe(true);
    expect(
      validateStripeAttribution({
        expectedPaymentLinkId: "plink_affiliate_a",
        receivedPaymentLinkId: "plink_affiliate_b",
        expectedAmount: 5000,
        receivedAmount: 5000,
        expectedCurrency: "USD",
        receivedCurrency: "usd",
      }).ok,
    ).toBe(false);
  });

  it("attributes a paid session by the unique Stripe Payment Link, not by webhook fan-out", () => {
    const owner = {
      stripePaymentLinkId: "plink_affiliate_a_50",
      amount: 5000,
      currency: "USD",
      affiliatePageId: "page-a",
    };
    expect(
      attributeByStripePaymentLink({
        receivedPaymentLinkId: "plink_affiliate_a_50",
        receivedAmount: 5000,
        receivedCurrency: "usd",
        owners: [owner],
      }),
    ).toEqual({ ok: true, owner });
    expect(
      attributeByStripePaymentLink({
        receivedPaymentLinkId: "plink_affiliate_a_50",
        receivedAmount: 5000,
        receivedCurrency: "usd",
        owners: [],
      }).ok,
    ).toBe(false);
    expect(
      attributeByStripePaymentLink({
        receivedPaymentLinkId: "plink_shared",
        receivedAmount: 5000,
        receivedCurrency: "usd",
        owners: [owner, { ...owner, affiliatePageId: "page-b" }],
      }),
    ).toMatchObject({ ok: false, reason: "duplicate_payment_link" });
    expect(
      intentBelongsToPaymentLinkOwner({
        intentAffiliatePageId: "page-b",
        ownerAffiliatePageId: "page-a",
      }),
    ).toBe(false);
    expect(
      canReusePendingCheckoutIntent({
        hasSale: false,
        expired: false,
        intentAffiliatePageId: "page-a",
        ownerAffiliatePageId: "page-a",
        intentPaymentLinkId: "link-200",
        ownerPaymentLinkId: "link-200",
      }),
    ).toBe(true);
    expect(
      canReusePendingCheckoutIntent({
        hasSale: true,
        expired: false,
        intentAffiliatePageId: "page-a",
        ownerAffiliatePageId: "page-a",
        intentPaymentLinkId: "link-200",
        ownerPaymentLinkId: "link-200",
      }),
    ).toBe(false);
  });

  it("still attributes a Stripe Payment Link copied onto sibling campaigns", () => {
    const ownerA = {
      stripePaymentLinkId: "plink_shared",
      amount: 7000,
      currency: "USD",
      affiliatePageId: "page-musgrove",
    };
    const ownerB = {
      ...ownerA,
      affiliatePageId: "page-other",
    };
    expect(
      chooseStripePaymentLinkOwner({
        receivedPaymentLinkId: "plink_shared",
        receivedAmount: 7000,
        receivedCurrency: "usd",
        owners: [ownerB, ownerA],
        preferredAffiliatePageId: "page-musgrove",
      }),
    ).toEqual({ ok: true, owner: ownerA });
    expect(
      chooseStripePaymentLinkOwner({
        receivedPaymentLinkId: "plink_shared",
        receivedAmount: 7000,
        receivedCurrency: "usd",
        owners: [ownerB, ownerA],
      }),
    ).toMatchObject({ ok: false, reason: "duplicate_payment_link" });
    expect(
      chooseStripePaymentLinkOwner({
        receivedPaymentLinkId: "plink_affiliate_a_50",
        receivedAmount: 7200,
        receivedCurrency: "usd",
        owners: [
          {
            stripePaymentLinkId: "plink_affiliate_a_50",
            amount: 7000,
            currency: "USD",
            affiliatePageId: "page-a",
          },
        ],
      }).ok,
    ).toBe(true);
  });

  it("applies refund deltas once and detects a full refund", () => {
    expect(
      calculateRefundTransition({
        saleAmount: 5000,
        previousRefunded: 1000,
        reportedRefunded: 5000,
      }),
    ).toEqual({ refunded: 5000, delta: 4000, fullyRefunded: true });
    expect(
      calculateRefundTransition({
        saleAmount: 5000,
        previousRefunded: 5000,
        reportedRefunded: 5000,
      }).delta,
    ).toBe(0);
  });
});

describe("affiliate pixels", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("maps InitiateCheckout to Google begin_checkout", () => {
    expect(googleEventForPixel("InitiateCheckout")).toBe("begin_checkout");
    expect(googleEventForPixel("ViewContent")).toBe("view_item");
    expect(googleEventForPixel("Purchase")).toBe("purchase");
  });

  it("fires InitiateCheckout on Google and TikTok, never Facebook", () => {
    const fbq = vi.fn();
    const gtag = vi.fn();
    const track = vi.fn();
    (globalThis as { window: unknown }).window = {
      fbq,
      gtag,
      ttq: { instance: () => ({ track }) },
    };
    trackAffiliatePixelEvent("InitiateCheckout", {
      googlePixelId: "AW-1234567890",
      tiktokPixelId: "ABCDEF1234",
      valueCents: 2500,
      currency: "USD",
    });
    expect(fbq).not.toHaveBeenCalled();
    expect(gtag).toHaveBeenCalledWith("event", "begin_checkout", {
      send_to: "AW-1234567890",
      value: 25,
      currency: "USD",
      content_type: "product",
    });
    expect(track).toHaveBeenCalledWith("InitiateCheckout", {
      value: 25,
      currency: "USD",
      content_type: "product",
    });
  });

  it("does not inject the Facebook browser pixel or enqueue CAPI after payment", () => {
    expect(readFileSync("components/tracking/AffiliatePagePixels.tsx", "utf8")).not.toContain(
      "fbevents",
    );
    expect(readFileSync("lib/record-paid-session.ts", "utf8")).not.toContain("enqueueMetaCapi");
    expect(readFileSync("lib/outbox.ts", "utf8")).not.toContain("sendMetaCapiPurchase");
  });

  it("records wallet PaymentIntents from the Stripe webhook and copies the campaign name onto the charge", () => {
    expect(readFileSync("scripts/create-stripe-webhook.ts", "utf8")).toContain(
      "payment_intent.succeeded",
    );
    expect(readFileSync("app/api/webhooks/stripe/route.ts", "utf8")).toContain(
      "payment_intent.succeeded",
    );
    expect(readFileSync("app/api/stripe/embedded-session/route.ts", "utf8")).toContain(
      "payment_intent_data",
    );
    expect(readFileSync("app/api/stripe/wallet-intent/route.ts", "utf8")).toContain(
      "stripePaymentLabel",
    );
    expect(readFileSync("components/checkout/WalletPayButton.tsx", "utf8")).toContain(
      "/api/stripe/wallet-confirm",
    );
  });

  it("loads the Utmify pixel on campaign, checkout, pay, and confirmed pages", () => {
    for (const file of [
      "app/c/[campaignSlug]/[affiliateSlug]/page.tsx",
      "app/c/[campaignSlug]/[affiliateSlug]/checkout/page.tsx",
      "app/c/[campaignSlug]/[affiliateSlug]/pay/page.tsx",
      "app/c/[campaignSlug]/[affiliateSlug]/confirmed/page.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("resolvedUtmifyPixelScript");
      expect(source).toContain("AffiliatePagePixels");
    }
  });
});

describe("public site URLs", () => {
  const previousPublic = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL;
  const previousApp = process.env.NEXT_PUBLIC_APP_URL;
  const previousName = process.env.APP_NAME;

  afterEach(() => {
    process.env.NEXT_PUBLIC_PUBLIC_SITE_URL = previousPublic;
    process.env.NEXT_PUBLIC_APP_URL = previousApp;
    process.env.APP_NAME = previousName;
  });

  it("copies affiliate links from the public site URL in env", () => {
    process.env.NEXT_PUBLIC_PUBLIC_SITE_URL = "https://giving.example.org";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(publicSiteUrl()).toBe("https://giving.example.org");
    expect(publicHostname()).toBe("giving.example.org");
    expect(publicAbsoluteUrl("/c/sample/direct-team")).toBe(
      "https://giving.example.org/c/sample/direct-team",
    );
  });

  it("uses the public site URL for donor email links", () => {
    process.env.NEXT_PUBLIC_PUBLIC_SITE_URL = "https://giving.example.org";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
    process.env.APP_NAME = "Giving Site";
    expect(publicSiteUrl()).toBe("https://giving.example.org");
    expect(emailPublicSiteUrl(true)).toBe("https://giving.example.org");
  });

  it("prefixes Mexico copy-link URLs and leaves US /c/ unchanged", () => {
    process.env.NEXT_PUBLIC_PUBLIC_SITE_URL = "https://giving.example.org";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(withPublicPrefix("/mexico", "/c/goyito/direct-team-mexico")).toBe(
      "/mexico/c/goyito/direct-team-mexico",
    );
    expect(withPublicPrefix("", "/c/anok/direct-team")).toBe("/c/anok/direct-team");
    expect(withPublicPrefix("/mexico", "/api/receipt?token=abc")).toBe(
      "/api/receipt?token=abc",
    );
    expect(
      publicCampaignPath("/mexico", "goyito", "direct-team-mexico", "/checkout"),
    ).toBe("/mexico/c/goyito/direct-team-mexico/checkout");
    expect(publicAbsoluteUrl("/c/goyito/direct-team-mexico", "/mexico")).toBe(
      "https://giving.example.org/mexico/c/goyito/direct-team-mexico",
    );
    expect(publicAbsoluteUrl("/c/anok/direct-team")).not.toContain("/mexico/");
    expect(companyPublicPrefix({ locale: "es-MX", publicPathPrefix: null })).toBe(
      "/mexico",
    );
    expect(companyPublicPrefix({ slug: "mexico", publicPathPrefix: "" })).toBe(
      "/mexico",
    );
    expect(companyPublicPrefix({ locale: "en", publicPathPrefix: null })).toBe("");
    expect(
      companyPublicPrefix({ locale: "es-AR", publicPathPrefix: null }),
    ).toBe("/argentina");
    expect(
      companyPublicPrefix({ slug: "argentina", publicPathPrefix: "" }),
    ).toBe("/argentina");
    expect(companyPublicPrefix({ locale: "es-MX", publicPathPrefix: null })).not.toBe(
      "/argentina",
    );
    expect(publicPrefixFromPathname("/argentina/c/cecilia/direct-team")).toBe(
      ARGENTINA_PUBLIC_PREFIX,
    );
    expect(publicPrefixFromPathname("/mexico/c/cecilia/direct-team")).toBe(
      "/mexico",
    );
    expect(publicPrefixFromPathname("/c/cecilia/direct-team")).toBeNull();
    expect(
      publicCampaignPath("", "hope", "direct-team", "/checkout", { short: true }),
    ).toBe("/c/hope/checkout");
    expect(publicCampaignPath("", "hope", "direct-team", "", { short: true })).toBe(
      "/c/hope",
    );
    expect(
      companyPublicPrefix({
        locale: "es-MX",
        publicPathPrefix: "/mexico",
        siteMode: "INSTITUTIONAL",
      }),
    ).toBe("");
    expect(
      publicAbsoluteUrl(
        "/c/cecilia/direct-team",
        companyPublicPrefix({ locale: "es-MX", publicPathPrefix: null }),
      ),
    ).toBe("https://giving.example.org/mexico/c/cecilia/direct-team");
  });

  it("resolves Mexico by path prefix even on localhost", () => {
    expect(
      companyResolutionPlan({
        prefix: "/mexico",
        hostname: "localhost",
        isLocalHost: true,
      }),
    ).toEqual({ by: "prefix", prefix: "/mexico" });
    expect(
      companyResolutionPlan({
        prefix: "",
        hostname: "localhost",
        isLocalHost: true,
      }),
    ).toEqual({ by: "host", hostname: "localhost" });
    expect(
      companyResolutionPlan({
        prefix: "",
        hostname: "giving.example.org",
        isLocalHost: false,
      }),
    ).toEqual({ by: "host", hostname: "giving.example.org" });
  });
});

describe("donation thank-you email", () => {
  const previousPublic = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL;
  const previousApp = process.env.NEXT_PUBLIC_APP_URL;
  const previousName = process.env.APP_NAME;
  const previousLogo = process.env.EMAIL_LOGO_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_PUBLIC_SITE_URL = previousPublic;
    process.env.NEXT_PUBLIC_APP_URL = previousApp;
    process.env.APP_NAME = previousName;
    process.env.EMAIL_LOGO_URL = previousLogo;
  });

  it("uses this site's name and the public URL from env", () => {
    process.env.NEXT_PUBLIC_PUBLIC_SITE_URL = "https://giving.example.org";
    process.env.NEXT_PUBLIC_APP_URL = "https://giving.example.org";
    process.env.APP_NAME = "Giving Site";
    delete process.env.EMAIL_LOGO_URL;

    const message = buildDonationThankYouEmail({
      trackingCode: "DN71809468",
      campaignSlug: "sample-campaign",
      affiliateSlug: "direct-team",
      customerName: "Gabriel Escobar",
      campaignTitle: "Sample campaign",
      amountLabel: "$30",
      paidAt: new Date("2026-09-24T12:00:00Z"),
      shortDonationPath: true,
      institutional: true,
      receiptToken: "test-token",
    });

    expect(message.subject).toBe("Thank you for your gift");
    expect(message.receiptUrl).toBe(
      "https://giving.example.org/api/receipt?token=test-token",
    );
    expect(message.html).toContain("Giving Site");
    expect(message.html).toContain("https://giving.example.org/admin-icon-192.png");
    expect(message.html).toContain("#163c2c");
    expect(message.html).toContain("#d4f07a");
    expect(message.html).toContain("Thank you, Gabriel Escobar!");
    expect(message.html).not.toContain("third-party-logo");
    expect(message.html).not.toContain("PDF within 3 business days");
  });
});

describe("pixel isolation", () => {
  it("rejects a Meta pixel already used by another company", () => {
    expect(
      hasCrossCompanyPixelConflict(
        [{ fbPixelId: "111222333" }],
        { fbPixelId: "111222333" },
      ),
    ).toBe(true);
    expect(
      hasCrossCompanyPixelConflict(
        [{ fbPixelId: "111222333" }],
        { fbPixelId: "999888777" },
      ),
    ).toBe(false);
    expect(
      hasCrossCompanyPixelConflict(
        [{ utmifyPixelId: "utmify-mx", pagnovoDesk: true }],
        { utmifyPixelId: "utmify-mx", pagnovoDesk: true },
      ),
    ).toBe(false);
    expect(
      hasCrossCompanyPixelConflict(
        [{ utmifyPixelId: "utmify-us", pagnovoDesk: false }],
        { utmifyPixelId: "utmify-us", pagnovoDesk: true },
      ),
    ).toBe(true);
    expect(
      hasCrossCompanyPixelConflict(
        [{ fbPixelId: "111222333", pagnovoDesk: true }],
        { fbPixelId: "111222333", pagnovoDesk: true },
      ),
    ).toBe(true);
  });

  it("lets a company keep using an affiliate even if another company already has it", () => {
    expect(
      canAttachAffiliateToCompany({
        usedByThisCompany: true,
        usedByOtherCompany: true,
      }),
    ).toBe(true);
    expect(
      canAttachAffiliateToCompany({
        usedByThisCompany: true,
        usedByOtherCompany: false,
      }),
    ).toBe(true);
    expect(
      canAttachAffiliateToCompany({
        usedByThisCompany: false,
        usedByOtherCompany: false,
      }),
    ).toBe(true);
    expect(
      canAttachAffiliateToCompany({
        usedByThisCompany: false,
        usedByOtherCompany: true,
      }),
    ).toBe(false);
  });

  it("namespaces consent storage so Mexico, Argentina and global do not share a dismiss", () => {
    expect(consentStorageKey("default")).toBe(CONSENT_KEY);
    expect(consentStorageKey("mexico")).toBe(MEXICO_CONSENT_KEY);
    expect(consentStorageKey("argentina")).toBe(ARGENTINA_CONSENT_KEY);
    expect(consentStorageKey("mexico")).not.toBe(consentStorageKey("default"));
    expect(consentStorageKey("argentina")).not.toBe(consentStorageKey("mexico"));
    expect(consentStorageKey("argentina")).not.toBe(consentStorageKey("default"));
  });

  it("does not let Mexico inherit the United States Direct Team Utmify pixel", () => {
    expect(inheritAffiliateUtmify(true)).toBe(true);
    expect(inheritAffiliateUtmify(false)).toBe(false);
    expect(
      resolvedUtmifyPixelScript(null, "us-pixel", false),
    ).toBeNull();
    expect(
      resolvedUtmifyPixelScript(null, "us-pixel", true),
    ).toBe("us-pixel");
    expect(
      resolvedUtmifyPixelScript(null, "us-pixel", false),
    ).toBeNull();
    expect(
      resolvedUtmifyPixelScript("mx-pixel", "us-pixel", false),
    ).toBe("mx-pixel");
    expect(resolvedUtmifyTokenEnc(null, "us-token", false)).toBeNull();
    expect(resolvedUtmifyTokenEnc("mx-token", "us-token", false)).toBe("mx-token");
    expect(
      utmifyTrackingForNewPage({
        companyIsDefault: true,
        pageScript: null,
        affiliateScript: "us-pixel",
        affiliateTokenEnc: "us-token",
      }),
    ).toEqual({
      utmifyPixelScript: "us-pixel",
      utmifyTokenEnc: "us-token",
      utmifyWebhookUrl: null,
    });
    expect(
      utmifyTrackingForNewPage({
        companyIsDefault: false,
        pageScript: null,
        affiliateScript: "us-pixel",
        affiliateTokenEnc: "us-token",
      }),
    ).toEqual({
      utmifyPixelScript: null,
      utmifyTokenEnc: null,
      utmifyWebhookUrl: null,
    });
    expect(
      utmifyTrackingForNewPage({
        companyIsDefault: false,
        pageScript: "mx-pixel",
        pageTokenEnc: "mx-token",
        affiliateScript: "us-pixel",
        affiliateTokenEnc: "us-token",
      }).utmifyPixelScript,
    ).toBe("mx-pixel");
  });

  it("sends paid orders with UTMIFY_API_TOKEN when Direct Team has no stored credential", () => {
    const previous = process.env.UTMIFY_API_TOKEN;
    try {
      process.env.UTMIFY_API_TOKEN = "sample-utmify-token";
      expect(envUtmifyApiToken()).toBe("sample-utmify-token");
      expect(
        resolveDeliverableUtmifyToken({
          pageTokenEnc: null,
          affiliateTokenEnc: null,
          companyIsDefault: true,
        }),
      ).toBe("sample-utmify-token");
      expect(
        resolveDeliverableUtmifyToken({
          pageTokenEnc: null,
          affiliateTokenEnc: null,
          companyIsDefault: false,
        }),
      ).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.UTMIFY_API_TOKEN;
      else process.env.UTMIFY_API_TOKEN = previous;
    }
  });
});

describe("pagnovo payer and status", () => {
  it("builds a checksum-valid CPF and a 10-digit phone from email", async () => {
    const { cpfFromEmail, isChecksumValidCpf, phoneFromEmail } = await import(
      "@/lib/pagnovo-payer"
    );
    const cpf = cpfFromEmail("donor@example.com");
    expect(cpf).toHaveLength(11);
    expect(isChecksumValidCpf(cpf)).toBe(true);
    expect(isChecksumValidCpf("11111111111")).toBe(false);
    expect(phoneFromEmail("donor@example.com")).toMatch(/^55\d{8}$/);
    const previous = process.env.PAGNOVO_PAYER_CPF;
    process.env.PAGNOVO_PAYER_CPF = "11111111111";
    const { resolvePayerCpf } = await import("@/lib/pagnovo-payer");
    const resolved = resolvePayerCpf("donor@example.com");
    expect(isChecksumValidCpf(resolved)).toBe(true);
    expect(resolved).not.toBe("11111111111");
    process.env.PAGNOVO_PAYER_CPF = previous;
  });

  it("maps Pagnovo statuses and extracts the deposit CLABE", async () => {
    const { extractDepositClabe, mapPagnovoStatus } = await import("@/lib/pagnovo");
    expect(mapPagnovoStatus("APPROVED")).toBe("paid");
    expect(mapPagnovoStatus("PAID")).toBe("paid");
    expect(mapPagnovoStatus("COMPLETED")).toBe("paid");
    expect(mapPagnovoStatus("REJECTED")).toBe("failed");
    expect(mapPagnovoStatus("CANCELED")).toBe("failed");
    expect(mapPagnovoStatus("PENDING")).toBe("pending");
    expect(
      extractDepositClabe({ deposit_clabe: "646180157000000004" }),
    ).toBe("646180157000000004");
    expect(extractDepositClabe({ clabe: "123" })).toBeNull();
  });

  it("blocks SPEI until name and email are filled", async () => {
    const { pagnovoDonorInvalid } = await import(
      "@/components/checkout/useCheckoutPayment"
    );
    expect(pagnovoDonorInvalid("", "")).toBe("name");
    expect(pagnovoDonorInvalid("A", "a@b.co")).toBe("name");
    expect(pagnovoDonorInvalid("Ana Perez", "")).toBe("email");
    expect(pagnovoDonorInvalid("Ana Perez", "not-an-email")).toBe("email");
    expect(pagnovoDonorInvalid("Ana Perez", "ana@correo.mx")).toBeNull();
  });

  it("forwards PagNovo secrets into the VPS process", () => {
    const source = readFileSync("ecosystem.config.cjs", "utf8");
    expect(source).toContain("PAGNOVO_SECRET_KEY");
    expect(source).toContain("PAGNOVO_WEBHOOK_SECRET");
    expect(source).toContain("PAGNOVO_RESPONSIBLE_DOCUMENT");
    expect(source).toContain("PAGNOVO_RESPONSIBLE_EXTERNAL_ID");
    expect(source).toContain("PAGNOVO_ARS_SECRET_KEY");
    expect(source).toContain("PAGNOVO_ARS_WEBHOOK_SECRET");
    expect(source).toContain("PAGNOVO_ARS_RESPONSIBLE_DOCUMENT");
    expect(source).toContain("PAGNOVO_ARS_RESPONSIBLE_EXTERNAL_ID");
  });

  it("strips /mexico and /argentina in next.config instead of a TLS rewrite to localhost", () => {
    const nextConfig = readFileSync("next.config.ts", "utf8");
    const proxy = readFileSync("proxy.ts", "utf8");
    expect(nextConfig).toContain('source: "/mexico/:path*"');
    expect(nextConfig).toContain('source: "/argentina/:path*"');
    expect(nextConfig).toContain('destination: "/:path*"');
    expect(proxy).not.toMatch(/NextResponse\.rewrite\(/);
    expect(proxy).toContain("PUBLIC_PREFIX_HEADER");
  });

  it("proxies the public site through Nginx to the Node app", () => {
    const nginx = readFileSync("deploy/nginx-ngo.conf", "utf8");
    expect(nginx).toContain("upstream crowdfunding_public");
    expect(nginx).toContain("proxy_pass http://crowdfunding_public");
    expect(nginx).toContain("location = /robots.txt");
    expect(nginx).toContain("location = /sitemap.xml");
  });

  it("does not show a restart interstitial from Nginx", () => {
    const nginx = readFileSync("deploy/nginx-ngo.conf", "utf8");
    expect(nginx).not.toContain("giving-502");
    expect(nginx).not.toContain("error_page 502");
  });

  it("restarts crowdfunding only after confirming port 3001 is closed", () => {
    const watch = readFileSync("deploy/watch-crowdfunding.sh", "utf8");
    const ecosystem = readFileSync("ecosystem.config.cjs", "utf8");
    const openGuard = watch.indexOf("port 3001 is open — not restarting");
    const restart = watch.indexOf("pm2 restart crowdfunding");
    expect(openGuard).toBeGreaterThan(-1);
    expect(restart).toBeGreaterThan(openGuard);
    expect(watch).toContain("crowdfunding-deploy.lock");
    expect(ecosystem).toContain('max_memory_restart: "1400M"');
    expect(ecosystem).not.toContain('max_memory_restart: "800M"');
  });

  it("does not seed social proof while rendering a public campaign page", () => {
    const source = readFileSync("lib/public-campaigns.ts", "utf8");
    expect(source).not.toContain("guaranteeCampaignSocialProof");
    expect(source).not.toContain("seedCampaignSocialActivity");
    expect(source).not.toMatch(/await ensureSocialProof/);
    expect(source).toContain("getAffiliateCampaign");
  });

  it("isolates ARS Pagnovo charges on PAGNOVO_ARS keys and polls CVU", async () => {
    const previous = {
      secret: process.env.PAGNOVO_ARS_SECRET_KEY,
      webhook: process.env.PAGNOVO_ARS_WEBHOOK_SECRET,
      document: process.env.PAGNOVO_ARS_RESPONSIBLE_DOCUMENT,
      externalId: process.env.PAGNOVO_ARS_RESPONSIBLE_EXTERNAL_ID,
    };
    delete process.env.PAGNOVO_ARS_SECRET_KEY;
    delete process.env.PAGNOVO_ARS_WEBHOOK_SECRET;
    delete process.env.PAGNOVO_ARS_RESPONSIBLE_DOCUMENT;
    delete process.env.PAGNOVO_ARS_RESPONSIBLE_EXTERNAL_ID;

    const {
      pagnovoChargeBlockedReason,
      extractDepositCvu,
      extractBeneficiary,
    } = await import("@/lib/pagnovo");
    const { pagnovoCredentials, isPagnovoRailConfigured } = await import(
      "@/lib/pagnovo-desk"
    );
    expect(pagnovoChargeBlockedReason("MXN")).toBeNull();
    expect(pagnovoChargeBlockedReason("ARS")).toBe(
      "Argentina bank transfer is not connected yet",
    );
    expect(pagnovoChargeBlockedReason("USD")).toBe(
      "This campaign is not set to MXN",
    );
    expect(pagnovoCredentials("ARS").secret).toBe("");
    expect(isPagnovoRailConfigured("ARS")).toBe(false);
    expect(
      extractDepositCvu({
        cvu: "",
        paymentInstruction: {
          cvu: "0000003100010000000001",
          beneficiary: "NOME DO BENEFICIÁRIO",
        },
      }),
    ).toBe("0000003100010000000001");
    expect(extractDepositCvu({ cvu: "" })).toBeNull();
    expect(
      extractBeneficiary({
        paymentInstruction: { beneficiary: "NOME DO BENEFICIÁRIO" },
      }),
    ).toBe("NOME DO BENEFICIÁRIO");

    const purchase = readFileSync("app/api/pagnovo/purchase/route.ts", "utf8");
    expect(purchase.indexOf("pagnovoChargeBlockedReason")).toBeLessThan(
      purchase.indexOf("createPagnovoPurchase("),
    );
    expect(purchase).toContain("currency: rail");
    expect(purchase).not.toContain('currency: "MXN"');
    expect(readFileSync("lib/pagnovo.ts", "utf8")).toContain("BANK_TRANSFER");
    expect(readFileSync("lib/pagnovo.ts", "utf8")).toContain("if (!ars)");
    expect(readFileSync("lib/pagnovo.ts", "utf8")).not.toContain(
      "process.env.PAGNOVO_SECRET_KEY",
    );
    expect(readFileSync("lib/pagnovo-desk.ts", "utf8")).toContain(
      "PAGNOVO_ARS_SECRET_KEY",
    );
    expect(readFileSync("app/api/webhooks/pagnovo/route.ts", "utf8")).toContain(
      "listPagnovoWebhookSecrets",
    );
    expect(readFileSync("app/api/pagnovo/status/route.ts", "utf8")).toContain(
      "extractDepositCvu",
    );
    expect(readFileSync("components/checkout/SpeiWaiting.tsx", "utf8")).toContain(
      "cvuLabel",
    );
    expect(readFileSync("scripts/seed-argentina-campaigns.ts", "utf8")).toContain(
      "utmifyPixelScript",
    );
    expect(readFileSync("scripts/seed-argentina-campaigns.ts", "utf8")).toContain(
      "guaranteeCampaignSocialProof",
    );
    expect(readFileSync("scripts/seed-mexico-campaigns.ts", "utf8")).toContain(
      "guaranteeCampaignSocialProof",
    );

    process.env.PAGNOVO_ARS_SECRET_KEY = previous.secret;
    process.env.PAGNOVO_ARS_WEBHOOK_SECRET = previous.webhook;
    process.env.PAGNOVO_ARS_RESPONSIBLE_DOCUMENT = previous.document;
    process.env.PAGNOVO_ARS_RESPONSIBLE_EXTERNAL_ID = previous.externalId;
  });

  it("maps the PagNovo ARS acquirer error for checkout", async () => {
    const {
      friendlyPagnovoPurchaseError,
      pagnovoChargeBlockedReason,
    } = await import("@/lib/pagnovo");
    const { checkoutErrorMessage } = await import(
      "@/components/checkout/useCheckoutPayment"
    );
    const { messagesFor } = await import("@/lib/i18n");

    expect(pagnovoChargeBlockedReason("MXN")).toBeNull();
    expect(
      friendlyPagnovoPurchaseError(
        "Nenhum adquirente disponível opera na moeda ARS. Configure um adquirente ARS para este seller.",
        "ARS",
      ),
    ).toBe(
      "Pagnovo has no ARS acquirer on this seller. Ask Pagnovo to enable ARS bank transfer (CVU).",
    );

    const es = messagesFor("es-AR");
    expect(
      checkoutErrorMessage(
        "Nenhum adquirente disponível opera na moeda ARS. Configure um adquirente ARS para este seller.",
        es.checkout.unableToOpen,
        es,
      ),
    ).toBe(es.checkout.arsAcquirerMissing);

    expect(readFileSync("app/api/pagnovo/purchase/route.ts", "utf8")).toContain(
      "friendlyPagnovoPurchaseError",
    );
  });
});

describe("pagnovo webhook signatures", () => {
  it("accepts a canonical HMAC of sorted keys", async () => {
    const { pagnovoWebhookSignature, verifyPagnovoSignature } = await import(
      "@/lib/pagnovo-signature"
    );
    const payload = {
      event: "cashin.paid",
      environment: "LIVE",
      payload: { amount: 10000, transaction_id: "tx-1", external_id: "intent-1" },
    };
    const secret = "webhook-secret";
    const signature = pagnovoWebhookSignature(payload, secret);
    expect(verifyPagnovoSignature(payload, signature, secret)).toBe(true);
    expect(verifyPagnovoSignature(payload, "deadbeef", secret)).toBe(false);
    const { verifyAnyPagnovoSignature } = await import("@/lib/pagnovo-signature");
    expect(
      verifyAnyPagnovoSignature(payload, signature, ["other-secret", secret]),
    ).toBe(true);
    expect(verifyAnyPagnovoSignature(payload, signature, ["other-secret"])).toBe(
      false,
    );
  });

  it("ignores an embedded signature field before hashing", async () => {
    const { pagnovoWebhookSignature, verifyPagnovoSignature } = await import(
      "@/lib/pagnovo-signature"
    );
    const secret = "webhook-secret";
    const without = { event: "cashin.paid", payload: { transaction_id: "tx-2" } };
    const withSig = {
      event: "cashin.paid",
      signature: "should-be-stripped",
      payload: { transaction_id: "tx-2" },
    };
    expect(pagnovoWebhookSignature(without, secret)).toBe(
      pagnovoWebhookSignature(withSig, secret),
    );
    expect(
      verifyPagnovoSignature(withSig, pagnovoWebhookSignature(without, secret), secret),
    ).toBe(true);
  });
});

describe("mexico i18n", () => {
  it("returns Mexican Spanish chrome for es-MX", async () => {
    const { messagesFor } = await import("@/lib/i18n");
    expect(messagesFor("es-MX").checkout.chooseAmount).toBe("Elige un monto");
    expect(messagesFor("es-AR").checkout.bankTransferTab).toBe(
      "Transferencia bancaria",
    );
    expect(messagesFor("es-AR").checkout.chooseAmount).toBe("Elige un monto");
    expect(messagesFor("es-MX").campaign.donateNow).toBe("Donar ahora");
    expect(messagesFor("en").checkout.chooseAmount).toBe("Choose an amount");
    expect(messagesFor("en").checkout.oneTime).toBe("One-time donation");
    expect(messagesFor("en").checkout.kindnessLine).toBe(
      "A small gesture of kindness can change lives",
    );
    expect(messagesFor("es-MX").checkout.stillToGo("$40,000")).toBe(
      "Aún faltan $40,000. Ayúdanos a dar un impulso.",
    );
  });
});

describe("campaign layout theme", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";

  it("defaults to CLASSIC and only treats IMPACT as the alternate layout", () => {
    expect(normalizeCampaignLayout(undefined)).toBe("CLASSIC");
    expect(normalizeCampaignLayout(null)).toBe("CLASSIC");
    expect(normalizeCampaignLayout("CLASSIC")).toBe("CLASSIC");
    expect(normalizeCampaignLayout("nope")).toBe("CLASSIC");
    expect(normalizeCampaignLayout("IMPACT")).toBe("IMPACT");
    expect(isImpactCampaignLayout("IMPACT")).toBe(true);
    expect(isImpactCampaignLayout("CLASSIC")).toBe(false);
    expect(
      nearestCheckoutOption(12_000, [
        { id: "a", amount: 5000, suggested: false, paymentLinkId: "1" },
        { id: "b", amount: 10000, suggested: true, paymentLinkId: "2" },
        { id: "c", amount: 25000, suggested: false, paymentLinkId: "3" },
      ])?.id,
    ).toBe("b");
  });

  it("accepts localhost and empty landing title on company save", () => {
    expect(
      companySchema.safeParse({
        name: "Giving Site",
        domain: "localhost",
        publicPathPrefix: "",
        landingTitle: "",
        landingBody: "",
        locale: "en",
        paymentGateway: "STRIPE",
        pagnovoWebhookSecret: "",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid layout on the admin one-click endpoint schema", () => {
    expect(
      companyLayoutSchema.safeParse({
        companyId,
        campaignLayout: "IMPACT",
      }).success,
    ).toBe(true);
    expect(
      companyLayoutSchema.safeParse({
        companyId,
        campaignLayout: "FLAT",
      }).success,
    ).toBe(false);
  });

  it("exposes CLASSIC on company brand when the field is missing", () => {
    expect(
      companyBrand({
        siteName: "Arc",
        logoUrl: null,
        primaryColor: "#0d3654",
        accentColor: "#f5a524",
        footerText: "x",
        legalText: "y",
      }).campaignLayout,
    ).toBe("CLASSIC");
    expect(
      companyBrand({
        siteName: "Arc",
        logoUrl: null,
        primaryColor: "#0d3654",
        accentColor: "#f5a524",
        footerText: "x",
        legalText: "y",
        campaignLayout: "IMPACT",
      }).campaignLayout,
    ).toBe("IMPACT");
    expect(
      companyBrand({
        siteName: "Arc",
        logoUrl: "https://cdn.example/classic.png",
        impactLogoUrl: "https://cdn.example/impact.png",
        primaryColor: "#0d3654",
        accentColor: "#f5a524",
        footerText: "x",
        legalText: "y",
        campaignLayout: "IMPACT",
      }).logoUrl,
    ).toBe("https://cdn.example/impact.png");
    expect(
      companyBrand({
        siteName: "Arc",
        logoUrl: "https://cdn.example/classic.png",
        impactLogoUrl: "https://cdn.example/impact.png",
        primaryColor: "#0d3654",
        accentColor: "#f5a524",
        footerText: "x",
        legalText: "y",
        campaignLayout: "CLASSIC",
      }).logoUrl,
    ).toBe("https://cdn.example/classic.png");
    expect(
      companyBrand({
        siteName: "Arc",
        logoUrl: "https://cdn.example/classic.png",
        faviconUrl: "https://cdn.example/favicon.png",
        primaryColor: "#0d3654",
        accentColor: "#f5a524",
        footerText: "x",
        legalText: "y",
      }).faviconUrl,
    ).toBe("https://cdn.example/favicon.png");
    expect(
      companyBrand({
        siteName: "Arc",
        logoUrl: "https://cdn.example/classic.png",
        primaryColor: "#0d3654",
        accentColor: "#f5a524",
        footerText: "x",
        legalText: "y",
      }).faviconUrl,
    ).toBe("/brand/favicon.png");
    expect(
      companyBrand({
        siteName: "Arc",
        logoUrl: null,
        primaryColor: "#0d3654",
        accentColor: "#f5a524",
        footerText: "x",
        legalText: "y",
      }).siteMode,
    ).toBe("CAMPAIGN");
    expect(
      companyBrand({
        siteName: "Harbor",
        logoUrl: null,
        primaryColor: "#0d3654",
        accentColor: "#f5a524",
        footerText: "x",
        legalText: "y",
        siteMode: "INSTITUTIONAL",
        contactEmail: "team@example.org",
      }).contactEmail,
    ).toBe("team@example.org");
  });
});

describe("institutional public nav", () => {
  it("points Impact menu rows at real public routes", () => {
    const items = impactMenu(en, null, "/c/help/direct-team");
    expect(items.map((item) => item.href)).toEqual([
      "/track-your-donation",
      "/c/help/direct-team",
      "/start-a-fundraiser",
      "/about-us",
      "/refund",
    ]);
  });

  it("adds institutional pages to the Impact menu and footer", () => {
    const items = impactMenu(en, null, "/c/help/direct-team", {
      donateHref: "/campaigns",
      institutional: true,
    });
    expect(items.some((item) => item.href === "/campaigns")).toBe(true);
    expect(items.some((item) => item.href === "/news")).toBe(true);
    expect(items.some((item) => item.href === "/help")).toBe(true);
    const columns = impactFooterColumns(en, null, "/campaigns", {
      institutional: true,
    });
    const hrefs = columns.flat().map((link) => link.href);
    expect(hrefs).toContain("/how-it-works");
    expect(hrefs).toContain("/transparency");
    expect(hrefs).toContain("/accountability");
    expect(hrefs).toContain("/refund");
  });

  it("accepts a published news post and a share-your-story form", () => {
    expect(
      sitePostSchema.safeParse({
        kind: "NEWS",
        status: "PUBLISHED",
        slug: "welcome-to-the-public-site",
        title: "A public home for verified fundraisers",
        excerpt: "Demonstration content — replace this from Admin → Posts.",
        body: "This organization publishes campaign pages with a goal, a story, and a protected checkout for supporters.",
      }).success,
    ).toBe(true);
    expect(
      shareStorySchema.safeParse({
        about: "someone",
        name: "Maya R",
        email: "maya@example.com",
        whatsapp: "+1 985 379 7831",
        address: "Hammond, Louisiana, United States",
        story:
          "I would like you to know about a neighbor who needs help covering treatment and a safer place to live this winter.",
        consentData: true,
        consentImage: false,
        consentTerms: true,
      }).success,
    ).toBe(true);
    expect(
      shareStorySchema.safeParse({
        about: "someone",
        name: "Maya R",
        email: "maya@example.com",
        whatsapp: "+1 985 379 7831",
        address: "Hammond, Louisiana, United States",
        story:
          "I would like you to know about a neighbor who needs help covering treatment and a safer place to live this winter.",
        consentData: true,
        consentImage: false,
        consentTerms: false,
      }).success,
    ).toBe(false);
    expect(
      shareStorySchema.safeParse({
        about: "someone",
        name: "Maya R",
        email: "maya@example.com",
        whatsapp: "+1 985 379 7831",
        address: "Hammond, Louisiana, United States",
        story:
          "I would like you to know about a neighbor who needs help covering treatment and a safer place to live this winter.",
        consentData: false,
        consentImage: false,
      }).success,
    ).toBe(false);
  });
});

describe("checkout tip split", () => {
  it("never adds tip to the charge so payment-link amounts stay fixed", () => {
    expect(DEFAULT_TIP_PERCENT).toBe(0);
    expect(splitCheckoutCharge(2500, tipCentsForPercent(2500, 17.5))).toEqual({
      donationAmount: 2500,
      tipAmount: 0,
      chargeAmount: 2500,
    });
    expect(splitCheckoutCharge(2500, 10_000)).toEqual({
      donationAmount: 2500,
      tipAmount: 0,
      chargeAmount: 2500,
    });
    expect(splitCheckoutCharge(2500, 0)).toEqual({
      donationAmount: 2500,
      tipAmount: 0,
      chargeAmount: 2500,
    });
  });
});

describe("admin company desks and paid sales filters", () => {
  it("labels United States Stripe and México PagNovo as separate desks", () => {
    expect(
      isMexicoCompany({
        slug: "giving-site",
        locale: "en",
        paymentGateway: "STRIPE",
      }),
    ).toBe(false);
    expect(
      isMexicoCompany({
        slug: "mexico",
        locale: "es-MX",
        paymentGateway: "PAGNOVO",
      }),
    ).toBe(true);
    expect(companyDesk({ slug: "giving-site", locale: "en" })).toEqual({
      region: "United States",
      gateway: "Stripe",
      currency: "USD",
    });
    expect(companyDesk({ slug: "mexico", locale: "es-MX", paymentGateway: "PAGNOVO" })).toEqual({
      region: "México",
      gateway: "PagNovo",
      currency: "MXN",
    });
    expect(companyDeskLabel({ slug: "mexico" })).toBe("México · PagNovo");
    expect(
      isMexicoCompany({
        slug: "argentina",
        locale: "es-AR",
        paymentGateway: "PAGNOVO",
      }),
    ).toBe(false);
    expect(
      companyDesk({ slug: "argentina", locale: "es-AR", paymentGateway: "PAGNOVO" }),
    ).toEqual({
      region: "Argentina",
      gateway: "PagNovo",
      currency: "ARS",
    });
    expect(companyDeskLabel({ slug: "argentina", locale: "es-AR" })).toBe(
      "Argentina · PagNovo · ARS",
    );
    expect(deskDirectTeamSlug({ slug: "argentina", locale: "es-AR" })).toBe(
      "direct-team-argentina",
    );
    expect(deskDirectTeamName({ slug: "argentina" })).toBe("Direct Team Argentina");
    expect(deskDirectTeamSlug({ slug: "mexico", locale: "es-MX" })).toBe(
      "direct-team-mexico",
    );
    expect(deskDirectTeamSlug({ slug: "giving-site", locale: "en" })).toBe(
      "direct-team",
    );
  });

  it("lists every active company campaign in Impact search and labels the admin desk", () => {
    const page = readFileSync("app/c/[campaignSlug]/[affiliateSlug]/page.tsx", "utf8");
    const publicCampaigns = readFileSync("lib/public-campaigns.ts", "utf8");
    const seed = readFileSync("lib/seed-social-activity.ts", "utf8");
    const adminList = readFileSync("app/admin/campaigns/page.tsx", "utf8");
    expect(publicCampaigns).toContain("export async function listPublicCompanyCampaigns");
    expect(page).toContain("listPublicCompanyCampaigns");
    expect(seed).toContain("deskDirectTeamSlug");
    expect(adminList).toContain("companyDesk");
    expect(adminList).toContain("desk.region");
  });

  it("keeps PagNovo sales whose Stripe session id is null", () => {
    expect(excludeSocialSeedSales).toEqual({
      OR: [
        { stripeCheckoutSessionId: null },
        {
          stripeCheckoutSessionId: {
            not: { startsWith: "seed-social-" },
          },
        },
      ],
    });
    expect(readFileSync("scripts/resync-stripe-utmify.ts", "utf8")).toContain(
      "excludeSocialSeedSales",
    );
    expect(paidLiveSalesWhere("mexico-company")).toMatchObject({
      livemode: true,
      campaign: { companyId: "mexico-company" },
    });
    expect(giftAmountCents({ amount: 3500, tipAmount: 500 })).toBe(3000);
    expect(tipAmountCents({ tipAmount: 500 })).toBe(500);
    expect(hasMissionTip({ tipAmount: 500 })).toBe(true);
    expect(hasMissionTip({ tipAmount: 0 })).toBe(false);
    expect(
      resolvedMissionTipCents({
        amount: 3500,
        tipAmount: 0,
        intentTipAmount: MISSION_TIP_CENTS,
        donationOptionAmount: 3000,
      }),
    ).toBe(500);
    expect(
      resolvedMissionTipCents({
        amount: 3000,
        tipAmount: 0,
        intentTipAmount: 0,
        donationOptionAmount: 2500,
      }),
    ).toBe(500);
    expect(
      resolvedMissionTipCents({
        amount: 2500,
        tipAmount: 0,
        intentTipAmount: 0,
        donationOptionAmount: 2500,
      }),
    ).toBe(0);
    expect(
      resolvedMissionTipCents({
        amount: 2800,
        tipAmount: 0,
        intentTipAmount: 500,
        donationOptionAmount: null,
      }),
    ).toBe(500);
    expect(
      resolvedMissionTipCents({
        amount: 3000,
        tipAmount: 0,
        intentTipAmount: 500,
        donationOptionAmount: 3000,
      }),
    ).toBe(0);
    expect(
      resolvedMissionTipCents({
        amount: 3000,
        tipAmount: 0,
        intentTipAmount: 0,
        donationOptionAmount: null,
        campaignOptionAmounts: [2500, 5000, 10000],
      }),
    ).toBe(500);
    expect(
      resolvedMissionTipCents({
        amount: 5000,
        tipAmount: 0,
        intentTipAmount: 0,
        donationOptionAmount: null,
        campaignOptionAmounts: [2500, 5000, 10000],
      }),
    ).toBe(0);
    expect(
      resolvedMissionTipCents({
        amount: 3000,
        tipAmount: 0,
        stripeTipAmount: 500,
        donationOptionAmount: 2500,
      }),
    ).toBe(500);
  });

  it("uses Los Angeles day bounds so Stripe evening sales stay on the Pacific calendar day", () => {
    const sep15 = dayBounds({ from: "2026-09-15", to: "2026-09-15" });
    expect(sep15.fromDate.toISOString()).toBe("2026-09-15T07:00:00.000Z");
    expect(sep15.toDate.toISOString()).toBe("2026-09-16T06:59:59.999Z");

    const afternoon = new Date("2026-09-15T23:06:00.000Z"); // 4:06 PM PDT
    const evening = new Date("2026-09-16T04:28:00.000Z"); // 9:28 PM PDT Sep 15
    const nextMorning = new Date("2026-09-16T11:19:00.000Z"); // 4:19 AM PDT Sep 16
    expect(afternoon >= sep15.fromDate && afternoon <= sep15.toDate).toBe(true);
    expect(evening >= sep15.fromDate && evening <= sep15.toDate).toBe(true);
    expect(nextMorning >= sep15.fromDate && nextMorning <= sep15.toDate).toBe(false);
    expect(reportingIsoDate(afternoon)).toBe("2026-09-15");
    expect(reportingIsoDate(evening)).toBe("2026-09-15");
    expect(reportingIsoDate(nextMorning)).toBe("2026-09-16");

    const range = dayBounds({ from: "2026-08-30", to: "2026-09-05" });
    expect(range.fromDate.toISOString()).toBe("2026-08-30T07:00:00.000Z");
    expect(range.toDate.toISOString()).toBe("2026-09-06T06:59:59.999Z");
    const spei = new Date("2026-09-05T04:05:35.540Z");
    expect(spei >= range.fromDate && spei <= range.toDate).toBe(true);

    expect(zonedStartOfDay("2027-01-15").toISOString()).toBe("2027-01-15T08:00:00.000Z");
    expect(
      rangeFromPreset("today", new Date("2026-09-16T04:00:00.000Z")),
    ).toEqual({ from: "2026-09-15", to: "2026-09-15" });
    expect(lastDaysRange(7, new Date("2026-09-16T04:00:00.000Z"))).toEqual({
      from: "2026-09-09",
      to: "2026-09-15",
    });
    expect(
      periodChipFor(lastDaysRange(30, new Date("2026-09-16T04:00:00.000Z")), new Date("2026-09-16T04:00:00.000Z")),
    ).toBe("30d");
    expect(homeRangeFromQuery(undefined)).toBe("30");
    expect(homeRangeFromQuery("today")).toBe("today");
    expect(homeRangeFromQuery("1")).toBe("today");
    expect(homeRangeFromQuery("7")).toBe("7");
    expect(homeRangeDays("today")).toBe(1);
    expect(lastDaysRange(1, new Date("2026-09-16T04:00:00.000Z"))).toEqual({
      from: "2026-09-15",
      to: "2026-09-15",
    });
    expect(reportingHour(new Date("2026-09-15T23:06:00.000Z"))).toBe(16);
    expect(formatReportingDateTime(new Date("2026-09-25T03:28:27.000Z"))).toBe(
      "2026-09-24 20:28:27",
    );
    expect(formatUtmifyDate(new Date("2026-09-25T02:15:22.000Z"))).toBe(
      "2026-09-25 02:15:22",
    );
    expect(formatUtmifyDate(new Date("2026-09-25T13:18:18.000Z"))).toBe(
      "2026-09-25 13:18:18",
    );
    expect(readFileSync("app/admin/page.tsx", "utf8")).toContain('href="/admin?range=today"');
    expect(readFileSync("app/admin/page.tsx", "utf8")).toContain("By campaign");
    expect(readFileSync("components/admin/CampaignRankRow.tsx", "utf8")).toContain("CampaignIdentity");
    expect(readFileSync("components/admin/PaymentRow.tsx", "utf8")).toContain("campaignSlug");
    expect(readFileSync("app/admin/campaigns/page.tsx", "utf8")).toContain("CampaignIdentity");
    expect(readFileSync("app/globals.css", "utf8")).toContain(".dash-rank-copy > span");
  });
});

describe("campaign comments", () => {
  it("writes Spanish notes for MXN campaigns and English for USD", () => {
    const mx = campaignCommentPool({
      title: "Ayuda a Jonatan",
      story: "Necesita silla de ruedas y medicinas.",
      currency: "MXN",
    });
    expect(mx.some((body) => body.includes("Jonatan"))).toBe(true);
    expect(mx.every((body) => /[áéíóúñ¿¡]|Doné|Ojalá|Que /i.test(body) || body.includes("Jonatan"))).toBe(true);
    expect(mx.some((body) => /I donated|This is for/.test(body))).toBe(false);

    const us = campaignCommentPool({
      title: "Help Cecilia",
      story: "She needs medicine and a safer place to live.",
      currency: "USD",
    });
    expect(us.some((body) => body.includes("Cecilia"))).toBe(true);
    expect(us.some((body) => body.includes("Doné"))).toBe(false);
  });

  it("does not treat CTA copy like Make a Difference as a person", () => {
    expect(extractCampaignSubject("Make a Difference Today", "Our Family")).toBeNull();
    expect(extractCampaignSubject("Help Make a Difference", "Our Family")).toBeNull();
    expect(extractCampaignSubject("Help Cecilia get home")).toBe("Cecilia");
    expect(
      extractCampaignSubject(
        "Help My Father Get Arm Prosthetics to Keep Working with Dignity",
      ),
    ).toBe("Father");
    const cta = campaignCommentPool({
      title: "Make a Difference Today",
      organizerName: "Our Family",
      story:
        "From our hearts, thank you. Make a Difference Today. Your donation brings hope.",
      currency: "USD",
    });
    expect(cta.some((body) => /\bMake\b/.test(body))).toBe(false);
    expect(cta.some((body) => /scrolled past|doing nothing|honest|direct way/i.test(body))).toBe(
      true,
    );
    expect(
      commentUsesRejectedSubject(
        "Make shouldn’t still be living like this. I gave so they can cover the most urgent part of this story.",
      ),
    ).toBe(true);
    expect(
      seededSocialNeedsRefresh({
        newestPaidAt: new Date(),
        bodies: [
          "I donated so Make can cover the most urgent part of this story.",
        ],
      }),
    ).toBe(true);
  });

  it("tells capitalized title words like Little Angels apart from a person's name", () => {
    const title = "Help these Little Angels that are living in the Streets ❤️";
    expect(extractCampaignSubject(title)).toBeNull();
    expect(extractCampaignSubject(title, "this organization")).toBeNull();
    expect(
      extractCampaignSubject("Ayuda a los Pequeños Ángeles que viven en la Calle"),
    ).toBeNull();
    expect(extractCampaignSubject("Help this organization feed 200 families")).toBeNull();
    expect(extractCampaignSubject("Operation Smile needs you")).toBeNull();
    expect(extractCampaignSubject("Hope Rising After the Flood")).toBeNull();
    expect(extractCampaignSubject("Casa de Esperanza")).toBeNull();
    expect(extractCampaignSubject("Help the Garcia family rebuild")).toBeNull();
    // A word the story also writes in lowercase is a word, not a name.
    expect(extractCampaignSubject("Help Sunny get surgery")).toBe("Sunny");
    expect(
      extractCampaignSubject("Help Sunny get surgery", null, "It was a sunny morning."),
    ).toBeNull();

    expect(extractCampaignSubject("Help Lucas walk again")).toBe("Lucas");
    expect(extractCampaignSubject("Lucas needs a wheelchair")).toBe("Lucas");
    expect(extractCampaignSubject("Little Mateo needs surgery")).toBe("Mateo");
    expect(extractCampaignSubject("Maria Silva necesita una silla de ruedas")).toBe("Maria");
    expect(
      extractCampaignSubject("Jonatan, 34 years old, Works hard not to give up on life"),
    ).toBe("Jonatan");
    expect(extractCampaignSubject("Rebuilding Rosa's home after the fire")).toBe("Rosa");
    expect(extractCampaignSubject("Help Hope get a wheelchair")).toBe("Hope");
    expect(extractCampaignSubject("Help Make a Difference for Pedro")).toBe("Pedro");
    expect(extractCampaignSubject("Un techo para Doña Rosa")).toBe("Rosa");
    expect(extractCampaignSubject("Team Lucas: fight against leukemia")).toBe("Lucas");
    expect(extractCampaignSubject("HELP MARIA WALK AGAIN")).toBe("Maria");

    const pool = campaignCommentPool({
      title,
      story: "These children sleep on the streets. Your gift protects little feet from the cold.",
      organizerName: "this organization",
      currency: "USD",
    });
    expect(pool.length).toBeGreaterThanOrEqual(10);
    expect(pool.some((body) => /\bLittle\b/.test(body))).toBe(false);
    for (const body of [
      "Standing with Little. Let this help keep her children safe and cared for.",
      "Just gave as well. Let's keep going until Little can keep her children safe and cared for.",
      "The part about keep her children safe and cared for is what made me donate for Little.",
      "Same here. Little shouldn't carry this alone.",
      "I donated so Little can keep her children safe and cared for.",
      "Thank you for writing. I gave so Little can keep her children safe and cared for.",
      "Just donated for Little. Don't stop until they can keep her children safe and cared for.",
    ]) {
      expect(commentUsesRejectedSubject(body)).toBe(true);
    }
    expect(commentUsesRejectedSubject("Same here. Little shouldn’t carry this alone.")).toBe(
      true,
    );
    expect(commentUsesRejectedSubject("I donated so Father can get a real wheelchair.")).toBe(
      false,
    );
    expect(
      seededSocialNeedsRefresh({
        newestPaidAt: new Date(),
        bodies: ["Standing with Little. Let this help keep her children safe and cared for."],
      }),
    ).toBe(true);
    expect(campaignNameTag(title)).toBe("Little Angels");
    expect(campaignNameTag("Make a Difference Today")).toBe("Make a Difference Today");
    expect(pool.some((body) => /safe and cared for/i.test(body))).toBe(false);
    expect(commentsStampOnePhrase(pool)).toBe(false);
  });

  it("writes a different concrete detail in each seeded comment", () => {
    const story = [
      "Provides 1 high-durability thermal blanket and 1 pair of warm socks to protect little feet from extreme cold.",
      "Delivers a heavy-duty waterproof jacket, beanie, gloves, and blankets to keep a child warm.",
      "Feeds and protects: guarantees hot, nutritious meals for a week, alongside winter clothing.",
      "Funds safe, temporary shelter for a child and their family during the coldest days.",
    ].join("\n");
    const pool = campaignCommentPool({
      title: "Help these Little Angels that are living in the Streets",
      story,
      organizerName: "this organization",
      currency: "USD",
    });
    expect(pool.some((body) => /\bLittle\b/.test(body))).toBe(false);
    expect(pool.some((body) => /safe and cared for/i.test(body))).toBe(false);
    expect(pool.some((body) => /blanket|socks/i.test(body))).toBe(true);
    expect(pool.some((body) => /jacket|gloves/i.test(body))).toBe(true);
    expect(pool.some((body) => /meal/i.test(body))).toBe(true);
    expect(pool.some((body) => /shelter/i.test(body))).toBe(true);
    expect(pool.some((body) => /street/i.test(body))).toBe(true);
    const distinct = new Set(
      pool.map((body) => body.toLowerCase().replace(/[^a-z\s]/g, "").slice(0, 48)),
    );
    expect(distinct.size).toBeGreaterThanOrEqual(8);
    expect(commentsStampOnePhrase(pool)).toBe(false);
    expect(
      commentUsesStampedClause(
        "I read the whole story and gave so they can keep her children safe and cared for.",
      ),
    ).toBe(true);
  });

  it("renders **words** in a story as bold and toggles the marker from a selection", () => {
    expect(storySegments("Provides **1 thermal blanket** for a child.")).toEqual([
      { text: "Provides ", bold: false },
      { text: "1 thermal blanket", bold: true },
      { text: " for a child.", bold: false },
    ]);
    expect(storySegments("no markers here")).toEqual([{ text: "no markers here", bold: false }]);
    expect(storySegments("a ** b")).toEqual([{ text: "a ** b", bold: false }]);
    expect(plainStoryText("**Comfort Kit**\nWarm socks for **little feet**.")).toBe(
      "Comfort Kit\nWarm socks for little feet.",
    );

    const text = "Delivers a complete set to keep a child warm.";
    const wrapped = toggleStoryBold(text, 11, 23);
    expect(wrapped).toEqual({
      text: "Delivers a **complete set** to keep a child warm.",
      start: 13,
      end: 25,
    });
    const unwrapped = toggleStoryBold(wrapped!.text, wrapped!.start, wrapped!.end);
    expect(unwrapped?.text).toBe(text);
    expect(toggleStoryBold(wrapped!.text, 11, 27)?.text).toBe(text);
    expect(toggleStoryBold(text, 8, 8)).toBeNull();
    expect(toggleStoryBold(text, 8, 11)?.text).toBe("Delivers **a** complete set to keep a child warm.");
  });

  it("flags comments newer than 8 hours and refreshes generic English seeds", () => {
    expect(isNewActivity(new Date(Date.now() - 60 * 60 * 1000).toISOString())).toBe(true);
    expect(isNewActivity(new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString())).toBe(false);
    expect(
      isGenericSocialComment(
        "This is the kind of help I hope someone would offer my family too.",
      ),
    ).toBe(true);
    expect(
      seededSocialNeedsRefresh({
        newestPaidAt: new Date("2026-09-01T00:00:00.000Z"),
        bodies: ["This is the kind of help I hope someone would offer my family too."],
        now: new Date("2026-09-05T00:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("labels page-link campaigns with a short name tag and a 3-day New window", () => {
    expect(campaignNameTag("Jonatan, 34 years old, Works hard not to give up on life")).toBe(
      "Jonatan",
    );
    expect(campaignNameTag("Help Les Retire After a Lifetime of Work")).toBe("Les");
    expect(campaignNameTag("Help Martha and Alberto Build a More Stable Life")).toBe(
      "Martha & Alberto",
    );
    expect(campaignNameTag("Help build Cecilia's dream")).toBe("Cecilia");
    expect(campaignNameTag("Goyito, Crawls Every Day Just to Survive and Care for His Mother")).toBe(
      "Goyito",
    );
    const now = Date.parse("2026-09-13T10:00:00.000Z");
    expect(isNewCampaign("2026-09-12T12:00:00.000Z", now)).toBe(true);
    expect(isNewCampaign("2026-09-01T12:00:00.000Z", now)).toBe(false);
  });

  it("builds Admin sale push copy with the net amount", async () => {
    const { salePushNotification } = await import("@/lib/sale-push");
    expect(
      salePushNotification({
        campaignTitle: "Let’s bless this humble father",
        amount: 2500,
        gatewayFee: 0,
        currency: "USD",
      }),
    ).toEqual({
      title: "US (global)",
      body: "Parabéns, mais uma venda aprovada\nNet: $25.00 - HUM***",
      url: "/admin/sales",
    });
    expect(
      salePushNotification({
        campaignTitle: "Jonatan, 34 years old, Works hard not to give up on life",
        amount: 10_000,
        gatewayFee: 150,
        currency: "USD",
      }).body,
    ).toBe("Parabéns, mais uma venda aprovada\nNet: $98.50 - JON***");
    expect(
      salePushNotification({
        campaignTitle: "Help Martha and Alberto Build a More Stable Life",
        amount: 5000,
        currency: "USD",
      }).body,
    ).toBe("Parabéns, mais uma venda aprovada\nNet: $50.00 - MAR***");
    expect(
      salePushNotification({
        amount: 2500,
        currency: "USD",
      }).body,
    ).toBe("Parabéns, mais uma venda aprovada\nNet: $25.00 - CAM***");
    expect(
      salePushNotification({
        campaignTitle: "Help build Cecilia's dream",
        amount: 10_000,
        currency: "MXN",
      }),
    ).toEqual({
      title: "MX",
      body: "Parabéns, mais uma venda aprovada\nNet: $100.00 - CEC***",
      url: "/admin/sales",
    });
    expect(
      salePushNotification({
        campaignTitle: "Ayuda a construir el sueño de Cecilia",
        amount: 200_000,
        currency: "ARS",
      }).title,
    ).toBe("AR");
  });

  it("plays a sale chime from the admin worker when a push arrives", async () => {
    const { isSaleChimeMessage } = await import("@/lib/sale-chime");
    expect(isSaleChimeMessage({ type: "sale-chime" })).toBe(true);
    expect(isSaleChimeMessage({ type: "other" })).toBe(false);
    const worker = readFileSync("public/sw.js", "utf8");
    expect(worker).toContain("silent: false");
    expect(worker).toContain('type: "sale-chime"');
    expect(worker).toContain('type: "open-sales"');
    expect(worker).not.toContain("fetchAdminNavigation");
    expect(worker).not.toMatch(/addEventListener\("fetch"/);
    expect(worker).toContain('title: "US (global)"');
    expect(worker).not.toContain("client.navigate");
    expect(worker).not.toContain('"Admin"');
    expect(readFileSync("public/admin/sw.js", "utf8")).toContain(
      'type: "sale-chime"',
    );
    expect(readFileSync("lib/admin-push.ts", "utf8")).toContain(
      'urgency: "high"',
    );
  });

  it("never writes em-dashes or double hyphens in public comment copy", () => {
    const us = campaignCommentPool({
      title: "Help Cecilia",
      story: "She needs medicine and a safer place to live.",
      currency: "USD",
    });
    const mx = campaignCommentPool({
      title: "Ayuda a Jonatan",
      story: "Necesita silla de ruedas y medicinas.",
      currency: "MXN",
    });
    for (const body of [...us, ...mx]) {
      expect(body).not.toMatch(/[—–]|---|--/);
    }
    expect(withoutAiDashes("Support — now --- please – thanks")).toBe(
      "Support, now, please, thanks",
    );
  });

  it("accepts a reply payload with parentId and rejects a second-level-looking empty body", () => {
    const parsed = commentSchema.safeParse({
      saleId: "2c7e1f3a-8b64-4d2e-9c11-4a6d8f0b21c9",
      authorName: "Chris Walker",
      body: "Glad this reached them.",
      parentId: "9a0c4b12-3d55-4e88-a101-7b2c9d0e4f18",
    });
    expect(parsed.success).toBe(true);
    expect(commentSchema.safeParse({
      saleId: "2c7e1f3a-8b64-4d2e-9c11-4a6d8f0b21c9",
      authorName: "Chris Walker",
      body: "ok",
    }).success).toBe(false);
  });
});
