import { prisma } from "@/lib/prisma";
import { paidLiveSalesWhere } from "@/lib/sale-filters";
import { resolvedUtmifyPixelScript } from "@/lib/utmify-desk";
import { sanitizeMetaPixelId, sanitizePixelId } from "@/lib/validators";

const DAY_MS = 24 * 3600_000;

export type TrackingQuality = {
  since: Date;
  pageViews: number;
  sessionsIdentified: number;
  checkouts: number;
  checkoutsWithUtm: number;
  checkoutsWithPixelCookie: number;
  checkoutsWithSrc: number;
  /** Checkouts that kept at least one ad label: UTM, Meta cookie, or src/sck. */
  checkoutsWithAdMark: number;
  paid: number;
  paidWithUtm: number;
  paidWithPixelCookie: number;
  lastPageView: Date | null;
  lastCheckout: Date | null;
  lastSale: Date | null;
  lastWebhook: { provider: string; at: Date } | null;
  webhooks24h: Array<{ provider: string; count: number }>;
  deliveries: { succeeded: number; failed: number; pending: number; cancelled: number };
  failedDeliveries: Array<{ at: Date; error: string | null; campaign: string; affiliate: string; pageId: string }>;
  pages: {
    active: number;
    withFbPixel: number;
    withUtmify: number;
    missing: Array<{ id: string; campaign: string; affiliate: string; fbPixel: boolean; utmify: boolean }>;
  };
  affiliates: { total: number; withDefaultPixel: number; withDefaultUtmify: number };
};

function count(query: Promise<number>) {
  return query.catch(() => 0);
}

