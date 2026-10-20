import { NextResponse, after } from "next/server";
import { z } from "zod";
import { cachedGeo, geoFromHeaders, isPublicIp, lookupEnabled, lookupGeo } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isMissingColumnError } from "@/lib/request-status";

const bodySchema = z.object({
  affiliatePageId: z.string().uuid(),
  sessionId: z.string().trim().min(8).max(100),
});

/**
 * Heartbeat from an open campaign tab. Does not write a page view, so click
 * counts, pixels and checkout stay as they are. The IP is not stored.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`presence:${ip}`, 30, 60_000)) {
    return NextResponse.json({ ok: true });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const page = await prisma.affiliatePage.findFirst({
    where: { id: parsed.data.affiliatePageId, active: true },
    select: { id: true },
  });
  if (!page) return NextResponse.json({ ok: false }, { status: 404 });

  const known = geoFromHeaders(request.headers) ?? cachedGeo(ip) ?? null;
  const now = new Date();
  const where = {
    sessionId_affiliatePageId: {
      sessionId: parsed.data.sessionId,
      affiliatePageId: page.id,
    },
  };
  try {
    const current = await prisma.visitorPresence.findUnique({
      where,
      select: { latitude: true },
    });
    const geo = known
      ? {
          country: known.country,
          city: known.city,
          latitude: known.latitude,
          longitude: known.longitude,
        }
      : {};
    await prisma.visitorPresence.upsert({
      where,
      create: {
        sessionId: parsed.data.sessionId,
        affiliatePageId: page.id,
        startedAt: now,
        lastSeenAt: now,
        ...geo,
      },
      update: { lastSeenAt: now, ...geo },
    });
    if (!current?.latitude && !known && lookupEnabled() && isPublicIp(ip)) {
      const sessionId = parsed.data.sessionId;
      const affiliatePageId = page.id;
      after(async () => {
        const looked = await lookupGeo(ip);
        if (!looked) return;
        await prisma.visitorPresence
          .update({
            where: { sessionId_affiliatePageId: { sessionId, affiliatePageId } },
            data: {
              country: looked.country,
              city: looked.city,
              latitude: looked.latitude,
              longitude: looked.longitude,
            },
          })
          .catch(() => undefined);
      });
    }
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: string }).code : "";
    if (!isMissingColumnError(error) && code !== "P2021") {
      console.error("presence failed", error instanceof Error ? error.message : error);
    }
  }
  return NextResponse.json({ ok: true });
}
