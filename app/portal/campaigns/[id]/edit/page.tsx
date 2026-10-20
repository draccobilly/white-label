import type { Metadata } from "next";
import { PortalCampaignEditForm } from "@/components/portal/PortalCampaignEditForm";
import { loadPortalCampaign, PortalCampaignFrame } from "@/components/portal/PortalCampaignPage";
import { portalCopy, portalStrings } from "@/lib/portal-copy";
import { getPublicPageChrome } from "@/lib/public-campaigns";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  return { title: `${copy.edit} · ${chrome.brand.siteName}`, robots: { index: false } };
}

export default async function PortalCampaignEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await loadPortalCampaign(id, "/edit");
  const { copy, campaign } = loaded;

  return (
    <PortalCampaignFrame loaded={loaded} lead={copy.editLead}>
      <PortalCampaignEditForm
        campaignId={campaign.id}
        copy={portalStrings(copy)}
        initial={{
          title: campaign.title,
          summary: campaign.summary,
          story: campaign.story,
          coverImageUrl: campaign.coverImageUrl ?? "",
          organizerImageUrl: campaign.organizerImageUrl ?? "",
          videoUrl: campaign.videoUrl ?? "",
          galleryImageUrls: campaign.galleryImageUrls,
        }}
      />
    </PortalCampaignFrame>
  );
}
