import type { CSSProperties } from "react";
import type { ProgressSale } from "@/components/campaign/PersonalDonationProgress";
import type { RelatedCampaignCard } from "@/components/campaign/RelatedCampaignsCarousel";
import type { SocialDonation } from "@/components/campaign/SocialProofCarousel";
import type { Messages } from "@/lib/i18n/types";

export type CampaignLayoutProps = {
  theme: CSSProperties;
  siteName: string;
  logoUrl: string | null;
  footerText: string;
  locale: string;
  messages: Messages;
  pathPrefix: string | null | undefined;
  paymentGateway: "STRIPE" | "PAGNOVO";
  checkoutHref: string;
  affiliatePageId: string;
  percent: number;
  /** Real campaigns: baseline plus DISPLAYED_PAID_PERCENT of paid. Causes omit this and keep campaign.currentAmount. */
  raisedAmount?: number;
  campaign: {
    id: string;
    slug: string;
    title: string;
    organizerName: string;
    organizerImageUrl: string | null;
    organizerVerified?: boolean;
    organizerBoldText?: string | null;
    titleBoldText?: string | null;
    summary: string;
    story: string;
    storyHeading: string;
    category: string | null;
    createdAt: Date | string;
    coverImageUrl: string | null;
    coverFocusX: number;
    coverFocusY: number;
    galleryImageUrls?: string[];
    verificationDocumentUrls?: string[];
    verificationNote?: string | null;
    /** Static cause total. Real campaign pages omit this and pass raisedAmount. */
    currentAmount?: number;
    goalAmount: number;
    /** Goal ladder in cents, stage 1 first; empty for a single goal. */
    goalStages: number[];
    currency: string;
    showMissionTip?: boolean;
    missionTipBold?: boolean;
    supporterCount: number;
    likeCount: number;
    shareCount: number;
    recentDonationsDescription: string;
    commentsDescription: string;
    comments: Array<{
      id: string;
      authorName: string;
      body: string;
      createdAt: Date | string;
      replies: Array<{
        id: string;
        authorName: string;
        body: string;
        createdAt: Date | string;
      }>;
    }>;
    updates?: Array<{
      id: string;
      title: string | null;
      body: string;
      authorName: string | null;
      createdAt: Date;
    }>;
  };
  donations: Array<{
    id: string;
    name: string;
    amount: number;
    currency: string;
    paidAt: string | null;
  }>;
  socialDonations: SocialDonation[];
  personalSale: ProgressSale | null;
  related: RelatedCampaignCard[];
  checkoutOptions?: Array<{
    id: string;
    amount: number;
    suggested: boolean;
    paymentLinkId: string | null;
  }>;
  googlePixelId?: string | null;
  tiktokPixelId?: string | null;
};
