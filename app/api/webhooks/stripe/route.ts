import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { SaleStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getStripeWebhookSecret } from "@/lib/stripe-webhook-secret";
import { calculateRefundTransition } from "@/lib/stripe-attribution";
import { applyLiveDebit } from "@/lib/campaign-accounting";
import { checkoutSessionIdFromPaymentIntent } from "@/lib/embedded-checkout";
import { WALLET_CHECKOUT_KIND } from "@/lib/embedded-stripe";
import {
  enqueueUtmify,
  notifyDonationPaid,
  recordPaidCheckoutSession,
  recordPaidPaymentIntent,
  resolveCampaignCheckout,
  sessionPaymentIntentId,
} from "@/lib/record-paid-session";
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

async function processPaidPaymentIntent(event: Stripe.Event, paymentIntent: Stripe.PaymentIntent) {
  const expanded =
    typeof paymentIntent.latest_charge === "object" && paymentIntent.latest_charge
      ? paymentIntent
      : await getStripe().paymentIntents.retrieve(paymentIntent.id, {
          expand: ["latest_charge"],
        });
  const checkoutSessionId =
    expanded.metadata?.checkoutKind === WALLET_CHECKOUT_KIND
      ? null
      : checkoutSessionIdFromPaymentIntent(expanded);
  const checkoutSession = checkoutSessionId
    ? await getStripe().checkout.sessions.retrieve(checkoutSessionId, {
        expand: ["line_items"],
      })
    : null;
  const recorded = await prisma.$transaction(async (tx) => {
    await recordEvent(tx, event);
    if (checkoutSession) return recordPaidCheckoutSession(tx, checkoutSession);
    return recordPaidPaymentIntent(tx, expanded);
  });
  void notifyDonationPaid(recorded);
  void processPendingDeliveries(10).catch((error) => {
    console.error("Utmify outbox flush failed", error);
  });
}

async function processPaidSession(event: Stripe.Event, session: Stripe.Checkout.Session) {
  const expanded = session.line_items?.data
    ? session
    : await getStripe().checkout.sessions.retrieve(session.id, {
        expand: ["line_items"],
      });
  const recorded = await prisma.$transaction(async (tx) => {
    await recordEvent(tx, event);
    return recordPaidCheckoutSession(tx, expanded);
  });
  void notifyDonationPaid(recorded);
  void processPendingDeliveries(10).catch((error) => {
    console.error("Utmify outbox flush failed", error);
  });
}

async function recordEvent(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
) {
  await tx.webhookEvent.create({
    data: {
      provider: "stripe",
      eventId: event.id,
      eventType: event.type,
      payloadHash: sha256Hex(`${event.id}:${event.type}`),
    },
  });
}

async function processFailedSession(event: Stripe.Event, session: Stripe.Checkout.Session) {
  await prisma.$transaction(async (tx) => {
    await recordEvent(tx, event);
    const checkout = await resolveCampaignCheckout(tx, session);
    if (!checkout) return;
    const { intent, paymentLink } = checkout;
    if (!paymentLink) return;
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${intent.id}))`,
    );
    const currentSale = await tx.sale.findUnique({
      where: { checkoutIntentId: intent.id },
      select: { status: true },
    });
    if (currentSale?.status === SaleStatus.PAID) return;
    const sale = await tx.sale.upsert({
      where: { checkoutIntentId: intent.id },
      update: { status: SaleStatus.FAILED, livemode: session.livemode },
      create: {
        checkoutIntentId: intent.id,
        affiliatePageId: paymentLink.affiliatePageId,
        campaignId: paymentLink.affiliatePage.campaignId,
        affiliateId: paymentLink.affiliatePage.affiliateId,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: sessionPaymentIntentId(session),
        stripePaymentLinkId: paymentLink.stripePaymentLinkId,
        amount: paymentLink.donationOption.amount,
        currency: paymentLink.affiliatePage.campaign.currency,
        status: SaleStatus.FAILED,
        customerEmail: session.customer_details?.email ?? null,
        livemode: session.livemode,
      },
    });
    if (session.livemode) {
      await enqueueUtmify(tx, {
        sale,
        page: paymentLink.affiliatePage,
        campaign: paymentLink.affiliatePage.campaign,
        affiliate: paymentLink.affiliatePage.affiliate,
        intent,
        status: "refused",
      });
    }
  });
}

async function processRefund(event: Stripe.Event, charge: Stripe.Charge) {
  await prisma.$transaction(async (tx) => {
    await recordEvent(tx, event);
    const paymentIntentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (!paymentIntentId) return;
    const sale = await tx.sale.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: {
        checkoutIntent: true,
        affiliatePage: true,
        campaign: { include: { company: { select: { isDefault: true } } } },
        affiliate: true,
      },
    });
    if (!sale) return;
    const { refunded, delta, fullyRefunded } = calculateRefundTransition({
      saleAmount: sale.amount,
      previousRefunded: sale.amountRefunded,
      reportedRefunded: charge.amount_refunded ?? 0,
    });
    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: {
        stripeChargeId: charge.id,
        amountRefunded: refunded,
        status: fullyRefunded
          ? SaleStatus.REFUNDED
          : SaleStatus.PARTIALLY_REFUNDED,
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
  });
}

async function processDispute(event: Stripe.Event, dispute: Stripe.Dispute) {
  await prisma.$transaction(async (tx) => {
    await recordEvent(tx, event);
    const paymentIntentId =
      typeof dispute.payment_intent === "string"
        ? dispute.payment_intent
        : dispute.payment_intent?.id;
    if (!paymentIntentId) return;
    const sale = await tx.sale.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: {
        checkoutIntent: true,
        affiliatePage: true,
        campaign: { include: { company: { select: { isDefault: true } } } },
        affiliate: true,
      },
    });
    if (!sale) return;
    await tx.chargeback.upsert({
      where: { stripeDisputeId: dispute.id },
      update: {
        status: dispute.status,
        reason: dispute.reason,
        closedAt: dispute.status === "lost" || dispute.status === "won" || dispute.status === "warning_closed"
          ? new Date()
          : null,
      },
      create: {
        stripeDisputeId: dispute.id,
        saleId: sale.id,
        affiliateId: sale.affiliateId,
        campaignId: sale.campaignId,
        amount: dispute.amount,
        currency: dispute.currency.toUpperCase(),
        status: dispute.status,
        reason: dispute.reason,
        openedAt: new Date((dispute.created ?? Date.now() / 1000) * 1000),
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
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = await getStripeWebhookSecret(request.headers.get("host"));
  if (!signature || !secret) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 400 });
  }
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await processPaidSession(event, event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.succeeded":
        await processPaidPaymentIntent(event, event.data.object as Stripe.PaymentIntent);
        break;
      case "checkout.session.async_payment_failed":
        await processFailedSession(event, event.data.object as Stripe.Checkout.Session);
        break;
      case "charge.refunded":
        await processRefund(event, event.data.object as Stripe.Charge);
        break;
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed":
        await processDispute(event, event.data.object as Stripe.Dispute);
        break;
      default:
        await prisma.webhookEvent.create({
          data: {
            provider: "stripe",
            eventId: event.id,
            eventType: event.type,
            payloadHash: sha256Hex(`${event.id}:${event.type}`),
          },
        });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    if (isDuplicate(error)) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Stripe webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
