import { SaleStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { applyLiveDebit } from "@/lib/campaign-accounting";
import { prisma } from "@/lib/prisma";
import {
  capturePaypalOrder,
  getPaypalOrder,
  paypalCaptureFromOrder,
  paypalLivemode,
  type PaypalCaptureDetails,
} from "@/lib/paypal";
import {
  enqueueUtmify,
  notifyDonationPaid,
  recordPaidDonation,
  type RecordedPaidSession,
} from "@/lib/record-paid-session";
import { calculateRefundTransition } from "@/lib/stripe-attribution";
import { processPendingDeliveries } from "@/lib/outbox";

const intentInclude = {
  sale: true,
  donationOption: true,
  affiliatePage: {
    include: {
      campaign: {
        include: {
          company: { select: { publicPathPrefix: true, isDefault: true, siteMode: true, siteName: true } },
        },
      },
      affiliate: true,
    },
  },
} as const;

const saleInclude = {
  checkoutIntent: true,
  affiliatePage: true,
  campaign: { include: { company: { select: { isDefault: true } } } },
  affiliate: true,
} as const;

const intentIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function enrichPaypalPayer(details: PaypalCaptureDetails) {
  if ((details.payerName && details.payerEmail) || !details.orderId) return details;
  try {
    const richer = paypalCaptureFromOrder(await getPaypalOrder(details.orderId));
    if (!richer) return details;
    return {
      ...details,
      payerName: details.payerName || richer.payerName,
      payerEmail: details.payerEmail || richer.payerEmail,
      customId: details.customId || richer.customId,
    };
  } catch (error) {
    console.error("PayPal payer lookup failed", error);
    return details;
  }
}

export async function recordPaypalCapture(
  tx: Prisma.TransactionClient,
  details: PaypalCaptureDetails,
): Promise<RecordedPaidSession | null> {
  if (details.status !== "COMPLETED" || details.amountCents == null) return null;
  const intent = intentIdPattern.test(details.customId)
    ? await tx.checkoutIntent.findUnique({ where: { id: details.customId }, include: intentInclude })
    : details.orderId
      ? await tx.checkoutIntent.findUnique({
          where: { paypalOrderId: details.orderId },
          include: intentInclude,
        })
      : null;
  const page = intent?.affiliatePage;
  if (!intent || !page) return null;
  if (details.currency && details.currency !== intent.currency.toUpperCase()) {
    console.error("[paypal] currency mismatch", {
      intentId: intent.id,
      expected: intent.currency,
      received: details.currency,
    });
    return null;
  }
  if (details.orderId && !intent.paypalOrderId) {
    await tx.checkoutIntent.update({
      where: { id: intent.id },
      data: { paypalOrderId: details.orderId },
    });
  }
  return recordPaidDonation(tx, {
    intent,
    page,
    amount: details.amountCents,
    customerName: details.payerName || "Anonymous",
    customerEmail: details.payerEmail,
    paymentMethod: "paypal",
    livemode: paypalLivemode(),
    gateway: "paypal",
    gatewayFee: details.feeCents,
    paypalOrderId: details.orderId || null,
    paypalCaptureId: details.captureId,
    paidAt: details.paidAt,
  });
}

export async function finishPaypalCapture(details: PaypalCaptureDetails) {
  const recorded = await prisma.$transaction((tx) => recordPaypalCapture(tx, details));
  void notifyDonationPaid(recorded);
  void processPendingDeliveries(10).catch((error) => {
    console.error("Utmify outbox flush failed", error);
  });
  return recorded;
}

export async function captureAndRecordPaypalOrder(orderId: string) {
  const order = await capturePaypalOrder(orderId);
  const parsed = paypalCaptureFromOrder(order);
  if (!parsed) throw new Error("PayPal capture was empty");
  const details = await enrichPaypalPayer(parsed);
  if (details.status === "PENDING") {
    return { pending: true as const, intentId: details.customId, recorded: null };
  }
  if (details.status !== "COMPLETED") {
    throw new Error("PayPal capture was not completed");
  }
  const recorded = await finishPaypalCapture(details);
  return { pending: false as const, intentId: details.customId, recorded };
}

export async function markPaypalCaptureDenied(
  tx: Prisma.TransactionClient,
  details: PaypalCaptureDetails,
) {
  if (!intentIdPattern.test(details.customId)) return;
  const intent = await tx.checkoutIntent.findUnique({
    where: { id: details.customId },
    include: intentInclude,
  });
  const page = intent?.affiliatePage;
  if (!intent || !page) return;
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${intent.id}))`);
  const current = await tx.sale.findUnique({
    where: { checkoutIntentId: intent.id },
    select: { status: true },
  });
  if (current?.status === SaleStatus.PAID) return;
  const sale = await tx.sale.upsert({
    where: { checkoutIntentId: intent.id },
    update: {
      status: SaleStatus.FAILED,
      gateway: "paypal",
      paymentMethod: "paypal",
      gatewayLabel: intent.gatewayLabel?.trim() || undefined,
    },
    create: {
      checkoutIntentId: intent.id,
      affiliatePageId: page.id,
      campaignId: page.campaignId,
      affiliateId: page.affiliateId,
      paypalOrderId: details.orderId || null,
      paypalCaptureId: details.captureId || null,
      amount: intent.amount,
      currency: intent.currency,
      status: SaleStatus.FAILED,
      gatewayLabel: intent.gatewayLabel?.trim() || null,
      customerEmail: details.payerEmail,
      paymentMethod: "paypal",
      gateway: "paypal",
      livemode: paypalLivemode(),
    },
  });
  if (paypalLivemode()) {
    await enqueueUtmify(tx, {
      sale,
      page,
      campaign: page.campaign,
      affiliate: page.affiliate,
      intent,
      status: "refused",
    });
  }
}

async function findPaypalSale(tx: Prisma.TransactionClient, captureId: string) {
  if (!captureId) return null;
  return tx.sale.findFirst({
    where: { OR: [{ paypalCaptureId: captureId }, { paypalOrderId: captureId }] },
    include: saleInclude,
  });
}

export async function applyPaypalRefund(
  tx: Prisma.TransactionClient,
  input: { captureId: string; amountCents: number | null },
) {
  const sale = await findPaypalSale(tx, input.captureId);
  if (!sale || input.amountCents == null) return;
  const { refunded, delta, fullyRefunded } = calculateRefundTransition({
    saleAmount: sale.amount,
    previousRefunded: sale.amountRefunded,
    reportedRefunded: sale.amountRefunded + input.amountCents,
  });
  const updated = await tx.sale.update({
    where: { id: sale.id },
    data: {
      amountRefunded: refunded,
      status: fullyRefunded ? SaleStatus.REFUNDED : SaleStatus.PARTIALLY_REFUNDED,
      refundedAt: fullyRefunded ? new Date() : null,
    },
  });
  if (delta > 0 && sale.livemode) {
    const totals = applyLiveDebit(
      sale.campaign,
      delta,
      fullyRefunded && sale.status === SaleStatus.PAID,
    );
    await tx.campaign.update({
      where: { id: sale.campaignId },
      data: {
        currentAmount: totals.currentAmount,
        supporterCount: totals.supporterCount,
        paidAmount: totals.paidAmount,
        paidSupporterCount: totals.paidSupporterCount,
      },
    });
  }
  if (fullyRefunded && sale.livemode) {
    await enqueueUtmify(tx, {
      sale: updated,
      page: sale.affiliatePage,
      campaign: sale.campaign,
      affiliate: sale.affiliate,
      intent: sale.checkoutIntent,
      status: "refunded",
    });
  }
}

export async function applyPaypalDispute(
  tx: Prisma.TransactionClient,
  input: {
    disputeId: string;
    captureId: string;
    status: string;
    reason: string | null;
    amountCents: number;
    currency: string;
    openedAt: Date;
    closed: boolean;
  },
) {
  if (!input.disputeId) return;
  const sale = await findPaypalSale(tx, input.captureId);
  if (!sale) return;
  await tx.chargeback.upsert({
    where: { stripeDisputeId: input.disputeId },
    update: {
      status: input.status,
      reason: input.reason,
      closedAt: input.closed ? new Date() : null,
    },
    create: {
      stripeDisputeId: input.disputeId,
      saleId: sale.id,
      affiliateId: sale.affiliateId,
      campaignId: sale.campaignId,
      amount: input.amountCents,
      currency: input.currency,
      status: input.status,
      reason: input.reason,
      openedAt: input.openedAt,
      closedAt: input.closed ? new Date() : null,
    },
  });
  if (sale.status === SaleStatus.DISPUTED) return;
  const updated = await tx.sale.update({
    where: { id: sale.id },
    data: { status: SaleStatus.DISPUTED },
  });
  if (sale.status === SaleStatus.PAID && sale.livemode) {
    const totals = applyLiveDebit(sale.campaign, sale.amount, true);
    await tx.campaign.update({
      where: { id: sale.campaignId },
      data: {
        currentAmount: totals.currentAmount,
        supporterCount: totals.supporterCount,
        paidAmount: totals.paidAmount,
        paidSupporterCount: totals.paidSupporterCount,
      },
    });
  }
  if (sale.livemode) {
    await enqueueUtmify(tx, {
      sale: updated,
      page: sale.affiliatePage,
      campaign: sale.campaign,
      affiliate: sale.affiliate,
      intent: sale.checkoutIntent,
      status: "chargedback",
    });
  }
}
