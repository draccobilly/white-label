import { z } from "zod";

/** Shared shapes for the owner vault (API + page). Never includes the secret. */

export const VAULT_CATEGORY_MAX = 60;
export const VAULT_LABEL_MAX = 120;
export const VAULT_VALUE_MAX = 10_000;
export const VAULT_NOTES_MAX = 2_000;

const category = z
  .string()
  .trim()
  .min(2, "Category needs at least 2 characters")
  .max(VAULT_CATEGORY_MAX, "Category is too long")
  .transform((value) => value.replace(/\s+/g, " "));

const label = z
  .string()
  .trim()
  .min(2, "Label needs at least 2 characters")
  .max(VAULT_LABEL_MAX, "Label is too long");

const value = z
  .string()
  .min(1, "Paste the value to store")
  .max(VAULT_VALUE_MAX, "Value is too long");

const notes = z
  .string()
  .trim()
  .max(VAULT_NOTES_MAX, "Notes are too long")
  .optional()
  .nullable()
  .or(z.literal(""));

export const vaultCreateSchema = z.object({
  category,
  label,
  value,
  notes,
});

export const vaultUpdateSchema = z
  .object({
    category: category.optional(),
    label: label.optional(),
    value: value.optional(),
    notes,
  })
  .refine(
    (input) =>
      input.category !== undefined ||
      input.label !== undefined ||
      input.value !== undefined ||
      input.notes !== undefined,
    { message: "Nothing to update" },
  );

export type VaultItemSummary = {
  id: string;
  category: string;
  label: string;
  preview: string;
  notes: string | null;
  createdByEmail: string | null;
  lastRevealedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeVaultItem(item: {
  id: string;
  category: string;
  label: string;
  preview: string;
  notes: string | null;
  createdByEmail: string | null;
  lastRevealedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): VaultItemSummary {
  return {
    id: item.id,
    category: item.category,
    label: item.label,
    preview: item.preview,
    notes: item.notes,
    createdByEmail: item.createdByEmail,
    lastRevealedAt: item.lastRevealedAt ? item.lastRevealedAt.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

/** Columns the list endpoints are allowed to read — never `valueEnc`. */
export const vaultSummarySelect = {
  id: true,
  category: true,
  label: true,
  preview: true,
  notes: true,
  createdByEmail: true,
  lastRevealedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
