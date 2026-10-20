import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { CoverMedia } from "@/components/campaign/CoverMedia";
import { StageGoal } from "@/components/campaign/StageGoal";
import { PersonalDonationProgress } from "@/components/campaign/PersonalDonationProgress";
import { CheckoutPanel } from "@/components/checkout/CheckoutPanel";
import { ImpactCheckoutPanel } from "@/components/checkout/ImpactCheckoutPanel";
import { DonationBubbles } from "@/components/checkout/DonationBubbles";
import { PaymentMethodBadges } from "@/components/checkout/PaymentMethodBadges";
import { VerifiedComments } from "@/components/checkout/VerifiedComments";
import { AffiliatePagePixels } from "@/components/tracking/AffiliatePagePixels";
import { AttributionCapture } from "@/components/tracking/AttributionCapture";
import { PublicMenu } from "@/components/public/PublicMenu";
import { isImpactCampaignLayout } from "@/lib/campaign-layout";
import { usesEmbeddedStripeCheckout } from "@/lib/embedded-stripe";
import { getAuthorizedBrowserDonation } from "@/lib/donor-browser-access";
import { getAffiliateCampaign, getPublicChrome } from "@/lib/public-campaigns";
import { resolvedUtmifyPixelScript } from "@/lib/utmify-desk";
import { getPagnovoCardConfig, isPagnovoConfigured } from "@/lib/pagnovo";
import { isAnonymousDonorName } from "@/lib/social-proof";
import { campaignStageView } from "@/lib/campaign-stages";
import { formatMoney, progressPercent } from "@/lib/utils";
import { keepsRunningCampaignAddress } from "@/lib/campaign-defaults";
import { publicCampaignPath, withPublicPrefix } from "@/lib/public-site-url";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ campaignSlug: string; affiliateSlug: string }>;
  searchParams: Promise<{ option?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { campaignSlug, affiliateSlug } = await params;
  const [page, chrome] = await Promise.all([
    getAffiliateCampaign(campaignSlug, affiliateSlug).catch(() => null),
    getPublicChrome().catch(() => null),
  ]);
  if (!page) return { title: chrome?.messages.checkout.title ?? "Secure donation" };
  return {
    title: `${chrome?.messages.checkout.title ?? "Donate"} · ${page.campaign.title}`,
    description: page.campaign.checkoutSubtitle ?? page.campaign.summary,
  };
}

