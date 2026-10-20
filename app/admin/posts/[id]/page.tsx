import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SitePostEditor } from "@/components/admin/SitePostEditor";
import { requireOwnerPage } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export default async function EditSitePostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireOwnerPage();
  const company = await getAdminCompany();
  const post = await prisma.sitePost.findFirst({
    where: { id, companyId: company.id },
  });
  if (!post) {
    const elsewhere = await prisma.sitePost.findUnique({
      where: { id },
      select: { id: true },
    });
    if (elsewhere) redirect("/admin/posts?notice=desk-switch");
    notFound();
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Public site"
        title={post.title}
        description={`${
          post.kind === "PROGRAM"
            ? "Program in action"
            : post.kind === "FIELD_UPDATE"
              ? "Field update"
              : "News"
        } · ${post.status === "PUBLISHED" ? "Published" : "Draft"}`}
        actions={
          <Link className="secondary-button" href="/admin/posts">
            Back to posts
          </Link>
        }
      />
      <AdminCard>
        <SitePostEditor
          postId={post.id}
          initial={{
            kind:
              post.kind === "PROGRAM"
                ? "PROGRAM"
                : post.kind === "FIELD_UPDATE"
                  ? "FIELD_UPDATE"
                  : "NEWS",
            status: post.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt,
            body: post.body,
            coverImageUrl: post.coverImageUrl ?? "",
          }}
        />
      </AdminCard>
    </>
  );
}
