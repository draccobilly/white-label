"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MediaUpload } from "@/components/admin/MediaUpload";
import type { CampaignLayout } from "@/lib/campaign-layout";

const OPTIONS: Array<{
  value: CampaignLayout;
  title: string;
  hint: string;
}> = [
  {
    value: "CLASSIC",
    title: "Classic",
    hint: "Full-bleed hero, navy overlay, current campaign page.",
  },
  {
    value: "IMPACT",
    title: "Impact",
    hint: "Story left, sticky donate widget right. Neutral conversion layout.",
  },
];

export function CampaignLayoutSwitcher({
  companyId,
  initialLayout,
  initialImpactLogoUrl,
}: {
  companyId: string;
  initialLayout: CampaignLayout;
  initialImpactLogoUrl?: string | null;
}) {
  const router = useRouter();
  const [layout, setLayout] = useState<CampaignLayout>(initialLayout);
  const [impactLogoUrl, setImpactLogoUrl] = useState(initialImpactLogoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: CampaignLayout) {
    if (next === layout || pending) return;
    const previous = layout;
    setLayout(next);
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/companies/layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, campaignLayout: next }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLayout(previous);
        setError(result.error ?? "Unable to switch layout");
        return;
      }
      router.refresh();
    });
  }

  function saveImpactLogo(url: string) {
    const previous = impactLogoUrl;
    setImpactLogoUrl(url);
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/companies/impact-logo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, impactLogoUrl: url }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setImpactLogoUrl(previous);
        setError(result.error ?? "Unable to save Impact logo");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="layout-switcher">
      <div className="layout-switcher-label">Campaign page layout</div>
      <div className="layout-switcher-grid" role="radiogroup" aria-label="Campaign page layout">
        {OPTIONS.map((option) => {
          const active = layout === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`layout-switcher-option${active ? " is-active" : ""}`}
              disabled={pending}
              onClick={() => choose(option.value)}
            >
              <strong>{option.title}</strong>
              <span>{option.hint}</span>
            </button>
          );
        })}
      </div>
      <label className="layout-switcher-logo">
        Impact logo
        <input
          className="admin-input"
          type="url"
          placeholder="https://…"
          value={impactLogoUrl}
          disabled={pending}
          onChange={(event) => setImpactLogoUrl(event.target.value)}
          onBlur={() => {
            if (impactLogoUrl !== (initialImpactLogoUrl ?? "")) {
              saveImpactLogo(impactLogoUrl);
            }
          }}
        />
        <MediaUpload folder="brand" onUploaded={saveImpactLogo} />
        {impactLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={impactLogoUrl} alt="" className="layout-switcher-logo-preview" />
        ) : (
          <small>Upload a mark for Impact. Classic keeps the Settings logo.</small>
        )}
      </label>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
