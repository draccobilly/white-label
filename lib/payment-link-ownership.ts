import type { Prisma } from "@/generated/prisma/client";

type PaymentLinkWriter = Prisma.TransactionClient | Prisma.DefaultPrismaClient;

export async function assertExclusiveStripePaymentLink(
  tx: PaymentLinkWriter,
  input: {
    stripePaymentLinkId: string | null;
    affiliatePageId: string;
    donationOptionId?: string;
  },
) {
  if (!input.stripePaymentLinkId) return;
  const page = await tx.affiliatePage.findUnique({
    where: { id: input.affiliatePageId },
    select: { affiliateId: true },
  });
  if (!page) return;

  const taken = await tx.paymentLink.findFirst({
    where: {
      stripePaymentLinkId: input.stripePaymentLinkId,
      NOT: input.donationOptionId
        ? {
            affiliatePageId: input.affiliatePageId,
            donationOptionId: input.donationOptionId,
          }
        : { affiliatePageId: input.affiliatePageId },
    },
    include: {
      affiliatePage: { include: { affiliate: { select: { name: true } } } },
    },
  });
  if (!taken) return;
  const samePage = taken.affiliatePageId === input.affiliatePageId;
  if (samePage) {
    throw new Error(
      "This Stripe Payment Link is already used on another amount. Each buy.stripe.com link can only cover one price.",
    );
  }
  if (taken.affiliatePage.affiliateId !== page.affiliateId) {
    throw new Error(
      `This Stripe Payment Link already belongs to ${taken.affiliatePage.affiliate.name}. Each plink_ can only track one affiliate.`,
    );
  }
}

export function assertUniqueStripePaymentLinksInBatch(
  links: Array<{ stripePaymentLinkId: string | null }>,
) {
  const seen = new Set<string>();
  for (const link of links) {
    if (!link.stripePaymentLinkId) continue;
    if (seen.has(link.stripePaymentLinkId)) {
      throw new Error(
        "The same Stripe Payment Link was pasted on more than one amount. Each price needs its own buy.stripe.com link.",
      );
    }
    seen.add(link.stripePaymentLinkId);
  }
}

export async function saveResolvedPaymentLinks(
  db: PaymentLinkWriter,
  affiliatePageId: string,
  links: Array<{
    donationOptionId: string;
    url: string;
    stripeCheckoutUrl: string | null;
    stripePaymentLinkId: string | null;
  }>,
) {
  assertUniqueStripePaymentLinksInBatch(links);
  for (const link of links) {
    await assertExclusiveStripePaymentLink(db, {
      stripePaymentLinkId: link.stripePaymentLinkId,
      affiliatePageId,
      donationOptionId: link.donationOptionId,
    });
    await db.paymentLink.upsert({
      where: {
        affiliatePageId_donationOptionId: {
          affiliatePageId,
          donationOptionId: link.donationOptionId,
        },
      },
      update: {
        url: link.url,
        stripeCheckoutUrl: link.stripeCheckoutUrl,
        stripePaymentLinkId: link.stripePaymentLinkId,
        active: true,
      },
      create: {
        affiliatePageId,
        donationOptionId: link.donationOptionId,
        url: link.url,
        stripeCheckoutUrl: link.stripeCheckoutUrl,
        stripePaymentLinkId: link.stripePaymentLinkId,
      },
    });
  }
}
