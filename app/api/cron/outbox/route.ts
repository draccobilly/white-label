import { NextResponse } from "next/server";
import { voidRefundedLetters } from "@/lib/donation-letter-desk";
import { processPendingDeliveries } from "@/lib/outbox";
import { refreshAllDailySeededSocialProof } from "@/lib/seed-social-activity";

async function run(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const processed = await processPendingDeliveries(25);
  const comments =
    new Date().getUTCMinutes() % 20 === 0
      ? await refreshAllDailySeededSocialProof().catch((error) => {
          console.error("[cron] daily comment refresh failed", error);
          return { scanned: 0, updated: 0 };
        })
      : { skipped: true as const };
  // Refunded gifts whose acknowledgment letter is now wrong: tell the donor it is cancelled.
  const letters = await voidRefundedLetters().catch((error) => {
    console.error("[cron] letter cancellation failed", error);
    return { voided: 0 };
  });
  return NextResponse.json({ processed, comments, letters });
}

export const GET = run;
export const POST = run;
