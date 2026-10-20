import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { organizerLinkSchema } from "@/lib/organizer-validators";
import { prisma } from "@/lib/prisma";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const idSchema = z.string().uuid();

/** Owner links or unlinks one campaign to an organizer account. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id } = await params;
    if (!idSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Organizer not found" }, { status: 404, headers: NO_STORE });
    }
    const parsed = organizerLinkSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose a campaign" }, { status: 400, headers: NO_STORE });
    }
    const company = await getAdminCompany();
    const [organizer, campaign] = await Promise.all([
      prisma.organizer.findFirst({ where: { id, companyId: company.id }, select: { id: true } }),
      prisma.campaign.findFirst({
        where: { id: parsed.data.campaignId, companyId: company.id },
        select: { id: true, organizerId: true },
      }),
    ]);
    if (!organizer) {
      return NextResponse.json({ error: "Organizer not found" }, { status: 404, headers: NO_STORE });
    }
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404, headers: NO_STORE });
    }
    if (!parsed.data.link && campaign.organizerId !== organizer.id) {
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { organizerId: parsed.data.link ? organizer.id : null },
    });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: authErrorMessage(error) },
        { status: authHttpStatus(error), headers: NO_STORE },
      );
    }
    console.error("organizer link failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to update" }, { status: 500, headers: NO_STORE });
  }
}
