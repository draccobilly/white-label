import { campaignNameTag } from "@/lib/campaign-label";
import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/request-status";
import { paidLiveSalesWhere } from "@/lib/sale-filters";

const MINUTE = 60_000;

/** Longitude the globe faces when nobody is on the site: the desk's region. */
export function homeLongitudeFor(timeZone: string) {
  const table: Record<string, number> = {
    "America/Los_Angeles": -118,
    "America/Denver": -105,
    "America/Phoenix": -112,
    "America/Chicago": -88,
    "America/New_York": -74,
    "America/Toronto": -79,
    "America/Mexico_City": -99,
    "America/Bogota": -74,
    "America/Lima": -77,
    "America/Sao_Paulo": -47,
    "America/Argentina/Buenos_Aires": -58,
    "America/Santiago": -71,
  };
  if (timeZone in table) return table[timeZone];
  if (timeZone.startsWith("America/")) return -75;
  if (timeZone.startsWith("Europe/") || timeZone.startsWith("Africa/")) return 10;
  if (timeZone.startsWith("Asia/")) return 90;
  if (timeZone.startsWith("Australia/")) return 135;
  return -60;
}

/** Shapes exchanged by /api/admin/live and the LiveNow strip. */

export type LiveEvent = {
  kind: "view" | "checkout" | "paid";
  label: string;
  sub: string;
  at: string;
  amount?: number;
  currency?: string;
  /** Product name sent to the gateway. Present on paid gifts. */
  tag?: string;
};

/** Open tabs right now, grouped by place, for the globe. */
export type LivePlace = {
  country: string;
  city: string | null;
  latitude: number;
  longitude: number;
  /** Distinct sessions still open in this place. */
  visitors: number;
  checkouts: number;
  lastAt: string;
  /** Longest open tab in this place. */
  openForMs: number;
};

/** Someone who was on a page in the last 30 minutes and has left. */
export type LiveDeparted = {
  country: string;
  city: string | null;
  stayedMs: number;
  leftAt: string;
  donatedAfterMs: number | null;
  amount: number | null;
  currency: string | null;
};

export type DwellBucket = {
  label: string;
  gifts: number;
  avgAmount: number;
};

/** Paid gifts we can time from tab-open to payment. Older gifts have no clock. */
export type DwellPattern = {
  gifts: number;
  buckets: DwellBucket[];
};

/** One browser tab in the last 30 minutes, with what it did. */
export type VisitStory = {
  country: string | null;
  city: string | null;
  /** Donor name when a payment is tied to this visit. */
  name: string | null;
  what: "donated" | "left" | "open";
  at: string;
  stayedMs: number;
  donatedAfterMs: number | null;
  amount: number | null;
  currency: string | null;
  /** Closed before the next heartbeat, with no payment. */
  quick: boolean;
  stillOpen: boolean;
};

/** Sessions seen in the last 30 minutes, counted once per browser tab. */
export type VisitFlow = {
  entered: number;
  donated: number;
  leftWithout: number;
  stillOpen: number;
  /** Left without a gift after a single heartbeat (under 20 seconds). */
  leftQuick: number;
  closed: number;
};

export type LiveSnapshot = {
  at: string;
  visitors5m: number;
  views5m: number;
  checkouts15m: number;
  paid60m: number;
  revenue60m: number;
  currency: string;
  /** Page views per minute, oldest first (60 values). */
  perMinute: number[];
  recent: LiveEvent[];
  places: LivePlace[];
  /** Sessions that left in the last 30 minutes. The globe does not show these. */
  departed: LiveDeparted[];
  /** Entered, donated, and left-without-giving in the same 30-minute window. */
  flow: VisitFlow;
  /** One row per visit in that window: who, what, when. */
  stories: VisitStory[];
  /** Time on page versus gift size, for gifts that carried a session id. */
  dwell: DwellPattern;
  /** Visitors of the last 30 minutes with and without a resolved location. */
  located: number;
  unlocated: number;
  /** False until the location columns exist in the database. */
  geoReady: boolean;
};

