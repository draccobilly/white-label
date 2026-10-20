import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/public/PublicInfoPage";
import { getPublicPageChrome } from "@/lib/public-campaigns";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getPublicPageChrome();
  return {
    title: messages.start.termsTitle,
    description: messages.start.termsDescription,
  };
}

export default async function FundraiserTermsPage() {
  const chrome = await getPublicPageChrome();
  const start = chrome.messages.start;
  return (
    <PublicInfoPage chrome={chrome} title={start.termsTitle} lead={start.termsLead}>
      <ol className="fundraiser-terms">
        {start.termsItems.map((item) => (
          <li key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </li>
        ))}
      </ol>
    </PublicInfoPage>
  );
}
