import { NextResponse } from "next/server";
import { issueFormToken } from "@/lib/form-guard";
import { FORM_RELOAD_ERROR } from "@/lib/form-guard-shared";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`form-guard:${ip}`, 30, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }
  const token = issueFormToken();
  if (!token) {
    return NextResponse.json({ error: FORM_RELOAD_ERROR }, { status: 503 });
  }
  return NextResponse.json({ token });
}
