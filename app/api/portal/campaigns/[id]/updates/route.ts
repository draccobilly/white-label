import { ownedCampaign, portalError, portalJson, requirePortalOrganizer } from "@/lib/organizer-route";
import { organizerUpdateSchema } from "@/lib/organizer-validators";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organizer, response: denied } = await requirePortalOrganizer();
  if (!organizer) return denied;
  const { id } = await params;
  const campaign = await ownedCampaign(organizer.id, id);
  if (!campaign) return portalError("Campaign not found.", 404);

  const parsed = organizerUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return portalError("Write the update before posting.", 400);
  const count = await prisma.campaignUpdate.count({ where: { campaignId: campaign.id } });
  if (count >= 100) return portalError("This campaign already has the maximum number of updates.", 400);

  const update = await prisma.campaignUpdate.create({
    data: {
      campaignId: campaign.id,
      title: parsed.data.title?.trim() || null,
      body: parsed.data.body,
      authorName: organizer.name,
    },
  });
  return portalJson({ update }, 201);
}
