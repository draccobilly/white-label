import type { Metadata } from "next";
import { InstitutionalCopyPage } from "@/components/public/InstitutionalCopyPage";
import { requireInstitutionalSite } from "@/lib/public-campaigns";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await requireInstitutionalSite();
  return {
    title: chrome.messages.site.privacyTitle,
    description: chrome.messages.site.privacyDescription,
  };
}

export default async function PrivacyPage() {
  const chrome = await requireInstitutionalSite();
  const site = chrome.messages.site;
  return (
    <InstitutionalCopyPage
      chrome={chrome}
      title={site.privacyTitle}
      lead={site.privacyLead}
      paragraphs={[site.privacyP1, site.privacyP2, site.privacyP3]}
    />
  );
}
