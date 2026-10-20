import { NextResponse } from "next/server";
import {
  hashPassword,
  passwordProblem,
  sessionCookieFor,
  verifyPassword,
} from "@/lib/organizer-auth";
import { NO_STORE, portalError, requirePortalOrganizer } from "@/lib/organizer-route";
import { organizerPasswordChangeSchema } from "@/lib/organizer-validators";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { organizer, response: denied } = await requirePortalOrganizer();
  if (!organizer) return denied;
  const parsed = organizerPasswordChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return portalError("Choose a password with at least 8 characters.", 400);
  const problem = passwordProblem(parsed.data.password);
  if (problem) return portalError(problem, 400);

  const current = await prisma.organizer.findUnique({ where: { id: organizer.id } });
  if (!current || !(await verifyPassword(parsed.data.currentPassword, current.passwordHash))) {
    return portalError("The current password is not right.", 403);
  }
  const updated = await prisma.organizer.update({
    where: { id: organizer.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  const cookie = sessionCookieFor(updated);
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
