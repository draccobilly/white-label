import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  applyPaypalDispute,
  applyPaypalRefund,
  enrichPaypalPayer,
  markPaypalCaptureDenied,
  recordPaypalCapture,
} from "@/lib/paypal-checkout";
import {
  paypalCaptureFromResource,
  paypalDisputeFromResource,
  paypalRefundFromResource,
  verifyPaypalWebhook,
} from "@/lib/paypal";
import { notifyDonationPaid } from "@/lib/record-paid-session";
import { processPendingDeliveries } from "@/lib/outbox";
import { sha256Hex } from "@/lib/crypto";

export const runtime = "nodejs";

function isDuplicate(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function POST(request: Request) {
  const raw = await request.text();
  let event: { id?: string; event_type?: string; resource?: Record<string, unknown> };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!event.id || !event.event_type) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const eventId = event.id;
  const eventType = event.event_type;
  const verified = await verifyPaypalWebhook(request.headers, event).catch((error) => {
    console.error("PayPal webhook verification failed", error);
    return false;
  });
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const resource = (event.resource ?? {}) as Parameters<typeof paypalCaptureFromResource>[0] &
      Parameters<typeof paypalRefundFromResource>[0] &
      Parameters<typeof paypalDisputeFromResource>[0];
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const details = paypalCaptureFromResource(resource);
      if (!details) return NextResponse.json({ received: true });
      const enriched = await enrichPaypalPayer(details);
      const recorded = await prisma.$transaction(async (tx) => {
        await tx.webhookEvent.create({
          data: {
            provider: "paypal",
            eventId,
            eventType,
            payloadHash: sha256Hex(`${eventId}:${eventType}`),
          },
        });
        const saved = await recordPaypalCapture(tx, {
          ...enriched,
          status: enriched.status || "COMPLETED",
        });
        if (!saved) throw new Error("PayPal capture was not attributed");
        return saved;
      });
      void notifyDonationPaid(recorded);
      void processPendingDeliveries(10).catch((error) => {
        console.error("Utmify outbox flush failed", error);
      });
      return NextResponse.json({ received: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.webhookEvent.create({
        data: {
          provider: "paypal",
          eventId,
          eventType,
          payloadHash: sha256Hex(`${eventId}:${eventType}`),
        },
      });
      if (eventType === "PAYMENT.CAPTURE.DENIED") {
        const details = paypalCaptureFromResource(resource);
        if (details) await markPaypalCaptureDenied(tx, details);
        return;
      }
      if (
        eventType === "PAYMENT.CAPTURE.REFUNDED" ||
        eventType === "PAYMENT.CAPTURE.REVERSED"
      ) {
        const capture =
          eventType === "PAYMENT.CAPTURE.REVERSED"
            ? paypalCaptureFromResource(resource)
            : null;
        const refund = paypalRefundFromResource(resource);
        await applyPaypalRefund(tx, {
          captureId: refund.captureId || capture?.captureId || "",
          amountCents: refund.amountCents ?? capture?.amountCents ?? null,
        });
        return;
      }
      if (eventType.startsWith("CUSTOMER.DISPUTE.")) {
        await applyPaypalDispute(tx, paypalDisputeFromResource(resource));
      }
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (isDuplicate(error)) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("PayPal webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
