import "dotenv/config";
import { DeliveryStatus, SaleStatus } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { excludeSocialSeedSales } from "../lib/sale-filters";
import { buildUtmifyPayload } from "../lib/utmify";
import { envUtmifyApiToken } from "../lib/utmify-desk";
import { processPendingDeliveries } from "../lib/outbox";

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

function jsonPayload(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function main() {
  const since = new Date(Date.now() - LOOKBACK_MS);
  const sales = await prisma.sale.findMany({
    where: {
      livemode: true,
      status: SaleStatus.PAID,
      gateway: "stripe",
      paidAt: { gte: since },
      stripePaymentIntentId: { not: null },
      ...excludeSocialSeedSales,
    },
    include: {
      checkoutIntent: true,
      campaign: { select: { title: true } },
      affiliate: { select: { name: true, defaultUtmifyTokenEnc: true } },
      affiliatePage: { select: { id: true, utmifyTokenEnc: true } },
    },
    orderBy: { paidAt: "desc" },
  });
  console.log(`Resending Utmify paid orders for ${sales.length} live Stripe sales (7 days).`);

  let queued = 0;
  for (const sale of sales) {
    if (
      !sale.affiliatePage.utmifyTokenEnc &&
      !sale.affiliate.defaultUtmifyTokenEnc &&
      !envUtmifyApiToken()
    ) {
      continue;
    }
    const payload = buildUtmifyPayload({
      saleId: sale.id,
      orderId:
        sale.stripePaymentIntentId || sale.stripeCheckoutSessionId || sale.id,
      affiliatePageId: sale.affiliatePageId,
      campaignTitle: sale.campaign.title,
      affiliateName: sale.affiliate.name,
      amount: sale.amount,
      gatewayFee: sale.gatewayFee,
      currency: sale.currency,
      customerName: sale.customerName,
      customerEmail: sale.customerEmail,
      paymentMethod: sale.paymentMethod,
      status: "paid",
      createdAt: sale.paidAt ?? sale.createdAt,
      paidAt: sale.paidAt,
      clientIp: sale.checkoutIntent.clientIp,
      attribution: sale.checkoutIntent,
    });
    await prisma.integrationDelivery.upsert({
      where: { idempotencyKey: `utmify:${sale.id}:paid` },
      create: {
        affiliatePageId: sale.affiliatePage.id,
        saleId: sale.id,
        idempotencyKey: `utmify:${sale.id}:paid`,
        payload: jsonPayload(payload),
        status: DeliveryStatus.PENDING,
        nextAttemptAt: new Date(),
      },
      update: {
        payload: jsonPayload(payload),
        status: DeliveryStatus.PENDING,
        lastError: null,
        nextAttemptAt: new Date(),
        attemptCount: 0,
      },
    });
    queued += 1;
    console.log(
      `Queued ${sale.campaign.title} ${sale.amount / 100} → ${payload.orderId}`,
    );
  }

  let flushed = 0;
  for (let round = 1; round <= 20; round += 1) {
    const batch = await processPendingDeliveries(25);
    flushed += batch;
    console.log(`Flush round ${round}: ${batch}`);
    if (batch === 0) break;
  }
  console.log(`Resent ${queued} Utmify orders; flushed ${flushed} jobs.`);
}

main()
  .catch((error) => {
    console.error("Could not resync Stripe Utmify orders", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
