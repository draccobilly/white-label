import { NextResponse } from "next/server";
import { z } from "zod";
import { CampaignStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  campaignId: z.string().uuid(),
  action: z.enum(["like", "share"]),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { campaignId, action } = parsed.data;
  const ip = clientIp(request);
  const windowMs = action === "like" ? 86_400_000 : 60_000;
  const limit = action === "like" ? 1 : 8;
  const allowed = rateLimit(`engage:${action}:${campaignId}:${ip}`, limit, windowMs);

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      status: { in: [CampaignStatus.ACTIVE, CampaignStatus.COMPLETED] },
    },
    select: { id: true, likeCount: true, shareCount: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (!allowed) {
    return NextResponse.json({
      likeCount: campaign.likeCount,
      shareCount: campaign.shareCount,
    });
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data:
      action === "like"
        ? { likeCount: { increment: 1 } }
        : { shareCount: { increment: 1 } },
    select: { likeCount: true, shareCount: true },
  });

  return NextResponse.json(updated);
}
