import { NextResponse } from "next/server";
import { isAuthError, requireAdmin } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/admin-role";
import { paidLiveSalesWhere } from "@/lib/sale-filters";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const company = await getAdminCompany();
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        companyId: company.id,
        ...(isOwnerAdmin(admin) ? {} : { createdByAdminId: admin.id }),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        _count: {
          select: { sales: { where: paidLiveSalesWhere(company.id) } },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (campaign.slug === "anok") {
      return NextResponse.json(
        { error: "Anok is protected and cannot be deleted." },
        { status: 409 },
      );
    }
    if (campaign.status === "ACTIVE" || campaign.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Pause this campaign before deleting it." },
        { status: 409 },
      );
    }
    if (campaign._count.sales > 0) {
      return NextResponse.json(
        {
          error:
            "This campaign has live payment history and must remain paused for financial records.",
        },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.chargeback.deleteMany({
        where: { sale: { campaignId: campaign.id } },
      });
      await tx.integrationDelivery.deleteMany({
        where: { affiliatePage: { campaignId: campaign.id } },
      });
      await tx.donationComment.deleteMany({
        where: { campaignId: campaign.id },
      });
      await tx.sale.deleteMany({ where: { campaignId: campaign.id } });
      await tx.checkoutIntent.deleteMany({
        where: { affiliatePage: { campaignId: campaign.id } },
      });
      await tx.trackingEvent.deleteMany({
        where: { affiliatePage: { campaignId: campaign.id } },
      });
      await tx.paymentLink.deleteMany({
        where: { affiliatePage: { campaignId: campaign.id } },
      });
      await tx.affiliatePage.deleteMany({
        where: { campaignId: campaign.id },
      });
      await tx.donationOption.deleteMany({
        where: { campaignId: campaign.id },
      });
      await tx.campaign.delete({ where: { id: campaign.id } });
    });
    return NextResponse.json({ deleted: true, title: campaign.title });
  } catch (error) {
    console.error("campaign deletion failed", error);
    return NextResponse.json(
      {
        error: isAuthError(error)
          ? "Unauthorized"
          : "Unable to delete campaign",
      },
      { status: isAuthError(error) ? 401 : 500 },
    );
  }
}
