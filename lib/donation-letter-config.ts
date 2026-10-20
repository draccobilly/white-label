/**
 * Who issues the donation acknowledgment letter and when.
 * Fill these values from Admin → Settings and this file after go-live.
 */
export const DONATION_LETTER = {
  /**
   * Gifts of this amount or more get the letter automatically, attached to
   * the thank-you e-mail (IRS: written acknowledgment for $250 or more).
   * Smaller gifts get it on request, from the panel.
   */
  automaticFromCents: 25_000,
  /** Only gifts settled in this currency get a letter. */
  currency: "USD",
  organization: {
    legalName: process.env.APP_NAME?.trim() || "the organization",
    ein: "",
    exemptSection: "501(c)(3)",
    addressLines: [] as string[],
    contactEmail: "",
  },
  signer: {
    name: "",
    title: "",
  },
  timeZone: process.env.TZ?.trim() || "America/Los_Angeles",
} as const;
