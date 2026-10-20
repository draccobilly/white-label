import { NextResponse } from "next/server";
import { getRequestCompany } from "@/lib/company";
import {
  hashPassword,
  organizerFromResetToken,
  passwordProblem,
  sessionCookieFor,
} from "@/lib/organizer-auth";
import { NO_STORE, portalError } from "@/lib/organizer-route";
import { organizerResetSchema } from "@/lib/organizer-validators";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`portal-reset:${ip}`, 10, 15 * 60_000)) {
    return portalError("Too many attempts. Wait a few minutes and try again.", 429);
  }
  const parsed = organizerResetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return portalError("Choose a password with at least 8 characters.", 400);
  const problem = passwordProblem(parsed.data.password);
  if (problem) return portalError(problem, 400);

  const organizer = await organizerFromResetToken(parsed.data.token);
  const company = await getRequestCompany();
  if (!organizer || organizer.companyId !== company.id) {
    return portalError("This link is no longer valid.", 410);
  }
  const updated = await prisma.organizer.update({
    where: { id: organizer.id },
    data: { passwordHash: await hashPassword(parsed.data.password), lastLoginAt: new Date() },
  });
  const cookie = sessionCookieFor(updated);
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
