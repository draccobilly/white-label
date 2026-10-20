import type { Metadata } from "next";
import { InstitutionalCopyPage } from "@/components/public/InstitutionalCopyPage";
import { requireInstitutionalSite } from "@/lib/public-campaigns";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await requireInstitutionalSite();
  return {
    title: chrome.messages.site.termsTitle,
    description: chrome.messages.site.termsDescription,
  };
}

export default async function TermsPage() {
  const chrome = await requireInstitutionalSite();
  const site = chrome.messages.site;
  return (
    <InstitutionalCopyPage
      chrome={chrome}
      title={site.termsTitle}
      lead={site.termsLead}
      paragraphs={[site.termsP1, site.termsP2, site.termsP3]}
    />
  );
}
