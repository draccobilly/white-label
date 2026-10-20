import { z } from "zod";
import { normalizePublicCheckoutUrl } from "@/lib/checkout-links";
import { REFUND_REASON_VALUES } from "@/lib/refund-reasons";

const optionalText = z
  .string()
  .trim()
  .max(240)
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value || "");

const optionalTrackingValue = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((value) => value || null);

export const attributionSchema = z.object({
  src: optionalTrackingValue,
  sck: optionalTrackingValue,
  utmSource: optionalTrackingValue,
  utmMedium: optionalTrackingValue,
  utmCampaign: optionalTrackingValue,
  utmContent: optionalTrackingValue,
  utmTerm: optionalTrackingValue,
  fbp: optionalTrackingValue,
  fbc: optionalTrackingValue,
  landingUrl: z.string().url().max(4000).optional().nullable(),
  referrer: z.string().max(4000).optional().nullable(),
});

export const affiliateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z
    .union([z.literal(""), z.string().trim().email()])
    .optional()
    .nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  active: z.boolean().default(true),
  utmifyWebhookUrl: z.string().trim().max(2000).optional().nullable().or(z.literal("")),
  utmifyToken: z.string().trim().max(500).optional().nullable().or(z.literal("")),
  utmifyPixelScript: z.string().trim().max(20_000).optional().nullable().or(z.literal("")),
});

const CAMPAIGN_FIELD_LABELS: Record<string, string> = {
  title: "Campaign title",
  slug: "Public slug",
  organizerName: "Organizer name",
  organizerImageUrl: "Organizer photo",
  summary: "Summary",
  story: "Story",
  coverImageUrl: "Cover image",
  galleryImageUrls: "Gallery photo",
  verificationDocumentUrls: "Verification document",
  verificationNote: "Verification note",
  checkoutSubtitle: "Checkout subtitle",
  socialProofText: "Social proof text",
  storyHeading: "Story heading",
  recentDonationsDescription: "Recent donations text",
  commentsDescription: "Comments text",
  thankYouTitle: "Thank you title",
  thankYouMessage: "Thank you message",
  goalAmount: "Goal amount",
  nextGoals: "Goal stages",
  displayPaidPercent: "Paid percent",
  amounts: "Donation amounts",
  suggestedAmount: "Suggested amount",
  showMissionTip: "Mission tip",
  missionTipBold: "Mission tip bold",
  updates: "Campaign update",
  gatewayNames: "Product name on Stripe/PayPal",
};

const NUMERIC_CAMPAIGN_FIELDS = new Set([
  "goalAmount",
  "nextGoals",
  "currentAmount",
  "supporterCount",
  "displayPaidPercent",
  "amounts",
  "suggestedAmount",
  "coverFocusX",
  "coverFocusY",
]);

function issueKind(issue: unknown) {
  if (!issue || typeof issue !== "object" || !("origin" in issue)) return "";
  return typeof issue.origin === "string" ? issue.origin : "";
}

export function campaignSchemaError(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Invalid campaign";
  const key = issue.path.find((part) => typeof part === "string");
  const label = (key && CAMPAIGN_FIELD_LABELS[key]) || "This field";
  const kind = issueKind(issue);
  const numeric =
    kind === "number" || (typeof key === "string" && NUMERIC_CAMPAIGN_FIELDS.has(key));
  if (issue.code === "too_big") {
    const max = "maximum" in issue ? String(issue.maximum) : null;
    if (kind === "array") {
      return max ? `${label} has too many items (max ${max}).` : `${label} has too many items.`;
    }
    if (numeric) {
      return max ? `${label} is too large (max ${max}).` : `${label} is too large.`;
    }
    return max ? `${label} is too long (max ${max} characters).` : `${label} is too long.`;
  }
  if (issue.code === "too_small") {
    const min = "minimum" in issue ? String(issue.minimum) : null;
    if (kind === "array") {
      return min ? `${label} needs at least ${min} item(s).` : `${label} needs more items.`;
    }
    if (numeric) {
      return min ? `${label} is too small (min ${min}).` : `${label} is too small.`;
    }
    return min ? `${label} is too short (min ${min} characters).` : `${label} is too short.`;
  }
  return `${label}: ${issue.message}`;
}

