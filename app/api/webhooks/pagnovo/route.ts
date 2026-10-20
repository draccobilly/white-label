import { NextResponse } from "next/server";
import { SaleStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sha256Hex } from "@/lib/crypto";
import { applyLiveDebit } from "@/lib/campaign-accounting";
import { listPagnovoWebhookSecrets } from "@/lib/pagnovo-webhook-secret";
import { verifyAnyPagnovoSignature } from "@/lib/pagnovo-signature";
import {
  enqueueUtmify,
  notifyDonationPaid,
  recordPaidPagnovoTransaction,
} from "@/lib/record-paid-session";
import { processPendingDeliveries } from "@/lib/outbox";

export const runtime = "nodejs";

function isDuplicate(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function recordEvent(
  tx: Prisma.TransactionClient,
  provider: string,
  eventId: string,
  eventType: string,
) {
  await tx.webhookEvent.create({
    data: {
      provider,
      eventId,
      eventType,
      payloadHash: sha256Hex(`${eventId}:${eventType}`),
    },
  });
}

export async function POST(request: Request) {
  const secrets = await listPagnovoWebhookSecrets();
  if (!secrets.length) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 400 });
  }
  const raw = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const signature =
    request.headers.get("x-signature") ?? request.headers.get("X-Signature");
  if (!verifyAnyPagnovoSignature(body, signature, secrets)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const envelope = asRecord(body);
  const event = text(envelope?.event) ?? "unknown";
  const environment = text(envelope?.environment)?.toUpperCase() ?? "";
  const payload = asRecord(envelope?.payload) ?? envelope ?? {};
  const transactionId =
    text(payload.transaction_id) ??
    text(payload.transactionId) ??
    text(payload.id);
  const eventId = `${event}:${transactionId ?? sha256Hex(raw).slice(0, 24)}`;
  const livemode = environment === "LIVE" || environment === "PRODUCTION";

  try {
    if (event === "cashin.paid" && transactionId) {
      const payer = asRecord(payload.payer);
      const recorded = await prisma.$transaction(async (tx) => {
        await recordEvent(tx, "pagnovo", eventId, event);
        return recordPaidPagnovoTransaction(tx, {
          transactionId,
          externalId: text(payload.external_id) ?? text(payload.externalId),
          amount: numberValue(payload.amount) ?? 0,
          customerName: text(payer?.name),
          customerEmail: text(payer?.email),
          paymentMethod: text(payload.method) ?? text(payload.payment_method),
          livemode,
          gatewayFee: numberValue(payload.cost_fee) ?? numberValue(payload.costFee),
        });
      });
      void notifyDonationPaid(recorded);
      void processPendingDeliveries(10).catch((error) => {
        console.error("Utmify outbox flush failed", error);
      });
      return NextResponse.json({ received: true });
    }

    if ((event === "cashin.refunded" || event === "infraction.updated") && transactionId) {
      await prisma.$transaction(async (tx) => {
        await recordEvent(tx, "pagnovo", eventId, event);
        const sale = await tx.sale.findFirst({
          where: { pagnovoTransactionId: transactionId },
          include: {
            checkoutIntent: true,
            affiliatePage: true,
            campaign: { include: { company: { select: { isDefault: true } } } },
            affiliate: true,
          },
        });
        if (!sale) return;
        if (event === "cashin.refunded") {
          if (sale.status === SaleStatus.REFUNDED) return;
          const updated = await tx.sale.update({
            where: { id: sale.id },
            data: {
              status: SaleStatus.REFUNDED,
              amountRefunded: sale.amount,
              refundedAt: new Date(),
            },
          });
          if (sale.livemode && sale.status === SaleStatus.PAID) {
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
            await enqueueUtmify(tx, {
              sale: updated,
              page: sale.affiliatePage,
              campaign: sale.campaign,
              affiliate: sale.affiliate,
              intent: sale.checkoutIntent,
              status: "refunded",
            });
          }
          return;
        }
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
          await enqueueUtmify(tx, {
            sale: updated,
            page: sale.affiliatePage,
            campaign: sale.campaign,
            affiliate: sale.affiliate,
            intent: sale.checkoutIntent,
            status: "chargedback",
          });
        }
      });
      return NextResponse.json({ received: true });
    }

    await prisma.webhookEvent.create({
      data: {
        provider: "pagnovo",
        eventId,
        eventType: event,
        payloadHash: sha256Hex(raw),
      },
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (isDuplicate(error)) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Pagnovo webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
