export type EmphasizedPart = {
  text: string;
  bold: boolean;
};

export function parseBoldPhrases(raw?: string | null): string[] {
  const value = raw?.trim();
  if (!value) return [];
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        return uniquePhrases(parsed);
      }
    } catch {
      // Treat the raw string as a single legacy phrase.
    }
  }
  return [value];
}

export function serializeBoldPhrases(phrases: string[]): string {
  const unique = uniquePhrases(phrases);
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0];
  return JSON.stringify(unique);
}

export function addBoldPhrase(current: string | null | undefined, phrase: string): string {
  return serializeBoldPhrases([...parseBoldPhrases(current), phrase]);
}

export function removeBoldPhrase(current: string | null | undefined, phrase: string): string {
  const needle = phrase.trim().toLowerCase();
  return serializeBoldPhrases(
    parseBoldPhrases(current).filter((item) => item.toLowerCase() !== needle),
  );
}

export function emphasizeSegments(text: string, bold?: string | null): EmphasizedPart[] {
  const phrases = parseBoldPhrases(bold);
  if (phrases.length === 0 || !text) return [{ text, bold: false }];

  const ranges = findBoldRanges(text, phrases);
  if (ranges.length === 0) return [{ text, bold: false }];

  const parts: EmphasizedPart[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      parts.push({ text: text.slice(cursor, range.start), bold: false });
    }
    parts.push({ text: text.slice(range.start, range.end), bold: true });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), bold: false });
  return parts;
}

function uniquePhrases(phrases: string[]): string[] {
  const unique: string[] = [];
  for (const phrase of phrases) {
    const trimmed = phrase.trim();
    if (!trimmed) continue;
    if (unique.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) continue;
    unique.push(trimmed);
  }
  return unique;
}

function findBoldRanges(text: string, phrases: string[]): Array<{ start: number; end: number }> {
  const lower = text.toLowerCase();
  const taken = new Array<boolean>(text.length).fill(false);
  const ranges: Array<{ start: number; end: number }> = [];
  const sorted = [...phrases].sort((a, b) => b.length - a.length);

  for (const phrase of sorted) {
    const needle = phrase.toLowerCase();
    if (!needle) continue;
    let from = 0;
    while (from < lower.length) {
      const index = lower.indexOf(needle, from);
      if (index < 0) break;
      const end = index + needle.length;
      const blocked = taken.slice(index, end).some(Boolean);
      if (!blocked) {
        ranges.push({ start: index, end });
        taken.fill(true, index, end);
      }
      from = index + 1;
    }
  }

  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}
