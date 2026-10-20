import type Stripe from "stripe";
import { CampaignStatus, SaleStatus } from "@/generated/prisma/enums";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { chooseStripePaymentLinkOwner } from "@/lib/stripe-attribution";
import { buildUtmifyPayload, type UtmifyStatus } from "@/lib/utmify";
import { resolveDeliverableUtmifyToken } from "@/lib/utmify-desk";
import { embeddedCheckoutMatchesIntent, WALLET_CHECKOUT_KIND, walletPaymentMatchesIntent } from "@/lib/embedded-stripe";
import { isInstitutionalSiteMode } from "@/lib/site-mode";
import { generateTrackingCode } from "@/lib/donation-tracking";
import { notifyAdminSalePush } from "@/lib/admin-push";
import { sendDonationThankYouEmail } from "@/lib/mail";
import { markAutomaticLetterSent, prepareAutomaticLetter } from "@/lib/donation-letter-desk";
import { shouldHideComment } from "@/lib/moderation";
import { formatMoney } from "@/lib/utils";
import { sha256Hex } from "@/lib/crypto";
import { resolvedChurchTipCents } from "@/lib/sale-filters";
import { STANDARD_DONATION_AMOUNTS } from "@/lib/donation-ticket";
import {
  checkoutSessionIdFromPaymentIntent,
  churchTipCentsFromStripeLineItems,
} from "@/lib/embedded-checkout";

export function sessionPaymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
}

function paidAtFromStripeUnix(unix: number | null | undefined) {
  return typeof unix === "number" && Number.isFinite(unix) && unix > 0
    ? new Date(unix * 1000)
    : undefined;
}

function sessionPaymentLinkId(session: Stripe.Checkout.Session) {
  return typeof session.payment_link === "string"
    ? session.payment_link
    : session.payment_link?.id ?? null;
}

const ownerInclude = {
  donationOption: true,
  affiliatePage: {
    include: {
      campaign: { include: { company: { select: { publicPathPrefix: true, isDefault: true, siteMode: true } } } },
      affiliate: true,
    },
  },
} as const;

type DbClient = Prisma.TransactionClient | PrismaClient;

async function reconcileCampaignAccounting(tx: DbClient, campaignId: string) {
  await tx.$executeRaw(
    Prisma.sql`
      UPDATE "Campaign"
      SET
        "currentAmount" = "baselineAmount" + "paidAmount",
        "supporterCount" = "baselineSupporterCount" + "paidSupporterCount",
        "updatedAt" = NOW()
      WHERE "id" = ${campaignId}
    `,
  );
}

