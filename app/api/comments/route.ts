import { NextResponse } from "next/server";
import { SaleStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { shouldHideComment } from "@/lib/moderation";
import { commentSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`comment:${ip}`, 8, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  try {
    const parsed = commentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid comment" },
        { status: 400 },
      );
    }

    const parentId = parsed.data.parentId?.trim() || null;
    const sale = await prisma.sale.findUnique({
      where: { id: parsed.data.saleId },
      include: {
        comments: { select: { id: true, parentId: true } },
      },
    });

    if (!sale || sale.status !== SaleStatus.PAID) {
      return NextResponse.json(
        { error: "Comments open only after a successful donation" },
        { status: 403 },
      );
    }

    if (parentId) {
      if (sale.comments.some((item) => item.parentId)) {
        return NextResponse.json(
          { error: "This donation already has a reply" },
          { status: 409 },
        );
      }
      const parent = await prisma.donationComment.findFirst({
        where: {
          id: parentId,
          campaignId: sale.campaignId,
          parentId: null,
          hidden: false,
        },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "That comment cannot be replied to" },
          { status: 404 },
        );
      }
    } else if (sale.comments.some((item) => !item.parentId)) {
      return NextResponse.json(
        { error: "This donation already has a comment" },
        { status: 409 },
      );
    }

    const comment = await prisma.donationComment.create({
      data: {
        saleId: sale.id,
        campaignId: sale.campaignId,
        parentId,
        authorName: parsed.data.authorName,
        body: parsed.data.body,
        hidden: shouldHideComment(parsed.data.body),
      },
    });

    return NextResponse.json({
      id: comment.id,
      parentId: comment.parentId,
      authorName: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("comment create failed", error);
    return NextResponse.json({ error: "Unable to save comment" }, { status: 500 });
  }
}
