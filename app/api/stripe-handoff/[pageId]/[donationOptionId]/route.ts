import { NextRequest, NextResponse } from "next/server";
import { CampaignStatus } from "@/generated/prisma/enums";
import { readAdClickCookie } from "@/lib/ad-click";
import { isOpaqueShortlink, stripeHandoffUrl } from "@/lib/checkout-links";
import {
  pendingCheckoutCookieName,
  readDonorBrowserToken,
} from "@/lib/donor-browser-token";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ pageId: string; donationOptionId: string }>;
  },
) {
  const { pageId, donationOptionId } = await context.params;
  const paymentLink = await prisma.paymentLink.findFirst({
    where: {
      affiliatePageId: pageId,
      donationOptionId,
      active: true,
      affiliatePage: {
        active: true,
        affiliate: { active: true },
        campaign: { status: CampaignStatus.ACTIVE },
      },
    },
    select: {
      id: true,
      stripeCheckoutUrl: true,
      donationOptionId: true,
      donationOption: { select: { amount: true } },
      affiliatePage: {
        select: { campaign: { select: { currency: true } } },
      },
    },
  });
  if (!paymentLink?.stripeCheckoutUrl) {
    return new NextResponse("Checkout not found", { status: 404 });
  }
  if (isOpaqueShortlink(paymentLink.stripeCheckoutUrl)) {
    return new NextResponse("Checkout must use buy.stripe.com, not t.co/x.com", {
      status: 500,
    });
  }

  const secret = process.env.ENCRYPTION_KEY;
  const encrypted = request.cookies.get(pendingCheckoutCookieName(pageId))?.value;
  const token =
    secret && encrypted ? readDonorBrowserToken(encrypted, secret) : null;
  const existing =
    token?.affiliatePageId === pageId
      ? await prisma.checkoutIntent.findFirst({
          where: {
            id: token.checkoutIntentId,
            affiliatePageId: pageId,
            paymentLinkId: paymentLink.id,
            expiresAt: { gt: new Date() },
            sale: { is: null },
          },
          select: {
            id: true,
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
            utmContent: true,
            utmTerm: true,
            sck: true,
          },
        })
      : null;
  const adClick = readAdClickCookie(request);
  const intent =
    existing ??
    (await prisma.checkoutIntent.create({
      data: {
        affiliatePageId: pageId,
        paymentLinkId: paymentLink.id,
        donationOptionId: paymentLink.donationOptionId,
        amount: paymentLink.donationOption.amount,
        currency: paymentLink.affiliatePage.campaign.currency,
        src: adClick?.src ?? null,
        sck: adClick?.sck ?? null,
        utmSource: adClick?.utmSource ?? null,
        utmMedium: adClick?.utmMedium ?? null,
        utmCampaign: adClick?.utmCampaign ?? null,
        utmContent: adClick?.utmContent ?? null,
        utmTerm: adClick?.utmTerm ?? null,
        landingUrl: adClick?.landingUrl ?? null,
        referrer: adClick?.referrer ?? null,
        fbp: adClick?.fbp || request.cookies.get("_fbp")?.value || null,
        fbc: adClick?.fbc || request.cookies.get("_fbc")?.value || null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      select: {
        id: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        utmTerm: true,
        sck: true,
      },
    }));

  return NextResponse.redirect(
    stripeHandoffUrl({
      stripeCheckoutUrl: paymentLink.stripeCheckoutUrl,
      intentId: intent.id,
      attribution: intent,
    }),
  );
}
