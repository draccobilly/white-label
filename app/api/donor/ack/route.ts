import { NextRequest, NextResponse } from "next/server";
import {
  createDonorBrowserToken,
  DONOR_BROWSER_COOKIE_MAX_AGE,
  donorBrowserCookieName,
  readDonorBrowserToken,
} from "@/lib/donor-browser-token";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    affiliatePageId?: unknown;
  } | null;
  const affiliatePageId =
    typeof body?.affiliatePageId === "string" ? body.affiliatePageId : null;
  const secret = process.env.ENCRYPTION_KEY;
  if (!affiliatePageId || !secret) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = donorBrowserCookieName(affiliatePageId);
  const encrypted = request.cookies.get(name)?.value;
  const token = encrypted ? readDonorBrowserToken(encrypted, secret) : null;
  if (
    !token ||
    !token.authorized ||
    token.affiliatePageId !== affiliatePageId
  ) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({
    name,
    value: createDonorBrowserToken(
      {
        affiliatePageId,
        checkoutIntentId: token.checkoutIntentId,
        authorized: true,
        showInlineThankYou: false,
      },
      secret,
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DONOR_BROWSER_COOKIE_MAX_AGE,
  });
  return response;
}
