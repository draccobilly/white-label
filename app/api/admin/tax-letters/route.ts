import { NextResponse } from "next/server";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { searchLetterSales } from "@/lib/donation-letter-desk";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Donations matching ?q= (donor e-mail, name or tracking code) with their letter state. Owner-only. */
export async function GET(request: Request) {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const query = new URL(request.url).searchParams.get("q") ?? "";
    if (query.trim().length < 3) {
      return NextResponse.json({ error: "Digite ao menos 3 caracteres" }, { status: 400, headers: NO_STORE });
    }
    const rows = await searchLetterSales(company.id, query.slice(0, 120));
    return NextResponse.json({ rows }, { headers: NO_STORE });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: authErrorMessage(error) },
        { status: authHttpStatus(error), headers: NO_STORE },
      );
    }
    console.error("letter search failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível buscar as doações" }, { status: 500, headers: NO_STORE });
  }
}
