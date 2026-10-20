import type { ReactNode } from "react";

export type AdminChipTone = "neutral" | "info" | "success" | "warning" | "danger";

/** Small status label. Purely visual — never carries data by itself. */
export function AdminChip({
  tone = "neutral",
  children,
  title,
}: {
  tone?: AdminChipTone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`admin-chip is-${tone}`} title={title}>
      {children}
    </span>
  );
}
