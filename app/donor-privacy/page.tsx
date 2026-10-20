import type { Metadata } from "next";
import { InstitutionalCopyPage } from "@/components/public/InstitutionalCopyPage";
import { requireInstitutionalSite } from "@/lib/public-campaigns";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await requireInstitutionalSite();
  return {
    title: chrome.messages.site.donorPrivacyTitle,
    description: chrome.messages.site.donorPrivacyDescription,
  };
}

export default async function DonorPrivacyPage() {
  const chrome = await requireInstitutionalSite();
  const site = chrome.messages.site;
  return (
    <InstitutionalCopyPage
      chrome={chrome}
      title={site.donorPrivacyTitle}
      lead={site.donorPrivacyLead}
      paragraphs={[
        site.donorPrivacyP1,
        site.donorPrivacyP2,
        site.donorPrivacyP3,
      ]}
    />
  );
}
