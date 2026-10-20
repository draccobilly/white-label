import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type DbClient = Prisma.TransactionClient | PrismaClient;

/** Conversions go to Utmify only. Do not queue Meta CAPI. */
export async function enqueueMetaCapi(
  _tx: DbClient,
  _input: {
    sale: {
      id: string;
      affiliatePageId: string;
      amount: number;
      currency: string;
      customerEmail: string | null;
      paidAt: Date | null;
      livemode: boolean;
    };
    page: {
      id: string;
      fbPixelId?: string | null;
    };
    campaign: {
      slug: string;
      company?: { publicPathPrefix?: string | null } | null;
    };
    affiliate: {
      slug: string;
      defaultFbPixelId?: string | null;
    };
    intent: {
      src?: string | null;
      sck?: string | null;
      landingUrl?: string | null;
      clientIp?: string | null;
      userAgent?: string | null;
      fbp?: string | null;
      fbc?: string | null;
    };
  },
) {
  return;
}
