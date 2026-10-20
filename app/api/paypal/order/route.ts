import { NextRequest, NextResponse } from "next/server";
import {
  churchStripePaymentLabel,
  startChurchDonation,
  withPendingCheckoutCookie,
} from "@/lib/embedded-checkout";
import { createPaypalOrder, PAYPAL_BUTTON_ENABLED, paypalConfigured, paypalReturnUrl } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { embeddedCheckoutSchema } from "@/lib/validators";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!PAYPAL_BUTTON_ENABLED) {
    return NextResponse.json({ error: "PayPal is unavailable" }, { status: 503 });
  }
  const ip = clientIp(request);
  if (!rateLimit(`paypal-order:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many checkout attempts" }, { status: 429 });
  }
  if (!paypalConfigured()) {
    return NextResponse.json({ error: "PayPal is not configured" }, { status: 500 });
  }

  try {
    const parsed = embeddedCheckoutSchema
      .and(z.object({ returnUrl: z.string().trim().max(2048).optional() }))
      .safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    }
    const started = await startChurchDonation(request, parsed.data);
    if (!started.ok) {
      return NextResponse.json({ error: started.error }, { status: started.status });
    }
    const orderId = await createPaypalOrder({
      checkoutIntentId: started.intent.id,
      amountCents: started.amount,
      currency: started.page.campaign.currency,
      description: churchStripePaymentLabel(started.intent.gatewayLabel),
      brandName: started.page.campaign.company?.siteName || "Donation",
      returnUrl: paypalReturnUrl(parsed.data.returnUrl, [
        started.origin,
        request.headers.get("origin") ?? "",
        process.env.NEXT_PUBLIC_APP_URL ?? "",
        process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? "",
      ]),
      userAgent: request.headers.get("user-agent"),
    });
    await prisma.checkoutIntent.update({
      where: { id: started.intent.id },
      data: { paypalOrderId: orderId },
    });
    const response = NextResponse.json({ orderId, intentId: started.intent.id });
    return withPendingCheckoutCookie(response, {
      origin: started.origin,
      affiliatePageId: started.page.id,
      checkoutIntentId: started.intent.id,
    });
  } catch (error) {
    console.error("PayPal order failed", error);
    return NextResponse.json({ error: "Unable to start secure checkout" }, { status: 500 });
  }
}
