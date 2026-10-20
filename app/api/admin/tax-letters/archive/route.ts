import { NextResponse } from "next/server";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { backfillLetterCopies, listLetterArchive } from "@/lib/donation-letter-archive";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function failure(error: unknown, fallback: string) {
  if (isAuthError(error)) {
    return NextResponse.json(
      { error: authErrorMessage(error) },
      { status: authHttpStatus(error), headers: NO_STORE },
    );
  }
  console.error("letter archive failed", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: fallback }, { status: 500, headers: NO_STORE });
}

/** Months of filed letters, with each letter listed. Owner-only. */
export async function GET() {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const listing = await listLetterArchive(company.id);
    return NextResponse.json(listing, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "Não foi possível listar as cartas");
  }
}

/** Files the next few letters that were e-mailed before copies were kept. */
export async function POST() {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const result = await backfillLetterCopies(company.id);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "Não foi possível guardar as cartas já enviadas");
  }
}
