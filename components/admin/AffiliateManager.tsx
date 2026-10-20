"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AffiliateRow = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  active: boolean;
  pageCount: number;
  saleCount: number;
};

const emptyForm = {
  name: "",
  email: "",
  notes: "",
  utmifyWebhookUrl: "",
  utmifyToken: "",
  utmifyPixelScript: "",
};

export function AffiliateManager({ affiliates }: { affiliates: AffiliateRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/admin/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, active: true }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(result.error ?? "Unable to create affiliate");
      return;
    }
    setForm(emptyForm);
    setOpen(false);
    router.refresh();
  }

  async function toggle(row: AffiliateRow) {
    await fetch("/api/admin/affiliates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliateId: row.id, active: !row.active }),
    });
    router.refresh();
  }

  return (
    <>
      <div className="admin-inline-actions" style={{ marginBottom: 16, justifyContent: "flex-end" }}>
        <button type="button" className="primary-button" onClick={() => setOpen(true)}>
          Add affiliate
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pages</th>
              <th>Sales</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {affiliates.map((row) => (
              <tr key={row.id}>
                <td data-label="Name">
                  <strong>{row.name}</strong>
                  <small>{row.email || "No alert email"}</small>
                </td>
                <td data-label="Pages">{row.pageCount}</td>
                <td data-label="Sales">{row.saleCount}</td>
                <td data-label="Status">
                  <span className={`status-pill ${row.active ? "" : "muted"}`}>
                    {row.active ? "Active" : "Paused"}
                  </span>
                </td>
                <td data-label="">
                  <div className="admin-inline-actions">
                    <Link className="secondary-button" href={`/admin/affiliates/${row.id}`}>
                      View
                    </Link>
                    <button className="secondary-button" type="button" onClick={() => toggle(row)}>
                      {row.active ? "Pause" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!affiliates.length ? (
              <tr>
                <td colSpan={5}>No affiliates yet. Click Add affiliate to create the first one.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {open ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="admin-modal admin-modal-wide"
            role="dialog"
            aria-labelledby="add-affiliate-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="admin-modal-close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <h2 id="add-affiliate-title">Add affiliate</h2>
            <p>
              Campaign pages are copied automatically. Utmify credentials stay on this
              affiliate only, so Stripe sales from their payment links are never counted
              on another partner.
            </p>
            <form className="admin-form" onSubmit={create}>
              <label>
                Name
                <input
                  className="admin-input"
                  value={form.name}
                  required
                  autoFocus
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label>
                Contact email
                <input
                  className="admin-input"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
                <span className="admin-field-hint">
                  Saved for system alerts (Resend / Sentry) when a page goes down or a code
                  error is found. Delivery is not wired yet.
                </span>
              </label>
              <label>
                Utmify webhook URL
                <input
                  className="admin-input"
                  type="url"
                  placeholder="https://api.utmify.com.br/..."
                  value={form.utmifyWebhookUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      utmifyWebhookUrl: event.target.value,
                    }))
                  }
                />
                <span className="admin-field-hint">
                  Only stored as a reference. Do not add this URL in Stripe — that
                  would send every sale on the shared account to every Utmify.
                  We mark sales with this affiliate’s API credential after the
                  Payment Link is identified.
                </span>
              </label>
              <label>
                Utmify API credential
                <input
                  className="admin-input"
                  type="password"
                  autoComplete="off"
                  placeholder="x-api-token"
                  value={form.utmifyToken}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, utmifyToken: event.target.value }))
                  }
                />
                <span className="admin-field-hint">
                  Authorizes our site to send only this affiliate’s orders to their Utmify
                  account.
                </span>
              </label>
              <label>
                Pixel script code
                <textarea
                  className="admin-textarea"
                  rows={6}
                  placeholder={`<script>\n  window.pixelId = "…";\n</script>\n<script async src="https://cdn.utmify.com.br/scripts/pixel/pixel.js"></script>`}
                  value={form.utmifyPixelScript}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      utmifyPixelScript: event.target.value,
                    }))
                  }
                />
                <span className="admin-field-hint">
                  Paste the pixel snippet from this affiliate’s Utmify. Every page for this
                  partner uses this same script.
                </span>
              </label>
              <label>
                Internal notes
                <textarea
                  className="admin-textarea"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </label>
              <div className="wizard-actions">
                <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={loading}>
                  {loading ? "Creating…" : "Create affiliate"}
                </button>
              </div>
              {message ? <p className="form-error">{message}</p> : null}
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
