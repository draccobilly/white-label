import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  hasCrossCompanyPixelConflict,
  PixelConflictError,
  type TrackingIds,
} from "@/lib/pixel-isolation";

function decryptToken(value: string | null | undefined) {
  const secret = process.env.ENCRYPTION_KEY;
  if (!value || !secret) return null;
  try {
    return decryptSecret(value, secret).trim() || null;
  } catch {
    return null;
  }
}

export async function assertTrackingExclusiveToCompany(input: {
  companyId: string;
  excludePageId?: string;
  excludeAffiliateId?: string;
  includeAffiliateUtmifyDefaults?: boolean;
  tracking: TrackingIds;
}) {
  const pages = await prisma.affiliatePage.findMany({
    where: {
      campaign: { companyId: { not: input.companyId } },
      ...(input.excludePageId ? { id: { not: input.excludePageId } } : {}),
    },
    select: {
      fbPixelId: true,
      googlePixelId: true,
      tiktokPixelId: true,
      utmifyTokenEnc: true,
      utmifyPixelScript: true,
      affiliateId: true,
      campaign: {
        select: { company: { select: { paymentGateway: true } } },
      },
      affiliate: {
        select: {
          id: true,
          defaultFbPixelId: true,
          defaultGooglePixelId: true,
          defaultTiktokPixelId: true,
          defaultUtmifyTokenEnc: true,
          utmifyPixelScript: true,
        },
      },
    },
  });
  const other: TrackingIds[] = [];
  const seenAffiliates = new Set<string>();
  for (const page of pages) {
    const sharedAffiliate = page.affiliateId === input.excludeAffiliateId;
    const pagnovoDesk = page.campaign.company?.paymentGateway === "PAGNOVO";
    other.push({
      fbPixelId: sharedAffiliate ? null : page.fbPixelId,
      googlePixelId: sharedAffiliate ? null : page.googlePixelId,
      tiktokPixelId: sharedAffiliate ? null : page.tiktokPixelId,
      utmifyPixelScript: page.utmifyPixelScript,
      utmifyToken: decryptToken(page.utmifyTokenEnc),
      pagnovoDesk,
    });
    if (seenAffiliates.has(page.affiliate.id)) continue;
    seenAffiliates.add(page.affiliate.id);
    other.push({
      fbPixelId: sharedAffiliate ? null : page.affiliate.defaultFbPixelId,
      googlePixelId: sharedAffiliate ? null : page.affiliate.defaultGooglePixelId,
      tiktokPixelId: sharedAffiliate ? null : page.affiliate.defaultTiktokPixelId,
      utmifyPixelScript:
        sharedAffiliate && input.includeAffiliateUtmifyDefaults === false
          ? null
          : page.affiliate.utmifyPixelScript,
      utmifyToken:
        sharedAffiliate && input.includeAffiliateUtmifyDefaults === false
          ? null
          : decryptToken(page.affiliate.defaultUtmifyTokenEnc),
      pagnovoDesk,
    });
  }
  if (hasCrossCompanyPixelConflict(other, input.tracking)) {
    throw new PixelConflictError();
  }
}
