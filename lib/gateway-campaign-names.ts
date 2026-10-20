/**
 * Rewrites a campaign made in the admin into product names for the gateway.
 *
 * "Let's bless this humble father" becomes names such as
 * "Let's bless humble families affected by poverty with $75": the lead verb
 * is kept, the person is generalized to a group (no names reach the
 * gateway), the hardship comes from the words of the title, category,
 * summary, and story, and the amount is placed by the operation's frames.
 *
 * Shared code. The wording that differs per operation lives in
 * lib/gateway-product-names.ts as GATEWAY_CAMPAIGN_VOICE.
 */

export type CampaignNameSource = {
  title: string;
  category?: string | null;
  summary?: string | null;
  story?: string | null;
};

export type GatewayCampaignVoice = {
  /** Leads used in rotation when the title does not start with one. */
  leads: readonly string[];
  /**
   * Sentence frames. Placeholders: {lead} {verb} {one} {many} {families}
   * {hardship} {need} {amount}. Every frame must carry {amount}.
   */
  frames: readonly string[];
};

import { GATEWAY_NAME_MAX_LENGTH } from "@/lib/gateway-name-rules";

/** PayPal cuts purchase unit descriptions at 127 characters; PagNovo at 120. */
export { GATEWAY_NAME_MAX_LENGTH };

type Theme = { key: string; test: RegExp; hardship: string; need: string };

/** Ordered by specificity: the first theme found in the title wins. */
const THEMES: readonly Theme[] = [
  {
    key: "medical",
    test: /surger|cirug|hospital|cancer|c[áa]ncer|treatment|tratamiento|medicin|medical|m[ée]dic|chemo|quimio|dialysis|di[áa]lisis|illness|enferm|\bsick\b|doctor|therap|terapi|transplant|accident|injur|lesi[óo]n|diagnos|tumor|stroke|derrame|kidney|ri[ñn][óo]n/i,
    hardship: "facing medical bills",
    need: "medicine and medical care",
  },
  {
    key: "disability",
    test: /wheelchair|silla de ruedas|prosthe|pr[óo]tesis|disab|discapac|\bblind\b|cieg[oa]|\bdeaf\b|sord[oa]|autis|paraly|par[áa]li|amput|cerebral/i,
    hardship: "living with a disability",
    need: "care and equipment",
  },
  {
    key: "disaster",
    test: /\bfire\b|\bburn|incendio|quem[óo]|flood|inundaci|hurricane|hurac[áa]n|earthquake|terremoto|storm|tormenta|tornado|disaster|desastre|landslide|derrumbe/i,
    hardship: "rebuilding after a disaster",
    need: "repairs and basic supplies",
  },
  {
    key: "loss",
    test: /funeral|burial|entierro|passed away|falleci|\bdied\b|muri[óo]|\bwidow|viud[ao]|orphan|hu[ée]rfan|\bloss of\b|p[ée]rdida de/i,
    hardship: "grieving a loss",
    need: "funeral costs and the weeks after",
  },
  {
    key: "newborn",
    test: /\bbaby\b|beb[ée]|newborn|reci[ée]n nacid|pregnan|embaraz|diaper|pa[ñn]al|\bformula\b|\bcrib\b|\bcuna\b/i,
    hardship: "welcoming a newborn with nothing",
    need: "diapers, formula and a crib",
  },
  {
    key: "immigration",
    test: /deport|\bice\b|immigra|inmigra|detain|detenid|asylum|asilo|\bborder\b|frontera|removal/i,
    hardship: "separated by immigration",
    need: "legal help and groceries",
  },
  {
    key: "housing",
    test: /\brent\b|\brenta\b|evict|desalojo|housing|vivienda|homeless|sin hogar|\broof\b|\btecho\b|shelter|apartment|departamento|mortgage|hipoteca|utilit/i,
    hardship: "at risk of losing their home",
    need: "rent and a safe place to sleep",
  },
  {
    key: "work",
    test: /lost (?:his|her|their) job|unemploy|desemple|laid off|out of work|sin trabajo|no work|perdi[óo] (?:su|el) trabajo/i,
    hardship: "between jobs",
    need: "the bills until work returns",
  },
  {
    key: "food",
    test: /\bfood\b|comida|hunger|hambre|hungry|grocer|despensa|\bmeal|aliment|pantry/i,
    hardship: "going without enough food",
    need: "groceries for the week",
  },
  {
    key: "school",
    test: /school|escuela|tuition|colegiatura|student|estudiante|\bbooks?\b|libros|uniform|backpack|mochila|college|universidad/i,
    hardship: "trying to stay in school",
    need: "school costs and supplies",
  },
  {
    key: "cold",
    test: /winter|invierno|\bcold\b|fr[íi]o|heater|heating|calefacci|blanket|cobija|\bcoat/i,
    hardship: "facing the cold months",
    need: "warm clothes and heat",
  },
  {
    key: "poverty",
    test: /poverty|pobreza|\bpoor\b|pobre|humble|humilde|hardship|struggl|\bneeds?\b|necesit|\bbills?\b|cuentas|\bdebt|deuda|afford/i,
    hardship: "affected by poverty",
    need: "groceries, rent and bills",
  },
];

