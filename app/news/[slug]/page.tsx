import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicInfoPage } from "@/components/public/PublicInfoPage";
import { requireInstitutionalSite } from "@/lib/public-campaigns";
import { getPublishedSitePost, splitPostBody } from "@/lib/site-posts";
import { SitePostKind } from "@/generated/prisma/enums";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const chrome = await requireInstitutionalSite();
  const post = await getPublishedSitePost(
    chrome.company.id,
    SitePostKind.NEWS,
    slug,
  );
  if (!post) return { title: chrome.messages.site.newsTitle };
  return { title: post.title, description: post.excerpt };
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const chrome = await requireInstitutionalSite();
  const post = await getPublishedSitePost(
    chrome.company.id,
    SitePostKind.NEWS,
    slug,
  );
  if (!post) notFound();

  return (
    <PublicInfoPage chrome={chrome} title={post.title} lead={post.excerpt}>
      {post.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="inst-article-cover" src={post.coverImageUrl} alt="" />
      ) : null}
      {splitPostBody(post.body).map((paragraph) => (
        <p key={paragraph.slice(0, 48)}>{paragraph}</p>
      ))}
    </PublicInfoPage>
  );
}
