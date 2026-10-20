"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CampaignLayoutSwitcher } from "@/components/admin/CampaignLayoutSwitcher";
import { CompanyForm } from "@/components/admin/CompanyForm";
import type { CampaignLayout } from "@/lib/campaign-layout";

export type CompanyCardData = {
  id: string;
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
  hasPagnovoWebhookSecret: boolean;
  campaignLayout: CampaignLayout;
  impactLogoUrl: string | null;
  nonprofitListed: boolean;
  nonprofitName: string;
  nonprofitDescription: string;
  nonprofitLogoUrl: string;
  isDefault: boolean;
  isActive: boolean;
};

function locationLabel(company: CompanyCardData) {
  if (company.publicPathPrefix) return company.publicPathPrefix;
  if (company.domain) return company.domain;
  return "No public path";
}

export function CompaniesBoard({ companies }: { companies: CompanyCardData[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if (!creating) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setCreating(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [creating]);

  async function activate(companyId: string) {
    setSwitchingId(companyId);
    await fetch("/api/admin/companies/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    router.refresh();
    window.location.reload();
  }

  return (
    <>
      <div className="company-board-toolbar">
        <p className="company-board-count">
          {companies.length} {companies.length === 1 ? "company" : "companies"}
        </p>
        <button
          type="button"
          className="primary-button"
          onClick={() => setCreating(true)}
        >
          + Criar empresa
        </button>
      </div>

      {creating ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCreating(false);
          }}
        >
          <div
            className="admin-modal admin-modal-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-company-title"
          >
            <button
              type="button"
              className="admin-modal-close"
              aria-label="Close"
              onClick={() => setCreating(false)}
            >
              ×
            </button>
            <h2 id="create-company-title">Create company</h2>
            <p>A new company gets its own campaigns, pixels and checkout.</p>
            <CompanyForm mode="create" />
          </div>
        </div>
      ) : null}

      <div className="company-board">
        {companies.map((company) => {
          const open = openId === company.id;
          return (
            <article
              key={company.id}
              className={`company-tile${open ? " is-open" : ""}`}
            >
              <header className="company-tile-head">
                <button
                  type="button"
                  className="company-tile-toggle"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : company.id)}
                >
                  <span
                    className={`company-tile-chevron${open ? " is-open" : ""}`}
                    aria-hidden
                  >
                    {open ? "▾" : "▸"}
                  </span>
                  <span className="company-tile-identity">
                    <strong>{company.name}</strong>
                    <span>{locationLabel(company)}</span>
                  </span>
                </button>
                <div className="company-tile-meta">
                  {company.isActive ? (
                    <span className="company-chip is-active">Active</span>
                  ) : null}
                  {company.isDefault ? (
                    <span className="company-chip">Default</span>
                  ) : null}
                  <span className="company-chip">
                    {company.siteMode === "INSTITUTIONAL" ? "Institutional" : "Campaign"}
                  </span>
                  <span className="company-chip">
                    {company.campaignLayout === "IMPACT" ? "Impact" : "Classic"}
                  </span>
                  <span className="company-chip">
                    {company.paymentGateway === "PAGNOVO" ? "Pagnovo" : "Stripe"}
                  </span>
                  <span className="company-chip">
                    {company.locale === "es-AR"
                      ? "ES-AR"
                      : company.locale === "es-MX"
                        ? "ES-MX"
                        : "EN"}
                  </span>
                  {company.nonprofitListed ? (
                    <span className="company-chip">Nonprofit</span>
                  ) : null}
                  {company.isActive ? null : (
                    <button
                      type="button"
                      className="secondary-button company-tile-switch"
                      disabled={switchingId === company.id}
                      onClick={() => void activate(company.id)}
                    >
                      {switchingId === company.id ? "Switching…" : "Work here"}
                    </button>
                  )}
                </div>
              </header>

              {open ? (
                <div className="company-tile-body">
                  <section className="company-tile-section">
                    <h3>Campaign layout</h3>
                    <CampaignLayoutSwitcher
                      companyId={company.id}
                      initialLayout={company.campaignLayout}
                      initialImpactLogoUrl={company.impactLogoUrl}
                    />
                  </section>
                  <section className="company-tile-section">
                    <h3>Company details</h3>
                    <CompanyForm
                      mode="edit"
                      initial={{
                        id: company.id,
                        name: company.name,
                        domain: company.domain,
                        publicPathPrefix: company.publicPathPrefix,
                        landingTitle: company.landingTitle,
                        landingBody: company.landingBody,
                        locale: company.locale,
                        paymentGateway: company.paymentGateway,
                        siteMode: company.siteMode,
                        contactEmail: company.contactEmail,
                        contactPhone: company.contactPhone,
                        contactAddress: company.contactAddress,
                        pagnovoWebhookSecret: "",
                        hasPagnovoWebhookSecret: company.hasPagnovoWebhookSecret,
                        nonprofitListed: company.nonprofitListed,
                        nonprofitName: company.nonprofitName,
                        nonprofitDescription: company.nonprofitDescription,
                        nonprofitLogoUrl: company.nonprofitLogoUrl,
                      }}
                    />
                  </section>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}
