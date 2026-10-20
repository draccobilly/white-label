import { slugify } from "@/lib/utils";

type SlugLookup = {
  affiliate: {
    findUnique: (args: { where: { slug: string }; select: { id: true } }) => Promise<{ id: string } | null>;
  };
};

export async function uniqueAffiliateSlug(
  db: SlugLookup,
  name: string,
  excludeId?: string,
) {
  const base = slugify(name) || "affiliate";
  for (let index = 0; index < 50; index += 1) {
    const slug = index === 0 ? base : `${base.slice(0, 70)}-${index + 1}`;
    const existing = await db.affiliate.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return slug;
  }
  return `${base.slice(0, 60)}-${crypto.randomUUID().slice(0, 8)}`;
}

export function affiliatePageTrackingFrom(affiliate: {
  defaultFbPixelId: string | null;
  defaultGooglePixelId: string | null;
  defaultTiktokPixelId: string | null;
  defaultUtmifyTokenEnc: string | null;
  utmifyPixelScript?: string | null;
  utmifyWebhookUrl?: string | null;
}) {
  return {
    fbPixelId: affiliate.defaultFbPixelId,
    googlePixelId: affiliate.defaultGooglePixelId,
    tiktokPixelId: affiliate.defaultTiktokPixelId,
    utmifyTokenEnc: affiliate.defaultUtmifyTokenEnc,
    utmifyPixelScript: affiliate.utmifyPixelScript ?? null,
    utmifyWebhookUrl: affiliate.utmifyWebhookUrl ?? null,
  };
}
