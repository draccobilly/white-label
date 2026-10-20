import Link from "next/link";
import {
  ChartColumn,
  CircleAlert,
  CircleCheck,
  LifeBuoy,
  Link2,
  Megaphone,
  Pencil,
  Receipt,
  ShieldAlert,
  Undo2,
} from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLiveRefresh } from "@/components/admin/AdminLiveRefresh";
import { LiveNow } from "@/components/admin/LiveNow";
import { CampaignRankRow } from "@/components/admin/CampaignRankRow";
import { PaymentRow } from "@/components/admin/PaymentRow";
import { VolumeBars } from "@/components/admin/VolumeBars";
import { VolumeHero } from "@/components/admin/VolumeHero";
import { currentAdminAccess } from "@/lib/admin-access";
import { adminAttention } from "@/lib/admin-attention";
import { ADMIN_OPERATION_CLOCK } from "@/lib/admin-clock";
import { homeLongitudeFor, loadLiveSnapshot } from "@/lib/live";
import { ensureOperatorAffiliate, ownAffiliateSales } from "@/lib/operator-affiliate";
import { getAdminCompany } from "@/lib/company";
import { companyDesk } from "@/lib/company-desk";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";
import { paidLiveSalesWhere } from "@/lib/sale-filters";
import {
  addCalendarDays,
  formatReportingChartDay,
  formatReportingHour,
  formatReportingWeekday,
  homeRangeDays,
  homeRangeFromQuery,
  lastDaysRange,
  reportingHour,
  reportingIsoDate,
  zonedStartOfDay,
} from "@/lib/date-range";

function deltaTone(delta: { text: string; positive: boolean }) {
  if (/^[+-]?0%/.test(delta.text)) return undefined;
  return delta.positive ? "is-up" : "is-down";
}

