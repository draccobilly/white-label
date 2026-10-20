import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Small status chips or counters shown beside the title. */
  badges?: ReactNode;
};

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  badges,
}: Props) {
  return (
    <header className="admin-header">
      <div className="admin-header-copy">
        {eyebrow ? <p className="admin-kicker">{eyebrow}</p> : null}
        <div className="admin-header-title">
          <h1>{title}</h1>
          {badges ? <div className="admin-header-badges">{badges}</div> : null}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="admin-header-actions">{actions}</div> : null}
    </header>
  );
}
