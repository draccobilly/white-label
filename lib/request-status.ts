import { z } from "zod";
import { RequestStatus } from "@/generated/prisma/enums";
import type { AdminChipTone } from "@/components/admin/AdminChip";

export const REQUEST_STATUSES: RequestStatus[] = ["OPEN", "ANSWERED", "RESOLVED"];

export const requestStatusSchema = z.enum(["OPEN", "ANSWERED", "RESOLVED"]);

/** Body accepted by the status routes. Both fields optional, at least one set. */
export const requestStatusUpdateSchema = z
  .object({
    status: requestStatusSchema.optional(),
    internalNote: z.string().max(4000).optional(),
  })
  .refine((value) => value.status !== undefined || value.internalNote !== undefined, {
    message: "Nothing to update",
  });

export type RequestStatusUpdate = z.infer<typeof requestStatusUpdateSchema>;

export function requestStatusLabel(status: RequestStatus) {
  switch (status) {
    case "ANSWERED":
      return "Respondido";
    case "RESOLVED":
      return "Resolvido";
    default:
      return "Aberto";
  }
}

export function requestStatusTone(status: RequestStatus): AdminChipTone {
  switch (status) {
    case "ANSWERED":
      return "warning";
    case "RESOLVED":
      return "success";
    default:
      return "info";
  }
}

export function parseRequestStatusFilter(value: string | undefined): RequestStatus | "ALL" {
  if (value === "ALL") return "ALL";
  const parsed = requestStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "OPEN";
}

/**
 * Prisma raises P2022 when a column from the schema is missing in the database.
 * The queue pages use it to keep working before the status migration is applied.
 */
export function isMissingColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2022"
  );
}
