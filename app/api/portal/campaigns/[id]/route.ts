import { ownedCampaign, portalError, portalJson, requirePortalOrganizer } from "@/lib/organizer-route";
import { organizerCampaignEditSchema } from "@/lib/organizer-validators";
import { prisma } from "@/lib/prisma";

/**
 * Organizer edits to their own campaign page: words, photos, and video.
 * Goal, amounts, status, slug, and publication stay with the panel.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organizer, response: denied } = await requirePortalOrganizer();
  if (!organizer) return denied;
  const { id } = await params;
  const campaign = await ownedCampaign(organizer.id, id);
  if (!campaign) return portalError("Campaign not found.", 404);

  const parsed = organizerCampaignEditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return portalError(parsed.error.issues[0]?.message ?? "Check the fields.", 400);
  }
  const data = parsed.data;
  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      title: data.title,
      summary: data.summary,
      story: data.story,
      coverImageUrl: data.coverImageUrl || null,
      organizerImageUrl: data.organizerImageUrl || null,
      videoUrl: data.videoUrl || null,
      galleryImageUrls: data.galleryImageUrls,
    },
    select: { id: true, title: true, updatedAt: true },
  });
  return portalJson({ campaign: updated });
}
