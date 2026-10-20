import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AffiliateCredentialsForm } from "@/components/admin/AffiliateCredentialsForm";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import { companyDesk } from "@/lib/company-desk";
import { utmifyPixelIdFromConfig } from "@/lib/utmify-pixel";
import { formatMoney } from "@/lib/utils";
import { CampaignIdentity } from "@/components/admin/CampaignIdentity";
import { TrackingEventType } from "@/generated/prisma/enums";
import { paidLiveSalesWhere } from "@/lib/sale-filters";
import { CampaignStatus } from "@/generated/prisma/enums";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default async function AffiliateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwnerPage();
  const company = await getAdminCompany();
  const { id } = await params;
  const affiliate = isUuid(id)
    ? await prisma.affiliate.findUnique({
        where: { id },
        include: {
          pages: {
            where: { campaign: { companyId: company.id } },
            include: { campaign: true },
          },
        },
      })
    : await prisma.affiliate.findUnique({
        where: { slug: id },
        include: {
          pages: {
            where: { campaign: { companyId: company.id } },
            include: { campaign: true },
          },
        },
      });
  if (!affiliate) notFound();

  const pageIds = affiliate.pages.map((page) => page.id);
  const [sales, chargebacks, trackingCounts] = await Promise.all([
    prisma.sale.groupBy({
      by: ["campaignId", "currency"],
      where: {
        affiliateId: affiliate.id,
        ...paidLiveSalesWhere(company.id),
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.chargeback
      .findMany({
        where: { affiliateId: affiliate.id },
        orderBy: { openedAt: "desc" },
        take: 50,
      })
      .catch(() => []),
    pageIds.length
      ? prisma.trackingEvent.groupBy({
          by: ["affiliatePageId", "type"],
          where: {
            affiliatePageId: { in: pageIds },
            type: {
              in: [TrackingEventType.PAGE_VIEW, TrackingEventType.CHECKOUT_STARTED],
            },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const campaigns = affiliate.pages
    .filter((page) => page.campaign.status === CampaignStatus.ACTIVE)
    .sort((a, b) => a.campaign.title.localeCompare(b.campaign.title))
    .map((page) => {
      const sale = sales.find((row) => row.campaignId === page.campaignId);
      const pageClicks = trackingCounts
        .filter(
          (row) =>
            row.affiliatePageId === page.id &&
            row.type === TrackingEventType.PAGE_VIEW,
        )
        .reduce((sum, row) => sum + row._count._all, 0);
      const checkoutClicks = trackingCounts
        .filter(
          (row) =>
            row.affiliatePageId === page.id &&
            row.type === TrackingEventType.CHECKOUT_STARTED,
        )
        .reduce((sum, row) => sum + row._count._all, 0);
      return {
        id: page.campaign.id,
        title: page.campaign.title,
        slug: page.campaign.slug,
        amount: sale?._sum.amount ?? 0,
        count: sale?._count._all ?? 0,
        pageClicks,
        checkoutClicks,
        currency: sale?.currency ?? page.campaign.currency,
      };
    });

  return (
    <>
      <AdminPageHeader
        eyebrow="Affiliate"
        title={affiliate.name}
        description={companyDesk(company).region}
        actions={
          <Link className="secondary-button" href="/admin/affiliates">
            Back to affiliates
          </Link>
        }
      />
      <AdminCard title="Utmify and alerts">
        <AffiliateCredentialsForm
          affiliateId={affiliate.id}
          name={affiliate.name}
          email={affiliate.email}
          notes={affiliate.notes}
          utmifyWebhookUrl={
            company.isDefault
              ? affiliate.utmifyWebhookUrl
              : (affiliate.pages[0]?.utmifyWebhookUrl ?? null)
          }
          utmifyPixelId={utmifyPixelIdFromConfig(
            company.isDefault
              ? affiliate.utmifyPixelScript
              : affiliate.pages[0]?.utmifyPixelScript,
          )}
          hasUtmifyToken={
            company.isDefault
              ? Boolean(affiliate.defaultUtmifyTokenEnc)
              : affiliate.pages.some((page) => page.utmifyTokenEnc)
          }
          deskScopedUtmify={!company.isDefault}
        />
      </AdminCard>
      <AdminCard title="Active campaigns">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Page clicks</th>
                <th>Checkout clicks</th>
                <th>Paid gifts</th>
                <th>Total sold</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td data-label="Campaign">
                    <CampaignIdentity
                      title={campaign.title}
                      slug={campaign.slug}
                      currency={campaign.currency}
                    />
                  </td>
                  <td className="admin-metric" data-label="Page clicks">{campaign.pageClicks.toLocaleString()}</td>
                  <td className="admin-metric" data-label="Checkout clicks">{campaign.checkoutClicks.toLocaleString()}</td>
                  <td data-label="Paid gifts">{campaign.count}</td>
                  <td data-label="Total sold">{formatMoney(campaign.amount, campaign.currency)}</td>
                </tr>
              ))}
              {!campaigns.length ? (
                <tr>
                  <td colSpan={5}>No active campaigns assigned.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>
      <AdminCard title="Chargebacks">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Stripe dispute</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Days open</th>
              </tr>
            </thead>
            <tbody>
              {chargebacks.map((chargeback) => {
                const end = chargeback.closedAt ?? new Date();
                const daysOpen = Math.max(
                  1,
                  Math.ceil((end.getTime() - chargeback.openedAt.getTime()) / 86_400_000),
                );
                return (
                  <tr key={chargeback.id}>
                    <td data-label="Stripe dispute">{chargeback.stripeDisputeId}</td>
                    <td data-label="Amount">{formatMoney(chargeback.amount, chargeback.currency)}</td>
                    <td data-label="Status">{chargeback.status}</td>
                    <td data-label="Days open">{chargeback.closedAt ? `${daysOpen} closed` : `${daysOpen} open`}</td>
                  </tr>
                );
              })}
              {!chargebacks.length ? (
                <tr>
                  <td colSpan={4}>No chargebacks recorded for this affiliate.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </>
  );
}
