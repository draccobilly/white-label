import type { Metadata } from "next";
import { StoryCta, StorySection } from "@/components/public/StoryBlocks";
import { PublicInfoPage } from "@/components/public/PublicInfoPage";
import { requireInstitutionalSite } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";
import {
  candidSearchUrl,
  documentRequestMailto,
  irsSearchUrl,
  propublicaNonprofitUrl,
} from "@/lib/nonprofit-verify";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await requireInstitutionalSite();
  return {
    title: chrome.messages.site.transparencyTitle,
    description: chrome.messages.site.transparencyDescription,
  };
}

export default async function TransparencyPage() {
  const chrome = await requireInstitutionalSite();
  const site = chrome.messages.site;
  const { brand } = chrome;
  const ein = brand.nonprofitEin || "";
  const docsHref = documentRequestMailto(brand.contactEmail, brand.siteName);

  return (
    <PublicInfoPage
      chrome={chrome}
      kicker={site.navTransparency}
      title={site.transparencyTitle}
      lead={site.transparencyLead}
      updated={`${site.lastUpdated} · September 2026`}
    >
      <p>
        {brand.nonprofitName || brand.siteName}. {site.charityStatus}
        {ein ? ` · ${site.contactEin} ${ein}` : ""}. {brand.contactAddress}
      </p>

      <StorySection title={site.verifyHeading}>
        <p>{site.verifyLead}</p>
        <ul className="inst-story-links">
          <li>
            <a href={irsSearchUrl(ein)} target="_blank" rel="noreferrer">
              {site.irsTitle}
            </a>
            <span>
              {site.irsBody} {ein}.
            </span>
          </li>
          <li>
            <a href={propublicaNonprofitUrl(ein)} target="_blank" rel="noreferrer">
              {site.propublicaTitle}
            </a>
            <span>{site.propublicaBody}</span>
          </li>
          <li>
            <a href={candidSearchUrl(ein)} target="_blank" rel="noreferrer">
              {site.candidTitle}
            </a>
            <span>{site.candidBody}</span>
          </li>
        </ul>
      </StorySection>

      <StorySection title={site.docsHeading}>
        <p>{site.docsBody}</p>
        <StoryCta href={docsHref}>{site.docsCta}</StoryCta>
      </StorySection>

      <StorySection title={site.whereHeading}>
        <p>{site.whereBody}</p>
        <p>{site.transparencyP1}</p>
        <p>{site.transparencyP2}</p>
        <p>{site.transparencyP3}</p>
      </StorySection>

      <StorySection title={site.questionsHeading}>
        <p>{site.questionsBody}</p>
        <div className="inst-story-actions">
          <StoryCta href={withPublicPrefix(chrome.pathPrefix, "/contact")}>
            {site.contactTeam}
          </StoryCta>
          <StoryCta href={withPublicPrefix(chrome.pathPrefix, "/help")} variant="ghost">
            {site.visitHelp}
          </StoryCta>
        </div>
      </StorySection>
    </PublicInfoPage>
  );
}
