import type { Metadata } from "next";
import Link from "next/link";
import { PortalForgotForm } from "@/components/portal/PortalPasswordForms";
import { PortalShell } from "@/components/portal/PortalShell";
import { portalCopy, portalStrings } from "@/lib/portal-copy";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  return { title: `${copy.forgotTitle} · ${chrome.brand.siteName}`, robots: { index: false } };
}

export default async function PortalForgotPage() {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  return (
    <PortalShell chrome={chrome} copy={copy} organizer={null} title={copy.forgotTitle} lead={copy.forgotLead}>
      <PortalForgotForm copy={portalStrings(copy)} />
      <p className="admin-field-hint">
        <Link className="inst-terms-link" href={withPublicPrefix(chrome.pathPrefix, "/portal/login")}>
          {copy.signIn}
        </Link>
      </p>
    </PortalShell>
  );
}