export const campaignSchema = z.object({
  title: z.string().trim().min(5).max(255),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  organizerName: z.string().trim().min(2).max(120),
  organizerImageUrl: z.string().url().optional().nullable().or(z.literal("")),
  organizerVerified: z.boolean().optional().default(true),
  organizerBoldText: z.string().trim().max(500).optional().default(""),
  titleBoldText: z.string().trim().max(2000).optional().default(""),
  summary: z.string().trim().min(10).max(500),
  story: z.string().trim().min(20).max(60_000),
  category: z.string().trim().max(80).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable().or(z.literal("")),
  coverFocusX: z.number().int().min(0).max(100).optional(),
  coverFocusY: z.number().int().min(0).max(100).optional(),
  galleryImageUrls: z
    .array(z.string().trim().url().or(z.literal("")))
    .max(24)
    .optional()
    .transform((urls) =>
      (urls ?? []).filter((url): url is string => Boolean(url)),
    ),
  verificationDocumentUrls: z
    .array(z.string().trim().url().or(z.literal("")))
    .max(12)
    .optional()
    .transform((urls) =>
      (urls ?? []).filter((url): url is string => Boolean(url)),
    ),
  verificationNote: z.string().trim().max(180).optional().default(""),
  videoUrl: z.string().url().optional().nullable().or(z.literal("")),
  checkoutSubtitle: z.string().trim().max(180).optional().nullable(),
  socialProofText: z.string().trim().max(180).optional().nullable(),
  storyHeading: z.string().trim().max(120).optional(),
  recentDonationsDescription: z.string().trim().min(3).max(300),
  commentsDescription: z.string().trim().max(300).optional(),
  thankYouTitle: z.string().trim().min(3).max(120).optional(),
  thankYouMessage: z.string().trim().min(3).max(500).optional(),
  goalAmount: z.number().int().positive().max(1_000_000_000),
  /** Goals after the first, cents, ascending. Stored with goalAmount as Campaign.goalStages. */
  nextGoals: z.array(z.number().int().positive().max(1_000_000_000)).max(5).optional(),
  currentAmount: z.number().int().min(0).max(1_000_000_000).optional(),
  supporterCount: z.number().int().min(0).max(10_000_000).optional(),
  /** Percent of paid gifts added to the baseline on the public page. 1 = 1%. */
  displayPaidPercent: z.number().int().min(0).max(100).optional().default(1),
  currency: z.enum(["USD", "EUR", "GBP", "BRL", "CAD", "MXN", "ARS"]),
  amounts: z.array(z.number().int().positive().max(1_000_000_000)).min(1).max(20),
  suggestedAmount: z.number().int().positive().max(1_000_000_000),
  showMissionTip: z.boolean().optional().default(true),
  missionTipBold: z.boolean().optional().default(false),
  unlisted: z.boolean().optional().default(true),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).default("ACTIVE"),
  updates: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().trim().max(255).optional().nullable(),
        body: z.string().trim().min(1).max(10_000),
        createdAt: z.string().datetime().optional(),
      }),
    )
    .max(50)
    .optional(),
  /** Product names for Stripe/PayPal/PagNovo, one per entry, each with {amount}. */
  gatewayNames: z.array(z.string().trim().max(200)).max(30).optional(),
});

/** Text the model writes gateway product names from; same bounds as the campaign. */
export const gatewayNamesRequestSchema = z.object({
  title: z.string().trim().min(5).max(255),
  category: z.string().trim().max(80).optional().nullable(),
  summary: z.string().trim().max(500).optional().nullable(),
  story: z.string().trim().max(60_000).optional().nullable(),
});

