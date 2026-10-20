import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { captureAndRecordPaypalOrder } from "@/lib/paypal-checkout";
import { paypalConfigured } from "@/lib/paypal";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const captureSchema = z.object({
  orderId: z.string().trim().regex(/^[A-Z0-9]+$/).min(10).max(40),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!rateLimit(`paypal-capture:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many checkout attempts" }, { status: 429 });
  }
  if (!paypalConfigured()) {
    return NextResponse.json({ error: "PayPal is not configured" }, { status: 500 });
  }
  const parsed = captureSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid PayPal order" }, { status: 400 });
  }

  try {
    const result = await captureAndRecordPaypalOrder(parsed.data.orderId);
    if (result.pending) {
      return NextResponse.json(
        { error: "PayPal is still reviewing this payment", pending: true },
        { status: 202 },
      );
    }
    if (!result.recorded?.sale) {
      return NextResponse.json({ error: "PayPal payment is not recorded yet" }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      intentId: result.intentId,
      newlyPaid: result.recorded.newlyPaid,
    });
  } catch (error) {
    console.error("PayPal capture failed", error);
    return NextResponse.json({ error: "Unable to confirm PayPal payment" }, { status: 500 });
  }
}
