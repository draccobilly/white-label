/**
 * Rules every product name must meet before it goes to Stripe, PayPal, or
 * PagNovo. Shared by the admin editor (browser) and the server, so this file
 * imports nothing from Node.
 *
 * A name is a template with {amount} in it; the checkout fills the donation
 * amount in. PayPal cuts the purchase unit description at 127 characters and
 * PagNovo at 120, so the rendered name with a large amount stays under 120.
 */

/** PayPal cuts purchase unit descriptions at 127 characters; PagNovo at 120. */
export const GATEWAY_NAME_MAX_LENGTH = 120;
export const GATEWAY_NAME_MIN_LENGTH = 20;
export const GATEWAY_NAMES_MAX_COUNT = 30;
/** The amount the length check renders, wide enough for a large gift. */
const WIDE_AMOUNT = "$1,000";

const AMOUNT_VARIANTS =
  /(?:\$\s*)?(?:\{\{\s*amount\s*\}\}|\{\s*amount\s*\}|\[\s*amount\s*\]|<\s*amount\s*>|\(\s*amount\s*\))/gi;

/** Capitalized title words that are not somebody's name. */
const TITLE_WORD_STOPLIST = new Set(
  [
    "a", "an", "the", "and", "or", "of", "for", "with", "to", "in", "on", "at", "by", "from",
    "let's", "lets", "let", "us", "our", "we", "you", "your", "his", "her", "their", "this",
    "that", "these", "those", "help", "support", "save", "bless", "rebuild", "protect", "lift",
    "stand", "carry", "rally", "give", "bring", "keep", "family", "families", "father", "mother",
    "mom", "dad", "mommy", "daddy", "baby", "child", "children", "kids", "kid", "son", "daughter",
    "brother", "sister", "grandmother", "grandfather", "grandma", "grandpa", "home", "house",
    "home's", "surgery", "hospital", "school", "church", "god", "lord", "christmas", "easter",
    "thanksgiving", "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december", "monday", "tuesday", "wednesday", "thursday",
    "friday", "saturday", "sunday", "ayuda", "ayudemos", "apoyemos", "bendigamos", "familia",
    "para", "con", "por", "una", "uno", "los", "las", "del", "de", "la", "el", "y", "e",
    "doña", "don", "señora", "señor", "sra", "sr", "urgent", "urgente", "emergency",
  ],
);

export type GatewayNameContext = {
  /** Campaign title; its proper names must not appear in a product name. */
  title?: string | null;
  /** Words allowed even when they look like names, e.g. the organization's own. */
  allow?: Iterable<string> | null;
};

/** Collapses whitespace, drops list markers and quotes, and settles {amount}. */
export function normalizeGatewayName(raw: string) {
  let text = String(raw ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/^\s*(?:[-*•–—]|\d{1,2}[.)])\s*/, "")
    .replace(/[“”"«»]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(AMOUNT_VARIANTS, "{amount}");
  text = text.replace(/\s+([,:;.!?])/g, "$1").replace(/[.!\s]+$/, "").trim();
  return text;
}

/** Proper names in a campaign title: capitalized words that are not ordinary words. */
export function titleProperNames(title: string | null | undefined, allow?: Iterable<string> | null) {
  const allowed = new Set(Array.from(allow ?? [], (word) => word.toLowerCase()));
  const words = String(title ?? "")
    .replace(/[“”"«»(),:;!?]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const names = new Set<string>();
  words.forEach((word, index) => {
    const clean = word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").replace(/'s$/i, "");
    if (clean.length < 3) return;
    if (!/^\p{Lu}\p{Ll}+$/u.test(clean)) return;
    const lower = clean.toLowerCase();
    if (TITLE_WORD_STOPLIST.has(lower) || allowed.has(lower)) return;
    const previous = index > 0 ? words[index - 1] : "";
    const sentenceStart = index === 0 || /[.!?]$/.test(previous);
    if (sentenceStart) return;
    names.add(clean);
  });
  return Array.from(names);
}

/** Why a name cannot go to the gateway, or null when it can. */
export function gatewayNameProblem(name: string, context: GatewayNameContext = {}) {
  const text = normalizeGatewayName(name);
  if (!text) return "empty line";
  const parts = text.split("{amount}");
  if (parts.length < 2) return "missing {amount}";
  if (parts.length > 2) return "{amount} appears more than once";
  const rendered = text.replaceAll("{amount}", WIDE_AMOUNT);
  if (rendered.length > GATEWAY_NAME_MAX_LENGTH) {
    return `longer than ${GATEWAY_NAME_MAX_LENGTH} characters once the amount is filled in`;
  }
  if (rendered.length < GATEWAY_NAME_MIN_LENGTH) return "too short to describe the cause";
  if (/[\p{Extended_Pictographic}#]/u.test(text)) return "emoji or hashtag";
  if (/\bhttps?:\/\/|www\./i.test(text)) return "contains a link";
  for (const proper of titleProperNames(context.title, context.allow)) {
    if (new RegExp(`\\b${proper}(?:'s|es|s)?\\b`, "iu").test(text)) {
      return `names a person from the title (${proper})`;
    }
  }
  return null;
}

/**
 * Normalizes a candidate list, drops what breaks the rules, removes
 * duplicates, and caps the count. Order is kept.
 */
export function validateGatewayNames(raw: unknown, context: GatewayNameContext = {}) {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? splitGatewayNameLines(raw) : [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const entry of list) {
    if (typeof entry !== "string") continue;
    const text = normalizeGatewayName(entry);
    if (!text || gatewayNameProblem(text, context)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(text);
    if (names.length >= GATEWAY_NAMES_MAX_COUNT) break;
  }
  return names;
}

/** Problems per line of the editor textarea, for inline feedback. */
export function gatewayNameLineProblems(text: string, context: GatewayNameContext = {}) {
  return splitGatewayNameLines(text).flatMap((line, index) => {
    const problem = gatewayNameProblem(line, context);
    return problem ? [{ line: index + 1, text: line, problem }] : [];
  });
}

export function splitGatewayNameLines(text: string) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function renderGatewayName(template: string, amountText: string) {
  return normalizeGatewayName(template).replaceAll("{amount}", amountText);
}

export function sameGatewayNames(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  return a.every((name, index) => normalizeGatewayName(name) === normalizeGatewayName(b[index]));
}
