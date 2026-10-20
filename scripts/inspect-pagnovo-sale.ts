import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const externalId = process.argv[2]?.trim();
  const transactionId = process.argv[3]?.trim();
  if (!externalId) {
    throw new Error(
      "Usage: npx tsx scripts/inspect-pagnovo-sale.ts <external_id> [transaction_id]",
    );
  }

  const intent = await prisma.checkoutIntent.findUnique({
    where: { id: externalId },
    include: {
      sale: true,
      affiliatePage: {
        include: {
          campaign: { include: { company: true } },
          affiliate: true,
        },
      },
    },
  });
  if (!intent) {
    const byTx = transactionId
      ? await prisma.checkoutIntent.findUnique({
          where: { pagnovoTransactionId: transactionId },
          include: {
            sale: true,
            affiliatePage: {
              include: {
                campaign: { include: { company: true } },
                affiliate: true,
              },
            },
          },
        })
      : null;
    if (!byTx) {
      throw new Error(`No checkout intent ${externalId}`);
    }
    printIntent(byTx);
    return;
  }
  printIntent(intent);
}

function printIntent(intent: {
  id: string;
  amount: number;
  currency: string;
  landingUrl: string | null;
  pagnovoTransactionId: string | null;
  affiliatePage: {
    affiliate: { slug: string };
    campaign: {
      title: string;
      slug: string;
      company: { name: string; slug: string } | null;
    };
  };
  sale: {
    id: string;
    status: string;
    livemode: boolean;
    gateway: string;
    paidAt: Date | null;
  } | null;
}) {
  console.log({
    intentId: intent.id,
    amount: intent.amount / 100,
    currency: intent.currency,
    campaign: intent.affiliatePage.campaign.title,
    slug: intent.affiliatePage.campaign.slug,
    company: intent.affiliatePage.campaign.company?.name,
    companySlug: intent.affiliatePage.campaign.company?.slug,
    affiliate: intent.affiliatePage.affiliate.slug,
    landingUrl: intent.landingUrl,
    pagnovoTransactionId: intent.pagnovoTransactionId,
    saleId: intent.sale?.id ?? null,
    saleStatus: intent.sale?.status ?? null,
    saleLivemode: intent.sale?.livemode ?? null,
    saleGateway: intent.sale?.gateway ?? null,
    paidAt: intent.sale?.paidAt ?? null,
  });
  if (intent.sale?.status === "PAID") {
    console.log(
      "This payment is in the database. Open admin and switch the company selector to that company.",
    );
    return;
  }
  console.log(
    "Checkout exists but there is no PAID sale. The PagNovo webhook did not persist it.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
