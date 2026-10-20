import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImpactCampaignPage } from "@/components/campaign/layouts/ImpactCampaignPage";
import { causeActivity } from "@/lib/cause-social-proof";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import {
  CAUSE_ORGANIZER,
  CAUSE_PAGE_ID,
  causeCheckoutOptions,
  causeCover,
  causePath,
  causeText,
  foundationCause,
  FOUNDATION_CAUSES,
} from "@/lib/foundation-causes";
import { stripePublishableKey } from "@/lib/embedded-stripe";
import { paypalPublicClientId } from "@/lib/paypal";
import { en } from "@/lib/i18n/en";
import { progressPercent } from "@/lib/utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string; amount?: string }>;
};

function pageLang(value: string | undefined) {
  return value === "es" ? "es" : "en";
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const cause = foundationCause(slug);
  if (!cause) return { title: "Cause" };
  const text = causeText(cause, pageLang(query.lang));
  return { title: text.title, description: text.summary };
}

export default async function FoundationCausePage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const cause = foundationCause(slug);
  if (!cause) notFound();
  const chrome = await getPublicPageChrome().catch(() => null);
  const brand = chrome?.brand;

  const lang = pageLang(query.lang);
  const requested = Number(query.amount);
  const amountCents =
    Number.isFinite(requested) && requested >= 2500 ? Math.round(requested) : undefined;
  const text = causeText(cause, lang);
  const createdAt = "2026-03-12T15:00:00.000Z";
  const activity = causeActivity({ ...cause, notes: text.notes });
  const donations = activity.donations.map((gift, index) => ({
    id: `${cause.slug}-gift-${index}`,
    name: gift.name,
    amount: gift.amount,
    currency: "USD",
    paidAt: gift.paidAt,
  }));
  const theme = {
    "--navy": "#163c2c",
    "--gold": "#d4f07a",
  } as CSSProperties;

  return (
    <ImpactCampaignPage
      theme={theme}
      siteName={brand?.siteName || CAUSE_ORGANIZER}
      logoUrl={brand?.logoUrl ?? null}
      footerText={brand?.footerText || CAUSE_ORGANIZER}
      locale={lang}
      messages={en}
      pathPrefix={null}
      paymentGateway="STRIPE"
      checkoutHref={causePath(cause.slug, lang)}
      affiliatePageId={CAUSE_PAGE_ID}
      percent={progressPercent(cause.currentAmount, cause.goalAmount)}
      embeddedCheckout
      publishableKey={stripePublishableKey()}
      paypalClientId={paypalPublicClientId()}
      institutional
      checkoutOptions={causeCheckoutOptions(amountCents)}
      contactEmail={brand?.contactEmail}
      contactPhone={brand?.contactPhone}
      contactAddress={brand?.contactAddress}
      nonprofitEin={brand?.nonprofitEin}
      nonprofitName={brand?.nonprofitName}
      campaign={{
        id: cause.slug,
        slug: cause.slug,
        title: text.title,
        organizerName: CAUSE_ORGANIZER,
        organizerImageUrl: null,
        organizerVerified: true,
        summary: text.summary,
        story: text.story,
        storyHeading: text.storyHeading,
        category: cause.category,
        createdAt,
        coverImageUrl: causeCover(cause),
        coverFocusX: cause.coverFocusX,
        coverFocusY: cause.coverFocusY,
        galleryImageUrls: [causeCover(cause)],
        currentAmount: cause.currentAmount,
        goalAmount: cause.goalAmount,
        goalStages: [],
        currency: "USD",
        showMissionTip: true,
        supporterCount: cause.supporterCount,
        likeCount: cause.supporterCount,
        shareCount: Math.round(cause.supporterCount / 4),
        recentDonationsDescription:
          lang === "es"
            ? "Cada regalo es uno de los montos públicos, y el número de donantes es la cantidad de esos regalos."
            : "Every gift is one of the public amounts, and the donor count is the number of those gifts.",
        commentsDescription:
          lang === "es"
            ? "Notas de quienes ya dieron a esta causa."
            : "Notes from people who already gave to this cause.",
        comments: activity.comments.map((comment, index) => ({
          id: `${cause.slug}-note-${index}`,
          authorName: comment.authorName,
          body: comment.body,
          createdAt: comment.createdAt,
          replies: [],
        })),
        updates: [
          {
            id: `${cause.slug}-update`,
            title: text.updateTitle,
            body: text.updateBody,
            authorName: CAUSE_ORGANIZER,
            createdAt: new Date(activity.updatedAt),
          },
        ],
      }}
      donations={donations}
      socialDonations={donations.map(({ paidAt: _paidAt, ...gift }) => gift)}
      personalSale={null}
      related={FOUNDATION_CAUSES.filter((item) => item.slug !== cause.slug).map((item) => {
        const relatedText = causeText(item, lang);
        return {
          id: item.slug,
          href: causePath(item.slug, lang),
          title: relatedText.title,
          organizerName: CAUSE_ORGANIZER,
          category: item.category,
          coverImageUrl: causeCover(item),
          coverFocusX: item.coverFocusX,
          coverFocusY: item.coverFocusY,
          currentAmount: item.currentAmount,
          goalAmount: item.goalAmount,
          currency: "USD",
        };
      })}
    />
  );
}
