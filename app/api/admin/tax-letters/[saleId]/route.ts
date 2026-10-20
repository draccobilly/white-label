import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { DonationLetterError, letterPdfForSale, sendLetterOnRequest } from "@/lib/donation-letter-desk";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const idSchema = z.string().uuid();
const sendSchema = z.object({
  supportNote: z.string().trim().max(2000).optional(),
});

function failure(error: unknown, fallback: string) {
  if (isAuthError(error)) {
    return NextResponse.json(
      { error: authErrorMessage(error) },
      { status: authHttpStatus(error), headers: NO_STORE },
    );
  }
  if (error instanceof DonationLetterError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE });
  }
  console.error("donation letter request failed", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: fallback }, { status: 500, headers: NO_STORE });
}

/** The letter as a PDF, to check before sending. Sends nothing. Owner-only. */
export async function GET(_request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  try {
    await requireOwner();
    const { saleId } = await params;
    if (!idSchema.safeParse(saleId).success) {
      return NextResponse.json({ error: "Doação não encontrada" }, { status: 404, headers: NO_STORE });
    }
    const company = await getAdminCompany();
    const letter = await letterPdfForSale(company.id, saleId);
    return new NextResponse(new Uint8Array(letter.content), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${letter.filename}"`,
      },
    });
  } catch (error) {
    return failure(error, "Não foi possível gerar a carta");
  }
}

/** E-mails the letter to the donor (the "on request" path for smaller gifts). Owner-only. */
export async function POST(request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  try {
    await requireOwner();
    const { saleId } = await params;
    if (!idSchema.safeParse(saleId).success) {
      return NextResponse.json({ error: "Doação não encontrada" }, { status: 404, headers: NO_STORE });
    }
    const raw = await request.text();
    let supportNote: string | undefined;
    if (raw.trim()) {
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        return NextResponse.json({ error: "Pedido inválido" }, { status: 400, headers: NO_STORE });
      }
      const parsed = sendSchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "A mensagem de suporte precisa ter até 2000 caracteres." },
          { status: 400, headers: NO_STORE },
        );
      }
      supportNote = parsed.data.supportNote || undefined;
    }
    const company = await getAdminCompany();
    const sent = await sendLetterOnRequest(company.id, saleId, supportNote);
    return NextResponse.json({ ok: true, ...sent }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "Não foi possível enviar a carta");
  }
}
