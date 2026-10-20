import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { cancelLetterCopy, letterCopyFile, LetterArchiveError } from "@/lib/donation-letter-archive";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const idSchema = z.string().uuid();

function failure(error: unknown, fallback: string) {
  if (isAuthError(error)) {
    return NextResponse.json(
      { error: authErrorMessage(error) },
      { status: authHttpStatus(error), headers: NO_STORE },
    );
  }
  if (error instanceof LetterArchiveError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE });
  }
  console.error("letter copy request failed", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: fallback }, { status: 500, headers: NO_STORE });
}

/** The exact PDF that was e-mailed. Owner-only. */
export async function GET(_request: Request, { params }: { params: Promise<{ copyId: string }> }) {
  try {
    await requireOwner();
    const { copyId } = await params;
    if (!idSchema.safeParse(copyId).success) {
      return NextResponse.json({ error: "Carta não encontrada" }, { status: 404, headers: NO_STORE });
    }
    const company = await getAdminCompany();
    const copy = await letterCopyFile(company.id, copyId);
    if (!copy) {
      return NextResponse.json({ error: "Carta não encontrada" }, { status: 404, headers: NO_STORE });
    }
    const filename = copy.filename.replace(/[^A-Za-z0-9._-]+/g, "") || "carta.pdf";
    return new NextResponse(Buffer.from(copy.pdf), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return failure(error, "Não foi possível baixar a carta");
  }
}

/** Cancels this filed letter and e-mails the donor that it is no longer valid. Owner-only. */
export async function POST(_request: Request, { params }: { params: Promise<{ copyId: string }> }) {
  try {
    await requireOwner();
    const { copyId } = await params;
    if (!idSchema.safeParse(copyId).success) {
      return NextResponse.json({ error: "Carta não encontrada" }, { status: 404, headers: NO_STORE });
    }
    const company = await getAdminCompany();
    const cancelled = await cancelLetterCopy(company.id, copyId);
    return NextResponse.json({ ok: true, ...cancelled }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "Não foi possível cancelar a carta");
  }
}
