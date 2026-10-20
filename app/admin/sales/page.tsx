import { CampaignRankRow } from "@/components/admin/CampaignRankRow";
import { PaymentRow } from "@/components/admin/PaymentRow";
import { GatewaySplit } from "@/components/admin/GatewaySplit";
import { SalesBoard } from "@/components/admin/SalesBoard";
import { VolumeBars } from "@/components/admin/VolumeBars";
import { VolumeHero } from "@/components/admin/VolumeHero";
import {
  addCalendarDays,
  dayBounds,
  defaultSalesRange,
  formatDisplayDate,
  formatReportingHour,
  inclusiveDayCount,
  reportingHour,
  reportingIsoDate,
} from "@/lib/date-range";
import { prisma } from "@/lib/prisma";
import { currentAdminAccess } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import { ensureOperatorAffiliate, ownAffiliateSales } from "@/lib/operator-affiliate";
import { isInstitutionalSiteMode } from "@/lib/site-mode";
import {
  giftAmountCents,
  hasChurchMissionTip,
  paidLiveSalesWhere,
  resolvedChurchTipCents,
  tipAmountCents,
} from "@/lib/sale-filters";
import { companyDesk } from "@/lib/company-desk";
import { STANDARD_DONATION_AMOUNTS } from "@/lib/donation-ticket";
import { formatMoney } from "@/lib/utils";
import { normalizeGateway, sortGateways } from "@/lib/gateways";
import {
  comparisonQuery,
  formatPercentChange,
  parseCompareMode,
  percentChange,
  resolveComparison,
} from "@/lib/periods";

