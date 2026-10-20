import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GATEWAY_NAME_MAX_LENGTH,
  gatewayNameLineProblems,
  gatewayNameProblem,
  normalizeGatewayName,
  renderGatewayName,
  sameGatewayNames,
  titleProperNames,
  validateGatewayNames,
} from "@/lib/gateway-name-rules";
import {
  GATEWAY_AI_MIN_NAMES,
  GatewayNamesError,
  buildGatewayNamesPrompt,
  gatewayNamesProvider,
  gatewayNamesSourceHash,
  generateGatewayNames,
  namesFromModelText,
  plainCampaignText,
  type GatewayAiVoice,
} from "@/lib/gateway-ai-names";
import { gatewayProductGroup, gatewayProductLabel } from "@/lib/embedded-checkout";
import { GATEWAY_AI_VOICE, GATEWAY_PRODUCT_GROUPS } from "@/lib/gateway-product-names";
import { formatMoney } from "@/lib/utils";

const flooded = {
  title: "Help the Oliveira family leave a flooded home",
  category: "Urgent cause",
  summary: "Street water and sewage flood their house every time it rains.",
  story:
    "<p>The house where Ana and her three children live floods with <b>street water and sewage</b> whenever it rains. The floor stays wet for days, the children are getting sick, and they need to move out urgently. The money pays the deposit and first month on a dry apartment.</p>",
};

