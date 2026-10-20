import { NextResponse } from "next/server";
import { SaleStatus } from "@/generated/prisma/enums";
import {
  normalizeTrackingCode,
  trackingProgress,
} from "@/lib/donation-tracking";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { formatMoney } from "@/lib/utils";

export async function GET(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`track:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many lookups" }, { status: 429 });
  }

  const code = normalizeTrackingCode(
    new URL(request.url).searchParams.get("code") ?? "",
  );
  if (!code.startsWith("DN") || code.length < 6) {
    return NextResponse.json({ error: "Enter a valid tracking code." }, { status: 400 });
  }

  const sale = await prisma.sale.findFirst({
    where: { trackingCode: code, status: SaleStatus.PAID },
    include: { campaign: { select: { title: true } } },
  });
  if (!sale) {
    return NextResponse.json({ error: "No donation was found for that code." }, { status: 404 });
  }

  return NextResponse.json({
    trackingCode: sale.trackingCode,
    campaignTitle: sale.campaign.title,
    amountLabel: formatMoney(sale.amount, sale.currency),
    paidAt: sale.paidAt,
    steps: trackingProgress(sale.paidAt),
  });
}
