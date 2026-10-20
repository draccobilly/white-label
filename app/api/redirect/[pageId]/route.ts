import { NextRequest, NextResponse } from "next/server";
import { CampaignStatus, TrackingEventType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  createDonorBrowserToken,
  PENDING_CHECKOUT_COOKIE_MAX_AGE,
  pendingCheckoutCookieName,
} from "@/lib/donor-browser-token";
import { stripeHandoffUrl } from "@/lib/checkout-links";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { redirectSchema } from "@/lib/validators";
import { mergeAdClick, readAdClickCookie } from "@/lib/ad-click";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const ip = clientIp(request);
  if (!rateLimit(`redirect:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many checkout attempts" }, { status: 429 });
  }

  try {
    const { pageId } = await params;
    const parsed = redirectSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    }
    const paymentLink = await prisma.paymentLink.findFirst({
      where: {
        id: parsed.data.paymentLinkId,
        affiliatePageId: pageId,
        active: true,
        affiliatePage: {
          active: true,
          affiliate: { active: true },
          campaign: { status: CampaignStatus.ACTIVE },
        },
      },
      include: {
        donationOption: true,
        affiliatePage: {
          include: {
            campaign: true,
            affiliate: true,
          },
        },
      },
    });
    if (!paymentLink) {
      return NextResponse.json({ error: "Payment Link is not available" }, { status: 404 });
    }
    if (!paymentLink.url && !paymentLink.stripeCheckoutUrl) {
      return NextResponse.json(
        { error: "This amount is missing a Stripe wrap or original Payment Link" },
        { status: 400 },
      );
    }

    const attribution = mergeAdClick(
      readAdClickCookie(request),
      parsed.data.attribution ?? {},
    );
    const donationAmount = paymentLink.donationOption.amount;
    const hideName = parsed.data.hideName === true;
    const intent = await prisma.$transaction(async (tx) => {
      const created = await tx.checkoutIntent.create({
        data: {
          affiliatePageId: pageId,
          paymentLinkId: paymentLink.id,
          donationOptionId: paymentLink.donationOptionId,
          amount: donationAmount,
          tipAmount: 0,
          hideName,
          currency: paymentLink.affiliatePage.campaign.currency,
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
          pendingComment: parsed.data.comment?.trim() || null,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await tx.trackingEvent.create({
        data: {
          affiliatePageId: pageId,
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

    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
      throw new Error("ENCRYPTION_KEY is not configured");
    }

    if (!paymentLink.stripePaymentLinkId || !paymentLink.stripeCheckoutUrl) {
      return NextResponse.json(
        {
          error:
            "This donation amount is missing its original Stripe Payment Link",
        },
        { status: 400 },
      );
    }
    const checkoutUrl = stripeHandoffUrl({
      stripeCheckoutUrl: paymentLink.stripeCheckoutUrl,
      intentId: intent.id,
      attribution,
    });

    const response = NextResponse.json({ url: checkoutUrl });
    response.cookies.set({
      name: pendingCheckoutCookieName(pageId),
      value: createDonorBrowserToken(
        {
          affiliatePageId: pageId,
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
    console.error("payment redirect failed", error);
    return NextResponse.json({ error: "Unable to start secure checkout" }, { status: 500 });
  }
}

