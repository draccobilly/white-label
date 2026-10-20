"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { publicHostname } from "@/lib/public-site-url";

type Company = {
  id?: string;
  name: string;
  domain: string;
  publicPathPrefix: string;
  landingTitle: string;
  landingBody: string;
  locale: "en" | "es-MX" | "es-AR";
  paymentGateway: "STRIPE" | "PAGNOVO";
  siteMode: "CAMPAIGN" | "INSTITUTIONAL";
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  pagnovoWebhookSecret: string;
  hasPagnovoWebhookSecret?: boolean;
  nonprofitListed: boolean;
  nonprofitName: string;
  nonprofitDescription: string;
  nonprofitLogoUrl: string;
};

export function CompanyForm({
  initial,
  mode,
}: {
  initial?: Company;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [form, setForm] = useState<Company>(
    initial
      ? {
          ...initial,
          publicPathPrefix:
            initial.publicPathPrefix ||
            (initial.locale === "es-MX"
              ? "/mexico"
              : initial.locale === "es-AR"
                ? "/argentina"
                : ""),
        }
      : {
          name: "",
          domain: "",
          publicPathPrefix: "",
          landingTitle: "",
          landingBody: "",
          locale: "en",
          paymentGateway: "STRIPE",
          siteMode: "CAMPAIGN",
          contactEmail: "",
          contactPhone: "",
          contactAddress: "",
          pagnovoWebhookSecret: "",
          nonprofitListed: true,
          nonprofitName: "",
          nonprofitDescription: "",
          nonprofitLogoUrl: "",
        },
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const payload = {
      companyId: form.id,
      name: form.name,
      domain: form.domain,
      publicPathPrefix: form.publicPathPrefix,
      landingTitle: form.landingTitle || form.name,
      landingBody: form.landingBody,
      locale: form.locale,
      paymentGateway: form.paymentGateway,
      siteMode: form.siteMode,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      contactAddress: form.contactAddress,
      pagnovoWebhookSecret: form.pagnovoWebhookSecret,
      nonprofitListed: form.nonprofitListed,
      nonprofitName: form.nonprofitName,
      nonprofitDescription: form.nonprofitDescription,
      nonprofitLogoUrl: form.nonprofitLogoUrl,
    };
    const response = await fetch("/api/admin/companies", {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(result.error ?? "Unable to save company");
      return;
    }
    setMessage(mode === "create" ? "Company created." : "Company saved.");
    if (mode === "create") {
      if (result.company?.id) {
        await fetch("/api/admin/companies/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: result.company.id }),
        });
      }
      window.location.reload();
      return;
    }
    setForm((current) => ({
      ...current,
      pagnovoWebhookSecret: "",
      hasPagnovoWebhookSecret:
        current.hasPagnovoWebhookSecret || Boolean(current.pagnovoWebhookSecret.trim()),
    }));
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <label>
        Company name
        <input
          className="admin-input"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </label>
      <label>
        Public domain
        <input
          className="admin-input"
          placeholder="giving.example.com"
          value={form.domain}
          onChange={(event) => setForm({ ...form, domain: event.target.value })}
        />
        <span className="admin-field-hint">
          Hostname only, no https. Used when a company has its own domain.
          Leave empty when the company lives under a path on {publicHostname()}.
        </span>
      </label>
      <label>
        Public site mode
        <select
          className="admin-input"
          value={form.siteMode}
          onChange={(event) => {
            const siteMode = event.target.value as Company["siteMode"];
            setForm({
              ...form,
              siteMode,
              publicPathPrefix:
                siteMode === "INSTITUTIONAL" ? "" : form.publicPathPrefix,
              paymentGateway:
                siteMode === "INSTITUTIONAL" ? "STRIPE" : form.paymentGateway,
              locale: siteMode === "INSTITUTIONAL" ? "en" : form.locale,
            });
          }}
        >
          <option value="CAMPAIGN">Campaign landing</option>
          <option value="INSTITUTIONAL">Institutional NGO site</option>
        </select>
      </label>
      {form.siteMode === "INSTITUTIONAL" ? null : (
      <label>
        Public path prefix
        <input
          className="admin-input"
          placeholder="/mexico or /argentina"
          value={form.publicPathPrefix}
          onChange={(event) =>
            setForm({ ...form, publicPathPrefix: event.target.value })
          }
        />
        <span className="admin-field-hint">
          Mexico is /mexico and Argentina is /argentina on {publicHostname()}.
          Leave empty for the global /c/... operation.
        </span>
      </label>
      )}
      {form.siteMode === "INSTITUTIONAL" ? null : (
        <>
      <label>
        Language
        <select
          className="admin-input"
          value={form.locale}
          onChange={(event) => {
            const locale = event.target.value as Company["locale"];
            setForm({
              ...form,
              locale,
              publicPathPrefix:
                form.publicPathPrefix ||
                (locale === "es-MX"
                  ? "/mexico"
                  : locale === "es-AR"
                    ? "/argentina"
                    : form.publicPathPrefix),
            });
          }}
        >
          <option value="en">English</option>
          <option value="es-MX">Español (México)</option>
          <option value="es-AR">Español (Argentina)</option>
        </select>
      </label>
      <label>
        Payment gateway
        <select
          className="admin-input"
          value={form.paymentGateway}
          onChange={(event) =>
            setForm({
              ...form,
              paymentGateway: event.target.value as Company["paymentGateway"],
            })
          }
        >
          <option value="STRIPE">Stripe</option>
          <option value="PAGNOVO">Pagnovo (bank transfer + card)</option>
        </select>
        <span className="admin-field-hint">
          Pagnovo companies never use Stripe Payment Links. Mexico checkout is
          SPEI CLABE and/or card. Argentina checkout is bank transfer to a CVU
          from PAGNOVO_ARS_* keys — never the Mexico store.
        </span>
      </label>
        </>
      )}
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
      {form.paymentGateway === "PAGNOVO" ? (
        <label>
          Pagnovo webhook secret
          <input
            className="admin-input"
            type="password"
            autoComplete="off"
            placeholder={
              form.hasPagnovoWebhookSecret
                ? "Secret saved — paste a new one to rotate"
                : "HMAC secret from Pagnovo webhook V2"
            }
            value={form.pagnovoWebhookSecret}
            onChange={(event) =>
              setForm({ ...form, pagnovoWebhookSecret: event.target.value })
            }
          />
        </label>
      ) : null}
      <label>
        Landing title
        <input
          className="admin-input"
          value={form.landingTitle}
          onChange={(event) =>
            setForm({ ...form, landingTitle: event.target.value })
          }
        />
      </label>
      <label>
        Landing text
        <textarea
          className="admin-textarea"
          rows={6}
          value={form.landingBody}
          onChange={(event) =>
            setForm({ ...form, landingBody: event.target.value })
          }
        />
        <span className="admin-field-hint">
          This page never links to a product, checkout, or tracking URL.
        </span>
      </label>
      <fieldset className="company-nonprofit">
        <legend>Non-profit listing</legend>
        <p className="admin-field-hint">
          Shown in campaign search under Non-profit organizations.
        </p>
        <label className="company-nonprofit-check">
          <input
            type="checkbox"
            checked={form.nonprofitListed}
            onChange={(event) =>
              setForm({ ...form, nonprofitListed: event.target.checked })
            }
          />
          List this company as a non-profit
        </label>
        <label>
          Public name
          <input
            className="admin-input"
            placeholder={form.name || "Giving Site"}
            value={form.nonprofitName}
            onChange={(event) =>
              setForm({ ...form, nonprofitName: event.target.value })
            }
          />
        </label>
        <label>
          Short description
          <textarea
            className="admin-textarea"
            rows={3}
            maxLength={500}
            placeholder="We help institutions raise verified, one-time gifts."
            value={form.nonprofitDescription}
            onChange={(event) =>
              setForm({ ...form, nonprofitDescription: event.target.value })
            }
          />
        </label>
        <label>
          Logo
          <input
            className="admin-input"
            type="url"
            placeholder="https://…"
            value={form.nonprofitLogoUrl}
            onChange={(event) =>
              setForm({ ...form, nonprofitLogoUrl: event.target.value })
            }
          />
          <MediaUpload
            folder="brand"
            onUploaded={(url) => setForm({ ...form, nonprofitLogoUrl: url })}
          />
          {form.nonprofitLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.nonprofitLogoUrl}
              alt=""
              className="layout-switcher-logo-preview"
            />
          ) : null}
        </label>
      </fieldset>
      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? "Saving…" : mode === "create" ? "Create company" : "Save company"}
      </button>
      {message ? <p className="form-message">{message}</p> : null}
    </form>
  );
}