const paymentLinkItemSchema = z.object({
  donationOptionId: z.string().uuid(),
  url: z
    .string()
    .trim()
    .min(3)
    .max(2000)
    .transform((value, ctx) => {
      try {
        return normalizePublicCheckoutUrl(value);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          message: error instanceof Error ? error.message : "Enter a valid t.co shortlink",
        });
        return z.NEVER;
      }
    }),
  stripeCheckoutUrl: z
    .string()
    .trim()
    .min(3)
    .max(2000),
  stripePaymentLinkId: optionalText,
});

export const paymentLinksSchema = z.object({
  paymentLinks: z.array(paymentLinkItemSchema).min(1),
  deactivateOtherLinks: z.boolean().optional().default(false),
});

export const integrationSchema = z.object({
  affiliatePageId: z.string().uuid(),
  fbPixelId: optionalText,
  googlePixelId: optionalText,
  tiktokPixelId: optionalText,
  paymentLinks: z.array(paymentLinkItemSchema),
  deactivateOtherLinks: z.boolean().optional().default(false),
});

/** Accepted for older clients, then discarded — tips are not chargeable. */
const checkoutTipAmount = z
  .number()
  .int()
  .min(0)
  .max(10_000_000)
  .optional()
  .transform(() => 0);
const checkoutHideName = z.boolean().optional();
const visitorSessionId = z.string().trim().min(8).max(100).optional();

export const redirectSchema = z.object({
  paymentLinkId: z.string().uuid(),
  attribution: attributionSchema.partial().optional(),
  comment: z.string().trim().max(280).optional().nullable(),
  tipAmount: checkoutTipAmount,
  hideName: checkoutHideName,
  visitorSessionId,
});

export const embeddedCheckoutSchema = z
  .object({
    affiliatePageId: z.string().uuid(),
    donationOptionId: z.string().uuid().optional(),
    amountCents: z.number().int().positive().max(100_000_000).optional(),
    tipCents: z.union([z.literal(0), z.literal(500)]).optional(),
    attribution: attributionSchema.partial().optional(),
    comment: z.string().trim().max(280).optional().nullable(),
    hideName: checkoutHideName,
    visitorSessionId,
    causeSlug: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((value) => (value && /^[a-z0-9-]+$/.test(value) ? value : undefined)),
  })
  .refine((value) => Boolean(value.donationOptionId || value.amountCents), {
    message: "Invalid checkout request",
  });

export const walletConfirmSchema = z.object({
  paymentIntentId: z.string().trim().min(3).max(255),
});

export const commentSchema = z.object({
  saleId: z.string().uuid(),
  authorName: z.string().trim().min(2).max(80),
  body: z.string().trim().min(3).max(280),
  parentId: z.string().uuid().optional().nullable(),
});

export const refundRequestSchema = z.object({
  trackingCode: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) => (value && value.length ? value : undefined)),
  email: z.string().trim().email().max(320),
  name: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value && value.length ? value : undefined)),
  amountNote: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value && value.length ? value : undefined)),
  reason: z.enum(REFUND_REASON_VALUES),
  details: z.string().trim().min(3).max(1000),
});

export const companySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80)
    .optional(),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .optional()
    .nullable()
    .transform((value) => {
      const raw = (value || "").trim().toLowerCase();
      if (!raw) return null;
      return raw.replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0] || null;
    })
    .refine(
      (value) =>
        !value ||
        value === "localhost" ||
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(value),
      "Enter a hostname like giving.example.com",
    ),
  publicPathPrefix: z
    .string()
    .trim()
    .toLowerCase()
    .max(40)
    .optional()
    .nullable()
    .transform((value) => {
      const raw = value?.trim() || "";
      if (!raw || raw === "/") return null;
      return raw.startsWith("/") ? raw : `/${raw}`;
    })
    .refine(
      (value) => !value || /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
      "Enter a path prefix like /mexico",
    ),
  landingTitle: z
    .string()
    .trim()
    .max(140)
    .optional()
    .transform((value) => (value && value.length >= 2 ? value : undefined)),
  landingBody: z.string().trim().max(20_000).optional(),
  locale: z.enum(["en", "es-MX", "es-AR"]).optional(),
  paymentGateway: z.enum(["STRIPE", "PAGNOVO"]).optional(),
  siteMode: z.enum(["CAMPAIGN", "INSTITUTIONAL"]).optional(),
  contactEmail: z
    .union([z.literal(""), z.string().trim().email().max(320)])
    .optional()
    .nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  contactAddress: z.string().trim().max(500).optional().nullable(),
  nonprofitEin: z.string().trim().max(40).optional().nullable(),
  pagnovoWebhookSecret: z.string().trim().max(500).optional().nullable(),
  nonprofitListed: z.boolean().optional(),
  nonprofitName: z.string().trim().max(120).optional().nullable(),
  nonprofitDescription: z.string().trim().max(500).optional().nullable(),
  nonprofitLogoUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((value) => {
      const raw = value?.trim() || "";
      return raw || null;
    })
    .refine(
      (value) => !value || /^https?:\/\//i.test(value),
      "Enter a logo URL starting with https://",
    ),
});

