import { NextResponse } from "next/server";
import { isAuthError, requireAdmin } from "@/lib/auth";
import { isWebPushConfigured, webPushPublicKey } from "@/lib/admin-push";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({
      configured: isWebPushConfigured(),
      publicKey: webPushPublicKey() || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to read push status" },
      { status: isAuthError(error) ? 401 : 500 },
    );
  }
}
