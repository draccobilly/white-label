import { NextRequest, NextResponse } from "next/server";
import { SaleStatus } from "@/generated/prisma/enums";
import {
  CONFIRMED_VISIT_COOKIE_MAX_AGE,
  confirmedVisitCookieName,
  createConfirmedVisitToken,
  createDonorBrowserToken,
  DONOR_BROWSER_COOKIE_MAX_AGE,
  donorBrowserCookieName,
  pendingCheckoutCookieName,
  readDonorBrowserToken,
} from "@/lib/donor-browser-token";
import { prisma } from "@/lib/prisma";
import { companyPublicPrefix, publicCampaignPath } from "@/lib/public-site-url";
import { isInstitutionalSiteMode } from "@/lib/site-mode";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const intentId = request.nextUrl.searchParams.get("intent")?.trim() ?? "";
  const secret = process.env.ENCRYPTION_KEY;
  if (!UUID_RE.test(intentId) || !secret) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const intent = await prisma.checkoutIntent.findUnique({
    where: { id: intentId },
    include: {
      sale: true,
      affiliatePage: {
        include: {
          campaign: { include: { company: { select: { publicPathPrefix: true, siteMode: true } } } },
          affiliate: true,
        },
      },
    },
  });
  const campaignPath = intent
    ? publicCampaignPath(
        companyPublicPrefix(intent.affiliatePage.campaign.company ?? {}),
        intent.affiliatePage.campaign.slug,
        intent.affiliatePage.affiliate.slug,
        "",
        {
          short: isInstitutionalSiteMode(
            intent.affiliatePage.campaign.company?.siteMode,
          ),
        },
      )
    : "/";
  const campaignUrl = new URL(campaignPath, request.url);
  if (!intent) return NextResponse.redirect(campaignUrl, 303);

  const encrypted = request.cookies.get(pendingCheckoutCookieName(intent.affiliatePageId))?.value
    ?? request.cookies.get(donorBrowserCookieName(intent.affiliatePageId))?.value;
  const token = encrypted ? readDonorBrowserToken(encrypted, secret) : null;
  if (!token || token.checkoutIntentId !== intent.id) {
    return NextResponse.redirect(campaignUrl, 303);
  }

  const sale = intent.sale;
  if (sale?.status !== SaleStatus.PAID) {
    campaignUrl.pathname = `${campaignPath}/pay`;
    campaignUrl.searchParams.set("intent", intent.id);
    return NextResponse.redirect(campaignUrl, 303);
  }

  campaignUrl.pathname = `${campaignPath}/confirmed`;
  campaignUrl.search = "";
  campaignUrl.searchParams.set("intent", intent.id);
  const response = NextResponse.redirect(campaignUrl, 303);
  if (sale.livemode) {
    response.cookies.set({
      name: donorBrowserCookieName(intent.affiliatePageId),
      value: createDonorBrowserToken(
        {
          affiliatePageId: intent.affiliatePageId,
          checkoutIntentId: intent.id,
          authorized: true,
          showInlineThankYou: true,
        },
        secret,
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DONOR_BROWSER_COOKIE_MAX_AGE,
    });
  } else {
    response.cookies.set({
      name: confirmedVisitCookieName(intent.affiliatePageId),
      value: createConfirmedVisitToken(
        {
          affiliatePageId: intent.affiliatePageId,
          checkoutIntentId: intent.id,
          stripeCheckoutSessionId: sale.pagnovoTransactionId || intent.id,
        },
        secret,
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CONFIRMED_VISIT_COOKIE_MAX_AGE,
    });
  }
  response.cookies.set({
    name: pendingCheckoutCookieName(intent.affiliatePageId),
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
