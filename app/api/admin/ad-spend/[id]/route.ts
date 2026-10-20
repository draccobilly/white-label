import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const idSchema = z.string().uuid();

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id } = await params;
    if (!idSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404, headers: NO_STORE });
    }
    const company = await getAdminCompany();
    const deleted = await prisma.adSpend.deleteMany({ where: { id, companyId: company.id } });
    if (!deleted.count) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: authErrorMessage(error) },
        { status: authHttpStatus(error), headers: NO_STORE },
      );
    }
    console.error("ad spend delete failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to delete the entry" }, { status: 500, headers: NO_STORE });
  }
}
