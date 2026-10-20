const UTMIFY_SRC =
  /^https:\/\/(?:[a-z0-9-]+\.)*utmify\.com\.br\/[a-zA-Z0-9/._-]*$/i;
const PIXEL_ID = /^[A-Za-z0-9_-]{6,80}$/;
const PIXEL_ASSIGN =
  /^(?:window\.)?pixelId\s*=\s*(['"])[A-Za-z0-9_-]{6,80}\1\s*;?\s*$/;
const PIXEL_ASSIGN_VALUE =
  /(?:window\.)?pixelId\s*=\s*(['"])([A-Za-z0-9_-]{6,80})\1/;

export type ParsedUtmifyScript = {
  src: string | null;
  inline: string | null;
  async: boolean;
  defer: boolean;
  dataAttributes: Record<string, string>;
};

function parseAttributes(raw: string) {
  const dataAttributes: Record<string, string> = {};
  let src: string | null = null;
  let async = false;
  let defer = false;

  for (const match of raw.matchAll(
    /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
  )) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (name === "src") src = value.trim();
    else if (name === "async") async = true;
    else if (name === "defer") defer = true;
    else if (name.startsWith("data-utmify-")) dataAttributes[name] = value;
  }

  return { src, async, defer, dataAttributes };
}

function sanitizeInline(body: string) {
  const cleaned = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  if (!PIXEL_ASSIGN.test(cleaned)) return null;
  return cleaned.endsWith(";") ? cleaned : `${cleaned};`;
}

export function parseUtmifyPixelScript(raw: string): ParsedUtmifyScript[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (PIXEL_ID.test(trimmed) && !trimmed.includes("<")) {
    return [
      { src: null, inline: `window.pixelId = ${JSON.stringify(trimmed)};`, async: false, defer: false, dataAttributes: {} },
      {
        src: "https://cdn.utmify.com.br/scripts/pixel/pixel.js",
        inline: null,
        async: true,
        defer: false,
        dataAttributes: {},
      },
    ];
  }

  const tags = [...trimmed.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const parsed: ParsedUtmifyScript[] = [];

  for (const tag of tags) {
    const attrs = parseAttributes(tag[1] ?? "");
    const inline = sanitizeInline(tag[2] ?? "");
    if (attrs.src) {
      if (!UTMIFY_SRC.test(attrs.src)) continue;
      parsed.push({
        src: attrs.src,
        inline: null,
        async: attrs.async,
        defer: attrs.defer,
        dataAttributes: attrs.dataAttributes,
      });
      continue;
    }
    if (inline) {
      parsed.push({
        src: null,
        inline,
        async: false,
        defer: false,
        dataAttributes: {},
      });
    }
  }

  return parsed;
}

export function utmifyPixelIdFromConfig(raw: string | null | undefined) {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  if (PIXEL_ID.test(trimmed) && !trimmed.includes("<")) return trimmed;
  for (const item of parseUtmifyPixelScript(trimmed)) {
    const pixelId = item.inline?.match(PIXEL_ASSIGN_VALUE)?.[2];
    if (pixelId) return pixelId;
  }
  return null;
}

export function normalizeUtmifyPixelScript(raw: string | null | undefined) {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  if (
    trimmed.includes("<script") &&
    /(?:\batob\s*\(|\bnew\s+Function\b|\beval\s*\()/i.test(trimmed)
  ) {
    throw new Error(
      "Paste the Utmify Pixel ID shown on its Pixel card, not the generated JavaScript.",
    );
  }
  const parsed = parseUtmifyPixelScript(trimmed);
  if (!parsed.length) {
    throw new Error(
      "Paste the Utmify Pixel ID shown on its Pixel card. Other scripts are blocked.",
    );
  }
  return parsed
    .map((item) => {
      if (item.inline) return `<script>${item.inline}</script>`;
      const extras = Object.entries(item.dataAttributes)
        .map(([key, value]) => (value ? ` ${key}="${value}"` : ` ${key}`))
        .join("");
      return `<script src="${item.src}"${item.async ? " async" : ""}${item.defer ? " defer" : ""}${extras}></script>`;
    })
    .join("\n");
}

export function normalizeUtmifyWebhookUrl(raw: string | null | undefined) {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (parsed.protocol !== "https:") {
    throw new Error("Use an https Utmify webhook URL");
  }
  return parsed.toString();
}