const DEFAULT_THEME: Theme = {
  key: "general",
  test: /./,
  hardship: "going through hard times",
  need: "the most urgent needs",
};

type People = { test: RegExp; one: string; many: string };

/** Ordered: the first match in the title names the group. Proper names never pass through. */
const PEOPLE: readonly People[] = [
  { test: /\b(?:father|dad|daddy|pap[áa]|padre)\b/i, one: "father", many: "fathers" },
  { test: /\b(?:mother|mom|mommy|mam[áa]|madre)\b/i, one: "mother", many: "mothers" },
  {
    test: /\b(?:grandmother|grandma|abuel[ao]|grandfather|grandpa|elderly|elder|ancian[ao]|senior)\b/i,
    one: "elder",
    many: "elders",
  },
  { test: /\b(?:baby|beb[ée]|newborn|infant)\b/i, one: "newborn", many: "newborns" },
  {
    test: /\b(?:child|children|kid|kids|boy|girl|son|daughter|ni[ñn][oa]s?|hij[oa]s?|teen|teenager|adolescente)\b/i,
    one: "child",
    many: "children",
  },
  { test: /\b(?:widow|widower|viud[ao])\b/i, one: "widow", many: "widows" },
  { test: /\b(?:students?|estudiantes?|alumn[oa]s?)\b/i, one: "student", many: "students" },
  { test: /\b(?:workers?|laborers?|trabajador(?:es|a|as)?|jornaler[oa]s?)\b/i, one: "worker", many: "workers" },
  { test: /\b(?:veterans?|veteran[oa]s?)\b/i, one: "veteran", many: "veterans" },
  { test: /\b(?:famil(?:y|ies)|familias?)\b/i, one: "family", many: "families" },
  {
    test: /\b(?:brother|sister|herman[oa]|\bman\b|woman|hombre|mujer|neighbou?r|vecin[oa]|friend|amig[oa]|do[ñn]a|\bdon\b|se[ñn]ora?)\b/i,
    one: "neighbor",
    many: "neighbors",
  },
];

const DEFAULT_PEOPLE: People = { test: /./, one: "family", many: "families" };

/** Adjectives kept from the title. One at most, so names stay short. */
const ADJECTIVES: ReadonlyArray<{ test: RegExp; word: string }> = [
  { test: /\bhumble\b|humilde/i, word: "humble" },
  { test: /\bsingle\b|solter[ao]/i, word: "single" },
  { test: /\byoung\b|\bjoven\b/i, word: "young" },
  { test: /\bimmigrant\b|inmigrante/i, word: "immigrant" },
  { test: /\bdisplaced\b|desplazad/i, word: "displaced" },
  { test: /\bbrave\b|valiente/i, word: "brave" },
  { test: /\bhardworking\b|\bhard-working\b/i, word: "hardworking" },
  { test: /\bstruggling\b/i, word: "struggling" },
  { test: /\bgrieving\b/i, word: "grieving" },
  { test: /\bpregnant\b|embarazada/i, word: "expecting" },
];

type Lead = { lead: string; verb: string };

const LEAD_VERBS: ReadonlyArray<{ test: RegExp; verb: string }> = [
  { test: /^(?:bless|bendice|bendecir|bendigamos|bendigan)/i, verb: "bless" },
  { test: /^(?:help|ayud(?:a|ar|amos|emos|an|en)|ay[úu]d[ae]nos)/i, verb: "help" },
  { test: /^(?:support|apoy(?:a|ar|amos|emos|an|en))/i, verb: "support" },
  { test: /^(?:save|salv(?:a|ar|amos|emos|an|en))/i, verb: "save" },
  { test: /^(?:rebuild|reconstruy|reconstruir)/i, verb: "rebuild" },
  { test: /^(?:protect|proteg|proteja)/i, verb: "protect" },
  { test: /^(?:lift up|levant)/i, verb: "lift up" },
  { test: /^(?:stand with|acompa[ñn])/i, verb: "stand with" },
  { test: /^(?:carry|carg)/i, verb: "carry" },
  { test: /^(?:rally (?:for|around)|unámonos|un[áa]monos)/i, verb: "rally for" },
];

