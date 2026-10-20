import { NextResponse } from "next/server";
import { isAuthError, requireAdmin } from "@/lib/auth";
import { isWebPushConfigured, notifyAdminSalePush } from "@/lib/admin-push";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const admin = await requireAdmin();
    if (!isWebPushConfigured()) {
      return NextResponse.json({ error: "Push is not configured" }, { status: 400 });
    }
    const count = await prisma.adminPushSubscription.count({ where: { adminId: admin.id } });
    if (!count) {
      return NextResponse.json(
        { error: "Enable sale alerts on this phone first" },
        { status: 400 },
      );
    }
    await notifyAdminSalePush({
      campaignTitle: "Let’s bless this humble father",
      amount: 2500,
      gatewayFee: 0,
      currency: "USD",
      onlyAdminId: admin.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to send test notification" },
      { status: isAuthError(error) ? 401 : 500 },
    );
  }
}
