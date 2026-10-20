import {
  REPORTING_TIME_ZONE,
  addCalendarDays,
  dayBounds,
  inclusiveDayCount,
  reportingHour,
  reportingIsoDate,
  type DateRange,
} from "@/lib/date-range";
import { normalizeGateway, sortGateways } from "@/lib/gateways";
import { prisma } from "@/lib/prisma";
import { paidLiveSalesWhere } from "@/lib/sale-filters";

/* ------------------------------------------------------------------------ */
/* Types                                                                     */
/* ------------------------------------------------------------------------ */

export type SaleRow = {
  id: string;
  amount: number;
  tipAmount: number;
  gatewayFee: number;
  currency: string;
  gateway: string;
  paidAt: Date | null;
  campaignId: string;
  affiliateId: string;
  affiliatePageId: string;
};

export type PageInfo = {
  id: string;
  campaignId: string;
  affiliateId: string;
  campaignTitle: string;
  campaignSlug: string;
  affiliateName: string;
  affiliateSlug: string;
};

export type Totals = {
  revenue: number;
  gifts: number;
  tips: number;
  fees: number;
  clicks: number;
  sessions: number;
  checkouts: number;
  spend: number;
};

export type Metrics = Totals & {
  /** Average gift. */
  ticket: number;
  /** Paid gifts per page click. */
  conversion: number | null;
  /** Checkout starts per page click. */
  checkoutRate: number | null;
  /** Paid gifts per checkout start. */
  checkoutConversion: number | null;
  /** Revenue per visitor (sessions when tracked, otherwise clicks). */
  arpu: number | null;
  visitors: number;
  cpa: number | null;
  cpc: number | null;
  roas: number | null;
  roi: number | null;
  /** Revenue minus gateway fees and ad spend. */
  margin: number;
};

export type EntityMetrics = Metrics & {
  key: string;
  label: string;
  sublabel?: string;
  href?: string;
};

export type DayMetrics = Metrics & { day: string };

export type HourCell = { weekday: number; hour: number; gifts: number; revenue: number; clicks: number };

export type TimelineCell = { day: string; hour: number; gifts: number; revenue: number; clicks: number; checkouts: number };

export type AnalyticsData = {
  range: DateRange;
  currency: string;
  totals: Metrics;
  campaigns: EntityMetrics[];
  affiliates: EntityMetrics[];
  gateways: EntityMetrics[];
  days: DayMetrics[];
  heatmap: HourCell[];
  timeline: TimelineCell[];
  /** One timeline per campaign, so a quiet stretch can be named. */
  campaignTimelines: CampaignTimeline[];
  /** Spend rows that could not be matched to a campaign (company-level). */
  unassignedSpend: number;
  spendEntries: number;
};

type TrackRow = { affiliatePageId: string; type: string; events: number; sessions: number };
type TrackHourRow = {
  campaignId: string;
  day: string;
  hour: number;
  type: string;
  events: number;
  sessions: number;
};

export type CampaignTimeline = {
  key: string;
  label: string;
  href: string;
  timeline: TimelineCell[];
};

/* ------------------------------------------------------------------------ */
/* Arithmetic                                                                */
/* ------------------------------------------------------------------------ */

