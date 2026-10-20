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
import { capturePaidCheckoutSession } from "@/lib/record-paid-session";
import { getStripe } from "@/lib/stripe";
import { companyPublicPrefix, publicCampaignPath } from "@/lib/public-site-url";
import { isInstitutionalSiteMode } from "@/lib/site-mode";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function campaignDestination(
  request: NextRequest,
  campaignSlug?: string,
  affiliateSlug?: string,
  prefix?: string | null,
  short?: boolean,
) {
  const path =
    campaignSlug && affiliateSlug
      ? publicCampaignPath(prefix, campaignSlug, affiliateSlug, "", { short })
      : prefix || "/";
  return new URL(path, request.url);
}

export async function GET(request: NextRequest) {
  const affiliatePageId = request.nextUrl.searchParams.get("affiliate_page_id");
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const page =
    affiliatePageId && UUID_RE.test(affiliatePageId)
      ? await prisma.affiliatePage.findUnique({
          where: { id: affiliatePageId },
          select: {
            id: true,
            campaign: {
              select: {
                slug: true,
                company: { select: { publicPathPrefix: true, siteMode: true } },
              },
            },
            affiliate: { select: { slug: true } },
          },
        })
      : null;
  const prefix = page?.campaign.company
    ? companyPublicPrefix(page.campaign.company)
    : "";
  const short = isInstitutionalSiteMode(page?.campaign.company?.siteMode);
  const campaignUrl = campaignDestination(
    request,
    page?.campaign.slug,
    page?.affiliate.slug,
    prefix,
    short,
  );
  if (!page || !sessionId || !process.env.ENCRYPTION_KEY) {
    return NextResponse.redirect(campaignDestination(request, undefined, undefined, prefix), 303);
  }

  const encrypted = request.cookies.get(pendingCheckoutCookieName(page.id))?.value;
  const token = encrypted
    ? readDonorBrowserToken(encrypted, process.env.ENCRYPTION_KEY)
    : null;
  if (!token || token.authorized || token.affiliatePageId !== page.id) {
    return NextResponse.redirect(campaignDestination(request, undefined, undefined, prefix), 303);
  }

  let authorizeBrowser = false;
  let grantTestConfirmedVisit = false;
  let clearPendingCheckout = false;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== token.checkoutIntentId) {
      return NextResponse.redirect(campaignDestination(request, undefined, undefined, prefix), 303);
    }
    clearPendingCheckout = true;
    const sale = await capturePaidCheckoutSession(session.id);
    if (sale?.status === SaleStatus.PAID) {
      campaignUrl.pathname = publicCampaignPath(
        prefix,
        page.campaign.slug,
        page.affiliate.slug,
        "/confirmed",
        { short },
      );
      campaignUrl.search = "";
      campaignUrl.searchParams.set("session_id", session.id);
      if (sale.livemode) {
        authorizeBrowser = true;
      } else {
        grantTestConfirmedVisit = true;
      }
    }
  } catch (error) {
    console.error("Could not validate campaign checkout return", {
      affiliatePageId: page.id,
      sessionId,
      error,
    });
  }
  const response = NextResponse.redirect(campaignUrl, 303);
  if (authorizeBrowser) {
    response.cookies.set({
      name: donorBrowserCookieName(page.id),
      value: createDonorBrowserToken(
        {
          affiliatePageId: page.id,
          checkoutIntentId: token.checkoutIntentId,
          authorized: true,
          showInlineThankYou: true,
        },
        process.env.ENCRYPTION_KEY,
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DONOR_BROWSER_COOKIE_MAX_AGE,
    });
  }
  if (grantTestConfirmedVisit) {
    response.cookies.set({
      name: confirmedVisitCookieName(page.id),
      value: createConfirmedVisitToken(
        {
          affiliatePageId: page.id,
          checkoutIntentId: token.checkoutIntentId,
          stripeCheckoutSessionId: sessionId,
        },
        process.env.ENCRYPTION_KEY,
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CONFIRMED_VISIT_COOKIE_MAX_AGE,
    });
  }
  if (clearPendingCheckout) {
    response.cookies.set({
      name: pendingCheckoutCookieName(page.id),
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
