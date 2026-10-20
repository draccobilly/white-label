const CURRENCIES = ["USD", "EUR", "GBP", "BRL", "CAD", "MXN", "ARS"] as const;

export type DuplicatedCampaignForm = {
  title: string;
  slug: string;
  organizerName: string;
  organizerImageUrl: string;
  organizerVerified: boolean;
  organizerBoldText: string;
  titleBoldText: string;
  summary: string;
  story: string;
  category: string;
  coverImageUrl: string;
  coverFocusX: number;
  coverFocusY: number;
  galleryImageUrls: string[];
  verificationDocumentUrls: string[];
  verificationNote: string;
  videoUrl: string;
  checkoutSubtitle: string;
  socialProofText: string;
  storyHeading: string;
  recentDonationsDescription: string;
  commentsDescription: string;
  thankYouTitle: string;
  thankYouMessage: string;
  goalAmount: number;
  currentAmount: number;
  supporterCount: number;
  displayPaidPercent: number;
  currency: (typeof CURRENCIES)[number];
  amounts: number[];
  suggestedAmount: number;
  showMissionTip: boolean;
  missionTipBold: boolean;
  unlisted: boolean;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
  updates: Array<{ id?: string; title?: string; body: string; createdAt?: string }>;
  /** Written from the new campaign's own story once it is saved. */
  gatewayNames: string[];
  /** Goals after the first, cents; copied from the source ladder. */
  nextGoals: number[];
};

export type SourceCampaignCopy = {
  organizerName?: string | null;
  fallbackOrganizerName?: string | null;
  organizerVerified?: boolean | null;
  organizerBoldText?: string | null;
  titleBoldText?: string | null;
  checkoutSubtitle: string | null;
  socialProofText: string | null;
  storyHeading: string | null;
  recentDonationsDescription: string;
  commentsDescription: string;
  thankYouTitle: string;
  thankYouMessage: string;
  goalAmount: number;
  /** Full ladder, stage 1 first; the duplicate keeps the goals after the first. */
  goalStages?: number[] | null;
  displayPaidPercent?: number | null;
  currency: string;
  showMissionTip?: boolean;
  missionTipBold?: boolean;
  options: Array<{ amount: number; suggested: boolean }>;
};

const DEFAULT_COMMENTS =
  "Comments unlock only after a successful donation — one note per gift.";
const DEFAULT_STORY_HEADING = "Why this campaign matters";
const DEFAULT_AMOUNTS = [2500, 5000, 10000, 15000, 25000, 35000, 45000, 50000];

function asCurrency(value: string): DuplicatedCampaignForm["currency"] {
  return CURRENCIES.includes(value as DuplicatedCampaignForm["currency"])
    ? (value as DuplicatedCampaignForm["currency"])
    : "USD";
}

export function duplicatedCampaignForm(
  source: SourceCampaignCopy,
): DuplicatedCampaignForm {
  const amounts = source.options.map((option) => option.amount);
  const suggested =
    source.options.find((option) => option.suggested)?.amount ??
    amounts[0] ??
    5000;

  return {
    title: "",
    slug: "",
    organizerName:
      source.organizerName?.trim() ||
      source.fallbackOrganizerName?.trim() ||
      "Giving Site",
    organizerImageUrl: "",
    organizerVerified: source.organizerVerified ?? true,
    organizerBoldText: source.organizerBoldText ?? "",
    titleBoldText: source.titleBoldText ?? "",
    summary: "",
    story: "",
    category: "Urgent cause",
    coverImageUrl: "",
    coverFocusX: 50,
    coverFocusY: 50,
    galleryImageUrls: [],
    verificationDocumentUrls: [],
    verificationNote: "",
    videoUrl: "",
    checkoutSubtitle:
      source.checkoutSubtitle || "Your support can change a life today.",
    socialProofText: source.socialProofText || "A supporter donated recently",
    storyHeading: source.storyHeading || DEFAULT_STORY_HEADING,
    recentDonationsDescription: source.recentDonationsDescription,
    commentsDescription: source.commentsDescription || DEFAULT_COMMENTS,
    thankYouTitle: source.thankYouTitle,
    thankYouMessage: source.thankYouMessage,
    goalAmount: source.goalAmount,
    currentAmount: 0,
    displayPaidPercent:
      typeof source.displayPaidPercent === "number" &&
      Number.isInteger(source.displayPaidPercent) &&
      source.displayPaidPercent >= 0 &&
      source.displayPaidPercent <= 100
        ? source.displayPaidPercent
        : 1,
    supporterCount: 0,
    currency: asCurrency(source.currency),
    amounts: amounts.length ? amounts : DEFAULT_AMOUNTS,
    suggestedAmount: suggested,
    showMissionTip: source.showMissionTip !== false,
    missionTipBold: source.missionTipBold === true,
    unlisted: true,
    status: "DRAFT",
    updates: [],
    gatewayNames: [],
    nextGoals: (source.goalStages ?? []).slice(1),
  };
}