const voice: GatewayAiVoice = {
  organization: "A small nonprofit",
  mission: "Raises money for one family at a time.",
  style: "Plain and concrete.",
  avoid: ["slogans"],
  allowWords: ["Florida"],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("gateway name rules", () => {
  it("normalizes amount placeholders, quotes, bullets and trailing stops", () => {
    expect(normalizeGatewayName('1. "Help a family with ${Amount} toward rent."')).toBe(
      "Help a family with {amount} toward rent",
    );
    expect(normalizeGatewayName("- {{amount}} for a dry place to sleep!")).toBe(
      "{amount} for a dry place to sleep",
    );
    expect(normalizeGatewayName("  [amount]   so  a  family can move  ")).toBe(
      "{amount} so a family can move",
    );
  });

  it("finds the people named in a title and nothing else", () => {
    expect(titleProperNames("Help the Oliveira family leave a flooded home")).toEqual(["Oliveira"]);
    expect(titleProperNames("Let's bless this humble father")).toEqual([]);
    expect(titleProperNames("Ayudemos a Doña Rosa con la renta")).toEqual(["Rosa"]);
    expect(titleProperNames("Backpacks for South Florida students", ["south", "florida"])).toEqual([]);
    expect(titleProperNames("Maria needs surgery. Help Maria today")).toEqual(["Maria"]);
  });

  it("explains why a name cannot go to the gateway", () => {
    expect(gatewayNameProblem("")).toBe("empty line");
    expect(gatewayNameProblem("Help a family move out of a flooded house")).toBe("missing {amount}");
    expect(gatewayNameProblem("{amount} and {amount} again for a family")).toBe(
      "{amount} appears more than once",
    );
    expect(gatewayNameProblem(`{amount} ${"x".repeat(GATEWAY_NAME_MAX_LENGTH)}`)).toMatch(/longer than/);
    expect(gatewayNameProblem("{amount} gift")).toBe("too short to describe the cause");
    expect(gatewayNameProblem("{amount} to help the Oliveiras move", { title: flooded.title })).toBe(
      "names a person from the title (Oliveira)",
    );
    expect(gatewayNameProblem("{amount} for #relief for a family 🙏")).toBe("emoji or hashtag");
    expect(
      gatewayNameProblem("{amount} to help a family move out of a home flooded with sewage", {
        title: flooded.title,
      }),
    ).toBeNull();
  });

  it("validates a list: normalizes, drops the broken ones, dedupes, keeps order", () => {
    const names = validateGatewayNames(
      [
        '"{amount} to help a family move out of a home flooded with sewage"',
        "Help a family leave a flooded house with ${amount} toward a deposit",
        "{AMOUNT} to help a family move out of a home flooded with sewage",
        "A dry place to sleep for a family whose house floods",
        "{amount} for the Oliveira family's new apartment",
        42,
      ],
      { title: flooded.title },
    );
    expect(names).toEqual([
      "{amount} to help a family move out of a home flooded with sewage",
      "Help a family leave a flooded house with {amount} toward a deposit",
    ]);
    expect(gatewayNameLineProblems("{amount} for rent for a family of five\nno amount here", {})).toEqual([
      { line: 2, text: "no amount here", problem: "missing {amount}" },
    ]);
    expect(renderGatewayName("{amount} toward a deposit on a dry apartment", "$25")).toBe(
      "$25 toward a deposit on a dry apartment",
    );
    expect(sameGatewayNames(["{amount} a"], ['"{amount} a."'])).toBe(true);
    expect(sameGatewayNames(["{amount} a"], ["{amount} b"])).toBe(false);
  });
});

describe("gateway names from the model", () => {
  it("picks the provider from the keys and lets the model be overridden", () => {
    expect(gatewayNamesProvider({})).toBeNull();
    expect(gatewayNamesProvider({ OPENAI_API_KEY: "sk-test" })).toEqual({
      kind: "openai",
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
    });
    expect(gatewayNamesProvider({ ANTHROPIC_API_KEY: "sk-ant" })?.kind).toBe("anthropic");
    expect(
      gatewayNamesProvider({
        OPENAI_API_KEY: "sk-test",
        ANTHROPIC_API_KEY: "sk-ant",
        GATEWAY_NAMES_PROVIDER: "anthropic",
        GATEWAY_NAMES_MODEL: "claude-haiku-4-5",
      }),
    ).toEqual({ kind: "anthropic", apiKey: "sk-ant", model: "claude-haiku-4-5" });
    expect(gatewayNamesProvider({ OPENAI_API_KEY: "   " })).toBeNull();
  });

  it("reads the story as plain text and fingerprints the text the names came from", () => {
    expect(plainCampaignText(flooded.story)).toBe(
      "The house where Ana and her three children live floods with street water and sewage whenever it rains. The floor stays wet for days, the children are getting sick, and they need to move out urgently. The money pays the deposit and first month on a dry apartment.",
    );
    expect(plainCampaignText("a &amp; b&nbsp;c<br>d", 100)).toBe("a & b c\nd");
    expect(plainCampaignText("word ".repeat(100), 40).endsWith("…")).toBe(true);
    const hash = gatewayNamesSourceHash(flooded);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(gatewayNamesSourceHash({ ...flooded, story: `  ${flooded.story}  ` })).toBe(hash);
    expect(gatewayNamesSourceHash({ ...flooded, summary: "Something else" })).not.toBe(hash);
  });

  it("writes a prompt from the operation's voice and the campaign's own words", () => {
    const prompt = buildGatewayNamesPrompt(flooded, voice, 12);
    expect(prompt.system).toContain("{amount}");
    expect(prompt.system).toContain("exactly 12 names");
    expect(prompt.system).toMatch(/never include a person's name/i);
    expect(prompt.user).toContain("Organization: A small nonprofit");
    expect(prompt.user).toContain("Avoid: slogans");
    expect(prompt.user).toContain("Campaign title: Help the Oliveira family leave a flooded home");
    expect(prompt.user).toContain("street water and sewage");
    expect(prompt.user).not.toContain("<b>");
  });

  it("pulls the names out of JSON, fenced JSON, or plain lines", () => {
    expect(namesFromModelText('{"names":["{amount} a","{amount} b"]}')).toEqual(["{amount} a", "{amount} b"]);
    expect(namesFromModelText('Sure:\n```json\n{"names":["{amount} a"]}\n```')).toEqual(["{amount} a"]);
    expect(namesFromModelText('["{amount} a", 3, "{amount} b"]')).toEqual(["{amount} a", "{amount} b"]);
    expect(namesFromModelText("- {amount} a\n- nothing\n- {amount} b")).toEqual([
      "- {amount} a",
      "- {amount} b",
    ]);
    expect(namesFromModelText("")).toEqual([]);
  });

  it("calls OpenAI with a JSON schema and keeps only names that pass the rules", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const good = Array.from(
      { length: 8 },
      (_, index) => `{amount} toward a dry apartment deposit for a family of four, option ${index + 1}`,
    );
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                names: [...good, "{amount} for the Oliveira family", "no placeholder at all", good[0]],
              }),
            },
          },
        ],
      });
    }) as unknown as typeof fetch;
    const result = await generateGatewayNames(flooded, voice, {
      fetchImpl,
      env: { OPENAI_API_KEY: "sk-test" },
    });
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-5.4-mini");
    expect(result.names).toEqual(good);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(String(calls[0].init.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      response_format: { type: string };
      max_completion_tokens: number;
    };
    expect(body.model).toBe("gpt-5.4-mini");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].content).toContain("street water and sewage");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(body).not.toHaveProperty("temperature");
  });

  it("calls Anthropic's messages API and reads the text blocks", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const good = Array.from(
      { length: 6 },
      (_, index) => `Help a family leave a flooded house with {amount} toward deposit ${index + 1}`,
    );
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return jsonResponse({
        content: [
          { type: "thinking", thinking: "..." },
          { type: "text", text: `Here you go:\n{"names": ${JSON.stringify(good)}}` },
        ],
      });
    }) as unknown as typeof fetch;
    const result = await generateGatewayNames(flooded, voice, {
      fetchImpl,
      env: { ANTHROPIC_API_KEY: "sk-ant", GATEWAY_NAMES_MODEL: "claude-haiku-4-5" },
    });
    expect(result).toEqual({ names: good, model: "claude-haiku-4-5", provider: "anthropic" });
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("fails loudly without a key, on a bad answer, or when too few names survive", async () => {
    await expect(generateGatewayNames(flooded, voice, { env: {} })).rejects.toMatchObject({
      code: "unconfigured",
    });
    const refused = (async () => jsonResponse({ error: { message: "nope" } }, 401)) as unknown as typeof fetch;
    await expect(
      generateGatewayNames(flooded, voice, { fetchImpl: refused, env: { OPENAI_API_KEY: "sk" } }),
    ).rejects.toMatchObject({ code: "request" });
    const thin = (async () =>
      jsonResponse({
        choices: [{ message: { content: JSON.stringify({ names: ["{amount} toward a deposit for a family"] }) } }],
      })) as unknown as typeof fetch;
    const error = await generateGatewayNames(flooded, voice, {
      fetchImpl: thin,
      env: { OPENAI_API_KEY: "sk" },
    }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(GatewayNamesError);
    expect((error as GatewayNamesError).code).toBe("output");
    expect((error as GatewayNamesError).message).toContain(`at least ${GATEWAY_AI_MIN_NAMES}`);
  });

  it("describes this operation to the model", () => {
    expect(GATEWAY_AI_VOICE.organization.length).toBeGreaterThan(10);
    expect(GATEWAY_AI_VOICE.mission.length).toBeGreaterThan(40);
    expect(GATEWAY_AI_VOICE.avoid.length).toBeGreaterThanOrEqual(2);
  });
});

