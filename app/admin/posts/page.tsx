import Link from "next/link";
import { Newspaper } from "lucide-react";
import { AdminChip } from "@/components/admin/AdminChip";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireOwnerPage } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/utils";

function kindLabel(kind: string) {
  return kind === "PROGRAM"
    ? "Program in action"
    : kind === "FIELD_UPDATE"
      ? "Field update"
      : "News";
}

export default async function AdminPostsPage() {
  await requireOwnerPage();
  const company = await getAdminCompany();
  const posts = await prisma.sitePost.findMany({
    where: { companyId: company.id },
    orderBy: { updatedAt: "desc" },
  });
  const published = posts.filter((post) => post.status === "PUBLISHED").length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Site público"
        title="Posts"
        description="Program cards appear on the home. News appears on /news. Field updates appear on /updates."
        badges={
          posts.length ? (
            <>
              <AdminChip tone="success">{published} published</AdminChip>
              <AdminChip>{posts.length - published} draft{posts.length - published === 1 ? "" : "s"}</AdminChip>
            </>
          ) : null
        }
        actions={
          <Link className="primary-button" href="/admin/posts/new">
            New post
          </Link>
        }
      />
      <div className="admin-list">
        {posts.length ? (
          posts.map((post) => (
            <Link key={post.id} href={`/admin/posts/${post.id}`} className="admin-list-row">
              <div className="admin-list-main">
                <strong>{post.title}</strong>
                <div className="admin-list-sub">
                  <span>{kindLabel(post.kind)}</span>
                  <span>/{post.slug}</span>
                </div>
              </div>
              <div className="admin-list-meta">
                <AdminChip tone={post.status === "PUBLISHED" ? "success" : "neutral"}>
                  {post.status === "PUBLISHED" ? "Published" : "Draft"}
                </AdminChip>
                <time dateTime={post.updatedAt.toISOString()} title={post.updatedAt.toLocaleString("en-US")}>
                  {formatRelativeTime(post.updatedAt)}
                </time>
              </div>
            </Link>
          ))
        ) : (
          <AdminEmptyState
            icon={<Newspaper size={20} />}
            title="No posts yet"
            body="Create a program card, news note, or field update. Drafts stay off the public site until you publish them."
            action={
              <Link className="primary-button" href="/admin/posts/new">
                Create the first post
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}
