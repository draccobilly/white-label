import { notFound, redirect } from "next/navigation";
import AffiliateCampaignPage, {
  generateMetadata as affiliateMetadata,
} from "./[affiliateSlug]/page";
import { keepsRunningCampaignAddress } from "@/lib/campaign-defaults";
import { getDefaultAffiliateCampaign, getPublicChrome } from "@/lib/public-campaigns";
import { publicCampaignPath, withSearchParams } from "@/lib/public-site-url";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ campaignSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(props: PageProps) {
  const { campaignSlug } = await props.params;
  const page = await getDefaultAffiliateCampaign(campaignSlug).catch(() => null);
  if (!page) return { title: "Campaign not found" };
  return affiliateMetadata({
    params: Promise.resolve({
      campaignSlug,
      affiliateSlug: page.affiliate.slug,
    }),
    searchParams: props.searchParams,
  });
}

export default async function ShortCampaignPage(props: PageProps) {
  const [{ campaignSlug }, query] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const page = await getDefaultAffiliateCampaign(campaignSlug).catch(() => null);
  if (!page) notFound();
  if (keepsRunningCampaignAddress(campaignSlug)) {
    return AffiliateCampaignPage({
      params: Promise.resolve({
        campaignSlug,
        affiliateSlug: page.affiliate.slug,
      }),
      searchParams: props.searchParams,
    });
  }
  const chrome = await getPublicChrome().catch(() => null);
  redirect(
    withSearchParams(
      publicCampaignPath(chrome?.pathPrefix, campaignSlug, page.affiliate.slug),
      query,
    ),
  );
}