export function emptyTotals(): Totals {
  return { revenue: 0, gifts: 0, tips: 0, fees: 0, clicks: 0, sessions: 0, checkouts: 0, spend: 0 };
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

export function deriveMetrics(totals: Totals): Metrics {
  const visitors = totals.sessions > 0 ? totals.sessions : totals.clicks;
  return {
    ...totals,
    ticket: totals.gifts > 0 ? Math.round(totals.revenue / totals.gifts) : 0,
    conversion: ratio(totals.gifts, totals.clicks),
    checkoutRate: ratio(totals.checkouts, totals.clicks),
    checkoutConversion: ratio(totals.gifts, totals.checkouts),
    arpu: visitors > 0 ? Math.round(totals.revenue / visitors) : null,
    visitors,
    cpa: totals.spend > 0 && totals.gifts > 0 ? Math.round(totals.spend / totals.gifts) : null,
    cpc: totals.spend > 0 && totals.clicks > 0 ? Math.round(totals.spend / totals.clicks) : null,
    roas: totals.spend > 0 ? totals.revenue / totals.spend : null,
    roi: totals.spend > 0 ? (totals.revenue - totals.fees - totals.spend) / totals.spend : null,
    margin: totals.revenue - totals.fees - totals.spend,
  };
}

function add(target: Totals, part: Partial<Totals>) {
  for (const key of Object.keys(part) as Array<keyof Totals>) {
    target[key] += part[key] ?? 0;
  }
}

function bucket<T>(map: Map<string, T>, key: string, make: () => T) {
  let value = map.get(key);
  if (!value) {
    value = make();
    map.set(key, value);
  }
  return value;
}

function weekdayOf(iso: string) {
  // 0 = Sunday … 6 = Saturday, computed on the civil date itself.
  return new Date(`${iso}T12:00:00.000Z`).getUTCDay();
}

export function dayToIso(day: Date) {
  return day.toISOString().slice(0, 10);
}

export function isoToDay(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

/* ------------------------------------------------------------------------ */
/* Queries (read-only)                                                       */
/* ------------------------------------------------------------------------ */

export async function loadPages(companyId: string, affiliateId?: string): Promise<Map<string, PageInfo>> {
  const pages = await prisma.affiliatePage.findMany({
    where: { ...(affiliateId ? { affiliateId } : {}), campaign: { companyId } },
    select: {
      id: true,
      campaignId: true,
      affiliateId: true,
      campaign: { select: { title: true, slug: true } },
      affiliate: { select: { name: true, slug: true } },
    },
  });
  return new Map(
    pages.map((page) => [
      page.id,
      {
        id: page.id,
        campaignId: page.campaignId,
        affiliateId: page.affiliateId,
        campaignTitle: page.campaign.title,
        campaignSlug: page.campaign.slug,
        affiliateName: page.affiliate.name,
        affiliateSlug: page.affiliate.slug,
      },
    ]),
  );
}

export async function loadSales(companyId: string, range: DateRange, affiliateId?: string): Promise<SaleRow[]> {
  const { fromDate, toDate } = dayBounds(range);
  return prisma.sale.findMany({
    where: {
      ...paidLiveSalesWhere(companyId),
      ...(affiliateId ? { affiliateId } : {}),
      paidAt: { gte: fromDate, lte: toDate },
    },
    select: {
      id: true,
      amount: true,
      tipAmount: true,
      gatewayFee: true,
      currency: true,
      gateway: true,
      paidAt: true,
      campaignId: true,
      affiliateId: true,
      affiliatePageId: true,
    },
  });
}

/**
 * Page views and checkout starts per affiliate page. One aggregate query so
 * a month of events never travels row by row to the app.
 */
async function loadTracking(companyId: string, range: DateRange, affiliateId?: string): Promise<TrackRow[]> {
  const { fromDate, toDate } = dayBounds(range);
  const affiliateSql = affiliateId
    ? prisma.$queryRaw<TrackRow[]>`
      SELECT "TrackingEvent"."affiliatePageId" AS "affiliatePageId",
             "TrackingEvent"."type"::text AS "type",
             COUNT(*)::int AS "events",
             COUNT(DISTINCT "TrackingEvent"."sessionId")::int AS "sessions"
      FROM "TrackingEvent"
      JOIN "AffiliatePage" ON "AffiliatePage"."id" = "TrackingEvent"."affiliatePageId"
      JOIN "Campaign" ON "Campaign"."id" = "AffiliatePage"."campaignId"
      WHERE "Campaign"."companyId" = ${companyId}::uuid
        AND "AffiliatePage"."affiliateId" = ${affiliateId}::uuid
        AND "TrackingEvent"."createdAt" >= ${fromDate}
        AND "TrackingEvent"."createdAt" <= ${toDate}
      GROUP BY 1, 2
    `
    : prisma.$queryRaw<TrackRow[]>`
      SELECT "TrackingEvent"."affiliatePageId" AS "affiliatePageId",
             "TrackingEvent"."type"::text AS "type",
             COUNT(*)::int AS "events",
             COUNT(DISTINCT "TrackingEvent"."sessionId")::int AS "sessions"
      FROM "TrackingEvent"
      JOIN "AffiliatePage" ON "AffiliatePage"."id" = "TrackingEvent"."affiliatePageId"
      JOIN "Campaign" ON "Campaign"."id" = "AffiliatePage"."campaignId"
      WHERE "Campaign"."companyId" = ${companyId}::uuid
        AND "TrackingEvent"."createdAt" >= ${fromDate}
        AND "TrackingEvent"."createdAt" <= ${toDate}
      GROUP BY 1, 2
    `;
  try {
    return await affiliateSql;
  } catch (error) {
    console.error("analytics tracking query failed", error instanceof Error ? error.message : error);
    return [];
  }
}

/** Same events by civil day and hour in the reporting time zone. */
async function loadTrackingByHour(
  companyId: string,
  range: DateRange,
  affiliateId?: string,
): Promise<TrackHourRow[]> {
  const { fromDate, toDate } = dayBounds(range);
  const hourlySql = affiliateId
    ? prisma.$queryRaw<TrackHourRow[]>`
      SELECT "AffiliatePage"."campaignId" AS "campaignId",
             to_char(("TrackingEvent"."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${REPORTING_TIME_ZONE}::text, 'YYYY-MM-DD') AS "day",
             EXTRACT(HOUR FROM ("TrackingEvent"."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${REPORTING_TIME_ZONE}::text)::int AS "hour",
             "TrackingEvent"."type"::text AS "type",
             COUNT(*)::int AS "events",
             COUNT(DISTINCT "TrackingEvent"."sessionId")::int AS "sessions"
      FROM "TrackingEvent"
      JOIN "AffiliatePage" ON "AffiliatePage"."id" = "TrackingEvent"."affiliatePageId"
      JOIN "Campaign" ON "Campaign"."id" = "AffiliatePage"."campaignId"
      WHERE "Campaign"."companyId" = ${companyId}::uuid
        AND "AffiliatePage"."affiliateId" = ${affiliateId}::uuid
        AND "TrackingEvent"."createdAt" >= ${fromDate}
        AND "TrackingEvent"."createdAt" <= ${toDate}
      GROUP BY 1, 2, 3, 4
    `
    : prisma.$queryRaw<TrackHourRow[]>`
      SELECT "AffiliatePage"."campaignId" AS "campaignId",
             to_char(("TrackingEvent"."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${REPORTING_TIME_ZONE}::text, 'YYYY-MM-DD') AS "day",
             EXTRACT(HOUR FROM ("TrackingEvent"."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${REPORTING_TIME_ZONE}::text)::int AS "hour",
             "TrackingEvent"."type"::text AS "type",
             COUNT(*)::int AS "events",
             COUNT(DISTINCT "TrackingEvent"."sessionId")::int AS "sessions"
      FROM "TrackingEvent"
      JOIN "AffiliatePage" ON "AffiliatePage"."id" = "TrackingEvent"."affiliatePageId"
      JOIN "Campaign" ON "Campaign"."id" = "AffiliatePage"."campaignId"
      WHERE "Campaign"."companyId" = ${companyId}::uuid
        AND "TrackingEvent"."createdAt" >= ${fromDate}
        AND "TrackingEvent"."createdAt" <= ${toDate}
      GROUP BY 1, 2, 3, 4
    `;
  try {
    return await hourlySql;
  } catch (error) {
    console.error("analytics hourly query failed", error instanceof Error ? error.message : error);
    return [];
  }
}

export type SpendRow = {
  id: string;
  day: string;
  source: string;
  amount: number;
  currency: string;
  campaignId: string | null;
  affiliateId: string | null;
  note: string | null;
};

export async function loadSpend(companyId: string, range: DateRange, affiliateId?: string): Promise<SpendRow[]> {
  try {
    const rows = await prisma.adSpend.findMany({
      where: {
        companyId,
        ...(affiliateId ? { affiliateId } : {}),
        day: { gte: isoToDay(range.from), lte: isoToDay(range.to) },
      },
      orderBy: [{ day: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        day: true,
        source: true,
        amount: true,
        currency: true,
        campaignId: true,
        affiliateId: true,
        note: true,
      },
    });
    return rows.map((row) => ({ ...row, day: dayToIso(row.day) }));
  } catch (error) {
    // Table missing until the migration runs: analytics still works without spend.
    console.error("ad spend query failed", error instanceof Error ? error.message : error);
    return [];
  }
}

/* ------------------------------------------------------------------------ */
/* Assembly                                                                  */
/* ------------------------------------------------------------------------ */

export async function loadAnalytics(
  companyId: string,
  range: DateRange,
  options: { pages?: Map<string, PageInfo>; fallbackCurrency?: string; affiliateId?: string } = {},
): Promise<AnalyticsData> {
  const affiliateId = options.affiliateId;
  const pages = options.pages ?? (await loadPages(companyId, affiliateId));
  const [sales, tracking, hourly, spend] = await Promise.all([
    loadSales(companyId, range, affiliateId),
    loadTracking(companyId, range, affiliateId),
    loadTrackingByHour(companyId, range, affiliateId),
    loadSpend(companyId, range, affiliateId),
  ]);
  return assemble({ range, sales, tracking, hourly, spend, pages, fallbackCurrency: options.fallbackCurrency });
}

export function assemble({
  range,
  sales,
  tracking,
  hourly,
  spend,
  pages,
  fallbackCurrency = "USD",
}: {
  range: DateRange;
  sales: SaleRow[];
  tracking: TrackRow[];
  hourly: TrackHourRow[];
  spend: SpendRow[];
  pages: Map<string, PageInfo>;
  fallbackCurrency?: string;
}): AnalyticsData {
  const currency = sales[0]?.currency ?? spend[0]?.currency ?? fallbackCurrency;
  const totals = emptyTotals();
  const byCampaign = new Map<string, Totals>();
  const byAffiliate = new Map<string, Totals>();
  const byGateway = new Map<string, Totals>();
  const byDay = new Map<string, Totals>();
  const heat = new Map<string, HourCell>();
  const timeline = new Map<string, TimelineCell>();
  const campaignHours = new Map<string, Map<string, TimelineCell>>();
  const campaignSlot = (campaignId: string, day: string, hour: number) => {
    const hours = bucket(campaignHours, campaignId, () => new Map<string, TimelineCell>());
    return bucket(hours, `${day}-${hour}`, () => ({
      day,
      hour,
      gifts: 0,
      revenue: 0,
      clicks: 0,
      checkouts: 0,
    }));
  };
  const campaignLabels = new Map<string, { title: string; slug: string }>();
  const affiliateLabels = new Map<string, { name: string; slug: string }>();
  for (const page of pages.values()) {
    campaignLabels.set(page.campaignId, { title: page.campaignTitle, slug: page.campaignSlug });
    affiliateLabels.set(page.affiliateId, { name: page.affiliateName, slug: page.affiliateSlug });
  }

  const dayKeys = Array.from({ length: inclusiveDayCount(range.from, range.to) }, (_, index) =>
    addCalendarDays(range.from, index),
  );
  for (const day of dayKeys) byDay.set(day, emptyTotals());

  for (const sale of sales) {
    const part = { revenue: sale.amount, gifts: 1, tips: sale.tipAmount, fees: sale.gatewayFee };
    add(totals, part);
    add(bucket(byCampaign, sale.campaignId, emptyTotals), part);
    add(bucket(byAffiliate, sale.affiliateId, emptyTotals), part);
    add(bucket(byGateway, normalizeGateway(sale.gateway), emptyTotals), part);
    if (sale.paidAt) {
      const day = reportingIsoDate(sale.paidAt);
      const hour = reportingHour(sale.paidAt);
      add(bucket(byDay, day, emptyTotals), part);
      const cell = bucket(heat, `${weekdayOf(day)}-${hour}`, () => ({
        weekday: weekdayOf(day),
        hour,
        gifts: 0,
        revenue: 0,
        clicks: 0,
      }));
      cell.gifts += 1;
      cell.revenue += sale.amount;
      const slot = bucket(timeline, `${day}-${hour}`, () => ({
        day,
        hour,
        gifts: 0,
        revenue: 0,
        clicks: 0,
        checkouts: 0,
      }));
      slot.gifts += 1;
      slot.revenue += sale.amount;
      const campaignCell = campaignSlot(sale.campaignId, day, hour);
      campaignCell.gifts += 1;
      campaignCell.revenue += sale.amount;
    }
  }

  for (const row of tracking) {
    const page = pages.get(row.affiliatePageId);
    const part =
      row.type === "PAGE_VIEW"
        ? { clicks: row.events, sessions: row.sessions }
        : row.type === "CHECKOUT_STARTED"
          ? { checkouts: row.events }
          : null;
    if (!part) continue;
    add(totals, part);
    if (page) {
      add(bucket(byCampaign, page.campaignId, emptyTotals), part);
      add(bucket(byAffiliate, page.affiliateId, emptyTotals), part);
    }
  }

  for (const row of hourly) {
    const isView = row.type === "PAGE_VIEW";
    const isCheckout = row.type === "CHECKOUT_STARTED";
    if (!isView && !isCheckout) continue;
    if (!byDay.has(row.day)) continue;
    add(byDay.get(row.day) as Totals, isView ? { clicks: row.events, sessions: row.sessions } : { checkouts: row.events });
    const slot = bucket(timeline, `${row.day}-${row.hour}`, () => ({
      day: row.day,
      hour: row.hour,
      gifts: 0,
      revenue: 0,
      clicks: 0,
      checkouts: 0,
    }));
    if (isView) slot.clicks += row.events;
    else slot.checkouts += row.events;
    if (row.campaignId) {
      const campaignCell = campaignSlot(row.campaignId, row.day, row.hour);
      if (isView) campaignCell.clicks += row.events;
      else campaignCell.checkouts += row.events;
    }
    if (isView) {
      const cell = bucket(heat, `${weekdayOf(row.day)}-${row.hour}`, () => ({
        weekday: weekdayOf(row.day),
        hour: row.hour,
        gifts: 0,
        revenue: 0,
        clicks: 0,
      }));
      cell.clicks += row.events;
    }
  }

  let unassignedSpend = 0;
  for (const row of spend) {
    add(totals, { spend: row.amount });
    if (byDay.has(row.day)) add(byDay.get(row.day) as Totals, { spend: row.amount });
    if (row.campaignId) add(bucket(byCampaign, row.campaignId, emptyTotals), { spend: row.amount });
    else unassignedSpend += row.amount;
    if (row.affiliateId) add(bucket(byAffiliate, row.affiliateId, emptyTotals), { spend: row.amount });
  }

  const campaigns: EntityMetrics[] = [...byCampaign.entries()]
    .map(([id, value]) => {
      const label = campaignLabels.get(id);
      return {
        key: id,
        label: label?.title ?? "Campanha removida",
        sublabel: label ? `/${label.slug}` : undefined,
        href: `/admin/campaigns/${id}`,
        ...deriveMetrics(value),
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.clicks - a.clicks);
  const affiliates: EntityMetrics[] = [...byAffiliate.entries()]
    .map(([id, value]) => {
      const label = affiliateLabels.get(id);
      return {
        key: id,
        label: label?.name ?? "Afiliado removido",
        sublabel: label ? label.slug : undefined,
        href: `/admin/affiliates/${id}`,
        ...deriveMetrics(value),
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.clicks - a.clicks);
  const gateways: EntityMetrics[] = sortGateways(byGateway.keys()).map((gateway) => ({
    key: gateway,
    label: gateway,
    ...deriveMetrics(byGateway.get(gateway) as Totals),
  }));
  const days: DayMetrics[] = dayKeys.map((day) => ({ day, ...deriveMetrics(byDay.get(day) as Totals) }));

  return {
    range,
    currency,
    totals: deriveMetrics(totals),
    campaigns,
    affiliates,
    gateways,
    days,
    heatmap: [...heat.values()],
    timeline: [...timeline.values()].sort((a, b) => a.day.localeCompare(b.day) || a.hour - b.hour),
    campaignTimelines: [...campaignHours.entries()].map(([id, hours]) => {
      const label = campaignLabels.get(id);
      return {
        key: id,
        label: label?.title ?? "Campanha",
        href: `/admin/campaigns/${id}`,
        timeline: [...hours.values()].sort((a, b) => a.day.localeCompare(b.day) || a.hour - b.hour),
      };
    }),
    unassignedSpend,
    spendEntries: spend.length,
  };
}

/* ------------------------------------------------------------------------ */
/* Formatting helpers shared by the analytics screens                        */
/* ------------------------------------------------------------------------ */

export function formatRate(value: number | null, digits = 1) {
  if (value === null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatMultiple(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(value >= 10 ? 1 : 2)}×`;
}

export function formatSignedRate(value: number | null) {
  if (value === null) return "—";
  const percent = value * 100;
  return `${percent > 0 ? "+" : ""}${percent.toFixed(0)}%`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
