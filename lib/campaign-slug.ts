type CampaignSlugLookup = {
  campaign: {
    findFirst: (args: {
      where: { companyId: string; slug: string };
      select: { id: true; title: true; createdAt: true };
    }) => Promise<{ id: string; title: string; createdAt: Date } | null>;
  };
};

export function isRecentCampaignRetry(
  existing: {
    title: string;
    createdAt: Date;
  },
  _title: string,
  now = Date.now(),
) {
  return now - existing.createdAt.getTime() < 15 * 60_000;
}

export async function uniqueCampaignSlug(
  db: CampaignSlugLookup,
  companyId: string,
  desired: string,
  excludeId?: string,
) {
  const base = (desired.trim().toLowerCase() || "campaign").slice(0, 80);
  for (let index = 0; index < 50; index += 1) {
    const slug = index === 0 ? base : `${base.slice(0, 70)}-${index + 1}`;
    const existing = await db.campaign.findFirst({
      where: { companyId, slug },
      select: { id: true, title: true, createdAt: true },
    });
    if (!existing || existing.id === excludeId) return slug;
  }
  return `${base.slice(0, 60)}-${crypto.randomUUID().slice(0, 8)}`;
}
