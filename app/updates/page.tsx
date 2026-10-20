import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/public/PublicInfoPage";
import { SitePostList } from "@/components/public/SitePostList";
import { requireInstitutionalSite } from "@/lib/public-campaigns";
import { listPublishedSitePosts } from "@/lib/site-posts";
import { SitePostKind } from "@/generated/prisma/enums";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await requireInstitutionalSite();
  return {
    title: chrome.messages.site.updatesTitle,
    description: chrome.messages.site.updatesLead,
  };
}

export default async function UpdatesPage() {
  const chrome = await requireInstitutionalSite();
  const posts = await listPublishedSitePosts(
    chrome.company.id,
    SitePostKind.FIELD_UPDATE,
  );
  const site = chrome.messages.site;

  return (
    <PublicInfoPage
      chrome={chrome}
      kicker={site.navUpdates}
      title={site.updatesHero}
      lead={site.updatesLead}
      wide
    >
      <p className="inst-story-thanks">{site.updatesThanks}</p>
      <SitePostList
        posts={posts}
        emptyLabel={site.updatesEmpty}
        readLabel={site.readArticle}
        pathPrefix={chrome.pathPrefix}
        demoBadge={site.demoBadge}
        locale={chrome.locale}
        kindLabel={site.updatesTitle}
        variant="editorial"
      />
    </PublicInfoPage>
  );
}
