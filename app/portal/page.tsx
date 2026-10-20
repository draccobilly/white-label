import type { Metadata } from "next";
import Link from "next/link";
import { PortalShell } from "@/components/portal/PortalShell";
import { moneyLocale } from "@/lib/i18n";
import { requireOrganizer } from "@/lib/organizer-auth";
import {
  organizerCampaigns,
  publicHrefFor,
  publishedGoal,
  verifiedGiftTotals,
} from "@/lib/organizer-portal";
import { campaignStatusLabel, portalCopy, requestStatusLabel } from "@/lib/portal-copy";
import { prisma } from "@/lib/prisma";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";
import { formatMoney, progressPercent } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  return { title: `${copy.dashboard} · ${chrome.brand.siteName}`, robots: { index: false } };
}

export default async function PortalDashboardPage() {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  const organizer = await requireOrganizer(chrome.pathPrefix);
  const [campaigns, requests] = await Promise.all([
    organizerCampaigns(organizer.id),
    prisma.helpRequest.findMany({
      where: { organizerId: organizer.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const totals = await Promise.all(campaigns.map((campaign) => verifiedGiftTotals(campaign.id)));
  const dateLocale = chrome.locale === "en" ? "en-US" : chrome.locale;

  return (
    <PortalShell
      chrome={chrome}
      copy={copy}
      organizer={organizer}
      title={copy.welcome(organizer.name.split(/\s+/)[0] || organizer.name)}
      lead={copy.dashboardLead}
    >
      <section className="portal-section">
        <h2>{copy.yourCampaigns}</h2>
        {campaigns.length ? (
          <ul className="portal-campaign-list">
            {campaigns.map((campaign, index) => {
              const goal = publishedGoal(campaign);
              const percent = progressPercent(campaign.currentAmount, goal);
              const money = moneyLocale(chrome.locale, campaign.currency);
              const href = withPublicPrefix(chrome.pathPrefix, `/portal/campaigns/${campaign.id}`);
              const publicHref = publicHrefFor(chrome.pathPrefix, campaign);
              const gifts = totals[index];
              return (
                <li key={campaign.id} className="portal-campaign-card">
                  <Link href={href} className="portal-campaign-cover" aria-hidden tabIndex={-1}>
                    {campaign.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={campaign.coverImageUrl} alt="" />
                    ) : (
                      <span />
                    )}
                  </Link>
                  <div className="portal-campaign-body">
                    <div className="portal-campaign-title">
                      <h3>
                        <Link href={href}>{campaign.title}</Link>
                      </h3>
                      <span className={`portal-chip is-${campaign.status.toLowerCase()}`}>
                        {campaignStatusLabel(copy, campaign.status)}
                      </span>
                    </div>
                    <div className="portal-progress" role="img" aria-label={`${percent}%`}>
                      <span style={{ width: `${Math.min(100, percent)}%` }} />
                    </div>
                    <p className="portal-campaign-stats">
                      <strong>{formatMoney(campaign.currentAmount, campaign.currency, money)}</strong>{" "}
                      · {copy.goal} {formatMoney(goal, campaign.currency, money)}
                      <br />
                      <span>
                        {copy.verifiedGifts}: {formatMoney(gifts.total, campaign.currency, money)} ·{" "}
                        {copy.giftCount(gifts.count)}
                      </span>
                    </p>
                    <div className="portal-inline-actions">
                      <Link className="primary-button" href={href}>
                        {copy.overview}
                      </Link>
                      <Link className="secondary-button" href={`${href}/updates`}>
                        {copy.updates}
                      </Link>
                      <Link className="secondary-button" href={`${href}/payouts`}>
                        {copy.payouts}
                      </Link>
                      {publicHref ? (
                        <a className="inst-terms-link" href={publicHref} target="_blank" rel="noreferrer">
                          {copy.viewPublic}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="portal-empty">
            <strong>{copy.noCampaigns}</strong>
            <p>{copy.noCampaignsHint}</p>
          </div>
        )}
      </section>

      {requests.length ? (
        <section className="portal-section">
          <h2>{copy.yourRequests}</h2>
          <ul className="portal-request-list">
            {requests.map((request) => {
              const status = (request as { status?: string }).status;
              return (
                <li key={request.id}>
                  <div>
                    <strong>{request.name}</strong>
                    <small>
                      {copy.sentOn} {request.createdAt.toLocaleDateString(dateLocale, { dateStyle: "medium" })}
                    </small>
                  </div>
                  <span className={`portal-chip is-${(status ?? "open").toLowerCase()}`}>
                    {requestStatusLabel(copy, status)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </PortalShell>
  );
}
