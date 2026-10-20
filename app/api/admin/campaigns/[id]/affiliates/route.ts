import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner, isAuthError, authHttpStatus } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { inheritMissingPaymentLinksFromCompany } from "@/lib/inherit-campaign-assets";
import {
  affiliateUsedByOtherCompany,
  trackingForNewAffiliatePage,
} from "@/lib/pixel-isolation";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  affiliateId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id: campaignId } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Select a valid affiliate" }, { status: 400 });
    }

    const company = await getAdminCompany();
    const [campaign, affiliate] = await Promise.all([
      prisma.campaign.findFirst({
        where: { id: campaignId, companyId: company.id },
      }),
      prisma.affiliate.findUnique({ where: { id: parsed.data.affiliateId } }),
    ]);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (!affiliate) return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });

    if (await affiliateUsedByOtherCompany(prisma, affiliate.id, company.id)) {
      return NextResponse.json(
        {
          error:
            "This affiliate is already used by another company. Create a dedicated affiliate so pixels stay isolated.",
        },
        { status: 400 },
      );
    }

    const tracking = await trackingForNewAffiliatePage(
      prisma,
      affiliate,
      company.id,
      company.isDefault,
    );
    const page = await prisma.affiliatePage.upsert({
      where: {
        campaignId_affiliateId: {
          campaignId,
          affiliateId: affiliate.id,
        },
      },
      update: { active: true },
      create: {
        campaignId,
        affiliateId: affiliate.id,
        ...tracking,
      },
    });

    if (company.paymentGateway !== "PAGNOVO") {
      try {
        const options = await prisma.donationOption.findMany({
          where: { campaignId },
          select: { id: true, amount: true },
        });
        await inheritMissingPaymentLinksFromCompany(prisma, {
          targetCampaignId: campaignId,
          companyId: company.id,
          targetOptions: options,
        });
      } catch (error) {
        console.error("payment link inherit failed", error);
      }
    }

    return NextResponse.json({
      page: {
        id: page.id,
        campaignSlug: campaign.slug,
      },
    });
  } catch (error) {
    console.error("campaign affiliate attach failed", error);
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to add affiliate" },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}
