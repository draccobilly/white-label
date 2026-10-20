import { describe, expect, it } from "vitest";
import { campaignSeedFromFundraiser } from "@/lib/fundraiser-campaign-seed";
import {
  fundraiserCurrency,
  priorDonationCountFromInput,
  priorRaisedCentsFromInput,
  priorWholeNumber,
} from "@/lib/fundraiser-prior";
import { shareStorySchema } from "@/lib/validators";

const story =
  "I would like you to know about a neighbor who needs help covering treatment and a safer place to live this winter.";

describe("fundraiser prior totals", () => {
  it("reads an empty raised amount and donation count as zero", () => {
    expect(priorRaisedCentsFromInput("", "USD")).toBe(0);
    expect(priorRaisedCentsFromInput("0", "USD")).toBe(0);
    expect(priorDonationCountFromInput("")).toBe(0);
    expect(priorDonationCountFromInput("0")).toBe(0);
    expect(priorWholeNumber("")).toBe(0);
    expect(priorWholeNumber(undefined)).toBe(0);
  });

  it("keeps a prior raised amount and donation count for the public page", () => {
    expect(priorRaisedCentsFromInput("1500.50", "USD")).toBe(150_050);
    expect(priorRaisedCentsFromInput("1.500,50", "ARS")).toBe(150_050);
    expect(priorDonationCountFromInput("31")).toBe(31);
    expect(fundraiserCurrency("es-MX")).toBe("MXN");
    expect(fundraiserCurrency("es-AR")).toBe("ARS");
    expect(fundraiserCurrency("en")).toBe("USD");
  });

  it("rejects amounts and counts the campaign cannot store", () => {
    expect(priorRaisedCentsFromInput("abc", "USD")).toBeNull();
    expect(priorDonationCountFromInput("31.5")).toBeNull();
    expect(priorWholeNumber("nope")).toBe(-1);
  });

  it("accepts a fundraiser form that declares money already raised", () => {
    const parsed = shareStorySchema.safeParse({
      about: "someone",
      name: "Maya R",
      email: "maya@example.com",
      whatsapp: "+1 985 379 7831",
      address: "Hammond, Louisiana, United States",
      story,
      consentData: true,
      consentImage: false,
      consentTerms: true,
      priorRaisedCents: 150_050,
      priorDonationCount: 31,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.priorRaisedCents).toBe(150_050);
    expect(parsed.data.priorDonationCount).toBe(31);
  });

  it("still accepts a fundraiser form that starts from zero", () => {
    const parsed = shareStorySchema.safeParse({
      about: "someone",
      name: "Maya R",
      email: "maya@example.com",
      whatsapp: "+1 985 379 7831",
      address: "Hammond, Louisiana, United States",
      story,
      consentData: true,
      consentImage: false,
      consentTerms: true,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.priorRaisedCents).toBe(0);
    expect(parsed.data.priorDonationCount).toBe(0);
  });

  it("copies the organizer totals into Raised and Donations on the new campaign", () => {
    const seed = campaignSeedFromFundraiser({
      name: "Maya R",
      story,
      priorRaisedCents: 150_050,
      priorDonationCount: 31,
      currency: "USD",
      fallbackOrganizerName: "this organization",
    });
    expect(seed.currentAmount).toBe(150_050);
    expect(seed.supporterCount).toBe(31);
    expect(seed.currency).toBe("USD");
    expect(seed.organizerName).toBe("Maya R");
    expect(seed.story).toBe(story);
    expect(seed.status).toBe("ACTIVE");
  });
});
