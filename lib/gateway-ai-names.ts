/**
 * Product names written by a language model from one campaign's own text.
 *
 * A campaign made in the admin keeps its names on Campaign.gatewayNames. They
 * are written once per version of the text (title, category, summary, story),
 * reviewed in the campaign editor, and dealt in rotation by
 * lib/embedded-checkout.ts. Nothing in this file runs during a donor's checkout.
 *
 * The provider comes from the environment: OPENAI_API_KEY or ANTHROPIC_API_KEY
 * picks it (GATEWAY_NAMES_PROVIDER breaks a tie), GATEWAY_NAMES_MODEL overrides
 * the model. Without a key, generation is off and the checkout keeps the
 * word-matching fallback in lib/gateway-campaign-names.ts.
 *
 * Shared code. What differs per operation is GATEWAY_AI_VOICE in
 * lib/gateway-product-names.ts: who is raising the money and how the names
 * should sound.
 */

import { createHash } from "node:crypto";
import type { CampaignNameSource } from "@/lib/gateway-campaign-names";
import {
  GATEWAY_NAME_MAX_LENGTH,
  validateGatewayNames,
  type GatewayNameContext,
} from "@/lib/gateway-name-rules";

export type GatewayAiVoice = {
  /** Who is raising the money, as the donor should read it on the receipt. */
  organization: string;
  /** What the organization does, and when the names may mention it. */
  mission: string;
  /** How the names should sound. */
  style: string;
  /** Things this operation never wants in a name. */
  avoid: readonly string[];
  /** Words that look like names but are fine, e.g. the organization's own place. */
  allowWords?: readonly string[];
};

export type GatewayNamesProvider = {
  kind: "openai" | "anthropic";
  apiKey: string;
  model: string;
};

export type GatewayNamesPrompt = { system: string; user: string };

export const GATEWAY_AI_NAME_COUNT = 12;
/** Fewer valid names than this and the batch is rejected. */
export const GATEWAY_AI_MIN_NAMES = 5;
const STORY_CHARS = 4000;
const REQUEST_TIMEOUT_MS = 20_000;

const DEFAULT_MODELS: Record<GatewayNamesProvider["kind"], string> = {
  openai: "gpt-5.4-mini",
  anthropic: "claude-sonnet-5",
};

export class GatewayNamesError extends Error {
  constructor(
    public readonly code: "unconfigured" | "request" | "output",
    message: string,
  ) {
    super(message);
    this.name = "GatewayNamesError";
  }
}

export function gatewayNamesProvider(
  env: Record<string, string | undefined> = process.env,
): GatewayNamesProvider | null {
  const openai = env.OPENAI_API_KEY?.trim() || "";
  const anthropic = env.ANTHROPIC_API_KEY?.trim() || "";
  const forced = env.GATEWAY_NAMES_PROVIDER?.trim().toLowerCase();
  const model = env.GATEWAY_NAMES_MODEL?.trim() || "";
  const build = (kind: GatewayNamesProvider["kind"], apiKey: string) => ({
    kind,
    apiKey,
    model: model || DEFAULT_MODELS[kind],
  });
  if (forced === "anthropic" && anthropic) return build("anthropic", anthropic);
  if (forced === "openai" && openai) return build("openai", openai);
  if (openai) return build("openai", openai);
  if (anthropic) return build("anthropic", anthropic);
  return null;
}

export function isGatewayNamesAiConfigured(env?: Record<string, string | undefined>) {
  return gatewayNamesProvider(env) !== null;
}

/** The story as the model should read it: no tags, no entities, bounded. */
export function plainCampaignText(value: string | null | undefined, limit = STORY_CHARS) {
  const text = String(value ?? "")
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\*\*/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const atSpace = cut.lastIndexOf(" ");
  return `${atSpace > limit / 2 ? cut.slice(0, atSpace) : cut}…`;
}

