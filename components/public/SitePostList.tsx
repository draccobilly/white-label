import Link from "next/link";
import type { PublicSitePost } from "@/lib/site-posts";
import { postPath } from "@/lib/site-posts";
import { withPublicPrefix } from "@/lib/public-site-url";

function formatPostDate(value: Date | null, locale?: string) {
  if (!value) return null;
  return value.toLocaleDateString(locale || "en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function SitePostList({
  posts,
  emptyLabel,
  readLabel,
  pathPrefix,
  demoBadge,
  locale,
  kindLabel,
  variant = "grid",
}: {
  posts: PublicSitePost[];
  emptyLabel: string;
  readLabel: string;
  pathPrefix?: string | null;
  demoBadge: string;
  locale?: string;
  kindLabel?: string;
  variant?: "grid" | "editorial";
}) {
  if (!posts.length) {
    return <p className="inst-empty">{emptyLabel}</p>;
  }

  return (
    <ul className={`inst-post-list${variant === "editorial" ? " is-editorial" : ""}`}>
      {posts.map((post, index) => {
        const demo = /demonstration content/i.test(post.excerpt);
        const date = formatPostDate(post.publishedAt, locale);
        const featured = variant === "editorial" && index === 0;
        return (
          <li key={post.id} className={featured ? "is-featured" : undefined}>
            <Link
              href={withPublicPrefix(pathPrefix, postPath(post.kind, post.slug))}
              className="inst-post-card"
            >
              {post.coverImageUrl ? (
                <span
                  className="inst-post-cover"
                  style={{ backgroundImage: `url(${post.coverImageUrl})` }}
                />
              ) : (
                <span className="inst-post-cover is-empty" />
              )}
              <span className="inst-post-copy">
                {demo ? <span className="inst-demo-badge">{demoBadge}</span> : null}
                <span className="inst-post-meta">
                  {kindLabel ? <em>{kindLabel}</em> : null}
                  {date ? <time dateTime={post.publishedAt?.toISOString()}>{date}</time> : null}
                </span>
                <strong>{post.title}</strong>
                {post.excerpt ? <span className="inst-post-excerpt">{post.excerpt}</span> : null}
                <em className="inst-post-read">{readLabel}</em>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
