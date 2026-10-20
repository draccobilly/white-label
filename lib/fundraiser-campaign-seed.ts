import { defaultDonationSetup } from "@/lib/campaign-defaults";
import { duplicatedCampaignForm } from "@/lib/duplicate-campaign";
import { asFundraiserCurrency } from "@/lib/fundraiser-prior";

/** Campaign editor values copied from a Start a fundraiser request. */
export function campaignSeedFromFundraiser(input: {
  name: string;
  story: string;
  priorRaisedCents: number;
  priorDonationCount: number;
  currency: string;
  fallbackOrganizerName: string;
  mexico?: boolean;
  argentina?: boolean;
}) {
  const setup = defaultDonationSetup(
    input.argentina ? "argentina" : input.mexico ? "mexico" : false,
  );
  const story = input.story.trim();
  const summarySource = story.replace(/\s+/g, " ");
  const summary =
    summarySource.length >= 10
      ? summarySource.slice(0, 240)
      : "Campaign opened from a fundraiser request.";
  const currency = asFundraiserCurrency(input.currency);
  const seeded = duplicatedCampaignForm({
    organizerName: input.name.trim() || input.fallbackOrganizerName,
    fallbackOrganizerName: input.fallbackOrganizerName,
    checkoutSubtitle: null,
    socialProofText: null,
    storyHeading: null,
    recentDonationsDescription:
      "Every gift appears here so supporters can confirm their help was counted.",
    commentsDescription: "",
    thankYouTitle: "Thank you!",
    thankYouMessage:
      "Here’s your confirmation — and the official record of your gift.",
    goalAmount: setup.goalAmount,
    currency,
    options: setup.amounts.map((amount) => ({
      amount,
      suggested: amount === setup.suggestedAmount,
    })),
  });
  return {
    ...seeded,
    summary,
    story,
    currentAmount: Math.max(0, Math.trunc(input.priorRaisedCents) || 0),
    supporterCount: Math.max(0, Math.trunc(input.priorDonationCount) || 0),
    currency,
    status: "ACTIVE" as const,
  };
}