describe("stored names in the checkout", () => {
  const stored = [
    "{amount} to help a family move out of a home flooded with street water",
    "Help a family of four leave a flooded house with {amount} toward a deposit",
    "A dry apartment for children who sleep on a wet floor, {amount}",
  ];
  const context = {
    campaignSlug: "flooded-home",
    campaignTitle: flooded.title,
    campaignSummary: flooded.summary,
    campaignStory: flooded.story,
    campaignGatewayNames: stored,
  };

  it("deals the campaign's own names before any word-matched rewrite", () => {
    const group = gatewayProductGroup(context);
    expect(group.templates).toEqual(stored);
    expect(group.key.startsWith("campaign:flooded-home:")).toBe(true);
    const amount = formatMoney(2500, "USD");
    const rendered = new Set(stored.map((name) => name.replaceAll("{amount}", amount)));
    const draws = Array.from({ length: 9 }, () => gatewayProductLabel(2500, "USD", context));
    for (const label of draws) expect(rendered.has(label)).toBe(true);
    expect(new Set(draws).size).toBe(3);
    for (let i = 1; i < draws.length; i += 1) expect(draws[i]).not.toBe(draws[i - 1]);
    expect(gatewayProductLabel(2500, "USD", { ...context, index: 1 })).toBe(
      stored[1].replaceAll("{amount}", amount),
    );
  });

  it("falls back to the word rule without names, skips broken entries, and lets a cause slug win", () => {
    const without = gatewayProductGroup({ ...context, campaignGatewayNames: [] });
    expect(without.key).toBe("campaign:flooded-home");
    expect(without.templates.every((template) => template.includes("{amount}"))).toBe(true);
    const broken = gatewayProductGroup({
      ...context,
      campaignGatewayNames: ["no placeholder", "{amount} twice {amount}", stored[0]],
    });
    expect(broken.templates).toEqual([stored[0]]);
    const cause = GATEWAY_PRODUCT_GROUPS.find((entry) => entry.slugs.length > 0);
    if (cause) {
      expect(gatewayProductGroup({ ...context, causeSlug: cause.slugs[0] }).key).toBe(cause.key);
      expect(gatewayProductGroup({ ...context, campaignSlug: cause.slugs[0] }).templates).toEqual(stored);
    }
    // A new list gets a fresh rotation deck.
    const regenerated = gatewayProductGroup({ ...context, campaignGatewayNames: [stored[0]] });
    expect(regenerated.key).not.toBe(gatewayProductGroup(context).key);
    expect(gatewayProductLabel(2500, "USD", { ...context, campaignGatewayNames: [stored[0]] })).toBe(
      stored[0].replaceAll("{amount}", formatMoney(2500, "USD")),
    );
  });

  it("is wired through the checkout, the admin, PM2 and the deploy env", () => {
    for (const file of ["lib/embedded-checkout.ts", "app/api/pagnovo/purchase/route.ts"]) {
      expect(readFileSync(file, "utf8")).toContain("campaignGatewayNames: page.campaign.gatewayNames");
    }
    const route = readFileSync("app/api/admin/campaigns/route.ts", "utf8");
    expect(route).toContain("settleCampaignGatewayNames");
    expect(route).toContain("gatewayNamesError(parsed.data.gatewayNames");
    expect(readFileSync("app/api/admin/campaigns/gateway-names/route.ts", "utf8")).toContain(
      "generateGatewayNames",
    );
    expect(readFileSync("components/admin/CampaignEditor.tsx", "utf8")).toContain(
      "/api/admin/campaigns/gateway-names",
    );
    expect(readFileSync("prisma/schema.prisma", "utf8")).toMatch(/gatewayNames\s+String\[\]/);
    expect(readFileSync("ecosystem.config.cjs", "utf8")).toContain("OPENAI_API_KEY: process.env.OPENAI_API_KEY");
    expect(readFileSync("ecosystem.config.cjs", "utf8")).toContain(
      "ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY",
    );
    for (const file of [".env.example", "deploy/ngo.vps.env.example", "deploy/vps.env.example"]) {
      expect(readFileSync(file, "utf8")).toContain("OPENAI_API_KEY");
    }
    expect(JSON.parse(readFileSync("package.json", "utf8")).scripts["gateway:names"]).toBe(
      "tsx scripts/generate-gateway-names.ts",
    );
  });
});
