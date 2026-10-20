import { NextResponse } from "next/server";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { buildLetterArchiveZip, isLetterMonth } from "@/lib/donation-letter-archive";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Zip of every filed letter, or of one month (?month=YYYY-MM or ?month=all). Owner-only. */
export async function GET(request: Request) {
  try {
    await requireOwner();
    const monthParam = new URL(request.url).searchParams.get("month") ?? "";
    const month = monthParam === "all" ? null : monthParam;
    if (month !== null && !isLetterMonth(month)) {
      return NextResponse.json({ error: "Mês inválido" }, { status: 400, headers: NO_STORE });
    }
    const company = await getAdminCompany();
    const zip = await buildLetterArchiveZip(company.id, month);
    if (!zip) {
      return NextResponse.json({ error: "Nenhuma carta nesse período" }, { status: 404, headers: NO_STORE });
    }
    return new NextResponse(Buffer.from(zip.bytes), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zip.filename}"`,
      },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: authErrorMessage(error) },
        { status: authHttpStatus(error), headers: NO_STORE },
      );
    }
    console.error("letter archive download failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível baixar as cartas" }, { status: 500, headers: NO_STORE });
  }
}