export async function resolveCampaignCheckout(
  tx: DbClient,
  session: Stripe.Checkout.Session,
) {
  const stripePaymentLinkId = sessionPaymentLinkId(session);
  const amount = session.amount_total;
  const currency = session.currency?.toUpperCase() ?? "";
  if (amount == null || !currency) return null;

  const intentInclude = {
    sale: true,
    donationOption: true,
    affiliatePage: {
      include: {
        campaign: {
          include: {
            company: { select: { publicPathPrefix: true, isDefault: true, siteMode: true } },
          },
        },
        affiliate: true,
      },
    },
    paymentLink: {
      include: ownerInclude,
    },
  } as const;

  const referenced = session.client_reference_id
    ? await tx.checkoutIntent.findUnique({
        where: { id: session.client_reference_id },
        include: intentInclude,
      })
    : null;
  if (
    referenced &&
    checkoutIntentMatchesSession(referenced, session, { requireAmount: false })
  ) {
    return {
      intent: referenced,
      paymentLink: referenced.paymentLink,
    };
  }
  if (
    referenced?.affiliatePage &&
    embeddedCheckoutMatchesIntent({
      intentAmount: referenced.amount,
      intentCurrency: referenced.currency,
      sessionAmount: amount,
      sessionCurrency: currency,
      sessionPaymentLinkId: stripePaymentLinkId,
      checkoutKind: session.metadata?.checkoutKind ?? null,
      pageActive: referenced.affiliatePage.active,
      affiliateActive: referenced.affiliatePage.affiliate.active,
    })
  ) {
    return { intent: referenced, paymentLink: null };
  }

  if (!stripePaymentLinkId) return null;

  const sharedOwners = await tx.paymentLink.count({
    where: {
      stripePaymentLinkId,
      active: true,
      affiliatePage: {
        active: true,
        affiliate: { active: true },
        campaign: { status: CampaignStatus.ACTIVE },
      },
    },
  });
  // Same $25 plink on many campaigns: campaign is only the /c/{slug}/direct-team
  // checkout that created client_reference_id. Never pick another page's intent.
  if (sharedOwners > 1) {
    console.error("[stripe] shared Payment Link paid without matching checkout intent", {
      sessionId: session.id,
      clientReferenceId: session.client_reference_id,
      stripePaymentLinkId,
    });
    return null;
  }

  const fallback = await tx.checkoutIntent.findFirst({
    where: {
      amount,
      currency,
      sale: { is: null },
      expiresAt: { gt: new Date() },
      paymentLink: {
        stripePaymentLinkId,
        active: true,
        affiliatePage: {
          active: true,
          affiliate: { active: true },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    include: intentInclude,
  });
  if (fallback && checkoutIntentMatchesSession(fallback, session)) {
    return {
      intent: fallback,
      paymentLink: fallback.paymentLink,
    };
  }

  return createIntentForPaidPaymentLink(tx, session, {
    stripePaymentLinkId,
    amount,
    currency,
    preferredAffiliatePageId: referenced?.affiliatePageId ?? fallback?.affiliatePageId,
  });
}

function checkoutIntentMatchesSession(
  intent: {
    affiliatePageId: string;
    amount: number;
    currency: string;
    paymentLink: {
      id: string;
      active: boolean;
      stripePaymentLinkId: string | null;
      affiliatePageId: string;
      affiliatePage: {
        active: boolean;
        affiliate: { active: boolean };
      };
    } | null;
  },
  session: Stripe.Checkout.Session,
  options?: { requireAmount?: boolean },
) {
  const paymentLink = intent.paymentLink;
  const stripePaymentLinkId = sessionPaymentLinkId(session);
  const requireAmount = options?.requireAmount !== false;
  return Boolean(
    paymentLink &&
      paymentLink.active &&
      paymentLink.affiliatePage.active &&
      paymentLink.affiliatePage.affiliate.active &&
      paymentLink.affiliatePageId === intent.affiliatePageId &&
      (!requireAmount || intent.amount === session.amount_total) &&
      intent.currency.toUpperCase() === (session.currency ?? "").toUpperCase() &&
      (!stripePaymentLinkId ||
        stripePaymentLinkId === paymentLink.stripePaymentLinkId),
  );
}

function sessionUtm(session: Stripe.Checkout.Session, key: string) {
  return session.metadata?.[key] || null;
}

function sessionClickId(session: Stripe.Checkout.Session) {
  return session.metadata?.sck || session.metadata?.fbclid || null;
}

async function createIntentForPaidPaymentLink(
  tx: DbClient,
  session: Stripe.Checkout.Session,
  input: {
    stripePaymentLinkId: string;
    amount: number;
    currency: string;
    preferredAffiliatePageId?: string | null;
  },
) {
  const links = await tx.paymentLink.findMany({
    where: {
      stripePaymentLinkId: input.stripePaymentLinkId,
      active: true,
      affiliatePage: {
        active: true,
        affiliate: { active: true },
        campaign: { status: CampaignStatus.ACTIVE },
      },
    },
    include: ownerInclude,
    orderBy: { updatedAt: "desc" },
  });
  const attributed = chooseStripePaymentLinkOwner({
    receivedPaymentLinkId: input.stripePaymentLinkId,
    receivedAmount: input.amount,
    receivedCurrency: input.currency,
    preferredAffiliatePageId: input.preferredAffiliatePageId,
    owners: links.map((link) => ({
      stripePaymentLinkId: link.stripePaymentLinkId ?? input.stripePaymentLinkId,
      amount: link.donationOption.amount,
      currency: link.affiliatePage.campaign.currency,
      affiliatePageId: link.affiliatePageId,
    })),
  });
  if (!attributed.ok) return null;
  const paymentLink = links.find(
    (link) => link.affiliatePageId === attributed.owner.affiliatePageId,
  );
  if (!paymentLink) return null;

  const created = await tx.checkoutIntent.create({
    data: {
      affiliatePageId: paymentLink.affiliatePageId,
      paymentLinkId: paymentLink.id,
      donationOptionId: paymentLink.donationOptionId,
      amount: input.amount,
      tipAmount: Math.max(0, input.amount - paymentLink.donationOption.amount),
      hideName: false,
      currency: input.currency,
      src: sessionUtm(session, "src") || sessionUtm(session, "utm_source"),
      sck: sessionClickId(session),
      utmSource: sessionUtm(session, "utm_source"),
      utmMedium: sessionUtm(session, "utm_medium"),
      utmCampaign: sessionUtm(session, "utm_campaign"),
      utmContent: sessionUtm(session, "utm_content"),
      utmTerm: sessionUtm(session, "utm_term"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    include: {
      sale: true,
      donationOption: true,
      affiliatePage: {
        include: {
          campaign: {
            include: {
              company: { select: { publicPathPrefix: true, isDefault: true, siteMode: true } },
            },
          },
          affiliate: true,
        },
      },
      paymentLink: { include: ownerInclude },
    },
  });
  return {
    intent: created,
    paymentLink: created.paymentLink,
  };
}

function jsonPayload(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type PaidDonationPage = {
  id: string;
  affiliatePageId?: string;
  campaignId: string;
  affiliateId: string;
  fbPixelId?: string | null;
  utmifyTokenEnc: string | null;
  campaign: {
    id: string;
    slug: string;
    title: string;
    currency: string;
    company?: {
      publicPathPrefix?: string | null;
      isDefault?: boolean;
      siteMode?: string | null;
    } | null;
  };
  affiliate: {
    slug: string;
    name: string;
    defaultFbPixelId?: string | null;
    defaultUtmifyTokenEnc: string | null;
  };
};

function churchTipInput(
  input: {
    intent: {
      tipAmount?: number;
      donationOption?: { amount: number } | null;
    };
    page: PaidDonationPage;
    stripeTipAmount?: number | null;
  },
  sale: { amount: number; tipAmount?: number | null },
) {
  return {
    amount: sale.amount,
    tipAmount: sale.tipAmount,
    intentTipAmount: input.intent.tipAmount,
    donationOptionAmount: input.intent.donationOption?.amount,
    stripeTipAmount: input.stripeTipAmount,
    campaignOptionAmounts: isInstitutionalSiteMode(input.page.campaign.company?.siteMode)
      ? [...STANDARD_DONATION_AMOUNTS]
      : undefined,
  };
}

export async function recordPaidDonation(
  tx: Prisma.TransactionClient,
  input: {
    intent: {
      id: string;
      affiliatePageId: string;
      amount: number;
      currency: string;
      pendingComment: string | null;
      src: string | null;
      sck: string | null;
      utmSource: string | null;
      utmMedium: string | null;
      utmCampaign: string | null;
      utmContent: string | null;
      utmTerm: string | null;
      landingUrl?: string | null;
      clientIp: string | null;
      userAgent?: string | null;
      fbp?: string | null;
      fbc?: string | null;
      tipAmount?: number;
      hideName?: boolean;
      gatewayLabel?: string | null;
      donationOption?: { amount: number } | null;
      sale?: { trackingCode: string | null } | null;
    };
    page: PaidDonationPage;
    amount: number;
    customerName: string;
    customerEmail: string | null;
    paymentMethod: string;
    livemode: boolean;
    gateway: "stripe" | "pagnovo" | "paypal";
    gatewayFee?: number;
    stripeTipAmount?: number | null;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    stripePaymentLinkId?: string | null;
    pagnovoTransactionId?: string | null;
    paypalOrderId?: string | null;
    paypalCaptureId?: string | null;
    paidAt?: Date | null;
  },
): Promise<RecordedPaidSession> {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${input.intent.id}))`,
  );
  const alreadyPaid = await tx.sale.findUnique({
    where: { checkoutIntentId: input.intent.id },
  });
  if (alreadyPaid?.status === SaleStatus.PAID) {
    const resolvedTip = resolvedChurchTipCents(churchTipInput(input, alreadyPaid));
    const sale =
      resolvedTip > 0 && alreadyPaid.tipAmount === 0
        ? await tx.sale.update({
            where: { id: alreadyPaid.id },
            data: { tipAmount: resolvedTip },
          })
        : alreadyPaid;
    if (!sale.livemode) {
      await reconcileCampaignAccounting(tx, sale.campaignId);
    }
    return { sale, newlyPaid: false };
  }

  const paidAt = input.paidAt && !Number.isNaN(input.paidAt.getTime())
    ? input.paidAt
    : new Date();
  const trackingCode = input.intent.sale?.trackingCode ?? generateTrackingCode();
  const publicName = input.intent.hideName ? "Anonymous" : input.customerName;
  const tipAmount = resolvedChurchTipCents(churchTipInput(input, { amount: input.amount, tipAmount: 0 }));
  const sale = await tx.sale.upsert({
    where: { checkoutIntentId: input.intent.id },
    update: {
      status: SaleStatus.PAID,
      customerName: publicName,
      customerEmail: input.customerEmail,
      paymentMethod: input.paymentMethod,
      paidAt,
      trackingCode,
      livemode: input.livemode,
      gateway: input.gateway,
      gatewayFee: input.gatewayFee ?? 0,
      tipAmount,
      gatewayLabel: input.intent.gatewayLabel?.trim() || undefined,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? undefined,
      stripePaymentIntentId: input.stripePaymentIntentId ?? undefined,
      stripePaymentLinkId: input.stripePaymentLinkId ?? undefined,
      pagnovoTransactionId: input.pagnovoTransactionId ?? undefined,
      paypalOrderId: input.paypalOrderId ?? undefined,
      paypalCaptureId: input.paypalCaptureId ?? undefined,
    },
    create: {
      checkoutIntentId: input.intent.id,
      affiliatePageId: input.page.id,
      campaignId: input.page.campaignId,
      affiliateId: input.page.affiliateId,
      amount: input.amount,
      tipAmount,
      currency: input.page.campaign.currency,
      status: SaleStatus.PAID,
      customerName: publicName,
      customerEmail: input.customerEmail,
      paymentMethod: input.paymentMethod,
      paidAt,
      trackingCode,
      livemode: input.livemode,
      gateway: input.gateway,
      gatewayFee: input.gatewayFee ?? 0,
      gatewayLabel: input.intent.gatewayLabel?.trim() || null,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      stripePaymentLinkId: input.stripePaymentLinkId ?? null,
      pagnovoTransactionId: input.pagnovoTransactionId ?? null,
      paypalOrderId: input.paypalOrderId ?? null,
      paypalCaptureId: input.paypalCaptureId ?? null,
    },
  });

  if (input.livemode) {
    await tx.campaign.update({
      where: { id: input.page.campaignId },
      data: {
        currentAmount: { increment: input.amount },
        supporterCount: { increment: 1 },
        paidAmount: { increment: input.amount },
        paidSupporterCount: { increment: 1 },
      },
    });
  } else {
    await reconcileCampaignAccounting(tx, sale.campaignId);
  }

  await enqueueUtmify(tx, {
    sale,
    page: input.page,
    campaign: input.page.campaign,
    affiliate: input.page.affiliate,
    intent: input.intent,
    status: "paid",
  });

  if (input.intent.pendingComment) {
    const existing = await tx.donationComment.findFirst({
      where: { saleId: sale.id, parentId: null },
      select: { id: true },
    });
    if (!existing) {
      await tx.donationComment.create({
        data: {
          saleId: sale.id,
          campaignId: sale.campaignId,
          authorName: publicName,
          body: input.intent.pendingComment,
          hidden: shouldHideComment(input.intent.pendingComment),
        },
      });
    }
  }

  return {
    sale,
    newlyPaid: true,
    campaignSlug: input.page.campaign.slug,
    campaignTitle: input.page.campaign.title,
    affiliateSlug: input.page.affiliate.slug,
    publicPathPrefix:
      "company" in input.page.campaign
        ? (input.page.campaign as { company?: { publicPathPrefix?: string | null } })
            .company?.publicPathPrefix ?? null
        : null,
    shortDonationPath: isInstitutionalSiteMode(
      "company" in input.page.campaign
        ? (input.page.campaign as { company?: { siteMode?: string | null } })
            .company?.siteMode
        : null,
    ),
  };
}

export async function recordPendingPagnovoCheckout(
  tx: Prisma.TransactionClient,
  input: {
    intent: {
      id: string;
      amount: number;
      src: string | null;
      sck: string | null;
      utmSource: string | null;
      utmMedium: string | null;
      utmCampaign: string | null;
      utmContent: string | null;
      utmTerm: string | null;
      landingUrl?: string | null;
      clientIp: string | null;
      gatewayLabel?: string | null;
    };
    page: PaidDonationPage;
    customerName: string;
    customerEmail: string | null;
    paymentMethod: string;
    livemode: boolean;
    pagnovoTransactionId: string;
  },
) {
  const existing = await tx.sale.findUnique({
    where: { checkoutIntentId: input.intent.id },
  });
  if (existing?.status === SaleStatus.PAID) return existing;

  const sale = existing
    ? await tx.sale.update({
        where: { id: existing.id },
        data: {
          pagnovoTransactionId: input.pagnovoTransactionId,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          paymentMethod: input.paymentMethod,
          livemode: input.livemode,
          gateway: "pagnovo",
          gatewayLabel: input.intent.gatewayLabel?.trim() || undefined,
        },
      })
    : await tx.sale.create({
        data: {
          checkoutIntentId: input.intent.id,
          affiliatePageId: input.page.id,
          campaignId: input.page.campaignId,
          affiliateId: input.page.affiliateId,
          amount: input.intent.amount,
          currency: input.page.campaign.currency,
          status: SaleStatus.PENDING,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          paymentMethod: input.paymentMethod,
          livemode: input.livemode,
          gateway: "pagnovo",
          gatewayLabel: input.intent.gatewayLabel?.trim() || null,
          pagnovoTransactionId: input.pagnovoTransactionId,
        },
      });

  return sale;
}

export async function enqueueUtmify(
  tx: DbClient,
  input: {
    sale: {
      id: string;
      affiliatePageId: string;
      amount: number;
      gatewayFee: number;
      currency: string;
      customerName: string;
      customerEmail: string | null;
      paymentMethod: string;
      createdAt: Date;
      paidAt: Date | null;
      refundedAt: Date | null;
      livemode: boolean;
      stripePaymentIntentId?: string | null;
      stripeCheckoutSessionId?: string | null;
      pagnovoTransactionId?: string | null;
      paypalCaptureId?: string | null;
      paypalOrderId?: string | null;
    };
    page: { id: string; utmifyTokenEnc: string | null };
    campaign: { title: string; company?: { isDefault?: boolean } | null };
    affiliate: { name: string; defaultUtmifyTokenEnc: string | null };
    intent: {
      src: string | null;
      sck: string | null;
      utmSource: string | null;
      utmMedium: string | null;
      utmCampaign: string | null;
      utmContent: string | null;
      utmTerm: string | null;
      landingUrl?: string | null;
      clientIp: string | null;
      soldLabel?: string | null;
    };
    status: UtmifyStatus;
  },
) {
  if (input.status === "waiting_payment") {
    return;
  }
  if (
    !resolveDeliverableUtmifyToken({
      pageTokenEnc: input.page.utmifyTokenEnc,
      affiliateTokenEnc: input.affiliate.defaultUtmifyTokenEnc,
      companyIsDefault: input.campaign.company?.isDefault,
    })
  ) {
    return;
  }
  const isPaypal = input.sale.paymentMethod.trim().toLowerCase() === "paypal";
  const payload = buildUtmifyPayload({
    saleId: input.sale.id,
    orderId: isPaypal
      ? input.sale.paypalCaptureId || input.sale.paypalOrderId || input.sale.id
      : input.sale.stripePaymentIntentId ||
        input.sale.stripeCheckoutSessionId ||
        input.sale.pagnovoTransactionId ||
        input.sale.id,
    platform: isPaypal ? "PayPal" : undefined,
    affiliatePageId: input.sale.affiliatePageId,
    campaignTitle: input.campaign.title,
    affiliateName: input.affiliate.name,
    amount: input.sale.amount,
    gatewayFee: input.sale.gatewayFee,
    currency: input.sale.currency,
    customerName: input.sale.customerName,
    customerEmail: input.sale.customerEmail,
    paymentMethod: input.sale.paymentMethod,
    status: input.status,
    createdAt: input.sale.paidAt ?? input.sale.createdAt,
    paidAt: input.sale.paidAt,
    refundedAt: input.sale.refundedAt,
    clientIp: input.intent.clientIp,
    soldLabel: input.intent.soldLabel,
    attribution: {
      ...input.intent,
      landingUrl: input.intent.landingUrl,
    },
    isTest: !input.sale.livemode,
  });
  await tx.integrationDelivery.upsert({
    where: {
      idempotencyKey: `utmify:${input.sale.id}:${input.status}`,
    },
    update: {},
    create: {
      affiliatePageId: input.page.id,
      saleId: input.sale.id,
      idempotencyKey: `utmify:${input.sale.id}:${input.status}`,
      payload: jsonPayload(payload),
    },
  });
}

export type RecordedPaidSession = {
  sale: {
    id: string;
    affiliatePageId: string;
    amount: number;
    currency: string;
    customerName: string;
    customerEmail: string | null;
    paidAt: Date | null;
    trackingCode: string | null;
    livemode: boolean;
    gatewayFee?: number;
    affiliateId?: string;
  };
  newlyPaid: boolean;
  campaignSlug?: string;
  campaignTitle?: string;
  affiliateSlug?: string;
  publicPathPrefix?: string | null;
  shortDonationPath?: boolean;
};

function isUniqueConstraint(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function thankYouEmailEventId(saleId: string) {
  return `donation-thank-you:${saleId}`;
}

async function claimDonationThankYouEmail(saleId: string) {
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "resend",
        eventId: thankYouEmailEventId(saleId),
        eventType: "donation.thank_you",
        payloadHash: sha256Hex(saleId),
      },
    });
    return true;
  } catch (error) {
    if (isUniqueConstraint(error)) return false;
    throw error;
  }
}

async function releaseDonationThankYouEmail(saleId: string) {
  await prisma.webhookEvent.deleteMany({
    where: { provider: "resend", eventId: thankYouEmailEventId(saleId) },
  });
}

export async function notifyDonationPaid(result: RecordedPaidSession | null) {
  if (!result?.newlyPaid || !result.sale.livemode) return;
  void notifyAdminSalePush({
    campaignTitle: result.campaignTitle,
    amount: result.sale.amount,
    gatewayFee: result.sale.gatewayFee,
    currency: result.sale.currency,
    affiliateId: result.sale.affiliateId,
  }).catch((error) => {
    console.error("Could not send admin sale push", error);
  });
  const email = result.sale.customerEmail?.trim();
  const trackingCode = result.sale.trackingCode;
  if (!email || !trackingCode || !result.campaignSlug || !result.affiliateSlug) {
    return;
  }
  const claimed = await claimDonationThankYouEmail(result.sale.id);
  if (!claimed) return;
  try {
    // Gifts of $250 or more carry the acknowledgment letter (PDF) attached.
    const letter = await prepareAutomaticLetter(result.sale);
    await sendDonationThankYouEmail({
      taxLetter: letter?.attachment ?? null,
      to: email,
      trackingCode,
      campaignSlug: result.campaignSlug,
      campaignTitle: result.campaignTitle,
      affiliateSlug: result.affiliateSlug,
      pathPrefix: result.publicPathPrefix,
      shortDonationPath: result.shortDonationPath,
      institutional: Boolean(result.shortDonationPath),
      saleId: result.sale.id,
      customerName: result.sale.customerName,
      amountLabel: formatMoney(result.sale.amount, result.sale.currency),
      paidAt: result.sale.paidAt,
      locale:
        result.sale.currency === "MXN"
          ? "es-MX"
          : result.sale.currency === "ARS"
            ? "es-AR"
            : "en",
    });
    if (letter) await markAutomaticLetterSent(result.sale.id, letter.amountCents, letter.attachment);
  } catch (error) {
    await releaseDonationThankYouEmail(result.sale.id);
    console.error("Could not send donation thank-you email", error);
  }
}

export async function recordPaidCheckoutSession(
  tx: Prisma.TransactionClient,
  session: Stripe.Checkout.Session,
): Promise<RecordedPaidSession | null> {
  if (session.payment_status !== "paid") return null;

  const checkout = await resolveCampaignCheckout(tx, session);
  if (!checkout) {
    console.error("[stripe] paid session was not attributed", {
      sessionId: session.id,
      clientReferenceId: session.client_reference_id,
      paymentLink: sessionPaymentLinkId(session),
      amount: session.amount_total,
      currency: session.currency,
    });
    return null;
  }
  const { intent, paymentLink } = checkout;
  const page = paymentLink?.affiliatePage ?? intent.affiliatePage;
  if (!page) return null;
  const customerName =
    session.customer_details?.name?.trim() ||
    session.customer_details?.email?.split("@")[0] ||
    "Anonymous";
  const charged =
    session.amount_total ?? paymentLink?.donationOption.amount ?? intent.amount;
  const stripeTip = churchTipCentsFromStripeLineItems(session.line_items?.data ?? []);
  return recordPaidDonation(tx, {
    intent,
    page,
    amount: charged,
    customerName,
    customerEmail: session.customer_details?.email ?? null,
    paymentMethod: session.payment_method_types[0] ?? "card",
    livemode: session.livemode,
    gateway: "stripe",
    stripeTipAmount: stripeTip,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: sessionPaymentIntentId(session),
    stripePaymentLinkId: paymentLink?.stripePaymentLinkId ?? null,
    paidAt: paidAtFromStripeUnix(session.created),
  });
}

function walletChargeDetails(paymentIntent: Stripe.PaymentIntent) {
  const charge =
    typeof paymentIntent.latest_charge === "object" && paymentIntent.latest_charge
      ? paymentIntent.latest_charge
      : null;
  const billing =
    charge && "billing_details" in charge ? charge.billing_details : null;
  const wallet =
    charge && "payment_method_details" in charge
      ? charge.payment_method_details?.card?.wallet?.type
      : null;
  return {
    customerName:
      billing?.name?.trim() ||
      paymentIntent.shipping?.name?.trim() ||
      billing?.email?.split("@")[0] ||
      "Anonymous",
    customerEmail: billing?.email ?? paymentIntent.receipt_email ?? null,
    paymentMethod: wallet || paymentIntent.payment_method_types[0] || "card",
  };
}

export async function recordPaidPaymentIntent(
  tx: Prisma.TransactionClient,
  paymentIntent: Stripe.PaymentIntent,
): Promise<RecordedPaidSession | null> {
  if (paymentIntent.status !== "succeeded") return null;
  const checkoutSessionId = checkoutSessionIdFromPaymentIntent(paymentIntent);
  if (paymentIntent.metadata?.checkoutKind !== WALLET_CHECKOUT_KIND) {
    if (!checkoutSessionId) return null;
    const session = await getStripe().checkout.sessions.retrieve(checkoutSessionId, {
      expand: ["line_items"],
    });
    return recordPaidCheckoutSession(tx, session);
  }

  const intentId = paymentIntent.metadata.checkoutIntentId;
  if (!intentId) return null;

  const intent = await tx.checkoutIntent.findUnique({
    where: { id: intentId },
    include: {
      sale: true,
      donationOption: true,
      affiliatePage: {
        include: {
          campaign: {
            include: {
              company: { select: { publicPathPrefix: true, isDefault: true, siteMode: true } },
            },
          },
          affiliate: true,
        },
      },
    },
  });
  const page = intent?.affiliatePage;
  if (!intent || !page) return null;
  if (
    !walletPaymentMatchesIntent({
      intentAmount: intent.amount,
      intentCurrency: intent.currency,
      paymentAmount: paymentIntent.amount,
      paymentCurrency: paymentIntent.currency,
      checkoutKind: paymentIntent.metadata.checkoutKind,
      pageActive: page.active,
      affiliateActive: page.affiliate.active,
    })
  ) {
    return null;
  }

  const details = walletChargeDetails(paymentIntent);
  return recordPaidDonation(tx, {
    intent,
    page,
    amount: paymentIntent.amount,
    customerName: details.customerName,
    customerEmail: details.customerEmail,
    paymentMethod: details.paymentMethod,
    livemode: paymentIntent.livemode,
    gateway: "stripe",
    stripePaymentIntentId: paymentIntent.id,
    paidAt: paidAtFromStripeUnix(paymentIntent.created),
  });
}

const pagnovoIntentInclude = {
  sale: true,
  donationOption: true,
  affiliatePage: {
    include: {
      campaign: { include: { company: { select: { publicPathPrefix: true, isDefault: true, siteMode: true } } } },
      affiliate: true,
    },
  },
} as const;

export async function recordPaidPagnovoTransaction(
  tx: Prisma.TransactionClient,
  input: {
    transactionId: string;
    externalId?: string | null;
    amount: number;
    customerName?: string | null;
    customerEmail?: string | null;
    paymentMethod?: string | null;
    livemode: boolean;
    gatewayFee?: number | null;
  },
): Promise<RecordedPaidSession | null> {
  const byExternal = input.externalId
    ? await tx.checkoutIntent.findUnique({
        where: { id: input.externalId },
        include: pagnovoIntentInclude,
      })
    : null;
  const intent =
    byExternal ??
    (await tx.checkoutIntent.findUnique({
      where: { pagnovoTransactionId: input.transactionId },
      include: pagnovoIntentInclude,
    }));
  if (!intent?.affiliatePage) return null;
  if (intent.amount !== input.amount) {
    console.error("[pagnovo] amount mismatch", {
      intentId: intent.id,
      expected: intent.amount,
      received: input.amount,
    });
    return null;
  }

  const page = intent.affiliatePage;
  const customerName =
    input.customerName?.trim() ||
    intent.payerName?.trim() ||
    input.customerEmail?.split("@")[0] ||
    intent.payerEmail?.split("@")[0] ||
    "Anonymous";

  return recordPaidDonation(tx, {
    intent,
    page,
    amount: intent.donationOption?.amount ?? intent.amount,
    customerName,
    customerEmail: input.customerEmail ?? intent.payerEmail ?? null,
    paymentMethod: input.paymentMethod || "spei",
    livemode: input.livemode,
    gateway: "pagnovo",
    gatewayFee: input.gatewayFee ?? 0,
    pagnovoTransactionId: input.transactionId,
  });
}

export async function capturePaidPaymentIntent(paymentIntentId: string) {
  const existing = await prisma.sale.findFirst({
    where: { stripePaymentIntentId: paymentIntentId, status: SaleStatus.PAID },
  });
  if (existing) return { sale: existing, newlyPaid: false } satisfies RecordedPaidSession;

  const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  const recorded = await prisma.$transaction((tx) =>
    recordPaidPaymentIntent(tx, paymentIntent),
  );
  void notifyDonationPaid(recorded);
  const { processPendingDeliveries } = await import("@/lib/outbox");
  void processPendingDeliveries(10).catch((error) => {
    console.error("Utmify outbox flush failed", error);
  });
  return recorded;
}

export async function capturePaidCheckoutSession(sessionId: string) {
  const existing = await prisma.sale.findFirst({
    where: { stripeCheckoutSessionId: sessionId, status: SaleStatus.PAID },
    include: { comments: true, campaign: true, affiliate: true },
  });
  if (existing) return existing;

  const session = await getStripe().checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });
  const recorded = await prisma.$transaction((tx) =>
    recordPaidCheckoutSession(tx, session),
  );
  void notifyDonationPaid(recorded);
  const { processPendingDeliveries } = await import("@/lib/outbox");
  void processPendingDeliveries(10).catch((error) => {
    console.error("Utmify outbox flush failed", error);
  });

  return prisma.sale.findFirst({
    where: { stripeCheckoutSessionId: sessionId, status: SaleStatus.PAID },
    include: { comments: true, campaign: true, affiliate: true },
  });
}
