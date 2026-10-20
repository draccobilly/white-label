import type { Metadata } from "next";
import { loadPortalCampaign, PortalCampaignFrame } from "@/components/portal/PortalCampaignPage";
import { moneyLocale } from "@/lib/i18n";
import { payoutAvailability, publishedGoal, recentDonations } from "@/lib/organizer-portal";
import { portalCopy } from "@/lib/portal-copy";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { formatMoney, formatMoneyExact, progressPercent } from "@/lib/utils";
import { giftAmountCents, tipAmountCents } from "@/lib/sale-filters";

const DONATIONS_SHOWN = 100;

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  return { title: `${copy.overview} · ${chrome.brand.siteName}`, robots: { index: false } };
}

export default async function PortalCampaignOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await loadPortalCampaign(id, "");
  const { chrome, copy, campaign } = loaded;
  const [availability, donations] = await Promise.all([
    payoutAvailability(campaign.id),
    recentDonations(campaign.id, DONATIONS_SHOWN),
  ]);
  const goal = publishedGoal(campaign);
  const money = moneyLocale(chrome.locale, campaign.currency);
  const dateLocale = chrome.locale === "en" ? "en-US" : chrome.locale;
  const percent = progressPercent(campaign.currentAmount, goal);

  return (
    <PortalCampaignFrame loaded={loaded}>
      <div className="portal-stats">
        <div className="portal-stat">
          <span>{copy.publishedProgress}</span>
          <strong>{formatMoney(campaign.currentAmount, campaign.currency, money)}</strong>
          <small>
            {copy.goal} {formatMoney(goal, campaign.currency, money)} · {percent}%
          </small>
          <p>{copy.publishedProgressHint}</p>
        </div>
        <div className="portal-stat is-accent">
          <span>{copy.verifiedGifts}</span>
          <strong>{formatMoneyExact(availability.raised, campaign.currency, money)}</strong>
          <small>{copy.giftCount(availability.giftCount)}</small>
          <p>{copy.verifiedGiftsHint}</p>
        </div>
        <div className="portal-stat">
          <span>{copy.available}</span>
          <strong>{formatMoneyExact(availability.available, campaign.currency, money)}</strong>
          <small>&nbsp;</small>
          <p>{copy.availableHint}</p>
        </div>
      </div>

      <section className="portal-section">
        <h2>{copy.recentDonations}</h2>
        {donations.length ? (
          <>
            <table className="portal-table">
              <thead>
                <tr>
                  <th>{copy.donor}</th>
                  <th>{copy.amount}</th>
                  <th>{copy.date}</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((sale) => {
                  const when = sale.paidAt ?? sale.createdAt;
                  const tip = tipAmountCents(sale);
                  return (
                    <tr key={sale.id}>
                      <td>{sale.customerName?.trim() || copy.anonymous}</td>
                      <td>
                        {formatMoneyExact(giftAmountCents(sale), sale.currency, money)}
                        {tip > 0 ? (
                          <small>
                            {" "}
                            + {formatMoneyExact(tip, sale.currency, money)} {copy.tip}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <time dateTime={when.toISOString()}>
                          {when.toLocaleString(dateLocale, { dateStyle: "medium", timeStyle: "short" })}
                        </time>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {donations.length >= DONATIONS_SHOWN ? (
              <p className="admin-field-hint">{copy.showingLatest(DONATIONS_SHOWN)}</p>
            ) : null}
          </>
        ) : (
          <p className="admin-help">{copy.noDonations}</p>
        )}
      </section>
    </PortalCampaignFrame>
  );
}