/** Fingerprint of the text the names were written from. */
export function gatewayNamesSourceHash(source: CampaignNameSource) {
  const text = [
    source.title,
    source.category ?? "",
    source.summary ?? "",
    plainCampaignText(source.story, Number.MAX_SAFE_INTEGER),
  ]
    .map((part) => String(part ?? "").replace(/\s+/g, " ").trim().toLowerCase())
    .join("\n");
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

export function buildGatewayNamesPrompt(
  source: CampaignNameSource,
  voice: GatewayAiVoice,
  count = GATEWAY_AI_NAME_COUNT,
): GatewayNamesPrompt {
  const maxRendered = GATEWAY_NAME_MAX_LENGTH - 10;
  const system = [
    "You write the product name that a donation platform sends to Stripe, PayPal, and other payment processors for one fundraising campaign.",
    "The donor sees this name on the checkout and on the payment receipt, so it must say, truthfully and concretely, what this campaign's money does.",
    "",
    "Rules:",
    "- Write in English, in plain words a donor understands.",
    `- Return exactly ${count} names. Each one is a single phrase between 50 and ${maxRendered} characters long.`,
    '- Every name contains the placeholder {amount} exactly once. The system replaces it with the donation amount, for example "$25". Write it so it reads naturally with a dollar figure, such as "{amount} toward ..." or "... with {amount}". Never write a dollar sign next to the placeholder.',
    "- Build every name from the campaign text. Name the actual situation: what happened, what the people lack, what the money buys. Do not invent facts, numbers, places, diagnoses, or outcomes the text does not state.",
    '- Never include a person\'s name, age, address, phone number, or anything that identifies a person. Describe people by role: "a mother of three", "a family with two children", "an elderly neighbor".',
    "- Vary structure and wording across the names: some start with {amount}, some with a verb, some with the concrete thing the money buys. No two names may share their first three words.",
    '- No exclamation marks, no emojis, no quotation marks, no hashtags, no ALL CAPS, no "urgent" or "emergency" unless the text itself says so.',
    "- Do not mention the payment processor, the platform, taxes, receipts, or tax deductions.",
    "- Mention the organization only as described below, and never in more than a third of the names.",
    "",
    'Return only JSON in this exact shape: {"names": ["...", "..."]}',
  ].join("\n");

  const user = [
    `Organization: ${voice.organization}`,
    `What it does: ${voice.mission}`,
    `Tone: ${voice.style}`,
    voice.avoid.length ? `Avoid: ${voice.avoid.join("; ")}` : "",
    "",
    `Campaign title: ${source.title.trim()}`,
    source.category?.trim() ? `Category: ${source.category.trim()}` : "",
    source.summary?.trim() ? `Summary: ${plainCampaignText(source.summary, 1000)}` : "",
    "Story:",
    plainCampaignText(source.story) || "(no story written yet)",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { system, user };
}

/** Pulls the list out of whatever text the model returned. */
export function namesFromModelText(text: string): string[] {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return [];
  const candidates: unknown[] = [];
  const tryParse = (value: string) => {
    try {
      candidates.push(JSON.parse(value));
    } catch {
      // not JSON
    }
  };
  tryParse(trimmed);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) tryParse(fenced[1].trim());
  const object = trimmed.match(/\{[\s\S]*\}/);
  if (object) tryParse(object[0]);
  const array = trimmed.match(/\[[\s\S]*\]/);
  if (array) tryParse(array[0]);
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is string => typeof item === "string");
    }
    if (candidate && typeof candidate === "object" && "names" in candidate) {
      const names = (candidate as { names: unknown }).names;
      if (Array.isArray(names)) {
        return names.filter((item): item is string => typeof item === "string");
      }
    }
  }
  // Last resort: one name per line.
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("{amount}"));
}

type FetchLike = typeof fetch;

async function readError(response: Response) {
  const body = (await response.text().catch(() => "")).slice(0, 300).replace(/\s+/g, " ");
  return `${response.status}${body ? ` ${body}` : ""}`;
}

const NAMES_JSON_SCHEMA = {
  type: "object",
  properties: { names: { type: "array", items: { type: "string" } } },
  required: ["names"],
  additionalProperties: false,
} as const;

async function callOpenAi(
  provider: GatewayNamesProvider,
  prompt: GatewayNamesPrompt,
  fetchImpl: FetchLike,
  signal: AbortSignal,
) {
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "gateway_product_names", strict: true, schema: NAMES_JSON_SCHEMA },
      },
      max_completion_tokens: 4000,
    }),
    signal,
  });
  if (!response.ok) {
    throw new GatewayNamesError("request", `OpenAI answered ${await readError(response)}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
  };
  const message = data.choices?.[0]?.message;
  if (message?.refusal) {
    throw new GatewayNamesError("output", `OpenAI refused: ${message.refusal}`);
  }
  return message?.content ?? "";
}

async function callAnthropic(
  provider: GatewayNamesProvider,
  prompt: GatewayNamesPrompt,
  fetchImpl: FetchLike,
  signal: AbortSignal,
) {
  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 2000,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    }),
    signal,
  });
  if (!response.ok) {
    throw new GatewayNamesError("request", `Anthropic answered ${await readError(response)}`);
  }
  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

export type GeneratedGatewayNames = {
  names: string[];
  model: string;
  provider: GatewayNamesProvider["kind"];
};

/**
 * Asks the configured model for product names and keeps only the ones that
 * pass lib/gateway-name-rules.ts. Throws GatewayNamesError when there is no
 * key, the request fails, or too few names survive.
 */
export async function generateGatewayNames(
  source: CampaignNameSource,
  voice: GatewayAiVoice,
  options: {
    count?: number;
    signal?: AbortSignal;
    fetchImpl?: FetchLike;
    env?: Record<string, string | undefined>;
  } = {},
): Promise<GeneratedGatewayNames> {
  const provider = gatewayNamesProvider(options.env);
  if (!provider) {
    throw new GatewayNamesError(
      "unconfigured",
      "No AI key. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in the server .env.",
    );
  }
  if (!source.title.trim()) {
    throw new GatewayNamesError("output", "The campaign needs a title first.");
  }
  const count = Math.max(GATEWAY_AI_MIN_NAMES, Math.min(30, options.count ?? GATEWAY_AI_NAME_COUNT));
  const prompt = buildGatewayNamesPrompt(source, voice, count);
  const fetchImpl = options.fetchImpl ?? fetch;
  const signal = options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let text: string;
  try {
    text =
      provider.kind === "openai"
        ? await callOpenAi(provider, prompt, fetchImpl, signal)
        : await callAnthropic(provider, prompt, fetchImpl, signal);
  } catch (error) {
    if (error instanceof GatewayNamesError) throw error;
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? "the request timed out"
        : error instanceof Error
          ? error.message
          : "unknown error";
    throw new GatewayNamesError("request", `Could not reach ${provider.kind}: ${reason}`);
  }
  const context: GatewayNameContext = { title: source.title, allow: voice.allowWords ?? [] };
  const names = validateGatewayNames(namesFromModelText(text), context);
  if (names.length < GATEWAY_AI_MIN_NAMES) {
    throw new GatewayNamesError(
      "output",
      `The model returned ${names.length} usable name(s); at least ${GATEWAY_AI_MIN_NAMES} are needed.`,
    );
  }
  return { names, model: provider.model, provider: provider.kind };
}
