/**
 * Product names this storefront sends to Stripe, PayPal, and PagNovo.
 * Review generated names in the admin before they go live.
 * {amount} is the donation without the tip. Keep every line under 110
 * characters so it fits PayPal's 127-character description.
 */

import type { GatewayCampaignVoice } from "@/lib/gateway-campaign-names";
import type { GatewayAiVoice } from "@/lib/gateway-ai-names";

export type GatewayProductGroup = {
  /** Stable key; also names the rotation deck for this group. */
  key: string;
  /** Cause or campaign slugs that select this group outright. */
  slugs: readonly string[];
  templates: readonly string[];
};

/** Sent when a checkout intent has no stored gateway label. */
export const GATEWAY_FALLBACK_NAME = "One-time gift to this campaign";

export const GATEWAY_PRODUCT_GROUPS: readonly GatewayProductGroup[] = [];

/** Used when the donation does not belong to any cause above. */
export const GATEWAY_GENERAL_TEMPLATES: readonly string[] = [
  "One-time gift of {amount} to this campaign",
  "{amount} toward the published fundraising goal",
  "Support for the people in this campaign, {amount}",
  "{amount} to help cover the need described on this page",
  "A one-time donation of {amount}",
  "{amount} for the work this fundraiser is raising",
  "Help this campaign reach its goal with {amount}",
  "{amount} toward verified aid on this page",
  "A gift of {amount} for this public fundraiser",
  "{amount} to the organizer of this campaign",
];

/**
 * How this storefront rewrites a campaign made in the admin into product names.
 * Placeholders: {lead} {verb} {one} {many} {families} {hardship} {need} {amount}.
 */
export const GATEWAY_CAMPAIGN_VOICE: GatewayCampaignVoice = {
  leads: ["Help", "Support", "Stand with", "Give toward"],
  frames: [
    "{lead} {families} {hardship} with {amount}",
    "{amount} to {verb} {many} {hardship}",
    "{lead} {one} {hardship}, {amount}",
    "{amount} toward {need} for {families} {hardship}",
    "A gift of {amount} so {families} {hardship} are not alone",
    "{amount} for {one} {hardship}",
    "{lead} {many} {hardship} with {amount} of {need}",
    "{amount} toward {need}",
    "{lead} {families} {hardship}: {amount} for {need}",
    "Support {many} {hardship} with {amount}",
  ],
};

/**
 * How the model writes product names for a campaign of this storefront.
 * The campaign's own story supplies the rest. Fill organization and mission
 * in Admin or by editing this file after you set APP_NAME.
 */
export const GATEWAY_AI_VOICE: GatewayAiVoice = {
  organization: process.env.APP_NAME?.trim() || "this organization",
  mission:
    "This storefront publishes verified public fundraisers. A product name must describe this campaign's own situation, not generic programs.",
  style:
    "Plain, warm, and concrete, like a line on a receipt. Say what the money buys for the people in this campaign.",
  avoid: [
    "scripture quotes and religious slogans",
    "the name of another organization",
    "food bank, shelter, or mission trip wording unless the campaign is about them",
    "naming a neighborhood or city unless the story names it",
  ],
  allowWords: [],
};
