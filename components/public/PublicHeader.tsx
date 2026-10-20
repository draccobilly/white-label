import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { ImpactPublicHeader } from "@/components/public/ImpactPublicHeader";
import type { SearchCampaign, SearchOrg } from "@/components/public/ImpactSearch";
import { PublicMenu } from "@/components/public/PublicMenu";
import type { Messages } from "@/lib/i18n/types";
import { en } from "@/lib/i18n/en";

type Props = {
  siteName?: string;
  logoUrl?: string | null;
  donateHref?: string | null;
  messages?: Messages;
  locale?: string;
  pathPrefix?: string | null;
  variant?: "classic" | "impact";
  searchCampaigns?: SearchCampaign[];
  searchOrgs?: SearchOrg[];
  campaignHref?: string | null;
  institutional?: boolean;
};

export function PublicHeader({
  siteName,
  logoUrl,
  donateHref,
  messages = en,
  locale,
  pathPrefix,
  variant = "classic",
  searchCampaigns,
  searchOrgs,
  campaignHref,
  institutional,
}: Props) {
  const menuLocale = locale ?? messages.htmlLang;
  if (variant === "impact") {
    return (
      <ImpactPublicHeader
        siteName={siteName}
        logoUrl={logoUrl}
        donateHref={donateHref}
        locale={menuLocale}
        pathPrefix={pathPrefix}
        searchCampaigns={searchCampaigns}
        searchOrgs={searchOrgs}
        campaignHref={campaignHref}
        institutional={institutional}
      />
    );
  }

  return (
    <header className="public-header">
      <div className="shell public-header-inner">
        <PublicMenu locale={menuLocale} pathPrefix={pathPrefix} />
        <BrandLogo siteName={siteName} logoUrl={logoUrl} href="/" />
        {donateHref ? (
          <Link className="primary-button header-donate" href={donateHref}>
            {messages.nav.donate}
          </Link>
        ) : (
          <span aria-hidden className="public-header-spacer" />
        )}
      </div>
    </header>
  );
}
