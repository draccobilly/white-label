import Link from "next/link";
import { Activity, Crosshair, Radar, Wallet } from "lucide-react";
import { AdminChip, type AdminChipTone } from "@/components/admin/AdminChip";
import { AnalyticsBoard } from "@/components/admin/AnalyticsBoard";
import { InsightList } from "@/components/admin/InsightList";
import { SiteCheckRunner } from "@/components/admin/SiteCheckRunner";
import { currentAdminAccess } from "@/lib/admin-access";
import { formatCount, loadAnalytics, loadPages } from "@/lib/analytics";
import { getAdminCompany } from "@/lib/company";
import { companyDesk } from "@/lib/company-desk";
import { defaultSalesRange, inclusiveDayCount, orderedRange } from "@/lib/date-range";
import { buildInsights } from "@/lib/insights";
import { isIsoDay, parseCompareMode, periodLabel, previousPeriod, resolveComparison } from "@/lib/periods";
import { ensureOperatorAffiliate } from "@/lib/operator-affiliate";
import { loadHealthSummary, publicBaseUrl } from "@/lib/site-health";
import { loadTrackingQuality, trackingScore } from "@/lib/tracking-quality";
import { formatRelativeTime } from "@/lib/utils";

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function uptimeLabel(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(value >= 0.999 ? 1 : 1)}%`;
}

function ago(date: Date | null) {
  return date ? formatRelativeTime(date) : "nunca";
}

function staleTone(date: Date | null, warnAfterMs: number, dangerAfterMs: number): AdminChipTone {
  if (!date) return "neutral";
  const age = Date.now() - date.getTime();
  if (age > dangerAfterMs) return "danger";
  if (age > warnAfterMs) return "warning";
  return "success";
}

/**
 * Owner-only operations health: is the site up, is the tracking any good, are
 * pixels and Utmify delivering, and what the numbers say to do next.
 */
export default async function AdminHealthPage({
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
  const [health, quality, current, previous] = await Promise.all([
    isOwner ? loadHealthSummary(company.id) : Promise.resolve(null),
    loadTrackingQuality(company.id, affiliateId),
    loadAnalytics(company.id, range, options),
    loadAnalytics(company.id, previousPeriod(range), options),
  ]);
  const insights = buildInsights(current, previous);
  const score = trackingScore(quality);
  const base = publicBaseUrl(company);
  const days = inclusiveDayCount(range.from, range.to);
  const deliveriesTotal = quality.deliveries.succeeded + quality.deliveries.failed;
  const deliveryRate = percent(quality.deliveries.succeeded, deliveriesTotal);

  const siteTone: AdminChipTone = !health?.last
    ? "neutral"
    : !health.last.ok
      ? "danger"
      : (health.uptime24h ?? 1) < 0.99
        ? "warning"
        : "success";
  const scoreTone: AdminChipTone = score.score >= 80 ? "success" : score.score >= 50 ? "warning" : "danger";
  const pixelTone: AdminChipTone =
    deliveryRate === null ? (quality.pages.missing.length ? "warning" : "neutral") : deliveryRate >= 95 && !quality.pages.missing.length ? "success" : deliveryRate >= 80 ? "warning" : "danger";
  const salesTone = staleTone(quality.lastSale, 12 * 3600_000, 36 * 3600_000);

  return (
    <div className="dash dash-health">
      <header className="dash-page-head">
        <div>
          <p className="dash-kicker">
            {desk.region}, {desk.gateway}
          </p>
          <h1>Saúde e insights</h1>
        </div>
        <Link className="secondary-button" href="/admin/analytics">
          Analytics
        </Link>
      </header>

      <section className="dash-section insight-grid">
        <header className="dash-section-head">
          <h2>O que fazer</h2>
          <span>
            {periodLabel(range)} ({days} {days === 1 ? "dia" : "dias"}) vs anterior
          </span>
        </header>
        <AnalyticsBoard path="/admin/health" from={range.from} to={range.to} comparison={comparison} />
        <InsightList
          insights={insights}
          emptyText="Nada fora do normal: sem buraco de vendas, queda de conversão ou oportunidade perdida neste período."
        />
      </section>

      <div className="health-grid">
        {isOwner && health ? (
        <article className={`health-card is-${siteTone}`}>
          <span className="health-icon" aria-hidden>
            <Activity size={18} />
          </span>
          <div>
            <small>Site no ar</small>
            <strong>{health.last ? (health.last.ok ? "Respondendo" : "Fora do ar") : "Sem checagem"}</strong>
            <span>
              {health.last
                ? `${uptimeLabel(health.uptime24h)} nas últimas 24h · ${health.last.latencyMs} ms`
                : "A primeira verificação roda ao abrir esta tela."}
            </span>
          </div>
        </article>
        ) : null}
        <article className={`health-card is-${scoreTone}`}>
          <span className="health-icon" aria-hidden>
            <Crosshair size={18} />
          </span>
          <div>
            <small>Qualidade da marcação</small>
            <strong>{score.score}/100</strong>
            <span>{score.reasons.length ? score.reasons[0] : "UTM, sessão e cookie do pixel chegando"}</span>
          </div>
        </article>
        <article className={`health-card is-${pixelTone}`}>
          <span className="health-icon" aria-hidden>
            <Radar size={18} />
          </span>
          <div>
            <small>Pixel e Utmify</small>
            <strong>{deliveryRate === null ? "Sem entregas" : `${deliveryRate}% entregue`}</strong>
            <span>
              {quality.pages.missing.length
                ? `${quality.pages.missing.length} página(s) sem pixel ou Utmify`
                : `${quality.pages.active} páginas ativas marcadas`}
            </span>
          </div>
        </article>
        <article className={`health-card is-${salesTone}`}>
          <span className="health-icon" aria-hidden>
            <Wallet size={18} />
          </span>
          <div>
            <small>Pagamentos</small>
            <strong>Última {ago(quality.lastSale)}</strong>
            <span>
              {isOwner
                ? quality.webhooks24h.length
                  ? quality.webhooks24h.map((row) => `${row.provider} ${row.count}`).join(", ") + " webhooks em 24h"
                  : "nenhum webhook nas últimas 24h"
                : "só as vendas das suas campanhas"}
            </span>
          </div>
        </article>
      </div>

      <div className="dash-cols is-even">
        <div className="dash-col">
          {isOwner && health ? (
          <section className="dash-section">
            <header className="dash-section-head">
              <h2>Uptime</h2>
              <span>verificado pelo próprio painel</span>
            </header>
            <div className="admin-card">
              {!base ? (
                <p className="admin-help">Esta operação não tem domínio público cadastrado em Settings; nada para verificar.</p>
              ) : null}
              <div className="uptime-stats">
                <div>
                  <span>24 horas</span>
                  <strong>{uptimeLabel(health.uptime24h)}</strong>
                  <small>{health.checks24h} checagens</small>
                </div>
                <div>
                  <span>7 dias</span>
                  <strong>{uptimeLabel(health.uptime7d)}</strong>
                  <small>{health.checks7d} checagens</small>
                </div>
                <div>
                  <span>Resposta média</span>
                  <strong>{health.avgLatency24h === null ? "—" : `${health.avgLatency24h} ms`}</strong>
                  <small>p95 {health.p95Latency7d === null ? "—" : `${health.p95Latency7d} ms`}</small>
                </div>
                <div>
                  <span>Página pública</span>
                  <strong>{health.lastPage ? (health.lastPage.ok ? "OK" : "Falhou") : "—"}</strong>
                  <small>{health.lastPage ? `${health.lastPage.latencyMs} ms, ${ago(health.lastPage.checkedAt)}` : "sem checagem"}</small>
                </div>
              </div>
              <div className="uptime-series" role="img" aria-label="Últimas checagens">
                {health.series.map((point, index) => (
                  <i
                    key={index}
                    className={point.ok ? "is-ok" : "is-fail"}
                    title={`${point.at.toLocaleString("pt-BR")}: ${point.ok ? "ok" : "falha"}, ${point.latencyMs} ms`}
                  />
                ))}
                {!health.series.length ? <small>Ainda sem histórico.</small> : null}
              </div>
              {health.incidents.length ? (
                <ul className="incident-list">
                  {health.incidents.map((incident) => (
                    <li key={incident.from.toISOString()}>
                      <AdminChip tone="danger">{incident.count} falha{incident.count === 1 ? "" : "s"}</AdminChip>
                      <span>
                        {incident.from.toLocaleString("pt-BR")}
                        {incident.count > 1 ? ` → ${incident.to.toLocaleString("pt-BR")}` : ""}
                      </span>
                      <small>{incident.error ?? "sem detalhe"}</small>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="uptime-foot">
                <SiteCheckRunner lastCheckedAt={health.last?.checkedAt.toISOString() ?? null} />
                <p className="admin-help">
                  O painel verifica <code>/api/health</code> e a home ao abrir esta tela e a cada minuto enquanto ela
                  fica aberta. Para vigiar 24h por dia, aponte um monitor externo (UptimeRobot, Better Stack) para{" "}
                  <code>{base ? `${base}/api/health` : "/api/health"}</code>.
                </p>
                {!health.ready ? (
                  <p className="admin-help">
                    O histórico só começa a ser gravado depois da migration{" "}
                    <code>20261002100000_request_status_ad_spend_site_check</code>.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
          ) : null}

          <section className="dash-section">
            <header className="dash-section-head">
              <h2>Qualidade do rastreio</h2>
              <span>últimos 7 dias</span>
            </header>
            <div className="admin-card quality-card">
              <div className="quality-facts">
                <div className={quality.paid > 0 && quality.paidWithUtm === quality.paid && quality.paidWithPixelCookie === quality.paid ? "is-good" : undefined}>
                  <strong>{quality.paid ? `${formatCount(quality.paidWithUtm)}/${formatCount(quality.paid)}` : "—"}</strong>
                  <span>vendas com etiqueta</span>
                </div>
                <div>
                  <strong>
                    {formatCount(quality.checkoutsWithAdMark)}/{formatCount(quality.checkouts)}
                  </strong>
                  <span>checkouts de anúncio</span>
                </div>
                <div>
                  <strong>{formatCount(quality.pageViews)}</strong>
                  <span>visitas</span>
                </div>
              </div>
              <p className="mark-read">
                {quality.paid > 0 && quality.paidWithUtm === quality.paid && quality.paidWithPixelCookie === quality.paid
                  ? `As ${formatCount(quality.paid)} doações pagas saíram com UTM e com o cookie do Meta. A Utmify e o Meta conseguem atribuir essas vendas.`
                  : quality.paid > 0
                    ? `${formatCount(quality.paid - quality.paidWithUtm)} doações pagas chegaram sem UTM. Essas a Utmify não liga ao anúncio.`
                    : "Ainda não houve doação paga nestes 7 dias."}
                {quality.checkouts > quality.checkoutsWithAdMark
                  ? quality.paidWithUtm === quality.paid
                    ? ` ${formatCount(quality.checkouts - quality.checkoutsWithAdMark)} checkouts abriram sem etiqueta e não viraram venda.`
                    : ` ${formatCount(quality.checkouts - quality.checkoutsWithAdMark)} checkouts abriram sem a etiqueta do anúncio.`
                  : ""}
              </p>
              <p className="mark-read">
                Para marcar o checkout, o anúncio tem que usar o link da Utmify, com <code>utm_source</code>, <code>src</code> e <code>sck</code>. Link copiado da barra do navegador abre a página e não deixa etiqueta.
              </p>
              <dl className="quality-times">
                <div>
                  <dt>Última visita</dt>
                  <dd>
                    <AdminChip tone={staleTone(quality.lastPageView, 2 * 3600_000, 12 * 3600_000)}>{ago(quality.lastPageView)}</AdminChip>
                  </dd>
                </div>
                <div>
                  <dt>Último checkout</dt>
                  <dd>
                    <AdminChip tone={staleTone(quality.lastCheckout, 6 * 3600_000, 24 * 3600_000)}>{ago(quality.lastCheckout)}</AdminChip>
                  </dd>
                </div>
                {isOwner ? (
                <div>
                  <dt>Último webhook</dt>
                  <dd>
                    <AdminChip tone={staleTone(quality.lastWebhook?.at ?? null, 12 * 3600_000, 48 * 3600_000)}>
                      {quality.lastWebhook ? `${quality.lastWebhook.provider}, ${ago(quality.lastWebhook.at)}` : "nunca"}
                    </AdminChip>
                  </dd>
                </div>
                ) : null}
              </dl>
              {score.reasons.length ? (
                <ul className="quality-reasons">
                  {score.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          <section className="dash-section">
            <header className="dash-section-head">
              <h2>Pixel e Utmify</h2>
              <span>entregas dos últimos 7 dias</span>
            </header>
            <div className="admin-card">
              <div className="uptime-stats">
                <div>
                  <span>Entregues</span>
                  <strong>{formatCount(quality.deliveries.succeeded)}</strong>
                  <small>Utmify recebeu</small>
                </div>
                <div>
                  <span>Falharam</span>
                  <strong className={quality.deliveries.failed ? "is-bad" : undefined}>{formatCount(quality.deliveries.failed)}</strong>
                  <small>esgotaram as tentativas</small>
                </div>
                <div>
                  <span>Na fila</span>
                  <strong>{formatCount(quality.deliveries.pending)}</strong>
                  <small>aguardando envio</small>
                </div>
                {isOwner ? (
                <div>
                  <span>Afiliados com pixel</span>
                  <strong>
                    {quality.affiliates.withDefaultPixel}/{quality.affiliates.total}
                  </strong>
                  <small>{quality.affiliates.withDefaultUtmify} com token Utmify</small>
                </div>
                ) : null}
              </div>
              {quality.failedDeliveries.length ? (
                <ul className="incident-list">
                  {quality.failedDeliveries.map((row) => (
                    <li key={`${row.pageId}-${row.at.toISOString()}`}>
                      <AdminChip tone="danger">falhou</AdminChip>
                      <span>
                        {row.campaign} · {row.affiliate}
                      </span>
                      <small>
                        {ago(row.at)} · {row.error ?? "sem detalhe"}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : null}
              {quality.pages.missing.length ? (
                <ul className="incident-list">
                  {quality.pages.missing.map((page) => (
                    <li key={page.id}>
                      <AdminChip tone="warning">{!page.fbPixel && !page.utmify ? "sem pixel nem Utmify" : !page.fbPixel ? "sem pixel" : "sem Utmify"}</AdminChip>
                      <span>
                        {page.campaign} · {page.affiliate}
                      </span>
                      <Link className="dash-text-link" href={isOwner ? `/admin/integrations/${page.id}` : "/admin/integrations"}>
                        Configurar
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-help">Todas as páginas ativas têm pixel e Utmify configurados.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
