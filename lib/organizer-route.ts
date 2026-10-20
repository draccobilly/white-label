import "server-only";
import { NextResponse } from "next/server";
import { getOrganizerSession } from "@/lib/organizer-auth";
import { prisma } from "@/lib/prisma";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function portalJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function portalError(message: string, status: number) {
  return portalJson({ error: message }, status);
}

/** Organizer behind a portal API call, or a 401 response. */
export async function requirePortalOrganizer() {
  const organizer = await getOrganizerSession();
  if (!organizer) return { organizer: null, response: portalError("Sign in to continue.", 401) };
  return { organizer, response: null };
}

/** The campaign only if it belongs to the signed-in organizer. */
export async function ownedCampaign(organizerId: string, campaignId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return null;
  return prisma.campaign.findFirst({
    where: { id: campaignId, organizerId },
  });
}
