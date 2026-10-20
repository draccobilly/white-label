import Link from "next/link";
import { AdSpendManager } from "@/components/admin/AdSpendManager";
import { AnalyticsBoard } from "@/components/admin/AnalyticsBoard";
import { DayCompareTable } from "@/components/admin/DayCompareTable";
import { GatewaySplit } from "@/components/admin/GatewaySplit";
import { KpiGrid, type Kpi } from "@/components/admin/KpiGrid";
import { LiveNow } from "@/components/admin/LiveNow";
import { MetricTable } from "@/components/admin/MetricTable";
import { SalesHeatmap } from "@/components/admin/SalesHeatmap";
import { currentAdminAccess } from "@/lib/admin-access";
import { ADMIN_OPERATION_CLOCK } from "@/lib/admin-clock";
import {
  formatCount,
  formatMultiple,
  formatRate,
  formatSignedRate,
  loadAnalytics,
  loadPages,
  loadSpend,
} from "@/lib/analytics";
import { getAdminCompany } from "@/lib/company";
import { companyDesk } from "@/lib/company-desk";
import { defaultSalesRange, inclusiveDayCount, orderedRange } from "@/lib/date-range";
import { homeLongitudeFor, loadLiveSnapshot } from "@/lib/live";
import {
  comparisonLabel,
  isIsoDay,
  parseCompareMode,
  periodLabel,
  resolveComparison,
} from "@/lib/periods";
import { ensureOperatorAffiliate } from "@/lib/operator-affiliate";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";

