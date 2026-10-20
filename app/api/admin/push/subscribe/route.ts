import { NextResponse } from "next/server";
import { z } from "zod";
import { isOwnerAdmin } from "@/lib/admin-role";
import { isAuthError, requireAdmin } from "@/lib/auth";
import { ensureOperatorAffiliate } from "@/lib/operator-affiliate";
import { prisma } from "@/lib/prisma";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(8),
    auth: z.string().min(8),
  }),
  userAgent: z.string().max(500).optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!isOwnerAdmin(admin)) await ensureOperatorAffiliate(admin);
    const parsed = subscribeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    await prisma.adminPushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      update: {
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent: parsed.data.userAgent ?? null,
        adminId: admin.id,
      },
      create: {
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent: parsed.data.userAgent ?? null,
        adminId: admin.id,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: isAuthError(error)
          ? "Unauthorized"
          : error instanceof Error
            ? error.message
            : "Unable to save subscription",
      },
      { status: isAuthError(error) ? 401 : 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const parsed = unsubscribeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    await prisma.adminPushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to remove subscription" },
      { status: isAuthError(error) ? 401 : 500 },
    );
  }
}
