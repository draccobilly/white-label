import { DeliveryStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { sendUtmifyOrder, type UtmifyPayload } from "@/lib/utmify";
import { resolveDeliverableUtmifyToken } from "@/lib/utmify-desk";

function backoffMs(attempt: number) {
  const base = Math.min(60 * 60 * 1000, 1500 * 2 ** Math.min(attempt, 9));
  return base + Math.floor(Math.random() * 750);
}

async function deliverOne(deliveryId: string) {
  const delivery = await prisma.integrationDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      affiliatePage: {
        include: {
          affiliate: true,
          campaign: { select: { company: { select: { isDefault: true } } } },
        },
      },
    },
  });
  if (!delivery) return;
  if (
    delivery.status === DeliveryStatus.SUCCEEDED ||
    delivery.status === DeliveryStatus.CANCELLED
  ) {
    return;
  }

  const claimed = await prisma.integrationDelivery.updateMany({
    where: {
      id: delivery.id,
      status: { in: [DeliveryStatus.PENDING, DeliveryStatus.FAILED] },
    },
    data: {
      status: DeliveryStatus.PROCESSING,
      attemptCount: { increment: 1 },
    },
  });
  if (!claimed.count) return;

  try {
    if (
      delivery.idempotencyKey.startsWith("meta-capi:") ||
      delivery.idempotencyKey.includes(":waiting_payment")
    ) {
      await prisma.integrationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: DeliveryStatus.CANCELLED,
          lastError: "Meta and pending Utmify events are disabled; paid Utmify only",
        },
      });
      return;
    }
    const token = resolveDeliverableUtmifyToken({
      pageTokenEnc: delivery.affiliatePage.utmifyTokenEnc,
      affiliateTokenEnc: delivery.affiliatePage.affiliate.defaultUtmifyTokenEnc,
      companyIsDefault: delivery.affiliatePage.campaign.company?.isDefault,
    });
    if (!token) {
      throw new Error("This affiliate has no Utmify credential");
    }
    const responseBody = await sendUtmifyOrder(
      token,
      delivery.payload as unknown as UtmifyPayload,
    );
    await prisma.integrationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: DeliveryStatus.SUCCEEDED,
        responseBody: responseBody.slice(0, 4000),
        lastError: null,
        succeededAt: new Date(),
      },
    });
  } catch (error) {
    const attempt = delivery.attemptCount + 1;
    const permanent = attempt >= delivery.maxAttempts;
    await prisma.integrationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: permanent ? DeliveryStatus.FAILED : DeliveryStatus.PENDING,
        lastError: (error instanceof Error ? error.message : "Unknown delivery error").slice(
          0,
          2000,
        ),
        nextAttemptAt: new Date(Date.now() + backoffMs(attempt)),
      },
    });
  }
}

export async function processPendingDeliveries(limit = 25) {
  await prisma.integrationDelivery.updateMany({
    where: {
      status: { in: [DeliveryStatus.PENDING, DeliveryStatus.FAILED, DeliveryStatus.PROCESSING] },
      OR: [
        { idempotencyKey: { startsWith: "meta-capi:" } },
        { idempotencyKey: { contains: ":waiting_payment" } },
      ],
    },
    data: {
      status: DeliveryStatus.CANCELLED,
      lastError: "Meta and pending Utmify events are disabled; paid Utmify only",
    },
  });
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
  await prisma.integrationDelivery.updateMany({
    where: {
      status: DeliveryStatus.PROCESSING,
      updatedAt: { lt: staleBefore },
    },
    data: {
      status: DeliveryStatus.PENDING,
      lastError: "Retry after a worker disconnect",
      nextAttemptAt: new Date(),
    },
  });
  const due = await prisma.integrationDelivery.findMany({
    where: {
      status: { in: [DeliveryStatus.PENDING, DeliveryStatus.FAILED] },
      nextAttemptAt: { lte: new Date() },
      attemptCount: { lt: 8 },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: Math.min(100, Math.max(1, limit)),
    select: { id: true },
  });
  for (const delivery of due) {
    await deliverOne(delivery.id);
  }
  return due.length;
}
