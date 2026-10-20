import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PortalCampaignTabs } from "@/components/portal/PortalCampaignTabs";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireOrganizer } from "@/lib/organizer-auth";
import { organizerCampaign, publicHrefFor } from "@/lib/organizer-portal";
import { campaignStatusLabel, portalCopy } from "@/lib/portal-copy";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";

/** Loads chrome, organizer, and the campaign for every portal campaign page. */
export async function loadPortalCampaign(campaignId: string, suffix: string) {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  const base = withPublicPrefix(chrome.pathPrefix, `/portal/campaigns/${campaignId}`);
  const organizer = await requireOrganizer(chrome.pathPrefix, `${base}${suffix}`);
  const campaign = await organizerCampaign(organizer.id, campaignId);
  if (!campaign) notFound();
  return { chrome, copy, organizer, campaign, base };
}

export function PortalCampaignFrame({
  loaded,
  lead,
  children,
}: {
  loaded: Awaited<ReturnType<typeof loadPortalCampaign>>;
  lead?: string;
  children: ReactNode;
}) {
  const { chrome, copy, organizer, campaign, base } = loaded;
  const publicHref = publicHrefFor(chrome.pathPrefix, campaign);
  return (
    <PortalShell
      chrome={chrome}
      copy={copy}
      organizer={organizer}
      kicker={campaignStatusLabel(copy, campaign.status)}
      title={campaign.title}
      lead={lead}
      actions={
        publicHref ? (
          <a className="secondary-button" href={publicHref} target="_blank" rel="noreferrer">
            {copy.viewPublic}
          </a>
        ) : null
      }
    >
      <PortalCampaignTabs
        base={base}
        items={[
          { suffix: "", label: copy.overview },
          { suffix: "/updates", label: copy.updates },
          { suffix: "/edit", label: copy.edit },
          { suffix: "/payouts", label: copy.payouts },
        ]}
      />
      {children}
    </PortalShell>
  );
}
