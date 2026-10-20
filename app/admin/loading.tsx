export default function AdminLoading() {
  return (
    <div className="admin-skeleton" role="status" aria-label="Loading">
      <div className="admin-skeleton-head">
        <span className="admin-skeleton-line is-short" />
        <span className="admin-skeleton-line is-title" />
      </div>
      <div className="admin-skeleton-grid">
        <span className="admin-skeleton-card" />
        <span className="admin-skeleton-card" />
        <span className="admin-skeleton-card" />
      </div>
      <span className="admin-skeleton-card is-tall" />
      <span className="sr-only">Loading Admin…</span>
    </div>
  );
}
