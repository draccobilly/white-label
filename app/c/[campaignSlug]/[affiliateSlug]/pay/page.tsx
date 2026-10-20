import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { SpeiWaiting } from "@/components/checkout/SpeiWaiting";
import { AffiliatePagePixels } from "@/components/tracking/AffiliatePagePixels";
import { getAffiliateCampaign, getPublicChrome } from "@/lib/public-campaigns";
import { prisma } from "@/lib/prisma";
import { publicCampaignPath, withPublicPrefix } from "@/lib/public-site-url";
import { resolvedUtmifyPixelScript } from "@/lib/utmify-desk";
import {
  pendingCheckoutCookieName,
  readDonorBrowserToken,
} from "@/lib/donor-browser-token";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ campaignSlug: string; affiliateSlug: string }>;
  searchParams: Promise<{ intent?: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { campaignSlug, affiliateSlug } = await params;
  const chrome = await getPublicChrome().catch(() => null);
  const page = await getAffiliateCampaign(campaignSlug, affiliateSlug).catch(
    () => null,
  );
  const ars = page?.campaign.currency === "ARS";
  const title = ars
    ? chrome?.messages.payment.cvuTitle ?? "Envía el monto exacto"
    : chrome?.messages.payment.speiTitle ?? "Send the exact SPEI";
  return {
    title,
    robots: { index: false, follow: false },
  };
}

export default async function PagnovoPayPage({ params, searchParams }: PageProps) {
  const [{ campaignSlug, affiliateSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const intentId = query.intent?.trim();
  const [page, chrome] = await Promise.all([
    getAffiliateCampaign(campaignSlug, affiliateSlug).catch(() => null),
    getPublicChrome(),
  ]);
  const campaignPath = publicCampaignPath(
    chrome.pathPrefix,
    campaignSlug,
    affiliateSlug,
  );
  if (!page?.campaign || !page.affiliate || !intentId) {
    redirect(campaignPath);
  }
  if (chrome.paymentGateway !== "PAGNOVO") notFound();

  const secret = process.env.ENCRYPTION_KEY;
  const cookieStore = await cookies();
  const encrypted = cookieStore.get(pendingCheckoutCookieName(page.id))?.value;
  const token =
    encrypted && secret ? readDonorBrowserToken(encrypted, secret) : null;
  if (!token || token.checkoutIntentId !== intentId) {
    redirect(campaignPath);
  }

  const intent = await prisma.checkoutIntent.findUnique({
    where: { id: intentId },
  });
  if (!intent || intent.affiliatePageId !== page.id) {
    redirect(campaignPath);
  }

  const checkoutHref = `${campaignPath}/checkout`;
  const messages = chrome.messages;

  return (
    <main className="impact-donate impact-donate--spei">
      <AffiliatePagePixels
        pageKey={`${page.id}-pay`}
        googlePixelId={page.googlePixelId}
        tiktokPixelId={page.tiktokPixelId}
        utmifyPixelScript={resolvedUtmifyPixelScript(
          page.utmifyPixelScript,
          page.affiliate.utmifyPixelScript,
          chrome.company.isDefault,
        )}
      />
      <header className="impact-donate-header">
        <Link
          className="impact-donate-back"
          href={campaignPath}
          aria-label={messages.checkout.backToCampaign}
        >
          <ChevronLeft size={26} strokeWidth={1.7} aria-hidden />
        </Link>
        <BrandLogo
          siteName={chrome.brand.siteName}
          logoUrl={chrome.brand.logoUrl}
          compact
          href="/"
        />
        <span className="impact-donate-header-spacer" aria-hidden />
      </header>
      <div className="impact-donate-body">
        <h1 className="impact-donate-title">{page.campaign.title}</h1>
        <p className="impact-donate-remaining">
          {intent.currency === "ARS"
            ? messages.payment.cvuTitle
            : messages.payment.speiTitle}
        </p>
        <SpeiWaiting
          intentId={intent.id}
          checkoutHref={checkoutHref}
          pathPrefix={chrome.pathPrefix}
          locale={chrome.locale}
          initialClabe={intent.pagnovoClabe}
          amount={intent.amount}
          currency={intent.currency}
          refundHref={withPublicPrefix(chrome.pathPrefix, "/refund")}
          recentGifts={page.sales.slice(0, 6).map((sale) => ({
            id: sale.id,
            name: sale.customerName || messages.campaign.anonymous,
            amount: sale.amount,
            currency: sale.currency,
          }))}
        />
      </div>
    </main>
  );
}
