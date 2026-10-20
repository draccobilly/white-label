import type { Metadata } from "next";
import { loadPortalCampaign, PortalCampaignFrame } from "@/components/portal/PortalCampaignPage";
import { PortalUpdatesManager } from "@/components/portal/PortalUpdatesManager";
import { portalCopy, portalStrings } from "@/lib/portal-copy";
import { prisma } from "@/lib/prisma";
import { getPublicPageChrome } from "@/lib/public-campaigns";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  return { title: `${copy.updates} · ${chrome.brand.siteName}`, robots: { index: false } };
}

export default async function PortalCampaignUpdatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await loadPortalCampaign(id, "/updates");
  const { chrome, copy, campaign } = loaded;
  const updates = await prisma.campaignUpdate.findMany({
    where: { campaignId: campaign.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true, createdAt: true },
  });

  return (
    <PortalCampaignFrame loaded={loaded} lead={copy.updatesLead}>
      <PortalUpdatesManager
        campaignId={campaign.id}
        copy={portalStrings(copy)}
        locale={chrome.locale === "en" ? "en-US" : chrome.locale}
        updates={updates.map((update) => ({ ...update, createdAt: update.createdAt.toISOString() }))}
      />
    </PortalCampaignFrame>
  );
}