export const companyLayoutSchema = z.object({
  companyId: z.string().uuid(),
  campaignLayout: z.enum(["CLASSIC", "IMPACT"]),
});

export const companyImpactLogoSchema = z.object({
  companyId: z.string().uuid(),
  impactLogoUrl: z.string().url().nullable().or(z.literal("")),
});

export const pagnovoPurchaseSchema = z.object({
  affiliatePageId: z.string().uuid(),
  donationOptionId: z.string().uuid(),
  paymentMethod: z.enum(["SPEI", "CREDIT_CARD", "BANK_TRANSFER"]),
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(255),
  attribution: attributionSchema.partial().optional(),
  tipAmount: checkoutTipAmount,
  hideName: checkoutHideName,
  comment: z.string().trim().max(280).optional().nullable(),
  visitorSessionId,
  creditCard: z
    .object({
      token: z.string().trim().min(4).max(500),
      holder: z.string().trim().min(2).max(120),
      brand: z.string().trim().max(40).optional(),
      last4: z.string().regex(/^\d{4}$/).optional(),
    })
    .optional(),
});

export function sanitizePixelId(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{5,64}$/.test(trimmed) ? trimmed : null;
}

/** Events Manager Pixel ID is digits only. Rejects Utmify hex IDs. */
export function sanitizeMetaPixelId(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{8,20}$/.test(trimmed) ? trimmed : null;
}

export const sitePostSchema = z.object({
  kind: z.enum(["NEWS", "FIELD_UPDATE", "PROGRAM"]),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  title: z.string().trim().min(3).max(160),
  excerpt: z.string().trim().min(12).max(400),
  body: z.string().trim().max(40_000),
  coverImageUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((value) => {
      const raw = value?.trim() || "";
      return raw || null;
    })
    .refine(
      (value) => !value || /^https?:\/\//i.test(value),
      "Enter a cover image URL starting with https://",
    ),
  publishedAt: z.string().datetime().optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.kind === "PROGRAM") {
    if (!value.coverImageUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["coverImageUrl"],
        message: "Upload a photo or video for this program card.",
      });
    }
    return;
  }
  if (value.body.trim().length < 40) {
    ctx.addIssue({
      code: "custom",
      path: ["body"],
      message: "Write at least a short body for this post.",
    });
  }
});

export const shareStorySchema = z.object({
  about: z.enum(["myself", "someone"]),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  whatsapp: z.string().trim().min(8).max(40),
  address: z.string().trim().min(8).max(400),
  story: z.string().trim().min(40).max(8000),
  consentData: z.literal(true),
  consentImage: z.boolean(),
  consentTerms: z.literal(true, {
    error: "Accept the Terms before sending your campaign.",
  }),
  /** Cents already raised before this campaign opened here. Blank is zero. */
  priorRaisedCents: z.number().int().min(0).max(1_000_000_000).optional().default(0),
  /** Gifts that starting total came from. Blank is zero. */
  priorDonationCount: z.number().int().min(0).max(10_000_000).optional().default(0),
  mediaUrls: z.array(z.string().url().max(2000)).max(8).optional().default([]),
});