/** Read-only picture of how well visits, checkouts and sales are being tagged. */
export async function loadTrackingQuality(companyId: string, affiliateId?: string): Promise<TrackingQuality> {
  const since = new Date(Date.now() - 7 * DAY_MS);
  const dayAgo = new Date(Date.now() - DAY_MS);
  const inCompany = {
    affiliatePage: { ...(affiliateId ? { affiliateId } : {}), campaign: { companyId } },
  } as const;
  const ownSales = { ...paidLiveSalesWhere(companyId), ...(affiliateId ? { affiliateId } : {}) };
  const [
    pageViews,
    sessionsIdentified,
    checkouts,
    checkoutsWithUtm,
    checkoutsWithPixelCookie,
    checkoutsWithSrc,
    checkoutsWithAdMark,
    paid,
    paidWithUtm,
    paidWithPixelCookie,
    lastView,
    lastCheckout,
    lastSale,
    lastWebhook,
    webhookGroups,
    deliveryGroups,
    failedDeliveries,
    pages,
    affiliates,
  ] = await Promise.all([
    count(prisma.trackingEvent.count({ where: { ...inCompany, type: "PAGE_VIEW", createdAt: { gte: since } } })),
    count(
      prisma.trackingEvent.count({
        where: { ...inCompany, type: "PAGE_VIEW", createdAt: { gte: since }, sessionId: { not: null } },
      }),
    ),
    count(prisma.checkoutIntent.count({ where: { ...inCompany, createdAt: { gte: since } } })),
    count(prisma.checkoutIntent.count({ where: { ...inCompany, createdAt: { gte: since }, utmSource: { not: null } } })),
    count(
      prisma.checkoutIntent.count({
        where: { ...inCompany, createdAt: { gte: since }, OR: [{ fbp: { not: null } }, { fbc: { not: null } }] },
      }),
    ),
    count(
      prisma.checkoutIntent.count({
        where: { ...inCompany, createdAt: { gte: since }, OR: [{ src: { not: null } }, { sck: { not: null } }] },
      }),
    ),
    count(
      prisma.checkoutIntent.count({
        where: {
          ...inCompany,
          createdAt: { gte: since },
          OR: [
            { utmSource: { not: null } },
            { fbp: { not: null } },
            { fbc: { not: null } },
            { src: { not: null } },
            { sck: { not: null } },
          ],
        },
      }),
    ),
    count(prisma.sale.count({ where: { ...ownSales, paidAt: { gte: since } } })),
    count(
      prisma.sale.count({
        where: { ...ownSales, paidAt: { gte: since }, checkoutIntent: { utmSource: { not: null } } },
      }),
    ),
    count(
      prisma.sale.count({
        where: {
          ...ownSales,
          paidAt: { gte: since },
          checkoutIntent: { OR: [{ fbp: { not: null } }, { fbc: { not: null } }] },
        },
      }),
    ),
    prisma.trackingEvent
      .findFirst({ where: { ...inCompany, type: "PAGE_VIEW" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } })
      .catch(() => null),
    prisma.checkoutIntent
      .findFirst({ where: inCompany, orderBy: { createdAt: "desc" }, select: { createdAt: true } })
      .catch(() => null),
    prisma.sale
      .findFirst({ where: ownSales, orderBy: { paidAt: "desc" }, select: { paidAt: true } })
      .catch(() => null),
    prisma.webhookEvent
      .findFirst({ orderBy: { processedAt: "desc" }, select: { provider: true, processedAt: true } })
      .catch(() => null),
    prisma.webhookEvent
      .groupBy({ by: ["provider"], where: { processedAt: { gte: dayAgo } }, _count: { _all: true } })
      .catch(() => [] as Array<{ provider: string; _count: { _all: number } }>),
    prisma.integrationDelivery
      .groupBy({ by: ["status"], where: { ...inCompany, createdAt: { gte: since } }, _count: { _all: true } })
      .catch(() => [] as Array<{ status: string; _count: { _all: number } }>),
    prisma.integrationDelivery
      .findMany({
        where: { ...inCompany, status: "FAILED", createdAt: { gte: since } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          updatedAt: true,
          lastError: true,
          affiliatePage: {
            select: { id: true, campaign: { select: { title: true } }, affiliate: { select: { name: true } } },
          },
        },
      })
      .catch(() => []),
    prisma.affiliatePage
      .findMany({
        where: {
          active: true,
          ...(affiliateId ? { affiliateId } : {}),
          campaign: { companyId, status: "ACTIVE" },
        },
        select: {
          id: true,
          fbPixelId: true,
          googlePixelId: true,
          tiktokPixelId: true,
          utmifyTokenEnc: true,
          utmifyPixelScript: true,
          campaign: { select: { title: true, company: { select: { isDefault: true } } } },
          affiliate: {
            select: {
              name: true,
              defaultFbPixelId: true,
              defaultGooglePixelId: true,
              defaultTiktokPixelId: true,
              defaultUtmifyTokenEnc: true,
              utmifyPixelScript: true,
            },
          },
        },
      })
      .catch(() => []),
    prisma.affiliate
      .findMany({
        where: {
          active: true,
          ...(affiliateId ? { id: affiliateId } : {}),
          pages: { some: { campaign: { companyId } } },
        },
        select: { defaultFbPixelId: true, defaultUtmifyTokenEnc: true },
      })
      .catch(() => []),
  ]);

  const deliveries = { succeeded: 0, failed: 0, pending: 0, cancelled: 0 };
  for (const group of deliveryGroups) {
    const n = group._count._all;
    if (group.status === "SUCCEEDED") deliveries.succeeded += n;
    else if (group.status === "FAILED") deliveries.failed += n;
    else if (group.status === "CANCELLED") deliveries.cancelled += n;
    else deliveries.pending += n;
  }
  const missing = pages
    .map((page) => {
      const script = resolvedUtmifyPixelScript(
        page.utmifyPixelScript,
        page.affiliate.utmifyPixelScript,
        page.campaign.company?.isDefault,
      );
      const meta = Boolean(
        sanitizeMetaPixelId(page.fbPixelId) ||
          sanitizeMetaPixelId(page.affiliate.defaultFbPixelId) ||
          sanitizeMetaPixelId(process.env.META_PIXEL_ID),
      );
      const browserPixel = Boolean(
        meta ||
          script ||
          sanitizePixelId(page.googlePixelId) ||
          sanitizePixelId(page.affiliate.defaultGooglePixelId) ||
          sanitizePixelId(page.tiktokPixelId) ||
          sanitizePixelId(page.affiliate.defaultTiktokPixelId),
      );
      const utmify = Boolean(page.utmifyTokenEnc || script || page.affiliate.defaultUtmifyTokenEnc);
      return {
        id: page.id,
        campaign: page.campaign.title,
        affiliate: page.affiliate.name,
        fbPixel: browserPixel,
        utmify,
      };
    })
    .filter((page) => !page.fbPixel || !page.utmify);

  return {
    since,
    pageViews,
    sessionsIdentified,
    checkouts,
    checkoutsWithUtm,
    checkoutsWithPixelCookie,
    checkoutsWithSrc,
    checkoutsWithAdMark,
    paid,
    paidWithUtm,
    paidWithPixelCookie,
    lastPageView: lastView?.createdAt ?? null,
    lastCheckout: lastCheckout?.createdAt ?? null,
    lastSale: lastSale?.paidAt ?? null,
    lastWebhook: lastWebhook ? { provider: lastWebhook.provider, at: lastWebhook.processedAt } : null,
    webhooks24h: webhookGroups.map((group) => ({ provider: group.provider, count: group._count._all })),
    deliveries,
    failedDeliveries: failedDeliveries.map((row) => ({
      at: row.updatedAt,
      error: row.lastError,
      campaign: row.affiliatePage.campaign.title,
      affiliate: row.affiliatePage.affiliate.name,
      pageId: row.affiliatePage.id,
    })),
    pages: {
      active: pages.length,
      withFbPixel: pages.length - missing.filter((page) => !page.fbPixel).length,
      withUtmify: pages.length - missing.filter((page) => !page.utmify).length,
      missing,
    },
    affiliates: {
      total: affiliates.length,
      withDefaultPixel: affiliates.filter((row) => row.defaultFbPixelId).length,
      withDefaultUtmify: affiliates.filter((row) => row.defaultUtmifyTokenEnc).length,
    },
  };
}

/** 0–100 score with the reasons, so the number is never a mystery. */
export function trackingScore(quality: TrackingQuality) {
  const reasons: string[] = [];
  let score = 100;
  const share = (part: number, total: number) => (total > 0 ? part / total : null);
  const utm = share(quality.paidWithUtm, quality.paid);
  if (utm !== null && utm < 0.7) {
    score -= 25;
    reasons.push(`${Math.round(utm * 100)}% das doações pagas chegaram com UTM`);
  }
  const total = quality.deliveries.succeeded + quality.deliveries.failed;
  if (total > 0 && quality.deliveries.failed / total > 0.05) {
    score -= 20;
    reasons.push(`${quality.deliveries.failed} entregas Utmify falharam em 7 dias`);
  }
  if (quality.pages.missing.length) {
    score -= Math.min(15, quality.pages.missing.length * 5);
    const pages = quality.pages.missing.length;
    reasons.push(pages === 1 ? "1 página ativa sem pixel" : `${pages} páginas ativas sem pixel`);
  }
  return { score: Math.max(0, score), reasons };
}
