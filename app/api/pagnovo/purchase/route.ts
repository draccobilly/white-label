import { NextResponse } from "next/server";
import { CampaignStatus, TrackingEventType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  createDonorBrowserToken,
  PENDING_CHECKOUT_COOKIE_MAX_AGE,
  pendingCheckoutCookieName,
} from "@/lib/donor-browser-token";
import {
  createPagnovoPurchase,
  friendlyPagnovoPurchaseError,
  isAnyPagnovoRailConfigured,
  isPagnovoLive,
  pagnovoChargeBlockedReason,
  pagnovoRailFromCurrency,
  PagnovoApiError,
} from "@/lib/pagnovo";
import { pagnovoPurchaseSchema } from "@/lib/validators";
import { gatewayProductLabel } from "@/lib/embedded-checkout";
import { recordPendingPagnovoCheckout } from "@/lib/record-paid-session";
import { processPendingDeliveries } from "@/lib/outbox";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`pagnovo:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many checkout attempts" }, { status: 429 });
  }
  if (!isAnyPagnovoRailConfigured()) {
    return NextResponse.json({ error: "Pagnovo is not configured" }, { status: 503 });
  }

  let checkoutRail: ReturnType<typeof pagnovoRailFromCurrency> = null;
  try {
    const parsed = pagnovoPurchaseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    }
    if (parsed.data.paymentMethod === "CREDIT_CARD" && !parsed.data.creditCard) {
      return NextResponse.json({ error: "Card token is required" }, { status: 400 });
    }

    const option = await prisma.donationOption.findFirst({
      where: { id: parsed.data.donationOptionId },
      include: {
        campaign: {
          include: { company: true },
        },
      },
    });
    const page = option
      ? await prisma.affiliatePage.findFirst({
          where: {
            id: parsed.data.affiliatePageId,
            campaignId: option.campaignId,
            active: true,
            affiliate: { active: true },
            campaign: {
              status: CampaignStatus.ACTIVE,
              company: { paymentGateway: "PAGNOVO" },
            },
          },
          include: {
            campaign: {
              include: {
                company: { select: { isDefault: true, paymentGateway: true } },
              },
            },
            affiliate: true,
          },
        })
      : null;
    if (!option || !page || option.campaign.company?.paymentGateway !== "PAGNOVO") {
      return NextResponse.json({ error: "Payment is not available" }, { status: 404 });
    }
    const rail = pagnovoRailFromCurrency(option.campaign.currency);
    checkoutRail = rail;
    if (!rail) {
      return NextResponse.json({ error: "This campaign is not set to MXN" }, { status: 400 });
    }
    const blocked = pagnovoChargeBlockedReason(option.campaign.currency);
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 400 });
    }
    if (rail === "ARS" && parsed.data.paymentMethod !== "BANK_TRANSFER") {
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    }
    if (rail === "MXN" && parsed.data.paymentMethod === "BANK_TRANSFER") {
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    }

    const attribution = parsed.data.attribution ?? {};
    const donationAmount = option.amount;
    const gatewayLabel = gatewayProductLabel(donationAmount, page.campaign.currency, {
      campaignSlug: page.campaign.slug,
      campaignTitle: page.campaign.title,
      campaignCategory: page.campaign.category,
      campaignSummary: page.campaign.summary,
      campaignStory: page.campaign.story,
      campaignGatewayNames: page.campaign.gatewayNames,
    });
    const intent = await prisma.$transaction(async (tx) => {
      const created = await tx.checkoutIntent.create({
        data: {
          affiliatePageId: page.id,
          donationOptionId: option.id,
          amount: donationAmount,
          tipAmount: 0,
          hideName: parsed.data.hideName === true,
          gatewayLabel,
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
          visitorSessionId: parsed.data.visitorSessionId ?? null,
          payerName: parsed.data.name,
          payerEmail: parsed.data.email,
          pendingComment: parsed.data.comment?.trim() || null,
          expiresAt: new Date(
            Date.now() + (rail === "ARS" ? 90 : 1) * 24 * 60 * 60 * 1000,
          ),
        },
      });
      await tx.trackingEvent.create({
        data: {
          affiliatePageId: page.id,
          type: TrackingEventType.PAYMENT_REDIRECT,
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

    const pagnovoMethod =
      rail === "ARS"
        ? "BANK_TRANSFER"
        : parsed.data.paymentMethod === "CREDIT_CARD"
          ? "CREDIT_CARD"
          : "SPEI";
    const purchase = await createPagnovoPurchase({
      name: parsed.data.name,
      email: parsed.data.email,
      amount: donationAmount,
      currency: rail,
      description: gatewayLabel.slice(0, 120),
      externalId: intent.id,
      paymentMethod: pagnovoMethod,
      creditCard: parsed.data.creditCard,
    });

    await prisma.$transaction(async (tx) => {
      await tx.checkoutIntent.update({
        where: { id: intent.id },
        data: {
          pagnovoTransactionId: purchase.id,
          pagnovoClabe: purchase.clabe ?? null,
        },
      });
      if (purchase.mappedStatus === "pending" || purchase.requiresAction) {
        await recordPendingPagnovoCheckout(tx, {
          intent,
          page,
          customerName: parsed.data.name,
          customerEmail: parsed.data.email,
          paymentMethod: parsed.data.paymentMethod,
          livemode: isPagnovoLive(rail),
          pagnovoTransactionId: purchase.id,
        });
      }
    });
    if (purchase.mappedStatus === "pending" || purchase.requiresAction) {
      void processPendingDeliveries(10).catch((error) => {
        console.error("Utmify outbox flush failed", error);
      });
    }

    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) throw new Error("ENCRYPTION_KEY is not configured");
    const response = NextResponse.json({
      intentId: intent.id,
      transactionId: purchase.id,
      status: purchase.status,
      method: purchase.method,
      clabe: purchase.clabe,
      cvu: purchase.cvu,
      beneficiary: purchase.beneficiary,
      requiresAction: purchase.requiresAction === true,
      clientSecret: purchase.clientSecret,
      livemode: isPagnovoLive(rail),
    });
    response.cookies.set({
      name: pendingCheckoutCookieName(page.id),
      value: createDonorBrowserToken(
        {
          affiliatePageId: page.id,
          checkoutIntentId: intent.id,
        },
        secret,
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PENDING_CHECKOUT_COOKIE_MAX_AGE,
    });
    return response;
  } catch (error) {
    const raw =
      error instanceof Error ? error.message : "Unable to start secure checkout";
    const message = friendlyPagnovoPurchaseError(raw, checkoutRail ?? "MXN");
    console.error("pagnovo purchase failed", {
      message: raw,
      mapped: message,
      rail: checkoutRail,
    });
    return NextResponse.json(
      { error: message },
      { status: error instanceof PagnovoApiError ? 400 : 500 },
    );
  }
}
