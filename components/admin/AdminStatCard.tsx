import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  hint?: string;
  delta?: string | null;
  positive?: boolean;
  icon: ReactNode;
};

export function AdminStatCard({
  label,
  value,
  hint,
  delta,
  positive = true,
  icon,
}: Props) {
  return (
    <article className="admin-stat-card">
      <div className="admin-stat-icon" aria-hidden>
        {icon}
      </div>
      <div>
        <span>{label}</span>
        <strong>
          {value}
          {delta ? (
            <em className={positive ? "is-up" : "is-down"}>{delta}</em>
          ) : null}
        </strong>
        {hint ? <p>{hint}</p> : null}
      </div>
    </article>
  );
}
