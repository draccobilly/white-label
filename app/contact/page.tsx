import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/public/PublicInfoPage";
import { requireInstitutionalSite } from "@/lib/public-campaigns";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await requireInstitutionalSite();
  return {
    title: chrome.messages.site.contactTitle,
    description: chrome.messages.site.contactDescription,
  };
}

export default async function ContactPage() {
  const chrome = await requireInstitutionalSite();
  const site = chrome.messages.site;
  const {
    contactEmail,
    contactPhone,
    contactAddress,
    nonprofitEin,
    nonprofitName,
    siteName,
  } = chrome.brand;
  const hasContact = Boolean(
    contactEmail || contactPhone || contactAddress || nonprofitEin || nonprofitName,
  );

  return (
    <PublicInfoPage chrome={chrome} title={site.contactTitle} lead={site.contactLead}>
      <p>{siteName}</p>
      {nonprofitName && nonprofitName !== siteName ? <p>{nonprofitName}</p> : null}
      <p>{site.charityStatus}</p>
      {hasContact ? (
        <>
          {nonprofitEin ? (
            <p>
              <strong>{site.contactEin}.</strong> {nonprofitEin}
            </p>
          ) : null}
          {contactAddress ? (
            <p>
              <strong>{site.contactAddress}.</strong> {contactAddress}
            </p>
          ) : null}
          {contactEmail ? (
            <p>
              <strong>{site.contactEmail}.</strong>{" "}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </p>
          ) : null}
          {contactPhone ? (
            <p>
              <strong>{site.contactPhone}.</strong>{" "}
              <a href={`tel:${contactPhone.replace(/[^\d+]/g, "")}`}>{contactPhone}</a>
            </p>
          ) : null}
        </>
      ) : (
        <p>{site.contactEmpty}</p>
      )}
    </PublicInfoPage>
  );
}
