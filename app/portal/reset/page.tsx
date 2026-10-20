import type { Metadata } from "next";
import Link from "next/link";
import { PortalResetForm } from "@/components/portal/PortalPasswordForms";
import { PortalShell } from "@/components/portal/PortalShell";
import { organizerFromResetToken } from "@/lib/organizer-auth";
import { portalCopy, portalStrings } from "@/lib/portal-copy";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  return { title: `${copy.resetTitle} · ${chrome.brand.siteName}`, robots: { index: false } };
}

export default async function PortalResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  const { token } = await searchParams;
  const organizer = token ? await organizerFromResetToken(token) : null;
  const valid = Boolean(organizer && organizer.companyId === chrome.company.id);

  return (
    <PortalShell chrome={chrome} copy={copy} organizer={null} title={copy.resetTitle} lead={copy.resetLead}>
      {valid && token ? (
        <PortalResetForm copy={portalStrings(copy)} token={token} dashboardHref={withPublicPrefix(chrome.pathPrefix, "/portal")} />
      ) : (
        <>
          <p className="form-message">{copy.resetInvalid}</p>
          <p className="admin-field-hint">
            <Link className="inst-terms-link" href={withPublicPrefix(chrome.pathPrefix, "/portal/forgot")}>
              {copy.forgotTitle}
            </Link>
          </p>
        </>
      )}
    </PortalShell>
  );
}
