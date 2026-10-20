import type { ReactNode } from "react";

/**
 * Calm empty state for lists. Keep the copy short: what the list shows and
 * where the entries come from.
 */
export function AdminEmptyState({
  icon,
  title,
  body,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`admin-empty${compact ? " is-compact" : ""}`} role="status">
      {icon ? (
        <span className="admin-empty-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
      {action ? <div className="admin-empty-action">{action}</div> : null}
    </div>
  );
}
