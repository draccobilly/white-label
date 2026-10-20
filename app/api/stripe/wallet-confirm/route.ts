import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { capturePaidPaymentIntent } from "@/lib/record-paid-session";
import { walletConfirmSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!rateLimit(`wallet-confirm:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many checkout attempts" }, { status: 429 });
  }

  const parsed = walletConfirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid wallet confirmation" }, { status: 400 });
  }

  try {
    const recorded = await capturePaidPaymentIntent(parsed.data.paymentIntentId);
    if (!recorded?.sale) {
      return NextResponse.json({ error: "Wallet payment is not recorded yet" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, newlyPaid: recorded.newlyPaid });
  } catch (error) {
    console.error("wallet confirm failed", error);
    return NextResponse.json({ error: "Unable to confirm wallet payment" }, { status: 500 });
  }
}
