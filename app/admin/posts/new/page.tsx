import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SitePostEditor } from "@/components/admin/SitePostEditor";

export default function NewSitePostPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Public site"
        title="New post"
        description="Program cards appear on the home. News appears on /news. Field updates appear on /updates."
        actions={
          <Link className="secondary-button" href="/admin/posts">
            Back to posts
          </Link>
        }
      />
      <AdminCard>
        <SitePostEditor />
      </AdminCard>
    </>
  );
}
