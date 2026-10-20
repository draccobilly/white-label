import { NextResponse } from "next/server";
import { requireOwner, isAuthError, authHttpStatus } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { buildUtmifyPayload, sendUtmifyOrder } from "@/lib/utmify";
import { resolveDeliverableUtmifyToken } from "@/lib/utmify-desk";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id } = await params;
    const company = await getAdminCompany();
    const page = await prisma.affiliatePage.findFirst({
      where: { id, campaign: { companyId: company.id } },
      include: {
        affiliate: true,
        campaign: { include: { options: { orderBy: { sortOrder: "asc" }, take: 1 } } },
      },
    });
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }
    const token = resolveDeliverableUtmifyToken({
      pageTokenEnc: page.utmifyTokenEnc,
      affiliateTokenEnc: page.affiliate.defaultUtmifyTokenEnc,
      companyIsDefault: company.isDefault,
    });
    if (!token) {
      return NextResponse.json({ error: "Save an Utmify credential first" }, { status: 400 });
    }
    const amount = page.campaign.options[0]?.amount ?? 100;
    const now = new Date();
    const body = await sendUtmifyOrder(
      token,
      buildUtmifyPayload({
        saleId: `test-${crypto.randomUUID()}`,
        affiliatePageId: page.id,
        campaignTitle: page.campaign.title,
        affiliateName: page.affiliate.name,
        amount,
        gatewayFee: 0,
        currency: page.campaign.currency,
        customerName: "Integration Test",
        customerEmail: "test@example.com",
        status: "paid",
        createdAt: now,
        paidAt: now,
        attribution: { utmSource: "integration_test" },
        isTest: true,
      }),
    );
    return NextResponse.json({
      ok: true,
      preview: body.slice(0, 400) || "Utmify accepted the test order.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: isAuthError(error)
          ? "Unauthorized"
          : error instanceof Error
            ? error.message
            : "Test failed",
      },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}
