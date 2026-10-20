import { NextResponse } from "next/server";
import { SaleStatus } from "@/generated/prisma/enums";
import { companyBrand, getRequestCompany } from "@/lib/company";
import { normalizeTrackingCode } from "@/lib/donation-tracking";
import { inspectPublicForm } from "@/lib/form-guard";
import { sendRefundRequestEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { formatMoney } from "@/lib/utils";
import { refundRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`refund:${ip}`, 8, 60 * 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const verdict = inspectPublicForm({
      formToken: body?.formToken,
      companyUrl: body?.companyUrl,
      email: body?.email,
      texts: [body?.name],
      prose: [body?.amountNote, body?.details],
      trackingCode: body?.trackingCode,
    });
    if (!verdict.ok) {
      if (verdict.silent) return NextResponse.json({ ok: true });
      return NextResponse.json({ error: verdict.message }, { status: 400 });
    }

    const parsed = refundRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Check the form fields." },
        { status: 400 },
      );
    }

    const company = await getRequestCompany();
    const brand = companyBrand(company);
    const donorEmail = parsed.data.email.toLowerCase();
    const trackingCode = parsed.data.trackingCode
      ? normalizeTrackingCode(parsed.data.trackingCode)
      : null;

    const sale = trackingCode
      ? await prisma.sale.findFirst({
          where: {
            trackingCode,
            status: { in: [SaleStatus.PAID, SaleStatus.PARTIALLY_REFUNDED] },
            campaign: { companyId: company.id },
            customerEmail: { equals: donorEmail, mode: "insensitive" },
          },
          select: {
            id: true,
            amount: true,
            currency: true,
            paidAt: true,
            stripePaymentIntentId: true,
            campaign: { select: { title: true } },
          },
        })
      : null;

    await prisma.refundRequest.create({
      data: {
        companyId: company.id,
        saleId: sale?.id ?? null,
        trackingCode,
        email: donorEmail,
        name: parsed.data.name ?? null,
        amountNote: parsed.data.amountNote ?? null,
        reason: parsed.data.reason,
        details: parsed.data.details,
      },
    });

    const inbox =
      process.env.REFUND_EMAIL?.trim() ||
      brand.contactEmail ||
      process.env.ADMIN_EMAIL?.trim();

    try {
      if (inbox && process.env.RESEND_API_KEY) {
        await sendRefundRequestEmail({
          to: inbox,
          donorEmail,
          donorName: parsed.data.name,
          trackingCode,
          reason: parsed.data.reason,
          details: parsed.data.details,
          campaignTitle: sale?.campaign.title ?? null,
          amountLabel: sale
            ? formatMoney(sale.amount, sale.currency)
            : parsed.data.amountNote ?? null,
          amountNote: parsed.data.amountNote,
          paidAt: sale?.paidAt ?? null,
          stripePaymentIntentId: sale?.stripePaymentIntentId ?? null,
          siteName: brand.siteName,
        });
      }
    } catch (error) {
      console.error("refund request email failed", error);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("refund request failed", error);
    return NextResponse.json(
      { error: "We couldn’t send your request. Please try again shortly." },
      { status: 500 },
    );
  }
}
