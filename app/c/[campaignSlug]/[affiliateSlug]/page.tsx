import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClassicCampaignPage } from "@/components/campaign/layouts/ClassicCampaignPage";
import { ImpactCampaignPage } from "@/components/campaign/layouts/ImpactCampaignPage";
import type { CampaignLayoutProps } from "@/components/campaign/layouts/types";
import { InlineCampaignThanks } from "@/components/campaign/InlineCampaignThanks";
import { AffiliatePagePixels } from "@/components/tracking/AffiliatePagePixels";
import { AttributionCapture } from "@/components/tracking/AttributionCapture";
import { isImpactCampaignLayout } from "@/lib/campaign-layout";
import { usesEmbeddedStripeCheckout, stripePublishableKey } from "@/lib/embedded-stripe";
import { paypalPublicClientId } from "@/lib/paypal";
import { isSpanishDesk, mexicoLocalizedCampaignCopy } from "@/lib/campaign-defaults";
import { getAuthorizedBrowserDonation } from "@/lib/donor-browser-access";
import {
  getAffiliateCampaign,
  getPublicChrome,
  getRelatedCampaigns,
  listPublicCompanyCampaigns,
  listPublicSearchOrgs,
} from "@/lib/public-campaigns";
import { raisedAmountForVisitor, raisedAmountFromLedger } from "@/lib/campaign-accounting";
import { campaignStageView } from "@/lib/campaign-stages";
import { progressPercent } from "@/lib/utils";
import { keepsRunningCampaignAddress } from "@/lib/campaign-defaults";
import { publicCampaignPath } from "@/lib/public-site-url";
import { resolvedUtmifyPixelScript } from "@/lib/utmify-desk";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ campaignSlug: string; affiliateSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TRACKING_QUERY_KEYS = [
  "src",
  "sck",
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

function checkoutUrlWithAttribution(
  path: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams();
  for (const key of TRACKING_QUERY_KEYS) {
    const raw = searchParams[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) query.set(key, value.slice(0, 500));
  }
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { campaignSlug, affiliateSlug } = await params;
  try {
    const page = await getAffiliateCampaign(campaignSlug, affiliateSlug);
    if (!page) return { title: "Campaign not found" };
    return {
      title: page.campaign.title,
      description: page.campaign.summary,
      openGraph: {
        title: page.campaign.title,
        description: page.campaign.summary,
        images: page.campaign.coverImageUrl
          ? [{ url: page.campaign.coverImageUrl }]
          : undefined,
      },
    };
  } catch {
    return { title: "Campaign" };
  }
}

export default async function AffiliateCampaignPage({ params, searchParams }: PageProps) {
  const [{ campaignSlug, affiliateSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const page = await getAffiliateCampaign(campaignSlug, affiliateSlug).catch(
    (error) => {
      console.error("[campaign] lookup failed", error);
      return null;
    },
  );
  const chrome = await getPublicChrome().catch(() => null);
  if (!page?.campaign || !page.affiliate || !chrome) notFound();
  const settings = chrome.brand;
  const messages = chrome.messages;

  const campaignPath = publicCampaignPath(
    chrome.pathPrefix,
    page.campaign.slug,
    page.affiliate.slug,
    "",
    {
      short:
        chrome.institutional &&
        keepsRunningCampaignAddress(page.campaign.slug),
    },
  );
  const [related, browserDonation, searchOrgs, searchCampaigns] = await Promise.all([
    getRelatedCampaigns(page.affiliateId, page.campaignId).catch(() => []),
    getAuthorizedBrowserDonation(page.id).catch(() => null),
    listPublicSearchOrgs(campaignPath).catch(() => []),
    listPublicCompanyCampaigns(page.affiliateId).catch(() => []),
  ]);
  const loadedCampaign = isSpanishDesk(chrome.company)
    ? mexicoLocalizedCampaignCopy(page.campaign)
    : page.campaign;
  const { currentAmount: storedCurrentAmount, ...campaign } = loadedCampaign;
  void storedCurrentAmount;
  const raisedAmount = raisedAmountForVisitor(
    campaign,
    browserDonation?.livemode ? browserDonation.amount : 0,
  );
  const affiliate = page.affiliate;
  const stage = campaignStageView({ ...campaign, currentAmount: raisedAmount });
  const percent = progressPercent(raisedAmount, stage.goalAmount);
  const checkoutHref = checkoutUrlWithAttribution(`${campaignPath}/checkout`, query);
  const theme = {
    "--navy": settings?.primaryColor ?? "#0d3654",
    "--gold": settings?.accentColor ?? "#f5a524",
  } as CSSProperties;

  const socialDonations = page.sales.map((sale) => ({
    id: sale.id,
    name: sale.customerName || messages.campaign.anonymous,
    amount: sale.amount,
    currency: sale.currency,
  }));
  const personalSale = browserDonation
    ? {
        id: browserDonation.id,
        checkoutIntentId: browserDonation.checkoutIntentId,
        amount: browserDonation.amount,
        paidAt: browserDonation.paidAt?.toISOString() ?? null,
        livemode: browserDonation.livemode,
        trackingCode: browserDonation.trackingCode,
        customerName: browserDonation.customerName,
        hasComment: Boolean(browserDonation.comment),
        hasReply: browserDonation.hasReply,
      }
    : null;
  const returnSessionId = Array.isArray(query.session_id)
    ? query.session_id[0]
    : query.session_id;
  const paymentReturn = Array.isArray(query.payment_return)
    ? query.payment_return[0]
    : query.payment_return;
  const returnIntentId = Array.isArray(query.intent)
    ? query.intent[0]
    : query.intent;
  const showInlineThanks =
    paymentReturn === "1" &&
    browserDonation?.showInlineThankYou === true &&
    (returnSessionId
      ? browserDonation.stripeCheckoutSessionId === returnSessionId
      : returnIntentId
        ? browserDonation.checkoutIntentId === returnIntentId
        : false);

  if (showInlineThanks && browserDonation) {
    return (
      <div style={theme}>
        <InlineCampaignThanks
          affiliatePageId={page.id}
          campaignTitle={campaign.title}
          campaignPath={campaignPath}
          sale={browserDonation}
        />
      </div>
    );
  }

  const layoutProps: CampaignLayoutProps = {
    theme,
    siteName: settings.siteName,
    logoUrl: settings.logoUrl,
    footerText: settings.footerText ?? "Your donation makes a real difference.",
    locale: chrome.locale,
    messages,
    pathPrefix: chrome.pathPrefix,
    paymentGateway: chrome.paymentGateway,
    checkoutHref,
    affiliatePageId: page.id,
    percent,
    raisedAmount,
    campaign,
    checkoutOptions: page.campaign.options.map((option) => ({
      id: option.id,
      amount: option.amount,
      suggested: option.suggested,
      paymentLinkId:
        page.paymentLinks.find((link) => link.donationOptionId === option.id)?.id ??
        null,
    })),
    googlePixelId: page.googlePixelId,
    tiktokPixelId: page.tiktokPixelId,
    donations: page.sales.map((sale) => ({
      id: sale.id,
      name: sale.customerName || messages.campaign.anonymous,
      amount: sale.amount,
      currency: sale.currency,
      paidAt: sale.paidAt?.toISOString() ?? null,
    })),
    socialDonations,
    personalSale,
    related: related.map((item) => {
      const relatedRaised = raisedAmountFromLedger(item.campaign);
      return {
        id: item.id,
        href: publicCampaignPath(
          chrome.pathPrefix,
          item.campaign.slug,
          item.affiliate.slug,
          "",
          {
            short:
              chrome.institutional &&
              keepsRunningCampaignAddress(item.campaign.slug),
          },
        ),
        title: item.campaign.title,
        organizerName: item.campaign.organizerName ?? undefined,
        category: isSpanishDesk(chrome.company)
          ? mexicoLocalizedCampaignCopy({ category: item.campaign.category }).category
          : item.campaign.category,
        coverImageUrl: item.campaign.coverImageUrl,
        coverFocusX: item.campaign.coverFocusX,
        coverFocusY: item.campaign.coverFocusY,
        currentAmount: relatedRaised,
        goalAmount: campaignStageView({
          ...item.campaign,
          currentAmount: relatedRaised,
        }).goalAmount,
        currency: item.campaign.currency,
      };
    }),
  };

  return (
    <>
      <AttributionCapture affiliatePageId={page.id} />
      <AffiliatePagePixels
        pageKey={`${page.id}-campaign`}
        googlePixelId={page.googlePixelId}
        tiktokPixelId={page.tiktokPixelId}
        utmifyPixelScript={resolvedUtmifyPixelScript(
          page.utmifyPixelScript,
          affiliate.utmifyPixelScript,
          chrome.company.isDefault,
        )}
        eventName="ViewContent"
      />
      {isImpactCampaignLayout(settings.campaignLayout) ? (
        <ImpactCampaignPage
          {...layoutProps}
          searchOrgs={searchOrgs}
          searchCampaigns={searchCampaigns}
          institutional={chrome.institutional}
          contactEmail={chrome.brand.contactEmail}
          contactPhone={chrome.brand.contactPhone}
          contactAddress={chrome.brand.contactAddress}
          nonprofitEin={chrome.brand.nonprofitEin}
          nonprofitName={chrome.brand.nonprofitName}
          checkoutOptions={layoutProps.checkoutOptions}
          googlePixelId={layoutProps.googlePixelId}
          tiktokPixelId={layoutProps.tiktokPixelId}
          embeddedCheckout={usesEmbeddedStripeCheckout(chrome.company)}
          publishableKey={stripePublishableKey()}
          paypalClientId={paypalPublicClientId()}
        />
      ) : (
        <ClassicCampaignPage {...layoutProps} />
      )}
    </>
  );
}
