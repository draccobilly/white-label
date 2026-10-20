import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="admin-empty-state">
      <p className="dash-kicker">Admin</p>
      <h1>This page is not in the selected country</h1>
      <p>
        Campaigns stay isolated per desk, so a Mexico product cannot be opened
        from Argentina and the other way around. Switch back to the original
        country, or pick a campaign from this desk.
      </p>
      <div className="admin-inline-actions">
        <Link className="primary-button" href="/admin/campaigns">
          Open campaigns
        </Link>
        <Link className="secondary-button" href="/admin">
          Admin home
        </Link>
      </div>
    </div>
  );
}
