import { z } from "zod";

export const AD_SPEND_SOURCES = ["Meta", "Google", "TikTok", "Kwai", "Outro"] as const;

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Data inválida");

export const adSpendEntrySchema = z.object({
  day: isoDay,
  /** Cents. */
  amount: z.number().int().min(0).max(1_000_000_000),
  source: z.string().trim().min(1, "Informe a fonte (Meta, Google…)").max(40),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  campaignId: z.string().uuid().nullable().optional(),
  affiliateId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(300).optional().nullable(),
});

export const adSpendCreateSchema = z.object({
  rows: z.array(adSpendEntrySchema).min(1, "Nenhum lançamento").max(400, "No máximo 400 linhas por vez"),
});

export type AdSpendEntry = z.infer<typeof adSpendEntrySchema>;

/** "1.234,56", "1,234.56", "120" → cents. Null when it is not a number. */
export function parseMoneyToCents(raw: string): number | null {
  const text = raw.trim().replace(/[^\d.,-]/g, "");
  if (!text) return null;
  let normalized = text;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) {
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = text.replace(/,/g, "");
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export type ParsedSpendLine =
  | { ok: true; day: string; amount: number; source: string; campaign?: string; affiliate?: string; note?: string }
  | { ok: false; line: string; reason: string };

/**
 * One entry per line: `data valor fonte [campanha] [afiliado]`, separated by
 * spaces, tabs, commas or semicolons. Dates accept AAAA-MM-DD or DD/MM/AAAA.
 */
export function parseSpendLines(text: string): ParsedSpendLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;\t,]+|\s+/).filter(Boolean);
      if (parts.length < 2) return { ok: false as const, line, reason: "faltam data e valor" };
      const [rawDay, rawAmount, source = "Meta", campaign, affiliate, ...rest] = parts;
      const day = normalizeDay(rawDay);
      if (!day) return { ok: false as const, line, reason: "data inválida" };
      const amount = parseMoneyToCents(rawAmount);
      if (amount === null) return { ok: false as const, line, reason: "valor inválido" };
      return {
        ok: true as const,
        day,
        amount,
        source,
        campaign,
        affiliate,
        note: rest.length ? rest.join(" ") : undefined,
      };
    });
}

function normalizeDay(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return Number.isNaN(Date.parse(`${raw}T00:00:00Z`)) ? null : raw;
  const match = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!match) return null;
  const day = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return Number.isNaN(Date.parse(`${day}T00:00:00Z`)) ? null : day;
}
