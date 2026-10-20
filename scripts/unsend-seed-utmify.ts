import "dotenv/config";
import { DeliveryStatus, SaleStatus } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { buildUtmifyPayload } from "../lib/utmify";
import { processPendingDeliveries } from "../lib/outbox";
import { SOCIAL_SEED_SESSION_PREFIX } from "../lib/social-proof";

function jsonPayload(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function main() {
  const sales = await prisma.sale.findMany({
    where: {
      livemode: true,
      status: SaleStatus.PAID,
      stripeCheckoutSessionId: { startsWith: SOCIAL_SEED_SESSION_PREFIX },
      deliveries: {
        some: { idempotencyKey: { startsWith: "utmify:" } },
      },
    },
    include: {
      checkoutIntent: true,
      campaign: { select: { title: true } },
      affiliate: { select: { name: true, defaultUtmifyTokenEnc: true } },
      affiliatePage: { select: { id: true, utmifyTokenEnc: true } },
    },
    orderBy: { paidAt: "desc" },
  });
  console.log(`Marking ${sales.length} social-proof seed sales as refunded in Utmify.`);

  const refundedAt = new Date();
  let queued = 0;
  for (const sale of sales) {
    if (!sale.affiliatePage.utmifyTokenEnc && !sale.affiliate.defaultUtmifyTokenEnc) {
      continue;
    }
    const payload = buildUtmifyPayload({
      saleId: sale.id,
      orderId: sale.stripePaymentIntentId || sale.stripeCheckoutSessionId || sale.id,
      affiliatePageId: sale.affiliatePageId,
      campaignTitle: sale.campaign.title,
      affiliateName: sale.affiliate.name,
      amount: sale.amount,
      gatewayFee: sale.gatewayFee,
      currency: sale.currency,
      customerName: sale.customerName,
      customerEmail: sale.customerEmail,
      paymentMethod: sale.paymentMethod,
      status: "refunded",
      createdAt: sale.createdAt,
      paidAt: sale.paidAt,
      refundedAt,
      clientIp: sale.checkoutIntent.clientIp,
      attribution: sale.checkoutIntent,
    });
    await prisma.integrationDelivery.upsert({
      where: { idempotencyKey: `utmify:${sale.id}:refunded` },
      create: {
        affiliatePageId: sale.affiliatePage.id,
        saleId: sale.id,
        idempotencyKey: `utmify:${sale.id}:refunded`,
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
  }

  let flushed = 0;
  for (let round = 1; round <= 20; round += 1) {
    const batch = await processPendingDeliveries(25);
    flushed += batch;
    console.log(`Flush round ${round}: ${batch}`);
    if (batch === 0) break;
  }
  console.log(`Queued ${queued} seed refunds; flushed ${flushed} jobs.`);
}

main()
  .catch((error) => {
    console.error("Could not unsend seed Utmify orders", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