function deltaLabel(current: number, previous: number) {
  if (previous <= 0 && current <= 0) return { text: "0%", positive: true };
  if (previous <= 0) return { text: "+100%", positive: true };
  const change = Math.round(((current - previous) / previous) * 100);
  return {
    text: `${change >= 0 ? "+" : ""}${change}% vs last period`,
    positive: change >= 0,
  };
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { admin, isOwner } = await currentAdminAccess();
  const operatorAffiliate = isOwner ? null : await ensureOperatorAffiliate(admin);
  const company = await getAdminCompany();
  const desk = companyDesk(company);
  const query = await searchParams;
  const rangeKey = homeRangeFromQuery(query.range);
  const isToday = rangeKey === "today";
  const rangeDays = homeRangeDays(rangeKey);
  // Dynamic reporting window uses request time by design.
  // eslint-disable-next-line react-hooks/purity
  const todayIso = reportingIsoDate();
  const period = lastDaysRange(rangeDays);
  const sinceIso = period.from;
  const previousSinceIso = addCalendarDays(sinceIso, -rangeDays);
  const since = zonedStartOfDay(sinceIso);
  const previousSince = zonedStartOfDay(previousSinceIso);
  const yesterday = zonedStartOfDay(addCalendarDays(todayIso, -1));
  const todayStart = zonedStartOfDay(todayIso);
  const chartDays = Array.from({ length: rangeDays }, (_, index) =>
    addCalendarDays(todayIso, index - (rangeDays - 1)),
  );

  const [rangeSales, previousRevenue, todayRevenue, yesterdayRevenue, attention, live] = await Promise.all([
    prisma.sale.findMany({
      where: {
        ...paidLiveSalesWhere(company.id),
        paidAt: { gte: since },
        ...(operatorAffiliate ? ownAffiliateSales(operatorAffiliate.id) : {}),
      },
      select: {
        id: true,
        customerName: true,
        amount: true,
        currency: true,
        gatewayLabel: true,
        paidAt: true,
        campaignId: true,
        campaign: {
          select: { title: true, slug: true, currency: true, createdAt: true },
        },
      },
      orderBy: { paidAt: "desc" },
    }),
    prisma.sale.groupBy({
      by: ["currency"],
      where: {
        ...paidLiveSalesWhere(company.id),
        paidAt: { gte: previousSince, lt: since },
        ...(operatorAffiliate ? ownAffiliateSales(operatorAffiliate.id) : {}),
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.sale.aggregate({
      where: {
        ...paidLiveSalesWhere(company.id),
        paidAt: { gte: todayStart },
        ...(operatorAffiliate ? ownAffiliateSales(operatorAffiliate.id) : {}),
      },
      _sum: { amount: true },
    }),
    prisma.sale.aggregate({
      where: {
        ...paidLiveSalesWhere(company.id),
        paidAt: { gte: yesterday, lt: todayStart },
        ...(operatorAffiliate ? ownAffiliateSales(operatorAffiliate.id) : {}),
      },
      _sum: { amount: true },
    }),
    isOwner ? adminAttention(company.id) : Promise.resolve(null),
    isOwner ? loadLiveSnapshot(company.id).catch(() => null) : Promise.resolve(null),
  ]);

  const revenueTotal = rangeSales.reduce((sum, sale) => sum + sale.amount, 0);
  const previousRevenueTotal = previousRevenue.reduce(
    (sum, row) => sum + (row._sum.amount ?? 0),
    0,
  );
  const currency = rangeSales[0]?.currency ?? desk.currency;
  const revenueLabel = formatMoney(revenueTotal, currency);
  const revenueDelta = deltaLabel(revenueTotal, previousRevenueTotal);
  const todayDelta = deltaLabel(
    todayRevenue._sum.amount ?? 0,
    yesterdayRevenue._sum.amount ?? 0,
  );
  // Dynamic reporting window uses request time by design.
  // eslint-disable-next-line react-hooks/purity
  const currentHour = reportingHour(new Date());
  const buckets = isToday
    ? Array.from({ length: 24 }, (_, hour) => ({
        label: `${todayIso} ${formatReportingHour(hour)}`,
        tick: hour % 6 === 0 ? formatReportingHour(hour).replace(" ", "").toLowerCase() : "",
        current: hour === currentHour,
        amount: rangeSales
          .filter((sale) => sale.paidAt && reportingHour(sale.paidAt) === hour)
          .reduce((sum, sale) => sum + sale.amount, 0),
      }))
    : chartDays.map((key, index) => ({
        label: key,
        tick:
          rangeDays <= 7
            ? formatReportingWeekday(key)
            : index % 5 === 4 || index === 0
              ? formatReportingChartDay(key)
              : "",
        current: key === todayIso,
        amount: rangeSales
          .filter((sale) => sale.paidAt && reportingIsoDate(sale.paidAt) === key)
          .reduce((sum, sale) => sum + sale.amount, 0),
      }));
  const previousCount = previousRevenue.reduce((sum, row) => sum + row._count._all, 0);
  const countDelta = deltaLabel(rangeSales.length, previousCount);
  const todayAmount = todayRevenue._sum.amount ?? 0;
  const yesterdayAmount = yesterdayRevenue._sum.amount ?? 0;
  const average = rangeSales.length ? Math.round(revenueTotal / rangeSales.length) : 0;

  const byCampaignMap = new Map<
    string,
    {
      id: string;
      title: string;
      slug: string;
      createdAt: Date;
      amount: number;
      count: number;
    }
  >();
  for (const sale of rangeSales) {
    const current = byCampaignMap.get(sale.campaignId) ?? {
      id: sale.campaignId,
      title: sale.campaign.title,
      slug: sale.campaign.slug,
      createdAt: sale.campaign.createdAt,
      amount: 0,
      count: 0,
    };
    current.amount += sale.amount;
    current.count += 1;
    byCampaignMap.set(sale.campaignId, current);
  }
  const byCampaign = [...byCampaignMap.values()].sort((a, b) => b.amount - a.amount);
  const recentSales = rangeSales.slice(0, isToday ? 40 : 8);
  const salesHref = `/admin/sales?from=${period.from}&to=${period.to}`;

  const rangeLabel = isToday ? "Today" : `Last ${rangeDays} days`;
  const attentionItems = attention
    ? [
        {
          key: "support",
          count: attention.support,
          href: "/admin/requests",
          icon: LifeBuoy,
          title: attention.support === 1 ? "pedido de suporte aberto" : "pedidos de suporte abertos",
          hint: "Sem resposta ainda",
          tone: "info",
        },
        {
          key: "refunds",
          count: attention.refunds,
          href: "/admin/refunds",
          icon: Undo2,
          title: attention.refunds === 1 ? "pedido de reembolso aberto" : "pedidos de reembolso abertos",
          hint: "Sem resposta ainda",
          tone: "warning",
        },
        {
          key: "unmatched",
          count: attention.unmatchedRefunds,
          href: "/admin/refunds",
          icon: CircleAlert,
          title:
            attention.unmatchedRefunds === 1
              ? "reembolso sem doação localizada"
              : "reembolsos sem doação localizada",
          hint: "Últimos 7 dias",
          tone: "warning",
        },
        {
          key: "disputes-answer",
          count: attention.disputes,
          href: "/admin/disputes",
          icon: ShieldAlert,
          title: attention.disputes === 1 ? "disputa para responder" : "disputas para responder",
          hint: "O Stripe espera a defesa; o prazo está correndo",
          tone: "danger",
        },
        {
          key: "disputes",
          count: Math.max(0, attention.openDisputes - attention.disputes),
          href: "/admin/disputes",
          icon: CircleAlert,
          title:
            attention.openDisputes - attention.disputes === 1
              ? "disputa em análise"
              : "disputas em análise",
          hint: "Chargebacks sem data de fechamento",
          tone: "warning",
        },
        {
          key: "drafts",
          count: attention.drafts,
          href: "/admin/campaigns?status=DRAFT",
          icon: Pencil,
          title: attention.drafts === 1 ? "campanha em rascunho" : "campanhas em rascunho",
          hint: "Ainda fora do site público",
          tone: "neutral",
        },
      ].filter((item) => item.count > 0)
    : [];

  return (
    <div className="dash dash-home">
      <header className="dash-page-head">
        <div>
          <p className="dash-kicker">
            {desk.region}, {desk.gateway}
          </p>
          <h1>Overview</h1>
        </div>
        <AdminLiveRefresh timeZone={ADMIN_OPERATION_CLOCK.timeZone} />
      </header>

      <div className="dash-seg" role="group" aria-label="Range">
        <Link
          className={isToday ? "is-active" : undefined}
          aria-current={isToday ? "true" : undefined}
          href="/admin?range=today"
        >
          Today
        </Link>
        <Link
          className={rangeKey === "7" ? "is-active" : undefined}
          aria-current={rangeKey === "7" ? "true" : undefined}
          href="/admin?range=7"
        >
          7D
        </Link>
        <Link
          className={rangeKey === "30" ? "is-active" : undefined}
          aria-current={rangeKey === "30" ? "true" : undefined}
          href="/admin?range=30"
        >
          30D
        </Link>
      </div>

      <div className="dash-cols">
        <div className="dash-col">
          <VolumeHero
            label={isToday ? "Today gross volume" : `${rangeDays}d gross volume`}
            value={revenueLabel}
            delta={revenueDelta.text.replace(
              " vs last period",
              isToday ? " vs yesterday" : " vs last period",
            )}
            positive={revenueDelta.positive}
          >
            <VolumeBars buckets={buckets} currency={currency} />
          </VolumeHero>

          <div className="dash-kpis">
            <Link className="dash-kpi" href={salesHref}>
              <span>Payments</span>
              <strong>{rangeSales.length}</strong>
              <small className={deltaTone(countDelta)}>
                {countDelta.text.replace(
                  " vs last period",
                  isToday ? " vs yesterday" : " vs last period",
                )}
              </small>
            </Link>
            {isToday ? (
              <div className="dash-kpi">
                <span>Yesterday</span>
                <strong>{formatMoney(yesterdayAmount, currency)}</strong>
                <small>full day</small>
              </div>
            ) : (
              <Link className="dash-kpi" href="/admin?range=today">
                <span>Today</span>
                <strong>{formatMoney(todayAmount, currency)}</strong>
                <small className={deltaTone(todayDelta)}>
                  {todayDelta.text.replace(" vs last period", " vs yesterday")}
                </small>
              </Link>
            )}
            <div className="dash-kpi">
              <span>Average</span>
              <strong>{formatMoney(average, currency)}</strong>
              <small>per payment</small>
            </div>
          </div>

          <section className="dash-section dash-top">
            <header className="dash-section-head">
              <h2>By campaign</h2>
              <Link className="dash-text-link" href={salesHref}>
                See all
              </Link>
            </header>
            <div className="dash-list">
              {byCampaign.slice(0, 6).map((row, index) => (
                <CampaignRankRow
                  key={row.id}
                  rank={index + 1}
                  href={`${salesHref}&campaign=${row.id}`}
                  title={row.title}
                  slug={row.slug}
                  currency={currency}
                  createdAt={row.createdAt}
                  amount={row.amount}
                  count={row.count}
                  share={revenueTotal > 0 ? (row.amount / revenueTotal) * 100 : 0}
                />
              ))}
              {!byCampaign.length ? (
                <AdminEmptyState
                  compact
                  icon={<Megaphone size={20} />}
                  title="No paid volume in this range"
                  body="Campaigns show up here as soon as the first live payment arrives."
                  action={
                    <Link className="secondary-button" href="/admin/integrations">
                      Copy a campaign link
                    </Link>
                  }
                />
              ) : null}
            </div>
          </section>
        </div>

        <div className="dash-col">
          {isOwner ? (
            <LiveNow
              variant="compact"
              initial={live}
              globe
              homeLongitude={homeLongitudeFor(ADMIN_OPERATION_CLOCK.timeZone)}
            />
          ) : null}

          <nav className="dash-actions" aria-label="Atalhos">
            <Link href="/admin/campaigns/new">
              <span aria-hidden>
                <Megaphone size={18} />
              </span>
              New campaign
            </Link>
            <Link href="/admin/integrations">
              <span aria-hidden>
                <Link2 size={18} />
              </span>
              Copy links
            </Link>
            <Link href={salesHref}>
              <span aria-hidden>
                <Receipt size={18} />
              </span>
              {rangeLabel} donations
            </Link>
            {isOwner ? (
              <Link href="/admin/analytics">
                <span aria-hidden>
                  <ChartColumn size={18} />
                </span>
                Analytics
              </Link>
            ) : (
              <Link href="/admin/campaigns">
                <span aria-hidden>
                  <Pencil size={18} />
                </span>
                My campaigns
              </Link>
            )}
          </nav>

          {attention ? (
            <section className="dash-section dash-attention">
              <header className="dash-section-head">
                <h2>Precisa de você</h2>
              </header>
              <div className="dash-list">
                {attentionItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.key} href={item.href} className={`dash-alert is-${item.tone}`}>
                      <span className="dash-alert-icon" aria-hidden>
                        <Icon size={18} />
                      </span>
                      <span className="dash-alert-copy">
                        <strong>
                          {item.count} {item.title}
                        </strong>
                        <small>{item.hint}</small>
                      </span>
                    </Link>
                  );
                })}
                {!attentionItems.length ? (
                  <p className="dash-allclear">
                    <CircleCheck size={18} aria-hidden />
                    Tudo em dia. Nenhum pedido novo, disputa aberta ou rascunho parado.
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="dash-section dash-recent">
            <header className="dash-section-head">
              <h2>{isToday ? "Today’s payments" : "Recent payments"}</h2>
              <Link className="dash-text-link" href={salesHref}>
                See all
              </Link>
            </header>
            <div className="dash-list">
              {recentSales.map((sale) => (
                <PaymentRow
                  key={sale.id}
                  customerName={sale.customerName}
                  amount={sale.amount}
                  currency={sale.currency}
                  paidAt={sale.paidAt}
                  campaignTitle={sale.campaign.title}
                  campaignSlug={sale.campaign.slug}
                  gatewayLabel={sale.gatewayLabel}
                />
              ))}
              {!recentSales.length ? (
                <AdminEmptyState
                  compact
                  icon={<Receipt size={20} />}
                  title={isToday ? "No live payments today" : "No live payments in this range"}
                  body="New gifts appear here within a minute of being paid."
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
