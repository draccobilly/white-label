import type { Metadata } from "next";
import { ImpactCampaignGrid } from "@/components/public/ImpactCampaignGrid";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import { requireInstitutionalSite } from "@/lib/public-campaigns";

function databaseIsDown(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Authentication failed|Can't reach database server|ECONNREFUSED|P1000|P1001/i.test(
    message,
  );
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const chrome = await requireInstitutionalSite();
    return {
      title: chrome.messages.site.navCampaigns,
      description: chrome.messages.site.storiesLead,
    };
  } catch (error) {
    if (!databaseIsDown(error)) throw error;
    return { title: "Campaigns" };
  }
}

export default async function CampaignsPage() {
  let chrome: Awaited<ReturnType<typeof requireInstitutionalSite>>;
  try {
    chrome = await requireInstitutionalSite();
  } catch (error) {
    if (!databaseIsDown(error)) throw error;
    return (
      <main className="inst-info">
        <div className="shell public-info-inner">
          <h1>Campaigns</h1>
          <p className="public-info-lead">
            Esta vista local no tiene la base de la iglesia. En el sitio publicado,
            aquí aparecen las campañas con meta y recibo.
          </p>
        </div>
      </main>
    );
  }
  const site = chrome.messages.site;

  return (
    <PublicSiteShell chrome={chrome}>
      <main className="inst-info">
        <div className="shell public-info-inner">
          <h1>{site.navCampaigns}</h1>
          <p className="public-info-lead">{site.storiesLead}</p>
          <ImpactCampaignGrid
            campaigns={chrome.campaigns}
            locale={chrome.locale}
            emptyLabel={site.emptyCampaigns}
            allLabel={site.allCampaigns}
            searchPlaceholder={site.searchPlaceholder}
            searchCta={site.searchCta}
            raisedSuffix={chrome.messages.campaign.raisedSuffix}
            ofGoalLabel={chrome.messages.campaign.ofGoal}
          />
        </div>
      </main>
    </PublicSiteShell>
  );
}