const LETS_PREFIX = /^(?:let'?s|let us|vamos a|juntos a)\s+/i;
const SPANISH_LETS = /^(?:ayudemos|apoyemos|bendigamos|salvemos|reconstruyamos|protejamos|levantemos|acompa[ñn]emos|carguemos|un[áa]monos)\b/i;

function cleanTitle(title: string) {
  return title
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ")
    .replace(/[“”"«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectCampaignLead(title: string): Lead | null {
  const text = cleanTitle(title).replace(/^[^\p{L}]+/u, "");
  const lets = LETS_PREFIX.test(text) || SPANISH_LETS.test(text);
  const rest = text.replace(LETS_PREFIX, "");
  for (const { test, verb } of LEAD_VERBS) {
    if (test.test(rest)) {
      const lead = lets ? `Let's ${verb}` : verb[0].toUpperCase() + verb.slice(1);
      return { lead, verb };
    }
  }
  return null;
}

function leadFrom(lead: string): Lead {
  const verb = lead.replace(/^let'?s\s+/i, "").trim().toLowerCase();
  return { lead, verb };
}

export function detectCampaignTheme(source: CampaignNameSource) {
  const layers = [
    `${source.title} ${source.category ?? ""}`,
    source.summary ?? "",
    source.story ?? "",
  ];
  for (const layer of layers) {
    if (!layer.trim()) continue;
    const found = THEMES.find((theme) => theme.test.test(layer));
    if (found) return found;
  }
  return DEFAULT_THEME;
}

/** Adjectives that read well on "families"; "single" or "expecting" do not. */
const FAMILY_ADJECTIVES = new Set(["humble", "young", "immigrant", "displaced", "brave", "hardworking", "struggling", "grieving"]);

export function detectCampaignPeople(title: string, themeKey?: string) {
  const text = cleanTitle(title);
  const people = PEOPLE.find((entry) => entry.test.test(text)) ?? DEFAULT_PEOPLE;
  let adjective = ADJECTIVES.find((entry) => entry.test.test(text))?.word ?? null;
  if (adjective === "immigrant" && themeKey === "immigration") adjective = null;
  const prefix = adjective ? `${adjective} ` : "";
  const familyPrefix = adjective && FAMILY_ADJECTIVES.has(adjective) ? `${adjective} ` : "";
  return {
    one: withArticle(`${prefix}${people.one}`),
    many: `${prefix}${people.many}`,
    families: `${familyPrefix}families`,
  };
}

function withArticle(phrase: string) {
  return `${/^[aeiou]/i.test(phrase) ? "an" : "a"} ${phrase}`;
}

function fill(frame: string, values: Record<string, string>) {
  const text = frame.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
  const trimmed = text.replace(/\s+/g, " ").replace(/\s+([,:;.])/g, "$1").trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

function fitsGateway(template: string) {
  return template.replaceAll("{amount}", "$1,000").length <= GATEWAY_NAME_MAX_LENGTH;
}

function shortenToFit(template: string) {
  const budget = GATEWAY_NAME_MAX_LENGTH - ("$1,000".length - "{amount}".length);
  if (template.length <= budget) return template;
  const cut = template.slice(0, budget);
  const atWord = cut.lastIndexOf(" ");
  return (atWord > budget / 2 ? cut.slice(0, atWord) : cut).replace(/[,:;]$/, "");
}

/**
 * Product name templates for one campaign, with {amount} still in place.
 * Returns one template per frame, in frame order, so the campaign's deck
 * rotates through every frame before repeating.
 */
export function campaignProductTemplates(
  source: CampaignNameSource,
  voice: GatewayCampaignVoice,
): string[] {
  const detected = detectCampaignLead(source.title);
  const theme = detectCampaignTheme(source);
  const people = detectCampaignPeople(source.title, theme.key);
  const seen = new Set<string>();
  const templates: string[] = [];
  voice.frames.forEach((frame, index) => {
    const lead = detected ?? leadFrom(voice.leads[index % Math.max(1, voice.leads.length)] ?? "Help");
    const filled = fill(frame, {
      lead: lead.lead,
      verb: lead.verb,
      one: people.one,
      many: people.many,
      families: people.families,
      hardship: theme.hardship,
      need: theme.need,
    });
    if (!filled.includes("{amount}")) return;
    const template = fitsGateway(filled) ? filled : shortenToFit(filled);
    if (!template.includes("{amount}")) return;
    const key = template.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    templates.push(template);
  });
  return templates;
}

export function campaignDeckKey(slug: string | null | undefined, title: string) {
  const base = (slug?.trim() || title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `campaign:${base || "untitled"}`;
}