type LiveEventRow = {
  type: string;
  createdAt: Date;
  sessionId: string | null;
  affiliatePageId: string;
  country?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const EVENT_SELECT = { type: true, createdAt: true, sessionId: true, affiliatePageId: true } as const;
const GEO_SELECT = { ...EVENT_SELECT, country: true, city: true, latitude: true, longitude: true } as const;

/** Events of the last hour, with the location columns when they exist. */
function livePageWhere(companyId: string, affiliateId?: string) {
  return { affiliatePage: { ...(affiliateId ? { affiliateId } : {}), campaign: { companyId } } };
}

async function loadEvents(
  companyId: string,
  since: Date,
  affiliateId?: string,
): Promise<{ rows: LiveEventRow[]; geoReady: boolean }> {
  const where = { createdAt: { gte: since }, ...livePageWhere(companyId, affiliateId) };
  try {
    const rows = await prisma.trackingEvent.findMany({
      where,
      select: GEO_SELECT,
      orderBy: { createdAt: "desc" },
      take: 4000,
    });
    return { rows, geoReady: true };
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    const rows = await prisma.trackingEvent.findMany({
      where,
      select: EVENT_SELECT,
      orderBy: { createdAt: "desc" },
      take: 4000,
    });
    return { rows, geoReady: false };
  }
}

/** Groups located visitors of the last 30 minutes by city (or country). */
export function groupPlaces(events: LiveEventRow[], now: number): { places: LivePlace[]; located: number; unlocated: number } {
  const cutoff = now - 30 * MINUTE;
  const groups = new Map<
    string,
    { country: string; city: string | null; lat: number; lng: number; n: number; sessions: Set<string>; events: number; checkouts: number; lastAt: number }
  >();
  const seenLocated = new Set<string>();
  const seenUnlocated = new Set<string>();
  let anonymousLocated = 0;
  let anonymousUnlocated = 0;
  for (const event of events) {
    const at = event.createdAt.getTime();
    if (at < cutoff) continue;
    if (event.type !== "PAGE_VIEW" && event.type !== "CHECKOUT_STARTED") continue;
    const hasPoint =
      typeof event.latitude === "number" &&
      typeof event.longitude === "number" &&
      Number.isFinite(event.latitude) &&
      Number.isFinite(event.longitude) &&
      Boolean(event.country);
    if (!hasPoint) {
      if (event.type !== "PAGE_VIEW") continue;
      if (event.sessionId) seenUnlocated.add(event.sessionId);
      else anonymousUnlocated += 1;
      continue;
    }
    const key = `${event.country}|${event.city ?? ""}`;
    const group = groups.get(key) ?? {
      country: event.country as string,
      city: event.city ?? null,
      lat: 0,
      lng: 0,
      n: 0,
      sessions: new Set<string>(),
      events: 0,
      checkouts: 0,
      lastAt: 0,
    };
    group.lat += event.latitude as number;
    group.lng += event.longitude as number;
    group.n += 1;
    if (event.type === "CHECKOUT_STARTED") group.checkouts += 1;
    else {
      if (event.sessionId) {
        group.sessions.add(event.sessionId);
        seenLocated.add(event.sessionId);
      } else {
        group.events += 1;
        anonymousLocated += 1;
      }
    }
    group.lastAt = Math.max(group.lastAt, at);
    groups.set(key, group);
  }
  const places = [...groups.values()]
    .map((group) => ({
      country: group.country,
      city: group.city,
      latitude: Math.round((group.lat / group.n) * 100) / 100,
      longitude: Math.round((group.lng / group.n) * 100) / 100,
      visitors: group.sessions.size + group.events,
      checkouts: group.checkouts,
      lastAt: new Date(group.lastAt).toISOString(),
      openForMs: 0,
    }))
    .filter((place) => place.visitors > 0 || place.checkouts > 0)
    .sort((a, b) => b.visitors - a.visitors || b.lastAt.localeCompare(a.lastAt))
    .slice(0, 80);
  return {
    places,
    located: seenLocated.size + anonymousLocated,
    unlocated: seenUnlocated.size + anonymousUnlocated,
  };
}


const OPEN_MS = 45_000;
/** Matches the public heartbeat. One ping means the tab closed before the next one. */
const QUICK_MS = 20_000;

const EMPTY_FLOW: VisitFlow = {
  entered: 0,
  donated: 0,
  leftWithout: 0,
  stillOpen: 0,
  leftQuick: 0,
  closed: 0,
};

function schemaNotReady(error: unknown) {
  if (isMissingColumnError(error)) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2021"
  );
}

type PresenceRow = {
  sessionId: string;
  startedAt: Date;
  lastSeenAt: Date;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

type GiftClock = {
  sessionId: string;
  amount: number;
  currency: string;
  paidAt: Date;
  startedAt: Date;
  name: string | null;
};

function donorName(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.toLowerCase() === "anonymous") return null;
  return trimmed;
}

