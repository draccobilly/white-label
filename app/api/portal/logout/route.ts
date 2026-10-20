import { NextResponse } from "next/server";
import { clearedSessionCookie } from "@/lib/organizer-auth";
import { NO_STORE } from "@/lib/organizer-route";

export async function POST() {
  const cookie = clearedSessionCookie();
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
