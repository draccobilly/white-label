import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { payoutStatusUpdateSchema } from "@/lib/organizer-validators";
import { prisma } from "@/lib/prisma";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const idSchema = z.string().uuid();

/** Owner sets the review status and internal note of a payout request. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id } = await params;
    if (!idSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404, headers: NO_STORE });
    }
    const parsed = payoutStatusUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid update" },
        { status: 400, headers: NO_STORE },
      );
    }
    const company = await getAdminCompany();
    const existing = await prisma.payoutRequest.findFirst({
      where: { id, companyId: company.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404, headers: NO_STORE });
    }
    const { status, internalNote } = parsed.data;
    const updated = await prisma.payoutRequest.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status, statusChangedAt: new Date() } : {}),
        ...(internalNote !== undefined ? { internalNote: internalNote.trim() || null } : {}),
      },
      select: { id: true, status: true, statusChangedAt: true, internalNote: true },
    });
    return NextResponse.json({ payout: updated }, { headers: NO_STORE });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: authErrorMessage(error) },
        { status: authHttpStatus(error), headers: NO_STORE },
      );
    }
    console.error("payout status update failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to update the payout" }, { status: 500, headers: NO_STORE });
  }
}
