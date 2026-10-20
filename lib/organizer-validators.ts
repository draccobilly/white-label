import { z } from "zod";

const url = z.string().trim().url().max(2000);
const optionalUrl = url.optional().nullable().or(z.literal(""));

export const organizerLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export const organizerForgotSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

export const organizerResetSchema = z.object({
  token: z.string().min(20).max(400),
  password: z.string().min(8).max(128),
});

export const organizerPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  password: z.string().min(8).max(128),
});

/** Fields an organizer may change on their own campaign. Money and status stay with the panel. */
export const organizerCampaignEditSchema = z.object({
  title: z.string().trim().min(5).max(255),
  summary: z.string().trim().min(10).max(500),
  story: z.string().trim().min(20).max(60_000),
  coverImageUrl: optionalUrl,
  organizerImageUrl: optionalUrl,
  videoUrl: optionalUrl,
  galleryImageUrls: z
    .array(url.or(z.literal("")))
    .max(12)
    .optional()
    .transform((urls) => (urls ?? []).filter((item): item is string => Boolean(item))),
});

export const organizerUpdateSchema = z.object({
  title: z.string().trim().max(255).optional().nullable(),
  body: z.string().trim().min(1).max(10_000),
});

export const payoutRequestSchema = z.object({
  /** Cents. `null` means everything available. */
  amount: z.number().int().positive().max(1_000_000_000).nullable(),
  accountHolderName: z.string().trim().min(3).max(160),
  holderAddress: z.string().trim().min(8).max(600),
  holderCountry: z.string().trim().min(2).max(80),
  bankName: z.string().trim().min(2).max(160),
  bankCountry: z.string().trim().min(2).max(80),
  bankAddress: z.string().trim().max(600).optional().default(""),
  accountNumber: z.string().trim().min(4).max(64),
  accountType: z.enum(["checking", "savings", ""]).optional().default(""),
  routingNumber: z.string().trim().max(40).optional().default(""),
  swiftBic: z
    .string()
    .trim()
    .toUpperCase()
    .max(11)
    .optional()
    .default("")
    .refine((value) => value === "" || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value), {
      message: "SWIFT / BIC is 8 or 11 letters and digits.",
    }),
  intermediaryBank: z.string().trim().max(600).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export type PayoutRequestInput = z.infer<typeof payoutRequestSchema>;

export const payoutStatusSchema = z.enum(["PENDING", "APPROVED", "PAID", "REJECTED"]);

export const payoutStatusUpdateSchema = z
  .object({
    status: payoutStatusSchema.optional(),
    internalNote: z.string().max(4000).optional(),
  })
  .refine((value) => value.status !== undefined || value.internalNote !== undefined, {
    message: "Nothing to update",
  });

export const organizerLinkSchema = z.object({
  campaignId: z.string().uuid(),
  /** `true` links the campaign to this organizer; `false` removes the link. */
  link: z.boolean(),
});
