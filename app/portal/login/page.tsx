import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalLoginForm } from "@/components/portal/PortalLoginForm";
import { PortalShell } from "@/components/portal/PortalShell";
import { getOrganizerSession } from "@/lib/organizer-auth";
import { portalCopy, portalStrings } from "@/lib/portal-copy";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  return { title: `${copy.loginTitle} · ${chrome.brand.siteName}`, robots: { index: false } };
}

function safeNext(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  const dashboard = withPublicPrefix(chrome.pathPrefix, "/portal");
  const { next } = await searchParams;
  const nextHref = safeNext(next, dashboard);
  if (await getOrganizerSession()) redirect(nextHref);

  return (
    <PortalShell chrome={chrome} copy={copy} organizer={null} title={copy.loginTitle} lead={copy.loginLead}>
      <PortalLoginForm
        copy={portalStrings(copy)}
        nextHref={nextHref}
        forgotHref={withPublicPrefix(chrome.pathPrefix, "/portal/forgot")}
        startHref={withPublicPrefix(chrome.pathPrefix, "/start-a-fundraiser")}
      />
    </PortalShell>
  );
}
