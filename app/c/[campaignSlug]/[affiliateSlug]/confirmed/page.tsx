import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AffiliatePagePixels } from "@/components/tracking/AffiliatePagePixels";
import { StripeConfirmedRedirect } from "@/components/campaign/StripeConfirmedRedirect";
import { getConfirmedSale } from "@/lib/confirmed-page-access";
import { getAffiliateCampaign, getPublicChrome } from "@/lib/public-campaigns";
import { resolvedUtmifyPixelScript } from "@/lib/utmify-desk";
import { keepsRunningCampaignAddress } from "@/lib/campaign-defaults";
import { publicCampaignPath } from "@/lib/public-site-url";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getPublicChrome();
  return {
    title: messages.confirmed.title,
    robots: { index: false, follow: false },
  };
}

export default async function PaymentConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignSlug: string; affiliateSlug: string }>;
  searchParams: Promise<{ session_id?: string; intent?: string }>;
}) {
  const [{ campaignSlug, affiliateSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const sessionId = query.session_id?.trim();
  const intentId = query.intent?.trim();
  const [page, chrome] = await Promise.all([
    getAffiliateCampaign(campaignSlug, affiliateSlug).catch(() => null),
    getPublicChrome(),
  ]);
  const campaignPath = publicCampaignPath(
    chrome.pathPrefix,
    campaignSlug,
    affiliateSlug,
    "",
    {
      short:
        chrome.institutional && keepsRunningCampaignAddress(campaignSlug),
    },
  );
  if (!page?.campaign || !page.affiliate || (!sessionId && !intentId)) {
    redirect(campaignPath);
  }

  const sale = await getConfirmedSale(page.id, {
    stripeCheckoutSessionId: sessionId,
    intentId,
  }).catch(() => null);
  if (!sale) {
    redirect(campaignPath);
  }

  const confirmRef = sessionId || intentId || sale.id;
  const returnQuery = sessionId
    ? `payment_return=1&session_id=${encodeURIComponent(sessionId)}`
    : `payment_return=1&intent=${encodeURIComponent(intentId ?? sale.checkoutIntentId)}`;

  return (
    <main className="receipt-wait-shell">
      <AffiliatePagePixels
        pageKey={`${page.id}-${sale.id}-purchase`}
        googlePixelId={page.googlePixelId}
        tiktokPixelId={page.tiktokPixelId}
        utmifyPixelScript={resolvedUtmifyPixelScript(
          page.utmifyPixelScript,
          page.affiliate.utmifyPixelScript,
          chrome.company.isDefault,
        )}
        eventName="Purchase"
      />
      <div className="receipt-wait-card">
        <span className="receipt-wait-kicker">
          {chrome.paymentGateway === "PAGNOVO"
            ? chrome.messages.confirmed.kickerPagnovo
            : chrome.messages.confirmed.kickerStripe}
        </span>
        <h1>{chrome.messages.confirmed.title}</h1>
        {!sale.livemode ? (
          <p className="receipt-wait-disclaimer">
            {chrome.messages.confirmed.testDisclaimer}
          </p>
        ) : null}
        <StripeConfirmedRedirect
          campaignPath={`${campaignPath}?${returnQuery}`}
          sessionId={confirmRef}
          continueToThankYou={sale.livemode}
          returningLabel={chrome.messages.confirmed.returning}
          testReturningLabel={chrome.messages.confirmed.testReturning}
        />
      </div>
    </main>
  );
}
