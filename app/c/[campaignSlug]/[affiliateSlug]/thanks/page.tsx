import { redirect } from "next/navigation";
import { getPublicChrome } from "@/lib/public-campaigns";
import { keepsRunningCampaignAddress } from "@/lib/campaign-defaults";
import { publicCampaignPath } from "@/lib/public-site-url";

export const dynamic = "force-dynamic";

export default async function LegacyThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignSlug: string; affiliateSlug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ campaignSlug, affiliateSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (query.token) {
    redirect(`/api/receipt?token=${encodeURIComponent(query.token)}`);
  }
  const chrome = await getPublicChrome().catch(() => null);
  redirect(
    publicCampaignPath(chrome?.pathPrefix, campaignSlug, affiliateSlug, "", {
      short: Boolean(
        chrome?.institutional && keepsRunningCampaignAddress(campaignSlug),
      ),
    }),
  );
}
