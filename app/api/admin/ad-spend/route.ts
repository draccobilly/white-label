import { NextResponse } from "next/server";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { adSpendCreateSchema } from "@/lib/ad-spend";
import { dayToIso, isoToDay } from "@/lib/analytics";
import { getAdminCompany } from "@/lib/company";
import { isIsoDay } from "@/lib/periods";
import { prisma } from "@/lib/prisma";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function failure(error: unknown, fallback: string) {
  if (isAuthError(error)) {
    return NextResponse.json(
      { error: authErrorMessage(error) },
      { status: authHttpStatus(error), headers: NO_STORE },
    );
  }
  console.error("ad spend request failed", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: fallback }, { status: 500, headers: NO_STORE });
}

/** Spend entries of the current desk inside ?from=&to= (civil days). */
export async function GET(request: Request) {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!isIsoDay(from) || !isIsoDay(to)) {
      return NextResponse.json({ error: "from and to are required" }, { status: 400, headers: NO_STORE });
    }
    const rows = await prisma.adSpend.findMany({
      where: { companyId: company.id, day: { gte: isoToDay(from), lte: isoToDay(to) } },
      orderBy: [{ day: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(
      { rows: rows.map((row) => ({ ...row, day: dayToIso(row.day) })) },
      { headers: NO_STORE },
    );
  } catch (error) {
    return failure(error, "Unable to load ad spend");
  }
}

/** Adds one or many entries. Each row is a separate line in the ledger. */
export async function POST(request: Request) {
  try {
    const owner = await requireOwner();
    const company = await getAdminCompany();
    const parsed = adSpendCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Lançamento inválido" },
        { status: 400, headers: NO_STORE },
      );
    }
    const result = await prisma.adSpend.createMany({
      data: parsed.data.rows.map((row) => ({
        companyId: company.id,
        day: isoToDay(row.day),
        source: row.source,
        amount: row.amount,
        currency: row.currency,
        campaignId: row.campaignId ?? null,
        affiliateId: row.affiliateId ?? null,
        note: row.note?.trim() || null,
        createdByEmail: owner.email ?? null,
      })),
    });
    return NextResponse.json({ created: result.count }, { status: 201, headers: NO_STORE });
  } catch (error) {
    return failure(error, "Unable to save ad spend");
  }
}
