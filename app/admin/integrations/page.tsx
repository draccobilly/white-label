import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AffiliateLedgerList } from "@/components/admin/AffiliateLedgerList";
import { TrackingEventType } from "@/generated/prisma/enums";
import { campaignNameTag, isNewCampaign } from "@/lib/campaign-label";
import { prisma } from "@/lib/prisma";
import { currentAdminAccess } from "@/lib/admin-access";
import { deskDirectTeamSlug, keepsRunningCampaignAddress } from "@/lib/campaign-defaults";
import { isInstitutionalSiteMode } from "@/lib/site-mode";
import { getAdminCompany } from "@/lib/company";
import { ensureOperatorAffiliate } from "@/lib/operator-affiliate";
import { affiliatePagesForAdmin } from "@/lib/page-links-access";
import { paidLiveSalesWhere } from "@/lib/sale-filters";
import { companyPublicPrefix, publicCampaignPath } from "@/lib/public-site-url";

export default async function IntegrationsPage() {
  const { admin, isOwner } = await currentAdminAccess();
  const copyOnly = !isOwner;
  const operatorAffiliate = isOwner ? null : await ensureOperatorAffiliate(admin);
  const company = await getAdminCompany();
  const pathPrefix = companyPublicPrefix(company);
  const pageWhere = affiliatePagesForAdmin({
    isOwner,
    companyId: company.id,
    adminId: admin.id,
    affiliateId: operatorAffiliate?.id,
    directTeamSlug: deskDirectTeamSlug(company),
  });
  const affiliates = await prisma.affiliate.findMany({
    where: { pages: { some: pageWhere } },
    include: {
      pages: {
        where: pageWhere,
        include: {
          campaign: {
            include: { _count: { select: { options: true } } },
          },
          _count: { select: { paymentLinks: true } },
          deliveries: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
        },
        orderBy: { campaign: { title: "asc" } },
      },
    },
    orderBy: { name: "asc" },
  });

  const pageIds = affiliates.flatMap((affiliate) =>
    affiliate.pages.map((page) => page.id),
  );
  const [trackingCounts, sales] = !copyOnly && pageIds.length
    ? await Promise.all([
        prisma.trackingEvent.groupBy({
          by: ["affiliatePageId", "type"],
          where: {
            affiliatePageId: { in: pageIds },
            type: {
              in: [TrackingEventType.PAGE_VIEW, TrackingEventType.CHECKOUT_STARTED],
            },
          },
          _count: { _all: true },
        }),
        prisma.sale.groupBy({
          by: ["affiliatePageId", "currency"],
          where: {
            affiliatePageId: { in: pageIds },
            ...paidLiveSalesWhere(company.id),
          },
          _count: { _all: true },
          _sum: { amount: true },
        }),
      ])
    : [[], []];

  const clicksByPage = new Map<
    string,
    { pageClicks: number; checkoutClicks: number }
  >();
  for (const row of trackingCounts) {
    const current = clicksByPage.get(row.affiliatePageId) ?? {
      pageClicks: 0,
      checkoutClicks: 0,
    };
    if (row.type === TrackingEventType.PAGE_VIEW) {
      current.pageClicks = row._count._all;
    }
    if (row.type === TrackingEventType.CHECKOUT_STARTED) {
      current.checkoutClicks = row._count._all;
    }
    clicksByPage.set(row.affiliatePageId, current);
  }

  const salesByPage = new Map<
    string,
    { paidGiftCount: number; totalSold: number; currency: string }
  >();
  for (const row of sales) {
    const current = salesByPage.get(row.affiliatePageId) ?? {
      paidGiftCount: 0,
      totalSold: 0,
      currency: row.currency,
    };
    current.paidGiftCount += row._count._all;
    current.totalSold += row._sum.amount ?? 0;
    salesByPage.set(row.affiliatePageId, current);
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Delivery"
        title="Page links"
        description={
          copyOnly
            ? "Copy the public link for campaigns you created."
            : "Each campaign page shows live clicks and paid gifts from that exact link."
        }
      />
      <AffiliateLedgerList
        copyOnly={copyOnly}
        pathPrefix={pathPrefix}
        ledgers={affiliates.map((affiliate) => ({
          id: affiliate.id,
          name: affiliate.name,
          slug: affiliate.slug,
          pages: affiliate.pages
            .map((page) => {
              const clicks = clicksByPage.get(page.id);
              const pageSales = salesByPage.get(page.id);
              const createdAt = page.campaign.createdAt;
              return {
                id: page.id,
                campaignTitle: page.campaign.title,
                campaignTag: campaignNameTag(page.campaign.title),
                campaignSlug: page.campaign.slug,
                isNew: isNewCampaign(createdAt),
                createdAt: createdAt.getTime(),
                publicPath: publicCampaignPath(
                  pathPrefix,
                  page.campaign.slug,
                  affiliate.slug,
                  "",
                  {
                    short:
                      isInstitutionalSiteMode(company.siteMode) &&
                      keepsRunningCampaignAddress(page.campaign.slug),
                  },
                ),
                paymentLinks: copyOnly ? 0 : page._count.paymentLinks,
                optionCount: copyOnly ? 0 : page.campaign._count.options,
                pageClicks: copyOnly ? 0 : clicks?.pageClicks ?? 0,
                checkoutClicks: copyOnly ? 0 : clicks?.checkoutClicks ?? 0,
                paidGiftCount: copyOnly ? 0 : pageSales?.paidGiftCount ?? 0,
                totalSold: copyOnly ? 0 : pageSales?.totalSold ?? 0,
                currency: page.campaign.currency,
                utmifyConfigured: copyOnly
                  ? false
                  : Boolean(
                      page.utmifyTokenEnc ||
                        affiliate.defaultUtmifyTokenEnc ||
                        process.env.UTMIFY_API_TOKEN?.trim(),
                    ),
                lastDelivery: copyOnly ? null : page.deliveries[0]?.status ?? null,
              };
            })
            .sort((left, right) => {
              if (left.isNew !== right.isNew) return left.isNew ? -1 : 1;
              return right.createdAt - left.createdAt;
            })
            .map(({ createdAt: _createdAt, ...page }) => page),
        }))}
      />
    </>
  );
}
