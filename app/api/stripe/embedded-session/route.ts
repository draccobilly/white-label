import { NextRequest, NextResponse } from "next/server";
import {
  MISSION_TIP_NAME,
  stripeCheckoutMetadata,
  stripePaymentLabel,
  startEmbeddedDonation,
  withPendingCheckoutCookie,
} from "@/lib/embedded-checkout";
import {
  EMBEDDED_CHECKOUT_KIND,
  embeddedCheckoutKeyError,
  embeddedCheckoutReturnUrl,
  stripePublishableKey,
} from "@/lib/embedded-stripe";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";
import { embeddedCheckoutSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!rateLimit(`embedded-checkout:${ip}`, 20, 60_000)) {
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

    const started = await startEmbeddedDonation(request, parsed.data);
    if (!started.ok) {
      return NextResponse.json({ error: started.error }, { status: started.status });
    }

    const metadata = stripeCheckoutMetadata({
      kind: EMBEDDED_CHECKOUT_KIND,
      checkoutIntentId: started.intent.id,
      affiliatePageId: started.page.id,
      donationOptionId: started.option?.id,
    });
    const description = stripePaymentLabel(started.intent.gatewayLabel);
    const session = await getStripe().checkout.sessions.create({
      ui_mode: "embedded_page",
      mode: "payment",
      redirect_on_completion: "if_required",
      client_reference_id: started.intent.id,
      customer_creation: "if_required",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: started.page.campaign.currency.toLowerCase(),
            unit_amount: started.donation,
            product_data: {
              name: description,
              description,
            },
          },
        },
        ...(started.tip
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: started.page.campaign.currency.toLowerCase(),
                  unit_amount: started.tip,
                  product_data: { name: MISSION_TIP_NAME },
                },
              },
            ]
          : []),
      ],
      return_url: embeddedCheckoutReturnUrl(started.origin, started.page.id),
      payment_intent_data: {
        description,
        metadata,
      },
      metadata,
    });
    if (!session.client_secret) {
      throw new Error("Stripe did not return an embedded checkout secret");
    }

    const response = NextResponse.json({
      clientSecret: session.client_secret,
      publishableKey: stripePublishableKey(),
      intentId: started.intent.id,
    });
    return withPendingCheckoutCookie(response, {
      origin: started.origin,
      affiliatePageId: started.page.id,
      checkoutIntentId: started.intent.id,
    });
  } catch (error) {
    console.error("embedded checkout failed", error);
    return NextResponse.json({ error: "Unable to start secure checkout" }, { status: 500 });
  }
}