function summarizeFlow(rows: PresenceRow[], gifts: Map<string, GiftClock>, now: number): VisitFlow {
  const bySession = new Map<string, PresenceRow[]>();
  for (const row of rows) {
    const list = bySession.get(row.sessionId) ?? [];
    list.push(row);
    bySession.set(row.sessionId, list);
  }
  const flow = { ...EMPTY_FLOW, entered: bySession.size };
  for (const [sessionId, sessionRows] of bySession) {
    const open = sessionRows.some((row) => now - row.lastSeenAt.getTime() <= OPEN_MS);
    const gave = gifts.has(sessionId);
    if (gave) flow.donated += 1;
    if (open) {
      flow.stillOpen += 1;
      continue;
    }
    flow.closed += 1;
    if (gave) continue;
    flow.leftWithout += 1;
    const stayed = Math.max(
      ...sessionRows.map((row) => Math.max(0, row.lastSeenAt.getTime() - row.startedAt.getTime())),
    );
    if (stayed < QUICK_MS) flow.leftQuick += 1;
  }
  return flow;
}

function buildStories(rows: PresenceRow[], gifts: Map<string, GiftClock>, now: number): VisitStory[] {
  const bySession = new Map<string, PresenceRow[]>();
  for (const row of rows) {
    const list = bySession.get(row.sessionId) ?? [];
    list.push(row);
    bySession.set(row.sessionId, list);
  }
  const stories: VisitStory[] = [];
  for (const [sessionId, sessionRows] of bySession) {
    const located = sessionRows.find(hasPoint) ?? sessionRows[0];
    const stayedMs = Math.max(
      ...sessionRows.map((row) => Math.max(0, row.lastSeenAt.getTime() - row.startedAt.getTime())),
    );
    const stillOpen = sessionRows.some((row) => now - row.lastSeenAt.getTime() <= OPEN_MS);
    const leftAt = Math.max(...sessionRows.map((row) => row.lastSeenAt.getTime()));
    const gift = gifts.get(sessionId);
    const donatedAfterMs = gift ? gift.paidAt.getTime() - gift.startedAt.getTime() : null;
    const what = gift ? "donated" : stillOpen ? "open" : "left";
    stories.push({
      country: located.country,
      city: located.city,
      name: gift?.name ?? null,
      what,
      at: (gift ? gift.paidAt : new Date(stillOpen ? now : leftAt)).toISOString(),
      stayedMs,
      donatedAfterMs: donatedAfterMs !== null && donatedAfterMs >= 0 ? donatedAfterMs : null,
      amount: gift?.amount ?? null,
      currency: gift?.currency ?? null,
      quick: what === "left" && stayedMs < QUICK_MS,
      stillOpen,
    });
  }
  const rank = { donated: 0, open: 1, left: 2 };
  stories.sort((a, b) => {
    if (a.what !== b.what) return rank[a.what] - rank[b.what];
    if (a.what === "left" && a.quick !== b.quick) return a.quick ? 1 : -1;
    return b.at.localeCompare(a.at);
  });
  return stories.slice(0, 40);
}

function hasPoint(row: PresenceRow) {
  return (
    typeof row.latitude === "number" &&
    typeof row.longitude === "number" &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude) &&
    Boolean(row.country)
  );
}

