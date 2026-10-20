import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { formatMoney, formatRelativeTime } from "@/lib/utils";

type SaleItem = {
  id: string;
  customerName: string;
  amount: number;
  currency: string;
  paidAt: Date | null;
  campaignTitle: string;
  affiliateName: string;
};

type AlertItem = {
  id: string;
  status: string;
  createdAt: Date;
  campaignTitle: string;
  affiliateName: string;
};

type Props = {
  adminName: string;
  email: string;
  recentSales: SaleItem[];
  alerts: AlertItem[];
  isOwner?: boolean;
};

export function AdminActivityRail({
  adminName,
  email,
  recentSales,
  alerts,
  isOwner = true,
}: Props) {
  const initial = adminName.trim().charAt(0).toUpperCase() || "A";

  return (
    <aside className="admin-rail" aria-label="Workspace activity">
      <section className="admin-profile-card admin-desktop-only">
        <div className="admin-avatar" aria-hidden>
          {initial}
        </div>
        <strong>{adminName}</strong>
        <span>{email}</span>
        <p>
          <ShieldCheck size={14} />
          Verified operator
        </p>
      </section>

      <section className="admin-rail-card">
        <div className="admin-card-head">
          <h2>Recent sales</h2>
        </div>
        <ul className="admin-activity-list">
          {recentSales.map((sale) => (
            <li key={sale.id}>
              <span className="admin-activity-dot" aria-hidden />
              <div>
                <strong>{sale.customerName}</strong>
                <p>
                  donated {formatMoney(sale.amount, sale.currency)} to{" "}
                  {sale.campaignTitle}
                </p>
                <small>
                  {sale.affiliateName} · {formatRelativeTime(sale.paidAt)}
                </small>
              </div>
            </li>
          ))}
          {!recentSales.length ? (
            <li className="is-empty">No verified donations yet.</li>
          ) : null}
        </ul>
      </section>

      {isOwner ? (
        <>
          <section className="admin-rail-card admin-desktop-only">
            <div className="admin-card-head">
              <h2>Delivery alerts</h2>
              <Link href="/admin/integrations">Open</Link>
            </div>
            <ul className="admin-alert-list">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <strong>{alert.affiliateName}</strong>
                  <p>
                    {alert.status} · {alert.campaignTitle}
                  </p>
                  <small>{formatRelativeTime(alert.createdAt)}</small>
                </li>
              ))}
              {!alerts.length ? (
                <li className="is-empty">All deliveries are healthy.</li>
              ) : null}
            </ul>
          </section>

          <section className="admin-rail-card admin-desktop-only">
            <div className="admin-card-head">
              <h2>Shortcuts</h2>
            </div>
            <div className="admin-shortcut-list">
              <Link href="/admin/campaigns">New campaign</Link>
              <Link href="/admin/affiliates">Manage affiliates</Link>
              <Link href="/admin/integrations">Review page links</Link>
            </div>
          </section>
        </>
      ) : (
        <section className="admin-rail-card admin-desktop-only">
          <div className="admin-card-head">
            <h2>Shortcuts</h2>
          </div>
          <div className="admin-shortcut-list">
            <Link href="/admin/campaigns">New campaign</Link>
            <Link href="/admin/sales">Open donations</Link>
          </div>
        </section>
      )}
    </aside>
  );
}
