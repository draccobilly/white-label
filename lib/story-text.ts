/**
 * Inline emphasis inside a campaign story.
 *
 * The admin selects words and presses Bold. The editor wraps them in double
 * asterisks, `**like this**`, and the public page renders that span in bold.
 * The marker is plain text, so the story column, the organizer portal, the
 * public form, and every export keep working without a schema change.
 */

export const STORY_BOLD_MARK = "**";

export type StorySegment = { text: string; bold: boolean };

const BOLD_SPAN = /\*\*(?=\S)([\s\S]*?\S)\*\*/g;

/** Split a story into plain and bold runs. Unpaired markers stay as text. */
export function storySegments(text: string): StorySegment[] {
  const segments: StorySegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(BOLD_SPAN)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ text: text.slice(cursor, start), bold: false });
    segments.push({ text: match[1]!, bold: true });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), bold: false });
  return segments.length ? segments : [{ text, bold: false }];
}

/** The story without markers, for previews, excerpts, and anything not HTML. */
export function plainStoryText(text: string | null | undefined) {
  return String(text ?? "").replace(BOLD_SPAN, "$1");
}

export function hasStoryBold(text: string | null | undefined) {
  return new RegExp(BOLD_SPAN.source, "u").test(String(text ?? ""));
}

export type BoldToggle = { text: string; start: number; end: number };

/**
 * Wrap the selection in bold markers, or remove them when the selection is
 * already bold. Returns the new text and where the selection should sit, or
 * null when nothing is selected.
 */
export function toggleStoryBold(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): BoldToggle | null {
  const mark = STORY_BOLD_MARK;
  let start = Math.max(0, Math.min(selectionStart, selectionEnd));
  let end = Math.min(text.length, Math.max(selectionStart, selectionEnd));
  while (start < end && /\s/.test(text[start]!)) start += 1;
  while (end > start && /\s/.test(text[end - 1]!)) end -= 1;
  if (start === end) return null;

  const selected = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);

  // "**word**" selected with its markers.
  if (
    selected.startsWith(mark) &&
    selected.endsWith(mark) &&
    selected.length > mark.length * 2
  ) {
    const inner = selected.slice(mark.length, -mark.length);
    return { text: before + inner + after, start, end: start + inner.length };
  }

  // "word" selected inside "**word**".
  if (before.endsWith(mark) && after.startsWith(mark)) {
    return {
      text: before.slice(0, -mark.length) + selected + after.slice(mark.length),
      start: start - mark.length,
      end: end - mark.length,
    };
  }

  // Wrap. Markers already inside the selection are dropped so bold never nests.
  const inner = selected.split(mark).join("");
  return {
    text: `${before}${mark}${inner}${mark}${after}`,
    start: start + mark.length,
    end: start + mark.length + inner.length,
  };
}
