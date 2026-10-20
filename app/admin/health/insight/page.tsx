import Link from "next/link";
import { currentAdminAccess } from "@/lib/admin-access";
import { loadAnalytics, loadPages } from "@/lib/analytics";
import { getAdminCompany } from "@/lib/company";
import { companyDesk } from "@/lib/company-desk";
import { defaultSalesRange, orderedRange } from "@/lib/date-range";
import { buildInsights } from "@/lib/insights";
import { ensureOperatorAffiliate } from "@/lib/operator-affiliate";
import { isIsoDay, previousPeriod } from "@/lib/periods";

export default async function InsightDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; from?: string; to?: string }>;
}) {
  const { admin, isOwner } = await currentAdminAccess();
  const affiliateId = isOwner ? undefined : (await ensureOperatorAffiliate(admin)).id;
  const company = await getAdminCompany();
  const desk = companyDesk(company);
  const query = await searchParams;
  const range =
    isIsoDay(query.from) && isIsoDay(query.to) ? orderedRange(query.from, query.to) : defaultSalesRange();
  const pages = await loadPages(company.id, affiliateId);
  const options = { pages, fallbackCurrency: desk.currency, affiliateId };
  const [current, previous] = await Promise.all([
    loadAnalytics(company.id, range, options),
    loadAnalytics(company.id, previousPeriod(range), options),
  ]);
  const insight = buildInsights(current, previous).find((item) => item.id === query.id);
  const back = `/admin/health?from=${range.from}&to=${range.to}`;

  return (
    <div className="dash">
      <header className="dash-page-head">
        <div>
          <p className="dash-kicker">Saúde</p>
          <h1>{insight?.title ?? "Esse aviso já não está neste período"}</h1>
        </div>
        <Link className="secondary-button" href={back}>
          Voltar para Saúde
        </Link>
      </header>
      {insight ? (
        <section className="dash-section">
          <div className="admin-card">
            <p>{insight.detail}</p>
            <ol className="insight-guide">
              {(insight.guide?.length ? insight.guide : [insight.action]).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {insight.campaignHref ? (
              <p>
                <Link className="dash-text-link" href={insight.campaignHref}>
                  Abrir a campanha
                </Link>
              </p>
            ) : null}
          </div>
        </section>
      ) : (
        <p className="admin-help">
          O período mudou ou o buraco já fechou. Volte para Saúde e abra o aviso de novo a partir da lista.
        </p>
      )}
    </div>
  );
}
