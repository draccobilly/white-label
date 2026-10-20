"use client";

import { useState } from "react";
import { MediaUpload } from "@/components/admin/MediaUpload";

const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
];

type Settings = {
  siteName: string;
  logoUrl: string;
  impactLogoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  footerText: string;
  legalText: string;
  siteMode: "CAMPAIGN" | "INSTITUTIONAL";
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  nonprofitEin: string;
  stripeWebhookSecret: string;
  hasStripeWebhookSecret: boolean;
  webhookEndpoint: string;
  lastWebhook: { eventType: string; createdAt: string } | null;
};

export function SettingsForm({ initial }: { initial: Settings }) {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteName: form.siteName,
        logoUrl: form.logoUrl,
        impactLogoUrl: form.impactLogoUrl,
        faviconUrl: form.faviconUrl,
        primaryColor: form.primaryColor,
        accentColor: form.accentColor,
        footerText: form.footerText,
        legalText: form.legalText,
        siteMode: form.siteMode,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        contactAddress: form.contactAddress,
        nonprofitEin: form.nonprofitEin,
        stripeWebhookSecret: form.stripeWebhookSecret,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Save failed");
      return;
    }
    setForm((current) => ({
      ...current,
      stripeWebhookSecret: "",
      hasStripeWebhookSecret:
        current.hasStripeWebhookSecret || Boolean(current.stripeWebhookSecret.trim()),
    }));
    setMessage("Company settings saved.");
  }

  async function sendTestEmail() {
    setEmailMessage(null);
    const response = await fetch("/api/admin/settings/test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testEmail }),
    });
    const result = await response.json();
    setEmailMessage(
      response.ok ? "Test email sent." : result.error ?? "Unable to send test email",
    );
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <div className="admin-grid">
        <label>
          Site name
          <input
            className="admin-input"
            value={form.siteName}
            onChange={(event) => setForm({ ...form, siteName: event.target.value })}
          />
        </label>
        <label>
          Logo URL
          <input
            className="admin-input"
            type="url"
            value={form.logoUrl}
            onChange={(event) => setForm({ ...form, logoUrl: event.target.value })}
          />
          <MediaUpload
            folder="brand"
            onUploaded={(logoUrl) => setForm((current) => ({ ...current, logoUrl }))}
          />
        </label>
        <label>
          Impact logo
          <input
            className="admin-input"
            type="url"
            value={form.impactLogoUrl}
            onChange={(event) =>
              setForm({ ...form, impactLogoUrl: event.target.value })
            }
          />
          <MediaUpload
            folder="brand"
            onUploaded={(impactLogoUrl) =>
              setForm((current) => ({ ...current, impactLogoUrl }))
            }
          />
          <small>
            Used on the Impact campaign page, checkout, and public header. Leave
            empty to keep the Classic logo.
          </small>
        </label>
        <label>
          Favicon
          <input
            className="admin-input"
            type="url"
            value={form.faviconUrl}
            onChange={(event) =>
              setForm({ ...form, faviconUrl: event.target.value })
            }
          />
          <MediaUpload
            folder="brand"
            onUploaded={(faviconUrl) =>
              setForm((current) => ({ ...current, faviconUrl }))
            }
          />
          <small>
            Browser tab icon for this company. Lion and Mexico each have their
            own. Square PNG or SVG works best. Falls back to the Classic logo.
          </small>
        </label>
      </div>
      <div className="admin-grid">
        <label>
          Primary color
          <input
            className="admin-input"
            type="color"
            value={form.primaryColor}
            onChange={(event) => setForm({ ...form, primaryColor: event.target.value })}
          />
        </label>
        <label>
          Donation button color
          <input
            className="admin-input"
            type="color"
            value={form.accentColor}
            onChange={(event) => setForm({ ...form, accentColor: event.target.value })}
          />
        </label>
      </div>
      <label>
        Footer text
        <textarea
          className="admin-textarea"
          value={form.footerText}
          onChange={(event) => setForm({ ...form, footerText: event.target.value })}
        />
      </label>
      <label>
        Legal text
        <textarea
          className="admin-textarea"
          value={form.legalText}
          onChange={(event) => setForm({ ...form, legalText: event.target.value })}
        />
      </label>
      <label>
        Public site mode
        <select
          className="admin-input"
          value={form.siteMode}
          onChange={(event) =>
            setForm({
              ...form,
              siteMode: event.target.value as Settings["siteMode"],
            })
          }
        >
          <option value="CAMPAIGN">Campaign landing (current ops)</option>
          <option value="INSTITUTIONAL">Institutional NGO site</option>
        </select>
        <span className="admin-field-hint">
          Institutional mode replaces the home with campaigns, news, updates, and
          transparency pages. Campaign desks stay on the simple landing.
        </span>
      </label>
      <div className="admin-grid">
        <label>
          Public email
          <input
            className="admin-input"
            type="email"
            value={form.contactEmail}
            onChange={(event) =>
              setForm({ ...form, contactEmail: event.target.value })
            }
          />
        </label>
        <label>
          Public phone
          <input
            className="admin-input"
            value={form.contactPhone}
            onChange={(event) =>
              setForm({ ...form, contactPhone: event.target.value })
            }
          />
        </label>
      </div>
      <label>
        EIN
        <input
          className="admin-input"
          value={form.nonprofitEin}
          onChange={(event) =>
            setForm({ ...form, nonprofitEin: event.target.value })
          }
        />
        <span className="admin-field-hint">
          Public charity employer identification number, shown in the footer when set.
        </span>
      </label>
      <label>
        Public address
        <textarea
          className="admin-textarea"
          rows={3}
          value={form.contactAddress}
          onChange={(event) =>
            setForm({ ...form, contactAddress: event.target.value })
          }
        />
      </label>
      <div className="webhook-setup">
        <h3>Stripe webhook</h3>
        <p className="admin-field-hint">
          Create this in the Stripe Dashboard (Test), not with the Stripe CLI.
          Use the public HTTPS URL of the VPS site, not localhost. Endpoint URL:
        </p>
        <code className="webhook-endpoint">{form.webhookEndpoint}</code>
        <p className="admin-field-hint">Subscribe only to:</p>
        <ul className="webhook-events">
          {WEBHOOK_EVENTS.map((eventName) => (
            <li key={eventName}>{eventName}</li>
          ))}
        </ul>
        {form.lastWebhook ? (
          <p className="admin-field-hint">
            Last event received: {form.lastWebhook.eventType} at{" "}
            {new Date(form.lastWebhook.createdAt).toLocaleString()}
          </p>
        ) : (
          <p className="admin-field-hint">No webhook event received yet.</p>
        )}
      </div>
      <label>
        Stripe webhook signing secret
        <input
          className="admin-input"
          type="password"
          autoComplete="off"
          placeholder={
            form.hasStripeWebhookSecret
              ? "Stored securely — enter a new whsec_ to replace"
              : "whsec_..."
          }
          value={form.stripeWebhookSecret}
          onChange={(event) =>
            setForm({ ...form, stripeWebhookSecret: event.target.value })
          }
        />
        <span className="admin-field-hint">
          Paste the Dashboard Signing secret (whsec_). Not the Utmify URL.
        </span>
      </label>
      <button className="primary-button" type="submit">Save company settings</button>
      {message && <p className="form-message">{message}</p>}
      <div className="webhook-setup">
        <h3>Resend test</h3>
        <div className="admin-grid">
          <label>
            Send a test thank-you to
            <input
              className="admin-input"
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => void sendTestEmail()}
        >
          Send test email
        </button>
        {emailMessage ? <p className="form-message">{emailMessage}</p> : null}
      </div>
    </form>
  );
}