function aggregate(
  rows: Array<{
    key: string;
    label: string;
    slug: string;
    createdAt: Date;
    amount: number;
    count: number;
  }>,
) {
  const map = new Map<
    string,
    {
      key: string;
      label: string;
      slug: string;
      createdAt: Date;
      amount: number;
      count: number;
    }
  >();
  for (const row of rows) {
    const current = map.get(row.key) ?? {
      key: row.key,
      label: row.label,
      slug: row.slug,
      createdAt: row.createdAt,
      amount: 0,
      count: 0,
    };
    current.amount += row.amount;
    current.count += row.count;
    map.set(row.key, current);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

function salesQuery(base: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(base)) {
    if (typeof value === "string" && value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/admin/sales?${query}` : "/admin/sales";
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    affiliates?: string;
    campaign?: string;
    view?: string;
    cmp?: string;
    cfrom?: string;
    cto?: string;
    gw?: string;
  }>;
}) {
  const query = await searchParams;
  const fallback = defaultSalesRange();
  const from = query.from ?? fallback.from;
  const to = query.to ?? fallback.to;
  const tipsView = query.view === "tips";
  const { fromDate, toDate } = dayBounds({ from, to });
  const comparison = resolveComparison(
    { from, to },
    parseCompareMode(query.cmp),
    query.cfrom,
    query.cto,
  );
  const gatewayFilter = (query.gw ?? "").toLowerCase().trim();
  const { admin, isOwner } = await currentAdminAccess();
  const operatorAffiliate = isOwner ? null : await ensureOperatorAffiliate(admin);
  const company = await getAdminCompany();
  const desk = companyDesk(company);
  const affiliates = operatorAffiliate
    ? [{ id: operatorAffiliate.id, name: operatorAffiliate.name }]
    : await prisma.affiliate.findMany({
        where: { pages: { some: { campaign: { companyId: company.id } } } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
  const knownIds = new Set(affiliates.map((affiliate) => affiliate.id));
  const selectedAffiliateIds = operatorAffiliate
    ? [operatorAffiliate.id]
    : (query.affiliates ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => knownIds.has(id));
  const campaignId = query.campaign?.trim() || "";

  const rawSales = await prisma.sale.findMany({
    where: {
      ...paidLiveSalesWhere(company.id),
      paidAt: { gte: fromDate, lte: toDate },
      ...(operatorAffiliate
        ? ownAffiliateSales(operatorAffiliate.id)
        : selectedAffiliateIds.length
          ? { affiliateId: { in: selectedAffiliateIds } }
          : {}),
    },
    select: {
      id: true,
      amount: true,
      tipAmount: true,
      currency: true,
      gateway: true,
      gatewayFee: true,
      paidAt: true,
      customerName: true,
      gatewayLabel: true,
      campaignId: true,
      affiliateId: true,
      campaign: {
        select: {
          title: true,
          slug: true,
          createdAt: true,
          options: { select: { amount: true } },
        },
      },
      checkoutIntent: {
        select: {
          tipAmount: true,
          donationOption: { select: { amount: true } },
        },
      },
    },
    orderBy: { paidAt: "desc" },
  });
  // Same filters, comparison window. Tips use the stored tip amount here.
  const compareBounds = comparison.range ? dayBounds(comparison.range) : null;
  const compareSales = compareBounds
    ? await prisma.sale.findMany({
        where: {
          ...paidLiveSalesWhere(company.id),
          paidAt: { gte: compareBounds.fromDate, lte: compareBounds.toDate },
          ...(operatorAffiliate
            ? ownAffiliateSales(operatorAffiliate.id)
            : selectedAffiliateIds.length
              ? { affiliateId: { in: selectedAffiliateIds } }
              : {}),
        },
        select: { amount: true, tipAmount: true, paidAt: true, campaignId: true, gateway: true },
      })
    : [];

  const inferChurchTickets = isInstitutionalSiteMode(company.siteMode);
  const sales = rawSales.map((sale) => {
    const ticketAmounts = sale.campaign.options.map((option) => option.amount);
    const tipAmount = resolvedChurchTipCents({
      amount: sale.amount,
      tipAmount: sale.tipAmount,
      intentTipAmount: sale.checkoutIntent?.tipAmount,
      donationOptionAmount: sale.checkoutIntent?.donationOption?.amount,
      campaignOptionAmounts: inferChurchTickets
        ? ticketAmounts.length
          ? ticketAmounts
          : [...STANDARD_DONATION_AMOUNTS]
        : undefined,
    });
    return { ...sale, tipAmount };
  });
  const missingTips = sales.filter(
    (sale, index) => sale.tipAmount > 0 && rawSales[index]?.tipAmount === 0,
  );
  if (missingTips.length) {
    await prisma.$transaction(
      missingTips.map((sale) =>
        prisma.sale.update({
          where: { id: sale.id },
          data: { tipAmount: sale.tipAmount },
        }),
      ),
    );
  }
  const volumeMetric = tipsView ? tipAmountCents : giftAmountCents;
  const periodSales = tipsView ? sales.filter(hasChurchMissionTip) : sales;
  const periodGateways = sortGateways(periodSales.map((sale) => normalizeGateway(sale.gateway)));
  const visibleSales = gatewayFilter
    ? periodSales.filter((sale) => normalizeGateway(sale.gateway) === gatewayFilter)
    : periodSales;
  const volume = visibleSales.reduce((sum, sale) => sum + volumeMetric(sale), 0);
  const compareVisible = compareSales.filter(
    (sale) =>
      (!tipsView || tipAmountCents(sale) > 0) &&
      (!gatewayFilter || normalizeGateway(sale.gateway) === gatewayFilter),
  );
  const compareVolume = compareVisible.reduce((sum, sale) => sum + volumeMetric(sale), 0);
  const compareByCampaign = new Map<string, number>();
  for (const sale of compareVisible) {
    compareByCampaign.set(
      sale.campaignId,
      (compareByCampaign.get(sale.campaignId) ?? 0) + volumeMetric(sale),
    );
  }
  const currency = sales[0]?.currency ?? desk.currency;
  const byCampaign = aggregate(
    visibleSales.map((sale) => ({
      key: sale.campaignId,
      label: sale.campaign.title,
      slug: sale.campaign.slug,
      createdAt: sale.campaign.createdAt,
      amount: volumeMetric(sale),
      count: 1,
    })),
  );
  const feed = campaignId
    ? visibleSales.filter((sale) => sale.campaignId === campaignId)
    : visibleSales;
  const feedVolume = feed.reduce((sum, sale) => sum + volumeMetric(sale), 0);
  const compareFeedVolume = campaignId ? (compareByCampaign.get(campaignId) ?? 0) : compareVolume;
  // Stripe vs PayPal for the period (ignores the gateway filter, respects the campaign).
  const gatewayBase = campaignId
    ? periodSales.filter((sale) => sale.campaignId === campaignId)
    : periodSales;
  const compareGatewayBase = campaignId
    ? compareSales.filter((sale) => sale.campaignId === campaignId && (!tipsView || tipAmountCents(sale) > 0))
    : compareSales.filter((sale) => !tipsView || tipAmountCents(sale) > 0);
  const gatewayRows = sortGateways(gatewayBase.map((sale) => normalizeGateway(sale.gateway))).map(
    (gateway) => {
      const rows = gatewayBase.filter((sale) => normalizeGateway(sale.gateway) === gateway);
      return {
        gateway,
        amount: rows.reduce((sum, sale) => sum + volumeMetric(sale), 0),
        count: rows.length,
        fees: rows.reduce((sum, sale) => sum + (sale.gatewayFee ?? 0), 0),
        previousAmount: comparison.range
          ? compareGatewayBase
              .filter((sale) => normalizeGateway(sale.gateway) === gateway)
              .reduce((sum, sale) => sum + volumeMetric(sale), 0)
          : undefined,
      };
    },
  );
  const selectedCampaign = byCampaign.find((row) => row.key === campaignId);

  const dayCount = inclusiveDayCount(from, to);
  const chartSales = campaignId ? feed : visibleSales;
  const compareChart = campaignId
    ? compareVisible.filter((sale) => sale.campaignId === campaignId)
    : compareVisible;
  const sumBetween = (
    rows: Array<{ paidAt: Date | null; amount: number; tipAmount: number }>,
    start: Date,
    end: Date,
  ) =>
    rows
      .filter((sale) => sale.paidAt && sale.paidAt >= start && sale.paidAt < end)
      .reduce((sum, sale) => sum + volumeMetric(sale), 0);
  const sumAtHour = (
    rows: Array<{ paidAt: Date | null; amount: number; tipAmount: number }>,
    hour: number,
  ) =>
    rows
      .filter((sale) => sale.paidAt && reportingHour(sale.paidAt) === hour)
      .reduce((sum, sale) => sum + volumeMetric(sale), 0);
  // The chart follows request time by design (today's current hour).
  // eslint-disable-next-line react-hooks/purity
  const todayIso = reportingIsoDate();
  // eslint-disable-next-line react-hooks/purity
  const currentHour = reportingHour(new Date());
  // One day is drawn hour by hour (today vs yesterday, for example).
  const buckets =
    dayCount === 1
      ? Array.from({ length: 24 }, (_, hour) => {
          const bucket = {
            label: `${from} ${formatReportingHour(hour)}`,
            tick: hour % 6 === 0 ? formatReportingHour(hour).replace(" ", "").toLowerCase() : "",
            current: from === todayIso && hour === currentHour,
            amount: sumAtHour(chartSales, hour),
          };
          if (!comparison.range) return bucket;
          return {
            ...bucket,
            compare: sumAtHour(compareChart, hour),
            compareLabel: `${comparison.range.from} ${formatReportingHour(hour)}`,
          };
        })
      : (() => {
          const bucketCount = Math.min(dayCount, 14);
          const bucketSize = Math.max(1, Math.ceil(dayCount / bucketCount));
          return Array.from({ length: Math.ceil(dayCount / bucketSize) }, (_, index) => {
            const startIso = addCalendarDays(from, index * bucketSize);
            const endIso = addCalendarDays(startIso, bucketSize);
            const start = dayBounds({ from: startIso, to: startIso }).fromDate;
            const end = dayBounds({ from: endIso, to: endIso }).fromDate;
            const bucket = {
              label: startIso,
              current: startIso <= todayIso && todayIso < endIso,
              amount: sumBetween(chartSales, start, end),
            };
            if (!comparison.range) return bucket;
            const compareStartIso = addCalendarDays(comparison.range.from, index * bucketSize);
            const compareEndIso = addCalendarDays(compareStartIso, bucketSize);
            return {
              ...bucket,
              compare: sumBetween(
                compareChart,
                dayBounds({ from: compareStartIso, to: compareStartIso }).fromDate,
                dayBounds({ from: compareEndIso, to: compareEndIso }).fromDate,
              ),
              compareLabel: compareStartIso,
            };
          });
        })();

  const queryBase = {
    from,
    to,
    affiliates: selectedAffiliateIds.join(","),
    ...comparisonQuery(comparison),
    ...(gatewayFilter ? { gw: gatewayFilter } : {}),
    ...(tipsView ? { view: "tips" } : {}),
  };
  const donationsHref = salesQuery({
    from,
    to,
    affiliates: selectedAffiliateIds.join(","),
    campaign: campaignId,
    ...comparisonQuery(comparison),
    ...(gatewayFilter ? { gw: gatewayFilter } : {}),
  });
  const tipsHref = salesQuery({
    from,
    to,
    affiliates: selectedAffiliateIds.join(","),
    campaign: campaignId,
    ...comparisonQuery(comparison),
    ...(gatewayFilter ? { gw: gatewayFilter } : {}),
    view: "tips",
  });

  return (
    <div className="dash">
      <header className="dash-page-head">
        <div>
          <p className="dash-kicker">
            {desk.region}, {desk.gateway}
          </p>
          <h1>Donations</h1>
        </div>
      </header>
      <nav className="dash-seg dash-view-tabs" aria-label="Donation views">
        <a className={tipsView ? undefined : "is-active"} href={donationsHref}>
          Donations
        </a>
        <a className={tipsView ? "is-active" : undefined} href={tipsHref}>
          Mission tips
        </a>
      </nav>

      <SalesBoard
        from={from}
        to={to}
        affiliates={affiliates}
        selectedAffiliateIds={selectedAffiliateIds}
        campaignId={campaignId || undefined}
        view={tipsView ? "tips" : "donations"}
        comparison={comparison}
        gateway={gatewayFilter || undefined}
        gateways={periodGateways}
      />

      <div className="dash-cols">
        <div className="dash-col">
          <VolumeHero
            label={
              selectedCampaign
                ? selectedCampaign.label
                : tipsView
                  ? from === to
                    ? `Mission tips · ${formatDisplayDate(from)}`
                    : `Mission tips · ${formatDisplayDate(from)} – ${formatDisplayDate(to)}`
                  : from === to
                    ? formatDisplayDate(from)
                    : `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`
            }
            value={formatMoney(campaignId ? feedVolume : volume, currency)}
            delta={
              comparison.range
                ? formatPercentChange(
                    percentChange(campaignId ? feedVolume : volume, compareFeedVolume),
                  )
                : undefined
            }
            positive={
              comparison.range ? (campaignId ? feedVolume : volume) >= compareFeedVolume : undefined
            }
          >
            <VolumeBars buckets={buckets} currency={currency} />
            <div className="dash-mini">
              <div>
                <span>{tipsView ? "Tip gifts" : "Payments"}</span>
                <strong>{feed.length}</strong>
              </div>
              <div>
                <span>Average</span>
                <strong>
                  {formatMoney(
                    feed.length ? Math.round((campaignId ? feedVolume : volume) / feed.length) : 0,
                    currency,
                  )}
                </strong>
              </div>
            </div>
          </VolumeHero>

          <section className="dash-section">
            <header className="dash-section-head">
              <h2>By gateway</h2>
              <span>Stripe and PayPal separately</span>
            </header>
            <GatewaySplit rows={gatewayRows} currency={currency} />
          </section>

          <section className="dash-section">
            <header className="dash-section-head">
              <h2>By campaign</h2>
              {campaignId ? (
                <a className="dash-text-link" href={salesQuery(queryBase)}>
                  Clear
                </a>
              ) : null}
            </header>
            <div className="dash-list">
              {byCampaign.map((row, index) => (
                <CampaignRankRow
                  key={row.key}
                  rank={index + 1}
                  href={
                    row.key === campaignId
                      ? salesQuery(queryBase)
                      : salesQuery({ ...queryBase, campaign: row.key })
                  }
                  title={row.label}
                  slug={row.slug}
                  createdAt={row.createdAt}
                  amount={row.amount}
                  currency={currency}
                  count={row.count}
                  share={volume > 0 ? (row.amount / volume) * 100 : 0}
                  active={row.key === campaignId}
                  previousAmount={
                    comparison.range ? (compareByCampaign.get(row.key) ?? 0) : undefined
                  }
                />
              ))}
              {!byCampaign.length ? (
                <p className="dash-empty">
                  {tipsView ? "No Mission tips in this range." : "No paid volume in this range."}
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <div className="dash-col">
          <section className="dash-section">
            <header className="dash-section-head">
              <h2>{tipsView ? "Mission tips" : "Payments"}</h2>
              <span>{feed.length}</span>
            </header>
            <div className="dash-list">
              {feed.slice(0, 40).map((sale) => (
                <PaymentRow
                  key={sale.id}
                  customerName={sale.customerName}
                  amount={volumeMetric(sale)}
                  currency={sale.currency}
                  paidAt={sale.paidAt}
                  campaignTitle={sale.campaign.title}
                  campaignSlug={sale.campaign.slug}
                  gatewayLabel={sale.gatewayLabel}
                  note={
                    tipsView
                      ? "Optional $5 mission tip"
                      : hasChurchMissionTip(sale)
                        ? "Also gave a $5 mission tip"
                        : null
                  }
                />
              ))}
              {!feed.length ? (
                <p className="dash-empty">
                  {tipsView ? "No Mission tips in this range." : "No payments in this range."}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
