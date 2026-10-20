import { NextResponse } from "next/server";
import { getCampaignLiveSnapshot } from "@/lib/public-campaigns";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ campaignSlug: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const ip = clientIp(request);
  if (!rateLimit(`campaign-live:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { campaignSlug } = await params;
  const snapshot = await getCampaignLiveSnapshot(campaignSlug).catch(() => null);
  if (!snapshot) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
