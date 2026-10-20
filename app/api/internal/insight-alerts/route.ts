import { NextResponse } from "next/server";
import { notifyAffiliateInsights } from "@/lib/insight-alerts";

export async function POST(request: Request) {
  const secret = process.env.INSIGHT_CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sent = await notifyAffiliateInsights();
  return NextResponse.json({ ok: true, sent });
}