export default async function CheckoutPage({ params, searchParams }: PageProps) {
  const [{ campaignSlug, affiliateSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const page = await getAffiliateCampaign(campaignSlug, affiliateSlug).catch(
    (error) => {
      console.error("[checkout] lookup failed", error);
      return null;
    },
  );
  const chrome = await getPublicChrome().catch(() => null);
  if (!page?.campaign || !page.affiliate || !chrome) notFound();

  const campaign = page.campaign;
  const messages = chrome.messages;
  const settings = chrome.brand;
  const pagnovo = chrome.paymentGateway === "PAGNOVO";
  const embeddedCheckout = usesEmbeddedStripeCheckout({
    paymentGateway: chrome.paymentGateway,
    siteMode: chrome.siteMode,
  });
  const browserDonation = await getAuthorizedBrowserDonation(page.id).catch(
    () => null,
  );
  const cardConfig =
    pagnovo && campaign.currency !== "ARS" && isPagnovoConfigured()
      ? await getPagnovoCardConfig().catch(() => ({
          available: false,
          tokenizationKey: null as string | null,
          allowsInstallments: false,
        }))
      : { available: false, tokenizationKey: null };
  const stage = campaignStageView(campaign);
  const percent = progressPercent(campaign.currentAmount, stage.goalAmount);
  const theme = {
    "--navy": settings.primaryColor,
    "--gold": settings.accentColor,
  } as CSSProperties;
  const options = campaign.options.flatMap((option) => {
    const paymentLink = page.paymentLinks.find(
      (link) => link.donationOptionId === option.id,
    );
    if (!pagnovo && !embeddedCheckout && !paymentLink) return [];
    return [
      {
        id: option.id,
        amount: option.amount,
        suggested: option.suggested,
        paymentLinkId: paymentLink?.id ?? null,
      },
    ];
  });
  const bubbles = page.sales.map((sale) => ({
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
      }
    : null;
  const campaignPath = publicCampaignPath(
    chrome.pathPrefix,
    campaign.slug,
    page.affiliate.slug,
    "",
    {
      short:
        chrome.institutional && keepsRunningCampaignAddress(campaign.slug),
    },
  );

  const remaining = Math.max(0, stage.goalAmount - campaign.currentAmount);
  const stillToGo =
    remaining > 0
      ? messages.checkout.stillToGo(
          formatMoney(remaining, campaign.currency, chrome.locale),
        )
      : messages.checkout.goalReached;
  const impact = isImpactCampaignLayout(settings.campaignLayout);
  const latestDonation = bubbles[0];
  const latestDonor = latestDonation
    ? isAnonymousDonorName(latestDonation.name)
      ? messages.campaign.anonymous
      : latestDonation.name
    : null;
  const otherDonors = Math.max(
    0,
    campaign.supporterCount - (latestDonor ? 1 : 0),
  );
  const socialProof = latestDonor
    ? messages.campaign.othersDonated(
        latestDonor,
        otherDonors.toLocaleString(chrome.locale),
      )
    : messages.campaign.donationsCount(
        campaign.supporterCount.toLocaleString(chrome.locale),
      );
  const tracking = (
    <>
      <AttributionCapture
        affiliatePageId={page.id}
        eventType="CHECKOUT_STARTED"
      />
      <AffiliatePagePixels
        pageKey={`${page.id}-checkout`}
        googlePixelId={page.googlePixelId}
        tiktokPixelId={page.tiktokPixelId}
        utmifyPixelScript={resolvedUtmifyPixelScript(
          page.utmifyPixelScript,
          page.affiliate.utmifyPixelScript,
          chrome.company.isDefault,
        )}
      />
    </>
  );
  const panelProps = {
    affiliatePageId: page.id,
    campaignPath,
    currency: campaign.currency,
    locale: chrome.locale,
    options,
    initialOptionId: query.option,
    recentDonations: bubbles,
    googlePixelId: page.googlePixelId,
    tiktokPixelId: page.tiktokPixelId,
    gateway: chrome.paymentGateway,
    embeddedCheckout,
    cardAvailable: cardConfig.available,
    tokenizationKey: cardConfig.tokenizationKey,
  };

  if (impact) {
    return (
      <main className="impact-donate">
        {tracking}
        <header className="impact-donate-header">
          <Link
            className="impact-donate-back"
            href={campaignPath}
            aria-label={messages.checkout.backToCampaign}
          >
            <ChevronLeft size={26} strokeWidth={1.7} aria-hidden />
          </Link>
          <BrandLogo siteName={settings.siteName} compact href="/" />
          <span className="impact-donate-header-spacer" aria-hidden />
        </header>
        <div className="impact-donate-body">
          <h1 className="impact-donate-title">{campaign.title}</h1>
          <p className="impact-donate-remaining">{stillToGo}</p>
          <ImpactCheckoutPanel
            {...panelProps}
            showMissionTip={campaign.showMissionTip}
            missionTipBold={campaign.missionTipBold}
            siteName={settings.siteName}
            termsHref={withPublicPrefix(chrome.pathPrefix, "/about-us")}
            privacyHref={withPublicPrefix(chrome.pathPrefix, "/about-us")}
            refundHref={withPublicPrefix(chrome.pathPrefix, "/refund")}
            sticky={{
              percent,
              raised: formatMoney(
                campaign.currentAmount,
                campaign.currency,
                chrome.locale,
              ),
              raisedSuffix: messages.campaign.raisedSuffix,
              ofLabel: messages.campaign.ofGoal,
              goal: formatMoney(
                stage.goalAmount,
                campaign.currency,
                chrome.locale,
              ),
              stageCompletedLabel: stage.stageCompletedLabel,
              socialProof,
              proofHref: `${campaignPath}#donations`,
              showYou: Boolean(personalSale?.livemode),
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-shell" style={theme}>
      {tracking}
      <DonationBubbles donations={bubbles} />

      <div className="checkout-head">
        <PublicMenu locale={chrome.locale} pathPrefix={chrome.pathPrefix} />
        <div className="checkout-brand">
          <BrandLogo siteName={settings.siteName} logoUrl={settings.logoUrl} href="/" />
        </div>
        <Link className="checkout-back" href={campaignPath}>
          <ChevronLeft size={18} aria-hidden />
          <span>{messages.checkout.backToCampaign}</span>
        </Link>
      </div>

      <div className="checkout-layout">
        <section className="checkout-campaign-card">
          <div className="checkout-campaign-media">
            {campaign.coverImageUrl ? (
              <CoverMedia
                src={campaign.coverImageUrl}
                alt=""
                sizes="420px"
                focusX={campaign.coverFocusX}
                focusY={campaign.coverFocusY}
              />
            ) : null}
          </div>
          <div className="checkout-campaign-copy">
            {campaign.category ? (
              <span className="campaign-kicker">{campaign.category}</span>
            ) : null}
            <h1>{campaign.title}</h1>
            <p>
              {campaign.checkoutSubtitle ?? messages.checkout.defaultSubtitle}
            </p>
            <div className="metric-line">
              <strong>
                {formatMoney(campaign.currentAmount, campaign.currency, chrome.locale)}
              </strong>
              <span>
                {messages.campaign.ofGoal}{" "}
                <StageGoal
                  amount={formatMoney(stage.goalAmount, campaign.currency, chrome.locale)}
                  stageCompletedLabel={stage.stageCompletedLabel}
                  amountClassName="metric-goal-amount"
                />
              </span>
            </div>
            <p className="supporter-count">
              {messages.checkout.supportersPercent(
                campaign.supporterCount.toLocaleString(chrome.locale),
                percent,
              )}
            </p>
            <PersonalDonationProgress
              currentAmount={campaign.currentAmount}
              goalAmount={stage.goalAmount}
              personalSale={personalSale}
              label={messages.campaign.funded(percent)}
            />
          </div>
        </section>

        <div className="checkout-panel-wrap">
          <CheckoutPanel
            {...panelProps}
            supporterCount={campaign.supporterCount}
          />
          <PaymentMethodBadges
            gateway={chrome.paymentGateway}
            locale={chrome.locale}
            currency={campaign.currency}
          />
          <p className="checkout-legal">
            {settings.legalText || messages.checkout.legal}
          </p>
        </div>
      </div>

      <VerifiedComments
        heading={messages.comments.fromSupporters}
        comments={campaign.comments
          .flatMap((comment) =>
            comment.sale
              ? [
                  {
                    id: comment.id,
                    authorName: comment.authorName,
                    body: comment.body,
                    amount: comment.sale.amount,
                    currency: comment.sale.currency,
                  },
                ]
              : [],
          )
          .slice(0, 5)}
      />
    </main>
  );
}
