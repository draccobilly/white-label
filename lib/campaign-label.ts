import { extractCampaignSubject } from "@/lib/campaign-comments";

export const NEW_CAMPAIGN_MS = 3 * 24 * 60 * 60 * 1000;

const TAG_MAX_CHARS = 28;

/** Calls to action and determiners that open a title but say nothing about it. */
const TAG_LEAD_WORDS = new Set(
  `help ayuda ayudar ayudemos apoya apoyemos ajude ajudem ajudar a al de del el la las los o os as um uma
   un una the these those this that our your his her their my mi su let lets please support save give join
   donate dona doe make bring keep stand pray bless we us you i me to for por para build construir`
    .split(/\s+/)
    .filter(Boolean),
);

const TAG_TAIL_WORDS = new Set(
  `that the and of for in to a an de la el los las y que para por con em no na do da e o os as um uma with
   from at on into who which`
    .split(/\s+/)
    .filter(Boolean),
);

export function isNewCampaign(
  createdAt: Date | string | null | undefined,
  now = Date.now(),
) {
  if (!createdAt) return false;
  const stamp = new Date(createdAt).getTime();
  return Number.isFinite(stamp) && now - stamp >= 0 && now - stamp < NEW_CAMPAIGN_MS;
}

/**
 * A short phrase from a long title that names no one: "Help these Little
 * Angels that are living in the Streets" becomes "Little Angels".
 */
function phraseTag(lead: string) {
  const words = lead
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, ""))
    .filter(Boolean);
  let start = 0;
  while (
    start < words.length &&
    TAG_LEAD_WORDS.has(words[start]!.toLowerCase().replace(/[’'].*$/u, ""))
  ) {
    start += 1;
  }
  const picked: string[] = [];
  for (const word of words.slice(start)) {
    if (picked.length >= 3) break;
    if (picked.length && [...picked, word].join(" ").length > TAG_MAX_CHARS) break;
    picked.push(word);
  }
  while (picked.length > 1 && TAG_TAIL_WORDS.has(picked[picked.length - 1]!.toLowerCase())) {
    picked.pop();
  }
  return picked.join(" ");
}

export function campaignNameTag(title: string) {
  const text = title.trim().replace(/\s+/g, " ");
  if (!text) return "Campaign";

  const commaLead = text.match(/^(\p{Lu}[\p{L}'’-]+)\s*,/u);
  if (
    commaLead?.[1] &&
    extractCampaignSubject(`Help ${commaLead[1]}`) === commaLead[1]
  ) {
    return commaLead[1];
  }

  const pair = text.match(
    /(?:Help|Ayuda(?:\s+a)?)\s+(\p{Lu}[\p{L}'’-]+)\s+(?:and|y)\s+(\p{Lu}[\p{L}'’-]+)/u,
  );
  if (
    pair?.[1] &&
    pair?.[2] &&
    extractCampaignSubject(`Help ${pair[1]}`) === pair[1] &&
    extractCampaignSubject(`Help ${pair[2]}`) === pair[2]
  ) {
    return `${pair[1]} & ${pair[2]}`;
  }

  const possessive = text.match(/(?<!\p{L})(\p{Lu}[\p{L}-]+)(?:’s|'s)(?!\p{L})/u);
  if (possessive?.[1] && extractCampaignSubject(`Help ${possessive[1]}`) === possessive[1]) {
    return possessive[1];
  }

  const subject = extractCampaignSubject(text);
  if (subject) return subject;

  const lead = text.split(",")[0]?.trim() ?? text;
  const fromLead = extractCampaignSubject(lead);
  if (fromLead) return fromLead;

  if (lead.length > TAG_MAX_CHARS) {
    const phrase = phraseTag(lead);
    if (phrase) return phrase;
  }
  return lead.slice(0, TAG_MAX_CHARS) || "Campaign";
}
