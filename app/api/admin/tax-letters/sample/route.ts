import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { sendSampleLetter } from "@/lib/donation-letter-desk";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const bodySchema = z.object({ to: z.string().trim().email("Informe um e-mail válido") });

/** E-mails a sample letter (made-up data, stamped as a sample) to the given address. Owner-only. */
export async function POST(request: Request) {
  try {
    await requireOwner();
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Informe um e-mail válido" },
        { status: 400, headers: NO_STORE },
      );
    }
    const sent = await sendSampleLetter(parsed.data.to);
    return NextResponse.json({ ok: true, ...sent }, { headers: NO_STORE });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: authErrorMessage(error) },
        { status: authHttpStatus(error), headers: NO_STORE },
      );
    }
    const message = error instanceof Error ? error.message : "falha";
    console.error("sample letter failed", message);
    // The mail provider's reason (bad key, unverified sender…) is what the owner needs to see.
    return NextResponse.json(
      { error: `Não foi possível enviar o teste: ${message.slice(0, 200)}` },
      { status: 500, headers: NO_STORE },
    );
  }
}
