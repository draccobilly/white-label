import { redirect } from "next/navigation";
import { getDefaultAffiliateCampaign, getPublicChrome } from "@/lib/public-campaigns";
import { keepsRunningCampaignAddress } from "@/lib/campaign-defaults";
import { publicCampaignPath } from "@/lib/public-site-url";

export const dynamic = "force-dynamic";

export default async function ShortThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignSlug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ campaignSlug }, query] = await Promise.all([params, searchParams]);
  if (query.token) {
    redirect(`/api/receipt?token=${encodeURIComponent(query.token)}`);
  }
  const [chrome, page] = await Promise.all([
    getPublicChrome().catch(() => null),
    getDefaultAffiliateCampaign(campaignSlug).catch(() => null),
  ]);
  redirect(
    publicCampaignPath(
      chrome?.pathPrefix,
      campaignSlug,
      page?.affiliate.slug ?? "direct-team",
      "",
      { short: keepsRunningCampaignAddress(campaignSlug) },
    ),
  );
}
