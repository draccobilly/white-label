import { NextRequest, NextResponse } from "next/server";
import {
  churchStripeCheckoutMetadata,
  churchStripePaymentLabel,
  startChurchDonation,
  withPendingCheckoutCookie,
} from "@/lib/embedded-checkout";
import {
  WALLET_CHECKOUT_KIND,
  embeddedCheckoutKeyError,
  stripePublishableKey,
} from "@/lib/embedded-stripe";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";
import { embeddedCheckoutSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!rateLimit(`wallet-checkout:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many checkout attempts" }, { status: 429 });
  }

  const keyError = embeddedCheckoutKeyError();
  if (keyError) {
    return NextResponse.json({ error: keyError }, { status: 500 });
  }

  try {
    const parsed = embeddedCheckoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    }

    const started = await startChurchDonation(request, parsed.data);
    if (!started.ok) {
      return NextResponse.json({ error: started.error }, { status: started.status });
    }

    const metadata = churchStripeCheckoutMetadata({
      kind: WALLET_CHECKOUT_KIND,
      checkoutIntentId: started.intent.id,
      affiliatePageId: started.page.id,
      donationOptionId: started.option?.id,
    });
    const paymentIntent = await getStripe().paymentIntents.create({
      amount: started.amount,
      currency: started.page.campaign.currency.toLowerCase(),
      description: churchStripePaymentLabel(started.intent.gatewayLabel),
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata,
    });
    if (!paymentIntent.client_secret) {
      throw new Error("Stripe did not return a wallet payment secret");
    }

    const response = NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      publishableKey: stripePublishableKey(),
      intentId: started.intent.id,
    });
    return withPendingCheckoutCookie(response, {
      origin: started.origin,
      affiliatePageId: started.page.id,
      checkoutIntentId: started.intent.id,
    });
  } catch (error) {
    console.error("wallet checkout failed", error);
    return NextResponse.json({ error: "Unable to start wallet payment" }, { status: 500 });
  }
}
