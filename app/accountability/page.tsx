import type { Metadata } from "next";
import { StoryCta, StorySection } from "@/components/public/StoryBlocks";
import { PublicInfoPage } from "@/components/public/PublicInfoPage";
import { requireInstitutionalSite } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";
import { documentRequestMailto } from "@/lib/nonprofit-verify";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await requireInstitutionalSite();
  return {
    title: chrome.messages.site.accountabilityTitle,
    description: chrome.messages.site.accountabilityDescription,
  };
}

export default async function AccountabilityPage() {
  const chrome = await requireInstitutionalSite();
  const site = chrome.messages.site;
  const { brand } = chrome;
  const docsHref = documentRequestMailto(brand.contactEmail, brand.siteName);

  return (
    <PublicInfoPage
      chrome={chrome}
      kicker={site.navAccountability}
      title={site.accountabilityTitle}
      lead={site.accountabilityLead}
    >
      <dl className="inst-story-facts">
        <div>
          <dt>{site.orgFactOrg}</dt>
          <dd>{brand.nonprofitName || brand.siteName}</dd>
        </div>
        <div>
          <dt>{site.orgFactStatus}</dt>
          <dd>{site.charityStatus}</dd>
        </div>
        <div>
          <dt>{site.orgFactEin}</dt>
          <dd>{brand.nonprofitEin || "—"}</dd>
        </div>
        <div>
          <dt>{site.orgFactLocation}</dt>
          <dd>{brand.contactAddress || "—"}</dd>
        </div>
      </dl>

      <StorySection title={site.requestHeading}>
        <p>{site.requestBody}</p>
        <p>{site.accountabilityP1}</p>
        <p>{site.accountabilityP2}</p>
        <p>{site.accountabilityP3}</p>
        <div className="inst-story-actions">
          <StoryCta href={docsHref}>{site.requestCta}</StoryCta>
          <StoryCta href={withPublicPrefix(chrome.pathPrefix, "/help")} variant="ghost">
            {site.paymentHelpLink}
          </StoryCta>
        </div>
      </StorySection>
    </PublicInfoPage>
  );
}
