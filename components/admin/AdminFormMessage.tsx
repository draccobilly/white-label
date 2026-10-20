import { CircleAlert, CircleCheck, Info } from "lucide-react";

export type AdminFormMessageTone = "error" | "success" | "info";

/**
 * Inline feedback for forms. Announced to screen readers through aria-live,
 * so place it near the controls that produced it.
 */
export function AdminFormMessage({
  tone,
  children,
  id,
}: {
  tone: AdminFormMessageTone;
  children: React.ReactNode;
  id?: string;
}) {
  const Icon = tone === "error" ? CircleAlert : tone === "success" ? CircleCheck : Info;
  return (
    <p
      id={id}
      className={`admin-form-message is-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <Icon size={16} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Heuristic shared by the older forms: decide whether a message is an error. */
export function looksLikeError(message: string) {
  return /unable|too long|too short|too big|invalid|timed out|must be|failed|forbidden|unauthorized|escolha|obrigat/i.test(
    message,
  );
}
