"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  affiliateId: string;
  name: string;
  email: string | null;
  notes: string | null;
  utmifyWebhookUrl: string | null;
  utmifyPixelId: string | null;
  hasUtmifyToken: boolean;
  deskScopedUtmify?: boolean;
};

export function AffiliateCredentialsForm({
  affiliateId,
  name,
  email,
  notes,
  utmifyWebhookUrl,
  utmifyPixelId,
  hasUtmifyToken,
  deskScopedUtmify = false,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    name,
    email: email ?? "",
    notes: notes ?? "",
    utmifyWebhookUrl: utmifyWebhookUrl ?? "",
    utmifyToken: "",
    utmifyPixelScript: utmifyPixelId ?? "",
  });
  const [tokenStored, setTokenStored] = useState(hasUtmifyToken);
  const [storedWebhookUrl, setStoredWebhookUrl] = useState(utmifyWebhookUrl ?? "");
  const [storedPixelId, setStoredPixelId] = useState(utmifyPixelId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const enteredToken = form.utmifyToken.trim();
    const response = await fetch("/api/admin/affiliates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        affiliateId,
        name: form.name,
        email: form.email,
        notes: form.notes,
        utmifyWebhookUrl: form.utmifyWebhookUrl,
        utmifyPixelScript: form.utmifyPixelScript,
        utmifyToken: form.utmifyToken,
      }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(result.error ?? "Unable to save affiliate");
      return;
    }
    setTokenStored((current) => current || Boolean(enteredToken));
    setStoredWebhookUrl(form.utmifyWebhookUrl.trim());
    setStoredPixelId(form.utmifyPixelScript.trim());
    setForm((current) => ({ ...current, utmifyToken: "" }));
    setMessage(
      deskScopedUtmify
        ? "Saved. Utmify on this desk only — United States Direct Team stays unchanged."
        : "Saved. United States pages use these Utmify credentials. Mexico pages do not.",
    );
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <label>
        Name
        <input
          className="admin-input"
          value={form.name}
          required
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        />
      </label>
      <label>
        Contact email
        <input
          className="admin-input"
          type="email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
        />
        <span className="admin-field-hint">
          Saved for system alerts (Resend / Sentry). Delivery is not wired yet.
        </span>
      </label>
      <label>
        <span className="admin-field-title">
          <span>Utmify webhook URL</span>
          <span className={`status-pill ${storedWebhookUrl ? "" : "muted"}`}>
            {storedWebhookUrl ? "Reference saved" : "Not required"}
          </span>
        </span>
        <input
          className="admin-input"
          type="url"
          placeholder="https://api.utmify.com.br/..."
          value={form.utmifyWebhookUrl}
          onChange={(event) =>
            setForm((current) => ({ ...current, utmifyWebhookUrl: event.target.value }))
          }
        />
        <span className="admin-field-hint">
          Optional reference only. Leave empty for the current flow: Stripe calls
          our webhook, then our server sends the sale to Utmify with the encrypted
          API credential.
        </span>
      </label>
      <label>
        <span className="admin-field-title">
          <span>Utmify API credential</span>
          <span className={`status-pill ${tokenStored ? "" : "muted"}`}>
            {tokenStored ? "Stored encrypted" : "Not added"}
          </span>
        </span>
        <input
          className="admin-input"
          type="password"
          autoComplete="off"
          placeholder={tokenStored ? "Stored securely — enter to replace" : "x-api-token"}
          value={form.utmifyToken}
          onChange={(event) =>
            setForm((current) => ({ ...current, utmifyToken: event.target.value }))
          }
        />
        <span className="admin-field-hint">
          The saved value is intentionally hidden. Enter a new credential only
          when replacing it.
        </span>
      </label>
      <label>
        <span className="admin-field-title">
          <span>Utmify Pixel ID</span>
          <span className={`status-pill ${storedPixelId ? "" : "muted"}`}>
            {storedPixelId
              ? deskScopedUtmify
                ? "Active on this desk"
                : "Active on United States pages"
              : "Not added"}
          </span>
        </span>
        <input
          className="admin-input"
          maxLength={80}
          placeholder="Example: 6a8d69876c8d0f2391cc660b"
          value={form.utmifyPixelScript}
          onChange={(event) =>
            setForm((current) => ({ ...current, utmifyPixelScript: event.target.value }))
          }
        />
        <span className="admin-field-hint">
          Copy the ID shown on the Utmify Pixel card, not its generated HTML.
          {deskScopedUtmify
            ? " This loads only on Mexico Direct Team pages."
            : " This loads on United States Direct Team pages. Mexico needs its own pixel on the México desk."}{" "}
          It is not the Facebook Ads pixel number. Facebook Purchase is not
          sent from this site — Ads Manager conversions come from Utmify only.
        </span>
      </label>
      <label>
        Internal notes
        <textarea
          className="admin-textarea"
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
        />
      </label>
      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save credentials"}
      </button>
      {message ? (
        <p className={message.startsWith("Saved") ? "form-message" : "form-error"}>{message}</p>
      ) : null}
    </form>
  );
}
