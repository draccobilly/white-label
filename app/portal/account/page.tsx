import type { Metadata } from "next";
import { PortalChangePasswordForm } from "@/components/portal/PortalPasswordForms";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireOrganizer } from "@/lib/organizer-auth";
import { portalCopy, portalStrings } from "@/lib/portal-copy";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  return { title: `${copy.accountTitle} · ${chrome.brand.siteName}`, robots: { index: false } };
}

export default async function PortalAccountPage() {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  const organizer = await requireOrganizer(chrome.pathPrefix, withPublicPrefix(chrome.pathPrefix, "/portal/account"));

  return (
    <PortalShell chrome={chrome} copy={copy} organizer={organizer} title={copy.accountTitle} lead={copy.accountLead}>
      <dl className="admin-meta-grid portal-meta">
        <div>
          <dt>{copy.email}</dt>
          <dd>{organizer.email}</dd>
        </div>
        <div>
          <dt>{copy.name}</dt>
          <dd>{organizer.name}</dd>
        </div>
      </dl>
      <PortalChangePasswordForm copy={portalStrings(copy)} />
    </PortalShell>
  );
}
