import type { CSSProperties, ReactNode } from "react";
import { PublicHeader } from "@/components/public/PublicHeader";
import { ImpactSiteFooter } from "@/components/public/ImpactSiteFooter";
import type { getPublicPageChrome } from "@/lib/public-campaigns";

type Chrome = Awaited<ReturnType<typeof getPublicPageChrome>>;

export function PublicSiteShell({
  chrome,
  children,
  className,
}: {
  chrome: Chrome;
  children: ReactNode;
  className?: string;
}) {
  const theme = {
    "--navy": chrome.brand.primaryColor,
    "--gold": chrome.brand.accentColor,
  } as CSSProperties;

  return (
    <div
      className={`campaign-page${chrome.impact ? " impact-campaign" : ""}${
        chrome.institutional ? " inst-site" : ""
      }${className ? ` ${className}` : ""}`}
      style={theme}
    >
      <PublicHeader
        siteName={chrome.brand.siteName}
        logoUrl={chrome.brand.logoUrl}
        donateHref={chrome.donateHref}
        messages={chrome.messages}
        locale={chrome.locale}
        pathPrefix={chrome.pathPrefix}
        variant={chrome.impact ? "impact" : "classic"}
        searchCampaigns={chrome.campaigns}
        searchOrgs={chrome.searchOrgs}
        campaignHref={chrome.donateHref}
        institutional={chrome.institutional}
      />
      {children}
      {chrome.impact ? (
        <ImpactSiteFooter
          siteName={chrome.brand.siteName}
          footerText={chrome.brand.footerText}
          messages={chrome.messages}
          pathPrefix={chrome.pathPrefix}
          donateHref={chrome.donateHref}
          institutional={chrome.institutional}
          contactEmail={chrome.brand.contactEmail}
          contactPhone={chrome.brand.contactPhone}
          contactAddress={chrome.brand.contactAddress}
          nonprofitEin={chrome.brand.nonprofitEin}
          nonprofitName={chrome.brand.nonprofitName}
          logoUrl={chrome.brand.logoUrl}
        />
      ) : (
        <footer className="public-footer">
          <div className="shell">
            <p>{chrome.brand.footerText}</p>
          </div>
        </footer>
      )}
    </div>
  );
}