/**
 * Owner-only performance screen: the funnel (clicks → checkout → paid), the
 * money (revenue, ticket, ARPU, fees) and the ad side (spend, CPA, ROAS, ROI),
 * per campaign, per affiliate, per gateway and day by day, each compared with
 * the previous period. Reads only. Ad spend is followed in Utmify; typing it
 * in at the bottom is optional and turns on the CPA, ROAS and ROI figures.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; cmp?: string; cfrom?: string; cto?: string }>;
}) {
  const { admin, isOwner } = await currentAdminAccess();
  const affiliateId = isOwner ? undefined : (await ensureOperatorAffiliate(admin)).id;
  const company = await getAdminCompany();
  const desk = companyDesk(company);
  const query = await searchParams;
  const range =
    isIsoDay(query.from) && isIsoDay(query.to) ? orderedRange(query.from, query.to) : defaultSalesRange();
  const comparison = resolveComparison(range, parseCompareMode(query.cmp), query.cfrom, query.cto);
  const pages = await loadPages(company.id, affiliateId);
  const options = { pages, fallbackCurrency: desk.currency, affiliateId };
  const [current, compared, campaignRows, affiliateRows] = await Promise.all([
    loadAnalytics(company.id, range, options),
    comparison.range ? loadAnalytics(company.id, comparison.range, options) : Promise.resolve(null),
    prisma.campaign.findMany({
      where: {
        companyId: company.id,
        ...(affiliateId ? { pages: { some: { affiliateId } } } : {}),
      },
      orderBy: { title: "asc" },
      select: { id: true, title: true, slug: true },
    }),
    prisma.affiliate.findMany({
      where: {
        ...(affiliateId ? { id: affiliateId } : {}),
        pages: { some: { campaign: { companyId: company.id } } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);
  // Insights always read the previous window, whatever the comparison shown.
  const [spendRows, live] = await Promise.all([
    isOwner ? loadSpend(company.id, range) : Promise.resolve([]),
    loadLiveSnapshot(company.id, affiliateId).catch(() => null),
  ]);
  const spendReady = await prisma.adSpend
    .count({ where: { companyId: company.id }, take: 1 })
    .then(() => true)
    .catch(() => false);
  const currency = current.currency;
  const money = (value: number) => formatMoney(value, currency);
  const t = current.totals;
  const p = compared?.totals ?? null;
  const vs = compared ? comparisonLabel(comparison) : undefined;
  const days = inclusiveDayCount(range.from, range.to);

  const kpis: Kpi[] = [
    { key: "revenue", label: "Receita", value: money(t.revenue), current: t.revenue, previous: p?.revenue, formula: "Soma das doações pagas (modo live)." },
    { key: "gifts", label: "Doações pagas", value: formatCount(t.gifts), current: t.gifts, previous: p?.gifts },
    { key: "ticket", label: "Ticket médio", value: t.gifts ? money(t.ticket) : "—", current: t.ticket, previous: p?.ticket, formula: "Receita ÷ doações." },
    { key: "clicks", label: "Cliques", value: formatCount(t.clicks), current: t.clicks, previous: p?.clicks, formula: "Visualizações da página de campanha (PAGE_VIEW)." },
    {
      key: "conversion",
      label: "Conversão",
      value: formatRate(t.conversion),
      current: t.conversion,
      previous: p?.conversion,
      formula: "Doações pagas ÷ cliques.",
    },
    {
      key: "checkout",
      label: "Checkout → pago",
      value: formatRate(t.checkoutConversion),
      current: t.checkoutConversion,
      previous: p?.checkoutConversion,
      formula: "Doações pagas ÷ checkouts iniciados.",
    },
    {
      key: "arpu",
      label: "ARPU",
      value: t.arpu === null ? "—" : money(t.arpu),
      current: t.arpu,
      previous: p?.arpu,
      formula: t.sessions > 0 ? "Receita ÷ sessões únicas." : "Receita ÷ cliques (sem sessão identificada).",
    },
  ];
  if (isOwner) {
    kpis.push({
      key: "fees",
      label: "Taxas de gateway",
      value: t.fees ? money(t.fees) : "—",
      current: t.fees || null,
      previous: p?.fees || null,
      invert: true,
      formula: "Soma das taxas informadas pelo gateway.",
    });
  }
  // Ad figures only when some spend was typed in for this period or the compared one.
  if (isOwner && (t.spend > 0 || (p?.spend ?? 0) > 0)) {
    kpis.push(
      { key: "spend", label: "Investimento", value: t.spend ? money(t.spend) : "—", current: t.spend || null, previous: p?.spend || null, invert: true, hint: t.spend ? undefined : "lance abaixo" },
      { key: "cpa", label: "CPA", value: t.cpa === null ? "—" : money(t.cpa), current: t.cpa, previous: p?.cpa, invert: true, formula: "Investimento ÷ doações pagas." },
      { key: "roas", label: "ROAS", value: formatMultiple(t.roas), current: t.roas, previous: p?.roas, formula: "Receita ÷ investimento." },
      { key: "roi", label: "ROI", value: formatSignedRate(t.roi), current: t.roi === null ? null : t.roi + 1, previous: p?.roi === null || p?.roi === undefined ? null : p.roi + 1, formula: "(Receita − taxas − investimento) ÷ investimento." },
    );
  }
  return (
    <div className="dash dash-analytics">
      <header className="dash-page-head">
        <div>
          <p className="dash-kicker">
            {desk.region}, {desk.gateway}
          </p>
          <h1>Analytics</h1>
        </div>
        <Link className="secondary-button" href="/admin/health">
          Saúde e insights
        </Link>
      </header>

      <AnalyticsBoard path="/admin/analytics" from={range.from} to={range.to} comparison={comparison} />

      <p className="dash-sub analytics-sub">
        {periodLabel(range)} ({days} {days === 1 ? "dia" : "dias"})
        {vs ? ` · ${vs}` : ""}
      </p>

      <KpiGrid items={kpis} compareLabel={compared ? "vs comparação" : undefined} />

      <section className="dash-section">
        <header className="dash-section-head">
          <h2>Agora no site</h2>
          <span>quem está nas páginas, de onde, e o que está acontecendo</span>
        </header>
        <LiveNow variant="full" initial={live} globe homeLongitude={homeLongitudeFor(ADMIN_OPERATION_CLOCK.timeZone)} />
      </section>

      <section className="dash-section">
        <header className="dash-section-head">
          <h2>Dia a dia</h2>
          <span>{compared ? "cada dia ao lado do dia equivalente da comparação" : "sem comparação"}</span>
        </header>
        <DayCompareTable
          range={range}
          days={current.days}
          compareRange={comparison.range}
          compareDays={compared?.days ?? null}
          currency={currency}
        />
      </section>

      <div className="dash-cols is-even">
        <div className="dash-col">
          <section className="dash-section">
            <header className="dash-section-head">
              <h2>Por gateway</h2>
              <span>Stripe e PayPal separados</span>
            </header>
            <GatewaySplit
              rows={current.gateways.map((row) => ({
                gateway: row.key,
                amount: row.revenue,
                count: row.gifts,
                fees: isOwner ? row.fees : 0,
                previousAmount: compared ? (compared.gateways.find((other) => other.key === row.key)?.revenue ?? 0) : undefined,
              }))}
              currency={currency}
            />
          </section>
        </div>

        <div className="dash-col">
          <section className="dash-section">
            <header className="dash-section-head">
              <h2>Horários que vendem</h2>
              <span>doações por hora e dia da semana</span>
            </header>
            <div className="admin-card is-tight">
              <SalesHeatmap cells={current.heatmap} currency={currency} />
            </div>
          </section>
        </div>
      </div>

      <section className="dash-section">
        <header className="dash-section-head">
          <h2>Por campanha (produto)</h2>
          <span>{current.campaigns.length} com movimento</span>
        </header>
        <MetricTable
          rows={current.campaigns}
          previous={compared?.campaigns}
          currency={currency}
          caption="Métricas por campanha"
          emptyText="Nenhuma campanha com cliques ou doações no período."
        />
      </section>

      {isOwner ? (
      <section className="dash-section">
        <header className="dash-section-head">
          <h2>Por afiliado (operação)</h2>
          <span>{current.affiliates.length} com movimento</span>
        </header>
        <MetricTable
          rows={current.affiliates}
          previous={compared?.affiliates}
          currency={currency}
          caption="Métricas por afiliado"
          emptyText="Nenhum afiliado com cliques ou doações no período."
        />
      </section>
      ) : null}

      {isOwner ? (
      <section className="dash-section">
        <div className="admin-card">
          <AdSpendManager
            from={range.from}
            to={range.to}
            currency={currency}
            campaigns={campaignRows.map((row) => ({ id: row.id, label: row.title, slug: row.slug }))}
            affiliates={affiliateRows.map((row) => ({ id: row.id, label: row.name, slug: row.slug }))}
            rows={spendRows}
            ready={spendReady}
          />
          {current.unassignedSpend ? (
            <p className="admin-help">
              {money(current.unassignedSpend)} do investimento não está ligado a nenhuma campanha; entra no total,
              não nas tabelas por campanha.
            </p>
          ) : null}
        </div>
      </section>
      ) : null}
    </div>
  );
}