async function loadPresence(companyId: string, now: number, affiliateId?: string): Promise<{
  places: LivePlace[];
  departed: LiveDeparted[];
  flow: VisitFlow;
  stories: VisitStory[];
  dwell: DwellPattern;
  located: number;
  unlocated: number;
}> {
  const empty = {
    places: [] as LivePlace[],
    departed: [] as LiveDeparted[],
    flow: { ...EMPTY_FLOW },
    stories: [] as VisitStory[],
    dwell: { gifts: 0, buckets: [] as DwellBucket[] },
    located: 0,
    unlocated: 0,
  };
  let rows: PresenceRow[] = [];
  try {
    rows = await prisma.visitorPresence.findMany({
      where: {
        lastSeenAt: { gte: new Date(now - 30 * MINUTE) },
        ...livePageWhere(companyId, affiliateId),
      },
      select: {
        sessionId: true,
        startedAt: true,
        lastSeenAt: true,
        country: true,
        city: true,
        latitude: true,
        longitude: true,
      },
    });
  } catch (error) {
    if (!schemaNotReady(error)) throw error;
    return empty;
  }

  let gifts: GiftClock[] = [];
  try {
    const sales = await prisma.sale.findMany({
      where: {
        ...paidLiveSalesWhere(companyId),
        ...(affiliateId ? { affiliateId } : {}),
        paidAt: { gte: new Date(now - 14 * 24 * 60 * MINUTE) },
        checkoutIntent: { visitorSessionId: { not: null } },
      },
      select: {
        amount: true,
        currency: true,
        paidAt: true,
        customerName: true,
        checkoutIntent: { select: { visitorSessionId: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 400,
    });
    const sessionIds = [
      ...new Set(
        sales
          .map((sale) => sale.checkoutIntent.visitorSessionId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const starts = sessionIds.length
      ? await prisma.visitorPresence.findMany({
          where: { sessionId: { in: sessionIds } },
          select: { sessionId: true, startedAt: true },
        })
      : [];
    const started = new Map<string, number>();
    for (const row of starts) {
      const at = row.startedAt.getTime();
      const prev = started.get(row.sessionId);
      if (prev === undefined || at < prev) started.set(row.sessionId, at);
    }
    gifts = sales.flatMap((sale) => {
      const sessionId = sale.checkoutIntent.visitorSessionId;
      const start = sessionId ? started.get(sessionId) : undefined;
      if (!sessionId || start === undefined || !sale.paidAt) return [];
      return [{
        sessionId,
        amount: sale.amount,
        currency: sale.currency,
        paidAt: sale.paidAt,
        startedAt: new Date(start),
        name: donorName(sale.customerName),
      }];
    });
  } catch (error) {
    if (!schemaNotReady(error)) throw error;
  }

  const giftBySession = new Map<string, GiftClock>();
  for (const gift of gifts) {
    if (!giftBySession.has(gift.sessionId)) giftBySession.set(gift.sessionId, gift);
  }
  const open = rows.filter((row) => now - row.lastSeenAt.getTime() <= OPEN_MS);
  const closed = rows.filter((row) => now - row.lastSeenAt.getTime() > OPEN_MS);
  const groups = new Map<
    string,
    { country: string; city: string | null; lat: number; lng: number; n: number; sessions: Set<string>; lastAt: number; openForMs: number; checkouts: number }
  >();
  let located = 0;
  let unlocated = 0;
  for (const row of open) {
    if (!hasPoint(row)) {
      unlocated += 1;
      continue;
    }
    located += 1;
    const key = `${row.country}|${row.city ?? ""}`;
    const group = groups.get(key) ?? {
      country: row.country as string,
      city: row.city,
      lat: 0,
      lng: 0,
      n: 0,
      sessions: new Set<string>(),
      lastAt: 0,
      openForMs: 0,
      checkouts: 0,
    };
    group.lat += row.latitude as number;
    group.lng += row.longitude as number;
    group.n += 1;
    group.sessions.add(row.sessionId);
    group.lastAt = Math.max(group.lastAt, row.lastSeenAt.getTime());
    group.openForMs = Math.max(group.openForMs, now - row.startedAt.getTime());
    if (giftBySession.has(row.sessionId)) group.checkouts += 1;
    groups.set(key, group);
  }
  const places = [...groups.values()]
    .map((group) => ({
      country: group.country,
      city: group.city,
      latitude: Math.round((group.lat / group.n) * 100) / 100,
      longitude: Math.round((group.lng / group.n) * 100) / 100,
      visitors: group.sessions.size,
      checkouts: group.checkouts,
      lastAt: new Date(group.lastAt).toISOString(),
      openForMs: group.openForMs,
    }))
    .sort((a, b) => b.visitors - a.visitors || b.openForMs - a.openForMs)
    .slice(0, 80);

  const departed = closed
    .filter(hasPoint)
    .map((row) => {
      const gift = giftBySession.get(row.sessionId);
      const donatedAfterMs = gift ? gift.paidAt.getTime() - gift.startedAt.getTime() : null;
      return {
        country: row.country as string,
        city: row.city,
        stayedMs: Math.max(0, row.lastSeenAt.getTime() - row.startedAt.getTime()),
        leftAt: row.lastSeenAt.toISOString(),
        donatedAfterMs: donatedAfterMs !== null && donatedAfterMs >= 0 ? donatedAfterMs : null,
        amount: gift?.amount ?? null,
        currency: gift?.currency ?? null,
      };
    })
    .sort((a, b) => b.leftAt.localeCompare(a.leftAt))
    .slice(0, 12);

  const flow = summarizeFlow(rows, giftBySession, now);

  const buckets = [
    { label: "até 1 min", min: 0, max: 60_000, gifts: 0, amount: 0 },
    { label: "1–3 min", min: 60_000, max: 180_000, gifts: 0, amount: 0 },
    { label: "mais de 3 min", min: 180_000, max: Number.POSITIVE_INFINITY, gifts: 0, amount: 0 },
  ];
  for (const gift of gifts) {
    const wait = gift.paidAt.getTime() - gift.startedAt.getTime();
    if (wait < 0) continue;
    const bucket = buckets.find((item) => wait >= item.min && wait < item.max);
    if (!bucket) continue;
    bucket.gifts += 1;
    bucket.amount += gift.amount;
  }
  return {
    places,
    departed,
    flow,
    stories: buildStories(rows, giftBySession, now),
    dwell: {
      gifts: buckets.reduce((sum, bucket) => sum + bucket.gifts, 0),
      buckets: buckets.map((bucket) => ({
        label: bucket.label,
        gifts: bucket.gifts,
        avgAmount: bucket.gifts ? Math.round(bucket.amount / bucket.gifts) : 0,
      })),
    },
    located,
    unlocated,
  };
}

/**
 * What is happening on the public pages right now: page views, checkout
 * starts and paid gifts from the last hour. Read-only.
 */
export async function loadLiveSnapshot(companyId: string, affiliateId?: string): Promise<LiveSnapshot> {
  const now = Date.now();
  const since = new Date(now - 60 * MINUTE);
  const [{ rows: events, geoReady }, sales] = await Promise.all([
    loadEvents(companyId, since, affiliateId),
    prisma.sale.findMany({
      where: {
        ...paidLiveSalesWhere(companyId),
        ...(affiliateId ? { affiliateId } : {}),
        paidAt: { gte: since },
      },
      select: {
        amount: true,
        currency: true,
        paidAt: true,
        customerName: true,
        gatewayLabel: true,
        campaign: { select: { title: true } },
        affiliate: { select: { name: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 30,
    }),
  ]);
  const pageIds = [...new Set(events.map((event) => event.affiliatePageId))];
  const pages = pageIds.length
    ? await prisma.affiliatePage.findMany({
        where: { id: { in: pageIds } },
        select: {
          id: true,
          campaign: { select: { title: true } },
          affiliate: { select: { name: true } },
        },
      })
    : [];
  const pageById = new Map(pages.map((page) => [page.id, page]));

  const fiveAgo = now - 5 * MINUTE;
  const fifteenAgo = now - 15 * MINUTE;
  const sessions = new Set<string>();
  let anonymousViews = 0;
  let views5m = 0;
  let checkouts15m = 0;
  const perMinute = new Array<number>(60).fill(0);
  for (const event of events) {
    const age = now - event.createdAt.getTime();
    if (event.type === "PAGE_VIEW") {
      const slot = 59 - Math.min(59, Math.floor(age / MINUTE));
      perMinute[slot] += 1;
      if (age <= 5 * MINUTE) {
        views5m += 1;
        if (event.sessionId) sessions.add(event.sessionId);
        else anonymousViews += 1;
      }
    } else if (event.type === "CHECKOUT_STARTED" && age <= 15 * MINUTE) {
      checkouts15m += 1;
    }
  }

  const recent: LiveEvent[] = [];
  for (const event of events) {
    if (recent.length >= 24) break;
    if (event.type !== "PAGE_VIEW" && event.type !== "CHECKOUT_STARTED") continue;
    if (event.type === "PAGE_VIEW" && event.createdAt.getTime() < fiveAgo) continue;
    if (event.type === "CHECKOUT_STARTED" && event.createdAt.getTime() < fifteenAgo) continue;
    const page = pageById.get(event.affiliatePageId);
    recent.push({
      kind: event.type === "PAGE_VIEW" ? "view" : "checkout",
      label: page ? campaignNameTag(page.campaign.title) : "Página",
      sub: page ? page.affiliate.name : "",
      at: event.createdAt.toISOString(),
    });
  }
  for (const sale of sales) {
    recent.push({
      kind: "paid",
      label: campaignNameTag(sale.campaign.title),
      sub: `${sale.customerName || "Anonymous"} · ${sale.affiliate.name}`,
      tag: sale.gatewayLabel?.trim() || undefined,
      at: (sale.paidAt ?? new Date()).toISOString(),
      amount: sale.amount,
      currency: sale.currency,
    });
  }
  recent.sort((a, b) => b.at.localeCompare(a.at));
  const presence = await loadPresence(companyId, now, affiliateId);

  const snapshot: LiveSnapshot = {
    at: new Date(now).toISOString(),
    visitors5m: sessions.size + anonymousViews,
    views5m,
    checkouts15m,
    paid60m: sales.length,
    revenue60m: sales.reduce((sum, sale) => sum + sale.amount, 0),
    currency: sales[0]?.currency ?? "USD",
    perMinute,
    recent: recent.slice(0, 12),
    places: presence.places,
    departed: presence.departed,
    flow: presence.flow,
    stories: presence.stories,
    dwell: presence.dwell,
    located: presence.located,
    unlocated: presence.unlocated,
    geoReady,
  };
  return snapshot;
}
