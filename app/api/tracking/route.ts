import { NextResponse, after } from "next/server";
import { z } from "zod";
import { TrackingEventType } from "@/generated/prisma/enums";
import { cachedGeo, geoColumns, geoFromHeaders, isPublicIp, lookupEnabled, lookupGeo } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isMissingColumnError } from "@/lib/request-status";
import { attributionSchema } from "@/lib/validators";

const eventSchema = z.object({
  affiliatePageId: z.string().uuid(),
  type: z.enum(["PAGE_VIEW", "CHECKOUT_STARTED"]),
  sessionId: z.string().max(100).optional(),
  attribution: attributionSchema.partial().optional(),
});

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`tracking:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many events" }, { status: 429 });
  }
  try {
    const parsed = eventSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    const page = await prisma.affiliatePage.findFirst({
      where: { id: parsed.data.affiliatePageId, active: true },
      select: { id: true },
    });
    if (!page) return NextResponse.json({ error: "Page unavailable" }, { status: 404 });
    const attribution = parsed.data.attribution ?? {};
    const data = {
      affiliatePageId: page.id,
      type: parsed.data.type as TrackingEventType,
      sessionId: parsed.data.sessionId,
      src: attribution.src,
      sck: attribution.sck,
      utmSource: attribution.utmSource,
      utmMedium: attribution.utmMedium,
      utmCampaign: attribution.utmCampaign,
      utmContent: attribution.utmContent,
      utmTerm: attribution.utmTerm,
    };
    // Visitor location: CDN headers or the IP cache answer immediately; a
    // first-seen IP is resolved after the response, so the page never waits.
    const known = geoFromHeaders(request.headers) ?? cachedGeo(ip);
    const needsLookup = known === undefined && lookupEnabled() && isPublicIp(ip);
    let eventId: string | null = null;
    try {
      const created = await prisma.trackingEvent.create({
        data: { ...data, ...geoColumns(known ?? null) },
        select: { id: true },
      });
      eventId = created.id;
    } catch (error) {
      // Location columns not migrated yet: record the event exactly as before.
      if (!isMissingColumnError(error)) throw error;
      await prisma.trackingEvent.create({ data });
    }
    if (eventId && needsLookup) {
      const id = eventId;
      after(async () => {
        const geo = await lookupGeo(ip);
        if (!geo) return;
        await prisma.trackingEvent.update({ where: { id }, data: geoColumns(geo) }).catch(() => undefined);
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to record event" }, { status: 500 });
  }
}
