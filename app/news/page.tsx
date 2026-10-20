import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/public/PublicInfoPage";
import { SitePostList } from "@/components/public/SitePostList";
import { requireInstitutionalSite } from "@/lib/public-campaigns";
import { listPublishedSitePosts } from "@/lib/site-posts";
import { SitePostKind } from "@/generated/prisma/enums";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await requireInstitutionalSite();
  return {
    title: chrome.messages.site.newsTitle,
    description: chrome.messages.site.newsLead,
  };
}

export default async function NewsPage() {
  const chrome = await requireInstitutionalSite();
  const posts = await listPublishedSitePosts(
    chrome.company.id,
    SitePostKind.NEWS,
  );
  const site = chrome.messages.site;

  return (
    <PublicInfoPage
      chrome={chrome}
      kicker={site.newsKicker}
      title={site.newsHero}
      lead={site.newsLead}
      wide
    >
      <SitePostList
        posts={posts}
        emptyLabel={site.newsEmpty}
        readLabel={site.readArticle}
        pathPrefix={chrome.pathPrefix}
        demoBadge={site.demoBadge}
        locale={chrome.locale}
        kindLabel={site.newsTitle}
        variant="editorial"
      />
    </PublicInfoPage>
  );
}
