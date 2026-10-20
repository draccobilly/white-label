import { notFound, redirect } from "next/navigation";
import CheckoutPage from "../[affiliateSlug]/checkout/page";
import { keepsRunningCampaignAddress } from "@/lib/campaign-defaults";
import { getDefaultAffiliateCampaign, getPublicChrome } from "@/lib/public-campaigns";
import { publicCampaignPath, withSearchParams } from "@/lib/public-site-url";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ campaignSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShortCheckoutPage(props: PageProps) {
  const [{ campaignSlug }, query] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const [page, chrome] = await Promise.all([
    getDefaultAffiliateCampaign(campaignSlug).catch(() => null),
    getPublicChrome().catch(() => null),
  ]);
  if (!page) notFound();
  if (keepsRunningCampaignAddress(campaignSlug)) {
    return CheckoutPage({
      params: Promise.resolve({
        campaignSlug,
        affiliateSlug: page.affiliate.slug,
      }),
      searchParams: props.searchParams as Promise<{ option?: string }>,
    });
  }
  redirect(
    withSearchParams(
      publicCampaignPath(
        chrome?.pathPrefix,
        campaignSlug,
        page.affiliate.slug,
        "/checkout",
      ),
      query,
    ),
  );
}
