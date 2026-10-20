import { SitePostKind, SitePostStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type PublicPostKind = "NEWS" | "FIELD_UPDATE" | "PROGRAM";

export type PublicSitePost = {
  id: string;
  kind: PublicPostKind;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  publishedAt: Date | null;
};

export function prismaSitePostKind(kind: string): SitePostKind {
  if (kind === "FIELD_UPDATE") return SitePostKind.FIELD_UPDATE;
  if (kind === "PROGRAM") return SitePostKind.PROGRAM;
  return SitePostKind.NEWS;
}

export function publicPostKind(kind: SitePostKind | string): PublicPostKind {
  if (kind === SitePostKind.FIELD_UPDATE || kind === "FIELD_UPDATE") {
    return "FIELD_UPDATE";
  }
  if (kind === SitePostKind.PROGRAM || kind === "PROGRAM") return "PROGRAM";
  return "NEWS";
}

function toPublicPost(post: {
  id: string;
  kind: SitePostKind;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  publishedAt: Date | null;
}): PublicSitePost {
  return {
    id: post.id,
    kind: publicPostKind(post.kind),
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    coverImageUrl: post.coverImageUrl,
    publishedAt: post.publishedAt,
  };
}

export async function listPublishedSitePosts(
  companyId: string,
  kind: SitePostKind,
  take = 24,
): Promise<PublicSitePost[]> {
  const posts = await prisma.sitePost.findMany({
    where: {
      companyId,
      kind,
      status: SitePostStatus.PUBLISHED,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take,
  });
  return posts.map(toPublicPost);
}

export async function getPublishedSitePost(
  companyId: string,
  kind: SitePostKind,
  slug: string,
): Promise<PublicSitePost | null> {
  const post = await prisma.sitePost.findFirst({
    where: {
      companyId,
      kind,
      slug,
      status: SitePostStatus.PUBLISHED,
    },
  });
  return post ? toPublicPost(post) : null;
}

export function postPath(kind: string, slug: string) {
  if (kind === "FIELD_UPDATE") return `/updates/${slug}`;
  if (kind === "PROGRAM") return "/#programs";
  return `/news/${slug}`;
}

export function splitPostBody(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
