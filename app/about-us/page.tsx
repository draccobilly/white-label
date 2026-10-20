import type { Metadata } from "next";
import { SiteMission } from "@/components/public/SiteMission";
import { StoryCta, StorySection } from "@/components/public/StoryBlocks";
import { PublicInfoPage } from "@/components/public/PublicInfoPage";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await getPublicPageChrome();
  if (chrome.institutional) {
    return {
      title: chrome.messages.site.aboutPageTitle,
      description: chrome.messages.site.aboutPageDescription,
    };
  }
  return {
    title: chrome.messages.about.title,
    description: chrome.messages.about.description,
  };
}

export default async function AboutUsPage() {
  const chrome = await getPublicPageChrome();
  if (chrome.institutional) {
    const site = chrome.messages.site;
    const prefix = chrome.pathPrefix;
    const { brand } = chrome;
    return (
      <PublicInfoPage
        chrome={chrome}
        kicker={site.aboutKicker}
        title={site.aboutPageTitle}
        lead={site.aboutPageLead}
        after={
          <SiteMission
            kicker={site.orgKicker}
            title={site.orgTitle}
            lead={site.orgLead}
            p1={site.orgP1}
            p2={site.orgP2}
            verseButton={site.verseButton}
            verseAnother={site.verseAnother}
          />
        }
      >
        <p>{site.aboutPageP1}</p>
        <p>{site.aboutPageP2}</p>
        <p>{site.aboutPageP3}</p>

        <StorySection title={site.aboutStoryTitle}>
          <p>{site.aboutStoryBody}</p>
          <div className="inst-story-actions">
            <StoryCta href={withPublicPrefix(prefix, "/campaigns")}>
              {site.aboutExplore}
            </StoryCta>
            <StoryCta href={withPublicPrefix(prefix, "/contact")} variant="ghost">
              {site.contactTeam}
            </StoryCta>
          </div>
        </StorySection>

        <StorySection title={site.aboutOrgHeading}>
          <p>
            {brand.nonprofitName || brand.siteName}. {brand.contactAddress}.{" "}
            {site.contactEin}: {brand.nonprofitEin || "—"}.
          </p>
          <StoryCta href={withPublicPrefix(prefix, "/accountability")}>
            {site.aboutViewAccountability}
          </StoryCta>
        </StorySection>
      </PublicInfoPage>
    );
  }

  const body = chrome.company.landingBody
    ?.split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <PublicInfoPage
      chrome={chrome}
      title={chrome.messages.about.title}
      lead={
        chrome.company.landingTitle ||
        chrome.brand.siteName ||
        chrome.messages.about.fallbackLead
      }
    >
      {body?.length ? (
        body.map((paragraph) => <p key={paragraph.slice(0, 48)}>{paragraph}</p>)
      ) : (
        <>
          <p>{chrome.messages.about.fallbackP1}</p>
          <p>
            {chrome.paymentGateway === "PAGNOVO"
              ? chrome.messages.about.fallbackP2Pagnovo
              : chrome.messages.about.fallbackP2}
          </p>
        </>
      )}
    </PublicInfoPage>
  );
}
