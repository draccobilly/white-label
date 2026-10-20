import type { Metadata } from "next";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import { RefundRequestForm } from "@/components/refund/RefundRequestForm";
import { getPublicPageChrome } from "@/lib/public-campaigns";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getPublicPageChrome();
  return {
    title: messages.refund.title,
    description: messages.refund.description,
  };
}

export default async function RefundPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const [query, chrome] = await Promise.all([
    searchParams,
    getPublicPageChrome(),
  ]);
  const copy = chrome.messages.refund;

  return (
    <PublicSiteShell chrome={chrome}>
      <main className="inst-apply refund-page">
        <div className="shell inst-apply-inner">
          <p className="inst-kicker">{chrome.messages.site.charityLine}</p>
          <h1>{copy.title}</h1>
          <p className="inst-lead">{copy.lead}</p>
          <div className="inst-apply-copy">
            <p>{copy.p1}</p>
            <p>{copy.p2}</p>
          </div>
          <RefundRequestForm initialCode={query.code ?? ""} copy={copy} />
        </div>
      </main>
    </PublicSiteShell>
  );
}
