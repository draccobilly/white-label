import { NextRequest, NextResponse } from "next/server";
import { CampaignStatus, TrackingEventType } from "@/generated/prisma/enums";
import {
  createDonorBrowserToken,
  PENDING_CHECKOUT_COOKIE_MAX_AGE,
  pendingCheckoutCookieName,
} from "@/lib/donor-browser-token";
import { usesEmbeddedStripeCheckout } from "@/lib/embedded-stripe";
import { mergeAdClick, readAdClickCookie } from "@/lib/ad-click";
import { clientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { minDonationCents } from "@/lib/donation-ticket";
import { causeSoldLabel, CAUSE_PAGE_ID } from "@/lib/foundation-causes";
import { ensurePublicCausePage } from "@/lib/public-cause-page";
import { formatMoney } from "@/lib/utils";
import {
  GATEWAY_CAMPAIGN_VOICE,
  GATEWAY_FALLBACK_NAME,
  GATEWAY_GENERAL_TEMPLATES,
  GATEWAY_PRODUCT_GROUPS,
} from "@/lib/gateway-product-names";
import { campaignDeckKey, campaignProductTemplates } from "@/lib/gateway-campaign-names";
import type { embeddedCheckoutSchema } from "@/lib/validators";
import type { z } from "zod";

type EmbeddedCheckoutInput = z.infer<typeof embeddedCheckoutSchema>;

export const CHECKOUT_ITEM_NAME = GATEWAY_FALLBACK_NAME;
export const MISSION_TIP_NAME = "Mission tip";

/**
 * Product names sent to the gateway live in lib/gateway-product-names.ts, one
 * catalog per operation, grouped by cause. This is every name across groups.
 */
export const GATEWAY_PRODUCT_TEMPLATES: readonly string[] = [
  ...GATEWAY_PRODUCT_GROUPS.flatMap((group) => group.templates),
  ...GATEWAY_GENERAL_TEMPLATES,
];

export const GATEWAY_GENERAL_GROUP_KEY = "general";

export type GatewayProductContext = {
  /** Cause slug sent by the checkout, or the campaign slug on campaign pages. */
  causeSlug?: string | null;
  campaignSlug?: string | null;
  campaignTitle?: string | null;
  campaignCategory?: string | null;
  campaignSummary?: string | null;
  campaignStory?: string | null;
  /** Campaign.gatewayNames: names written from the story and reviewed in the admin. */
  campaignGatewayNames?: readonly string[] | null;
};

function groupBySlug(slug: string | null | undefined) {
  const value = slug?.trim().toLowerCase() ?? "";
  if (!value) return null;
  const group = GATEWAY_PRODUCT_GROUPS.find((entry) =>
    entry.slugs.some((candidate) => candidate.trim().toLowerCase() === value),
  );
  return group ? { key: group.key, templates: group.templates } : null;
}

/** Short fingerprint so a regenerated list gets a fresh rotation deck. */
function namesDeckSuffix(names: readonly string[]) {
  let hash = 0;
  for (const char of names.join("\n")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

/**
 * Picks the catalog the donation belongs to, in this order:
 * 1. a cause slug listed on a group (the public cause pages);
 * 2. the names stored on the campaign, written from its story and reviewed
 *    in the admin (Campaign.gatewayNames);
 * 3. a campaign slug listed on a group;
 * 4. the word-matching rewrite of the campaign's title, summary, and story;
 * 5. with no campaign at all, the general list.
 */
export function gatewayProductGroup(context: GatewayProductContext = {}) {
  const byCause = groupBySlug(context.causeSlug);
  if (byCause) return byCause;

  const stored = (context.campaignGatewayNames ?? [])
    .map((name) => name.trim())
    .filter((name) => name.split("{amount}").length === 2);
  if (stored.length > 0) {
    const base = campaignDeckKey(context.campaignSlug, context.campaignTitle ?? "");
    return { key: `${base}:${namesDeckSuffix(stored)}`, templates: stored };
  }

  const byCampaignSlug = groupBySlug(context.campaignSlug);
  if (byCampaignSlug) return byCampaignSlug;

  const title = context.campaignTitle?.trim() ?? "";
  if (title) {
    const templates = campaignProductTemplates(
      {
        title,
        category: context.campaignCategory,
        summary: context.campaignSummary,
        story: context.campaignStory,
      },
      GATEWAY_CAMPAIGN_VOICE,
    );
    if (templates.length > 0) {
      return { key: campaignDeckKey(context.campaignSlug, title), templates };
    }
  }
  return { key: GATEWAY_GENERAL_GROUP_KEY, templates: GATEWAY_GENERAL_TEMPLATES };
}

/**
 * One shuffled deck of template indexes per group. Every name in the group is
 * dealt once before the deck is rebuilt, so the gateway sees the whole catalog
 * evenly instead of random clusters, and no name goes out twice in a row.
 */
const templateDecks = new Map<string, { deck: number[]; last: number }>();

function nextTemplateIndex(key: string, size: number) {
  const state = templateDecks.get(key) ?? { deck: [], last: -1 };
  if (state.deck.length === 0) {
    state.deck = Array.from({ length: size }, (_, i) => i);
    for (let i = size - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
    }
    const top = state.deck.length - 1;
    if (size > 1 && state.deck[top] === state.last) {
      [state.deck[top], state.deck[0]] = [state.deck[0], state.deck[top]];
    }
  }
  const choice = state.deck.pop() ?? 0;
  state.last = choice;
  templateDecks.set(key, state);
  return choice;
}

export function gatewayProductLabel(
  amountCents: number,
  currency = "USD",
  options: GatewayProductContext & { index?: number } = {},
) {
  const amount = formatMoney(Math.max(0, Math.round(amountCents)), currency);
  const group = gatewayProductGroup(options);
  const size = group.templates.length;
  const choice =
    options.index == null
      ? nextTemplateIndex(group.key, size)
      : Math.abs(Math.trunc(options.index)) % size;
  const template = group.templates[choice] ?? group.templates[0] ?? GATEWAY_FALLBACK_NAME;
  return template.replaceAll("{amount}", amount);
}

export function missionTipCentsFromStripeLineItems(
  items: Array<{
    description?: string | null;
    amount_total?: number | null;
    quantity?: number | null;
    price?: { unit_amount?: number | null } | null;
  }>,
) {
  for (const item of items) {
    const name = item.description?.trim() ?? "";
    if (name.toLowerCase() !== MISSION_TIP_NAME.toLowerCase()) continue;
    const cents =
      item.amount_total ??
      Math.max(0, item.price?.unit_amount ?? 0) * Math.max(1, item.quantity ?? 1);
    return Math.max(0, cents);
  }
  return 0;
}

export function checkoutSessionIdFromPaymentIntent(paymentIntent: object) {
  const record = paymentIntent as {
    payment_details?: { order_reference?: string | null } | null;
    metadata?: Record<string, string> | null;
  };
  const reference = record.payment_details?.order_reference?.trim();
  if (reference?.startsWith("cs_")) return reference;
  const fromMeta = record.metadata?.checkoutSessionId?.trim();
  if (fromMeta?.startsWith("cs_")) return fromMeta;
  return null;
}

export function stripePaymentLabel(label: string | null | undefined) {
  const value = label?.trim();
  return (value || CHECKOUT_ITEM_NAME).slice(0, 1000);
}

export function stripeCheckoutMetadata(input: {
  kind: string;
  checkoutIntentId: string;
  affiliatePageId: string;
  donationOptionId?: string | null;
}) {
  return {
    checkoutKind: input.kind,
    checkoutIntentId: input.checkoutIntentId,
    affiliatePageId: input.affiliatePageId,
    donationOptionId: input.donationOptionId ?? "",
  };
}

export async function startEmbeddedDonation(
  request: NextRequest,
  parsed: EmbeddedCheckoutInput,
) {
  const ip = clientIp(request);
  const affiliatePageId =
    parsed.affiliatePageId === CAUSE_PAGE_ID
      ? await ensurePublicCausePage()
      : parsed.affiliatePageId;
  const page = await prisma.affiliatePage.findFirst({
    where: {
      id: affiliatePageId,
      active: true,
      affiliate: { active: true },
      campaign: { status: CampaignStatus.ACTIVE },
    },
    include: {
      affiliate: true,
      campaign: {
        include: {
          company: {
            select: { paymentGateway: true, siteMode: true, siteName: true },
          },
          options: true,
        },
      },
    },
  });
  if (!page?.campaign.company || !usesEmbeddedStripeCheckout(page.campaign.company)) {
    return { ok: false as const, status: 404, error: "Embedded checkout is not available" };
  }

  const option = parsed.donationOptionId
    ? page.campaign.options.find((item) => item.id === parsed.donationOptionId)
    : page.campaign.options.find((item) => item.amount === parsed.amountCents);
  const donation = parsed.amountCents ?? option?.amount ?? null;
  const tip = parsed.tipCents === 500 ? 500 : 0;
  const minAmount = minDonationCents(page.campaign.currency);
  if (donation == null) {
    return { ok: false as const, status: 400, error: "Invalid checkout request" };
  }
  const amount = donation + tip;
  if (amount < minAmount) {
    return { ok: false as const, status: 400, error: "Invalid checkout request" };
  }

  const attribution = mergeAdClick(readAdClickCookie(request), parsed.attribution ?? {});
  const intent = await prisma.$transaction(async (tx) => {
    const created = await tx.checkoutIntent.create({
      data: {
        affiliatePageId: page.id,
        donationOptionId: option?.id ?? null,
        amount,
        tipAmount: tip,
        hideName: parsed.hideName === true,
        gatewayLabel: gatewayProductLabel(donation, page.campaign.currency, {
          causeSlug: parsed.causeSlug,
          campaignSlug: page.campaign.slug,
          campaignTitle: page.campaign.title,
          campaignCategory: page.campaign.category,
          campaignSummary: page.campaign.summary,
          campaignStory: page.campaign.story,
          campaignGatewayNames: page.campaign.gatewayNames,
        }),
        soldLabel: causeSoldLabel(page.id, parsed.causeSlug),
        currency: page.campaign.currency,
        src: attribution.src,
        sck: attribution.sck,
        utmSource: attribution.utmSource,
        utmMedium: attribution.utmMedium,
        utmCampaign: attribution.utmCampaign,
        utmContent: attribution.utmContent,
        utmTerm: attribution.utmTerm,
        landingUrl: attribution.landingUrl,
        referrer: attribution.referrer,
        clientIp: ip === "unknown" ? null : ip,
        userAgent: request.headers.get("user-agent")?.slice(0, 500),
        fbp: attribution.fbp,
        fbc: attribution.fbc,
        visitorSessionId: parsed.visitorSessionId ?? null,
        pendingComment: parsed.comment?.trim() || null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await tx.trackingEvent.create({
      data: {
        affiliatePageId: page.id,
        type: TrackingEventType.CHECKOUT_STARTED,
        src: attribution.src,
        sck: attribution.sck,
        utmSource: attribution.utmSource,
        utmMedium: attribution.utmMedium,
        utmCampaign: attribution.utmCampaign,
        utmContent: attribution.utmContent,
        utmTerm: attribution.utmTerm,
      },
    });
    return created;
  });

  return {
    ok: true as const,
    page,
    option: option ?? null,
    donation,
    tip,
    amount,
    intent,
    origin: request.nextUrl.origin.replace(/\/+$/, ""),
  };
}

export function withPendingCheckoutCookie(
  response: NextResponse,
  input: { origin: string; affiliatePageId: string; checkoutIntentId: string },
) {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ENCRYPTION_KEY is not configured");
  response.cookies.set({
    name: pendingCheckoutCookieName(input.affiliatePageId),
    value: createDonorBrowserToken(
      { affiliatePageId: input.affiliatePageId, checkoutIntentId: input.checkoutIntentId },
      secret,
    ),
    httpOnly: true,
    secure: input.origin.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_CHECKOUT_COOKIE_MAX_AGE,
  });
  return response;
}
