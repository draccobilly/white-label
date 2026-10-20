import type { ReactNode } from "react";

type Props = {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AdminCard({ title, action, children, className }: Props) {
  return (
    <section className={`admin-card ${className ?? ""}`.trim()}>
      {title || action ? (
        <div className="admin-card-head">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
