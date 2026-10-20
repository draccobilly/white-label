/**
 * Keeps Campaign.gatewayNames in step with the campaign's text.
 *
 * Names are written by the model from the title, category, summary, and
 * story (lib/gateway-ai-names.ts). The admin can also type them. A list the
 * admin touched is "manual" and is never overwritten on its own; the editor
 * shows a notice when the text changes and offers to write them again.
 */

import { prisma } from "@/lib/prisma";
import type { CampaignNameSource } from "@/lib/gateway-campaign-names";
import {
  GatewayNamesError,
  gatewayNamesSourceHash,
  generateGatewayNames,
  isGatewayNamesAiConfigured,
} from "@/lib/gateway-ai-names";
import { sameGatewayNames, validateGatewayNames } from "@/lib/gateway-name-rules";
import { GATEWAY_AI_VOICE } from "@/lib/gateway-product-names";

export const GATEWAY_NAMES_MANUAL = "manual";

export type GatewayNamesSyncResult =
  | { status: "current" | "unconfigured" | "manual" | "kept"; names: string[] }
  | { status: "generated"; names: string[]; model: string }
  | { status: "failed"; names: string[]; error: string };

type StoredNames = {
  gatewayNames: string[];
  gatewayNamesHash: string | null;
  gatewayNamesSource: string | null;
};

/** Prisma data for a list the admin typed or approved. */
export function manualGatewayNamesWrite(source: CampaignNameSource, names: string[]) {
  const clean = validateGatewayNames(names, { title: source.title, allow: GATEWAY_AI_VOICE.allowWords });
  return {
    gatewayNames: clean,
    gatewayNamesHash: gatewayNamesSourceHash(source),
    gatewayNamesSource: GATEWAY_NAMES_MANUAL,
    gatewayNamesAt: new Date(),
  };
}

/** True when the campaign text moved on after the names were written. */
export function gatewayNamesStale(campaign: CampaignNameSource & { gatewayNamesHash: string | null; gatewayNames: string[] }) {
  if (campaign.gatewayNames.length === 0) return false;
  return campaign.gatewayNamesHash !== gatewayNamesSourceHash(campaign);
}

/**
 * Writes names for a campaign when it has none, when its text changed and the
 * list was not typed by hand, or when forced. Never throws: a failure comes
 * back as status "failed" and the stored names stay as they are.
 */
export async function syncCampaignGatewayNames(
  campaignId: string,
  options: { force?: boolean } = {},
): Promise<GatewayNamesSyncResult> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      title: true,
      category: true,
      summary: true,
      story: true,
      gatewayNames: true,
      gatewayNamesHash: true,
      gatewayNamesSource: true,
    },
  });
  if (!campaign) return { status: "failed", names: [], error: "Campaign not found" };

  const hash = gatewayNamesSourceHash(campaign);
  const hasNames = campaign.gatewayNames.length > 0;
  const current = hasNames && campaign.gatewayNamesHash === hash;
  if (!options.force) {
    if (current) return { status: "current", names: campaign.gatewayNames };
    if (hasNames && campaign.gatewayNamesSource === GATEWAY_NAMES_MANUAL) {
      return { status: "kept", names: campaign.gatewayNames };
    }
  }
  if (!isGatewayNamesAiConfigured()) {
    return { status: "unconfigured", names: campaign.gatewayNames };
  }

  try {
    const generated = await generateGatewayNames(campaign, GATEWAY_AI_VOICE);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        gatewayNames: generated.names,
        gatewayNamesHash: hash,
        gatewayNamesSource: generated.model,
        gatewayNamesAt: new Date(),
      },
    });
    return { status: "generated", names: generated.names, model: generated.model };
  } catch (error) {
    const message =
      error instanceof GatewayNamesError
        ? error.message
        : error instanceof Error
          ? error.message
          : "unknown error";
    console.error(`gateway names for campaign ${campaignId} failed: ${message}`);
    return { status: "failed", names: campaign.gatewayNames, error: message };
  }
}

/**
 * After the admin saves a campaign: a list that differs from what is stored
 * was typed or approved by hand and is written as manual; otherwise the
 * campaign is brought up to date (written on first save, rewritten when the
 * text changes and the list is not manual).
 */
export async function settleCampaignGatewayNames(input: {
  campaignId: string;
  source: CampaignNameSource;
  requested: string[] | undefined;
  stored: StoredNames | null;
}): Promise<GatewayNamesSyncResult> {
  const requested = input.requested
    ? validateGatewayNames(input.requested, {
        title: input.source.title,
        allow: GATEWAY_AI_VOICE.allowWords,
      })
    : null;
  const storedNames = input.stored?.gatewayNames ?? [];
  if (requested && requested.length > 0 && !sameGatewayNames(requested, storedNames)) {
    await prisma.campaign.update({
      where: { id: input.campaignId },
      data: manualGatewayNamesWrite(input.source, requested),
    });
    return { status: "manual", names: requested };
  }
  if (requested && requested.length === 0 && storedNames.length > 0) {
    // The admin emptied the list: back to automatic names.
    await prisma.campaign.update({
      where: { id: input.campaignId },
      data: { gatewayNames: [], gatewayNamesHash: null, gatewayNamesSource: null, gatewayNamesAt: null },
    });
  }
  return syncCampaignGatewayNames(input.campaignId);
}
