import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { listPendingLetters, sendPendingLetters } from "@/lib/donation-letter-desk";
import { isIsoDay } from "@/lib/periods";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function failure(error: unknown, fallback: string) {
  if (isAuthError(error)) {
    return NextResponse.json(
      { error: authErrorMessage(error) },
      { status: authHttpStatus(error), headers: NO_STORE },
    );
  }
  console.error("pending letters request failed", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: fallback }, { status: 500, headers: NO_STORE });
}

/** Qualifying gifts paid since ?since= that never got a letter. Sends nothing. Owner-only. */
export async function GET(request: Request) {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const since = new URL(request.url).searchParams.get("since") ?? undefined;
    const pending = await listPendingLetters(company.id, isIsoDay(since) ? since : null);
    return NextResponse.json(pending, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "Não foi possível listar as doações sem carta");
  }
}

const bodySchema = z.object({
  since: z.string().optional().nullable(),
  /** Gifts that failed in this run, so they are not tried again in a loop. */
  exclude: z.array(z.string().uuid()).max(500).optional(),
});

/** E-mails the letter for the next few pending gifts and reports how many remain. Owner-only. */
export async function POST(request: Request) {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400, headers: NO_STORE });
    }
    const since = parsed.data.since ?? undefined;
    const result = await sendPendingLetters(company.id, isIsoDay(since) ? since : null, {
      batch: 5,
      exclude: parsed.data.exclude,
    });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "Não foi possível enviar as cartas");
  }
}
