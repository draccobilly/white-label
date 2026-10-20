import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { isMissingColumnError, requestStatusUpdateSchema } from "@/lib/request-status";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const idSchema = z.string().uuid();

function failure(error: unknown) {
  if (isAuthError(error)) {
    return NextResponse.json(
      { error: authErrorMessage(error) },
      { status: authHttpStatus(error), headers: NO_STORE },
    );
  }
  if (isMissingColumnError(error)) {
    return NextResponse.json(
      { error: "Status needs the pending database migration before it can be saved." },
      { status: 409, headers: NO_STORE },
    );
  }
  console.error("help request status update failed", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: "Unable to update the request" }, { status: 500, headers: NO_STORE });
}

/**
 * Owner-only queue status for a support request. Only the two panel-side
 * columns change; the submitted request itself is never rewritten.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id } = await params;
    if (!idSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Request not found" }, { status: 404, headers: NO_STORE });
    }
    const parsed = requestStatusUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid update" },
        { status: 400, headers: NO_STORE },
      );
    }
    const company = await getAdminCompany();
    const existing = await prisma.helpRequest.findFirst({
      where: { id, companyId: company.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404, headers: NO_STORE });
    }
    const { status, internalNote } = parsed.data;
    const updated = await prisma.helpRequest.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status, statusChangedAt: new Date() } : {}),
        ...(internalNote !== undefined ? { internalNote: internalNote.trim() || null } : {}),
      },
      select: { id: true, status: true, statusChangedAt: true, internalNote: true },
    });
    return NextResponse.json({ request: updated }, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}
