import { ownedCampaign, portalError, portalJson, requirePortalOrganizer } from "@/lib/organizer-route";
import { organizerUpdateSchema } from "@/lib/organizer-validators";
import { prisma } from "@/lib/prisma";

async function load(params: Promise<{ id: string; updateId: string }>) {
  const { organizer, response } = await requirePortalOrganizer();
  if (!organizer) return { response };
  const { id, updateId } = await params;
  const campaign = await ownedCampaign(organizer.id, id);
  if (!campaign) return { response: portalError("Campaign not found.", 404) };
  if (!/^[0-9a-f-]{36}$/i.test(updateId)) return { response: portalError("Update not found.", 404) };
  const update = await prisma.campaignUpdate.findFirst({
    where: { id: updateId, campaignId: campaign.id },
    select: { id: true },
  });
  if (!update) return { response: portalError("Update not found.", 404) };
  return { update, response: null };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; updateId: string }> },
) {
  const loaded = await load(params);
  if (loaded.response) return loaded.response;
  const parsed = organizerUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return portalError("Write the update before saving.", 400);
  const update = await prisma.campaignUpdate.update({
    where: { id: loaded.update.id },
    data: { title: parsed.data.title?.trim() || null, body: parsed.data.body },
  });
  return portalJson({ update });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; updateId: string }> },
) {
  const loaded = await load(params);
  if (loaded.response) return loaded.response;
  await prisma.campaignUpdate.delete({ where: { id: loaded.update.id } });
  return portalJson({ ok: true });
}