export type SourcePageCopy = {
  affiliateId: string;
  fbPixelId: string | null;
  googlePixelId: string | null;
  tiktokPixelId: string | null;
  utmifyTokenEnc: string | null;
  utmifyPixelScript?: string | null;
  utmifyWebhookUrl?: string | null;
  paymentLinks: Array<{
    amount: number;
    url: string;
    stripeCheckoutUrl: string | null;
    stripePaymentLinkId: string | null;
  }>;
};

export function mapDuplicatedCampaignAssets(input: {
  sourcePages: SourcePageCopy[];
  targetPages: Array<{ id: string; affiliateId: string }>;
  targetOptions: Array<{ id: string; amount: number }>;
  copyTracking?: boolean;
}) {
  const copyTracking = input.copyTracking !== false;
  const sourceByAffiliate = new Map(
    input.sourcePages.map((page) => [page.affiliateId, page]),
  );
  const optionIdByAmount = new Map(
    input.targetOptions.map((option) => [option.amount, option.id]),
  );

  return input.targetPages.flatMap((page) => {
    const source = sourceByAffiliate.get(page.affiliateId);
    if (!source) return [];
    const paymentLinks = source.paymentLinks.flatMap((link) => {
      const donationOptionId = optionIdByAmount.get(link.amount);
      if (!donationOptionId || (!link.url && !link.stripeCheckoutUrl)) {
        return [];
      }
      return [
        {
          donationOptionId,
          url: link.url,
          stripeCheckoutUrl: link.stripeCheckoutUrl,
          stripePaymentLinkId: link.stripePaymentLinkId,
        },
      ];
    });
    return [
      {
        pageId: page.id,
        tracking: copyTracking
          ? {
              fbPixelId: source.fbPixelId,
              googlePixelId: source.googlePixelId,
              tiktokPixelId: source.tiktokPixelId,
              ...(source.utmifyTokenEnc
                ? { utmifyTokenEnc: source.utmifyTokenEnc }
                : {}),
              ...(source.utmifyPixelScript?.trim()
                ? { utmifyPixelScript: source.utmifyPixelScript }
                : {}),
              ...(source.utmifyWebhookUrl
                ? { utmifyWebhookUrl: source.utmifyWebhookUrl }
                : {}),
            }
          : {
              fbPixelId: null,
              googlePixelId: null,
              tiktokPixelId: null,
              utmifyTokenEnc: null,
              utmifyPixelScript: null,
              utmifyWebhookUrl: null,
            },
        paymentLinks,
      },
    ];
  });
}

export type SiblingPaymentLink = {
  amount: number;
  url: string;
  stripeCheckoutUrl: string | null;
  stripePaymentLinkId: string | null;
};

export function mergeSiblingLinksByAmount(input: {
  targetOptions: Array<{ id: string; amount: number }>;
  takenAmounts?: Iterable<number>;
  siblings: Array<{ paymentLinks: SiblingPaymentLink[] }>;
}) {
  const taken = new Set(input.takenAmounts ?? []);
  const best = new Map<number, SiblingPaymentLink & { score: number }>();
  for (const sibling of input.siblings) {
    const score = sibling.paymentLinks.length;
    for (const link of sibling.paymentLinks) {
      if (!link.url && !link.stripeCheckoutUrl) continue;
      const current = best.get(link.amount);
      if (!current || score > current.score) {
        best.set(link.amount, { ...link, score });
      }
    }
  }
  return input.targetOptions.flatMap((option) => {
    if (taken.has(option.amount)) return [];
    const link = best.get(option.amount);
    if (!link) return [];
    return [
      {
        donationOptionId: option.id,
        url: link.url,
        stripeCheckoutUrl: link.stripeCheckoutUrl,
        stripePaymentLinkId: link.stripePaymentLinkId,
      },
    ];
  });
}
