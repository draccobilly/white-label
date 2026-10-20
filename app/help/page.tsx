import type { Metadata } from "next";
import Link from "next/link";
import { PublicInfoPage } from "@/components/public/PublicInfoPage";
import { requireInstitutionalSite } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await requireInstitutionalSite();
  return {
    title: chrome.messages.site.helpTitle,
    description: chrome.messages.site.helpDescription,
  };
}

export default async function HelpPage() {
  const chrome = await requireInstitutionalSite();
  const site = chrome.messages.site;
  const prefix = chrome.pathPrefix;

  return (
    <PublicInfoPage chrome={chrome} title={site.helpTitle} lead={site.helpLead}>
      <p>{site.helpP1}</p>
      <p>{site.helpP2}</p>
      <p>{site.helpP3}</p>
      <p>
        <Link href={withPublicPrefix(prefix, "/track-your-donation")}>
          {chrome.messages.nav.track}
        </Link>
        {" · "}
        <Link href={withPublicPrefix(prefix, "/refund")}>
          {chrome.messages.refund.title}
        </Link>
        {" · "}
        <Link href={withPublicPrefix(prefix, "/contact")}>
          {site.navContact}
        </Link>
      </p>
    </PublicInfoPage>
  );
}
