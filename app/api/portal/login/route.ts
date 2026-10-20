import { NextResponse } from "next/server";
import { getRequestCompany } from "@/lib/company";
import {
  normalizeOrganizerEmail,
  sessionCookieFor,
  verifyPassword,
} from "@/lib/organizer-auth";
import { NO_STORE, portalError } from "@/lib/organizer-route";
import { organizerLoginSchema } from "@/lib/organizer-validators";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`portal-login:${ip}`, 20, 15 * 60_000)) {
    return portalError("Too many attempts. Wait a few minutes and try again.", 429);
  }
  const parsed = organizerLoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return portalError("Enter your email and password.", 400);

  const company = await getRequestCompany();
  const email = normalizeOrganizerEmail(parsed.data.email);
  if (!rateLimit(`portal-login:${company.id}:${email}`, 10, 15 * 60_000)) {
    return portalError("Too many attempts. Wait a few minutes and try again.", 429);
  }
  const organizer = await prisma.organizer.findUnique({
    where: { companyId_email: { companyId: company.id, email } },
  });
  if (!organizer || !(await verifyPassword(parsed.data.password, organizer.passwordHash))) {
    return portalError("Email or password is not right.", 401);
  }
  await prisma.organizer.update({ where: { id: organizer.id }, data: { lastLoginAt: new Date() } });

  const cookie = sessionCookieFor(organizer);
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
