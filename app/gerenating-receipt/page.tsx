import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import { ReceiptCountdown } from "@/components/receipt/ReceiptCountdown";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { getReceiptAccess } from "@/lib/receipt-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Generating your receipt",
  description: "Your donation receipt is being prepared.",
};

export default async function GeneratingReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const query = await searchParams;
  if (!query.token || query.token.length > 2000) notFound();

  const [access, chrome] = await Promise.all([
    getReceiptAccess(query.token),
    getPublicPageChrome().catch(() => null),
  ]);
  if (!access) notFound();
  if (access.available) redirect(access.receiptPath);

  const inner = (
    <main className="receipt-wait-shell">
      <div className="receipt-wait-card">
        <span className="receipt-wait-kicker">Receipt center</span>
        <h1>We’re preparing your receipt</h1>
        <p>
          For security and review, receipts become available 24 hours after
          payment confirmation. This page will take you to your receipt
          automatically when it is ready.
        </p>
        <ReceiptCountdown
          receiptToken={access.token}
          availableAt={access.availableAt.toISOString()}
        />
        <p className="receipt-wait-disclaimer">
          This is your official donation record. Keep this page or return with
          the same link from your confirmation email.
        </p>
      </div>
    </main>
  );

  if (chrome) {
    return <PublicSiteShell chrome={chrome}>{inner}</PublicSiteShell>;
  }
  return inner;
}
