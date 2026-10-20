import Link from "next/link";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { AdminChip } from "@/components/admin/AdminChip";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CopyValueButton } from "@/components/admin/CopyValueButton";
import { requireOwnerPage } from "@/lib/admin-access";
import { campaignNameTag } from "@/lib/campaign-label";
import { getAdminCompany } from "@/lib/company";
import { reportingIsoDate } from "@/lib/date-range";
import {
  disputeReasonLabel,
  disputeStatusLabel,
  disputeStatusTone,
  needsResponse,
  stripeDisputeUrl,
} from "@/lib/disputes";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatRelativeTime } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

type Filter = "OPEN" | "CLOSED" | "ALL";

const TABS: Array<{ id: Filter; label: string }> = [
  { id: "OPEN", label: "Abertas" },
  { id: "CLOSED", label: "Fechadas" },
  { id: "ALL", label: "Todas" },
];

function daysBetween(from: Date, to: Date) {
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
}

/**
 * Read-only view of Stripe disputes (chargebacks) recorded by the webhook.
 * Evidence is submitted in the Stripe dashboard; this page only shows where
 * each case stands and which ones still need a response.
 */
export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireOwnerPage();
  const company = await getAdminCompany();
  const query = await searchParams;
  const filter: Filter = query.status === "CLOSED" || query.status === "ALL" ? query.status : "OPEN";
  const disputes = await prisma.chargeback
    .findMany({
      where: { sale: { campaign: { companyId: company.id } } },
      orderBy: [{ closedAt: "asc" }, { openedAt: "desc" }],
      take: 300,
      select: {
        id: true,
        stripeDisputeId: true,
        amount: true,
        currency: true,
        status: true,
        reason: true,
        openedAt: true,
        closedAt: true,
        affiliate: { select: { name: true } },
        sale: {
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
            paidAt: true,
            livemode: true,
            trackingCode: true,
            campaign: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    })
    .catch(() => []);
  // Days open are measured from request time by design.
  // eslint-disable-next-line react-hooks/purity
  const now = new Date();
  const open = disputes.filter((dispute) => !dispute.closedAt);
  const closed = disputes.filter((dispute) => dispute.closedAt);
  const toAnswer = open.filter((dispute) => needsResponse(dispute.status));
  const quarter = closed.filter((dispute) => now.getTime() - (dispute.closedAt?.getTime() ?? 0) < 90 * DAY_MS);
  const won = quarter.filter((dispute) => dispute.status === "won").length;
  const lost = quarter.filter((dispute) => dispute.status === "lost").length;
  const openAmount = open.reduce((sum, dispute) => sum + dispute.amount, 0);
  const currency = open[0]?.currency ?? disputes[0]?.currency ?? "USD";
  const visible = filter === "OPEN" ? open : filter === "CLOSED" ? closed : disputes;
  const counts: Record<Filter, number> = { OPEN: open.length, CLOSED: closed.length, ALL: disputes.length };

  return (
    <>
      <AdminPageHeader
        eyebrow="Suporte"
        title="Disputas"
        description="Chargebacks abertos pelo banco do doador e recebidos pelo webhook do Stripe. A defesa é enviada no painel do Stripe; aqui você vê o que está em aberto, o prazo correndo e o resultado."
        badges={
          toAnswer.length ? (
            <AdminChip tone="danger">{toAnswer.length} para responder</AdminChip>
          ) : null
        }
        actions={
          <>
            <Link className="secondary-button" href="/admin/refunds">
              Reembolsos
            </Link>
            <a
              className="secondary-button"
              href="https://dashboard.stripe.com/disputes"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={15} aria-hidden />
              Abrir no Stripe
            </a>
          </>
        }
      />

      <div className="admin-summary">
        <div className="admin-summary-item">
          <span>Abertas</span>
          <strong>{open.length}</strong>
          <small>{formatMoney(openAmount, currency)} em disputa</small>
        </div>
        <div className="admin-summary-item">
          <span>Para responder</span>
          <strong>{toAnswer.length}</strong>
          <small>o Stripe dá de 7 a 21 dias</small>
        </div>
        <div className="admin-summary-item">
          <span>Ganhas</span>
          <strong>{won}</strong>
          <small>últimos 90 dias</small>
        </div>
        <div className="admin-summary-item">
          <span>Perdidas</span>
          <strong>{lost}</strong>
          <small>
            {won + lost ? `${Math.round((won / (won + lost)) * 100)}% de vitória` : "sem fechadas ainda"}
          </small>
        </div>
      </div>

      <div className="dash-seg admin-queue-tabs" role="group" aria-label="Filtrar disputas">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === "OPEN" ? "/admin/disputes" : `/admin/disputes?status=${tab.id}`}
            className={filter === tab.id ? "is-active" : undefined}
            aria-current={filter === tab.id ? "true" : undefined}
          >
            {tab.label}
            <small>{counts[tab.id]}</small>
          </Link>
        ))}
      </div>

      <div className="admin-list">
        {visible.length ? (
          visible.map((dispute) => {
            const days = daysBetween(dispute.openedAt, dispute.closedAt ?? now);
            const urgent = !dispute.closedAt && needsResponse(dispute.status) && days >= 5;
            return (
              <article key={dispute.id} className="admin-list-row is-static">
                <div className="admin-list-main">
                  <strong>
                    {dispute.sale.customerName || "Anonymous"}
                    {" · "}
                    {formatMoney(dispute.amount, dispute.currency)}
                  </strong>
                  <div className="admin-list-sub">
                    <span>
                      <span className="campaign-name-tag">{campaignNameTag(dispute.sale.campaign.title)}</span>
                    </span>
                    <span>{dispute.affiliate.name}</span>
                    <span>{disputeReasonLabel(dispute.reason)}</span>
                    {dispute.sale.customerEmail ? <span>{dispute.sale.customerEmail}</span> : null}
                    {dispute.sale.trackingCode ? <span>Código {dispute.sale.trackingCode}</span> : null}
                  </div>
                  <div className="admin-inline-actions admin-list-actions">
                    <a
                      className="secondary-button"
                      href={stripeDisputeUrl(dispute.stripeDisputeId, dispute.sale.livemode)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={14} aria-hidden />
                      Responder no Stripe
                    </a>
                    <CopyValueButton value={dispute.stripeDisputeId} label="Copiar id" />
                    {dispute.sale.paidAt ? (
                      <Link
                        className="secondary-button"
                        href={`/admin/sales?from=${reportingIsoDate(dispute.sale.paidAt)}&to=${reportingIsoDate(dispute.sale.paidAt)}&campaign=${dispute.sale.campaign.id}`}
                      >
                        Ver o dia da venda
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="admin-list-meta">
                  <AdminChip tone={urgent ? "danger" : disputeStatusTone(dispute.status)}>
                    {disputeStatusLabel(dispute.status)}
                  </AdminChip>
                  <AdminChip tone={dispute.closedAt ? "neutral" : urgent ? "danger" : "warning"}>
                    {dispute.closedAt ? `fechada em ${days} d` : `${days} d em aberto`}
                  </AdminChip>
                  <time dateTime={dispute.openedAt.toISOString()} title={dispute.openedAt.toLocaleString("en-US")}>
                    aberta {formatRelativeTime(dispute.openedAt)}
                  </time>
                </div>
              </article>
            );
          })
        ) : (
          <AdminEmptyState
            icon={<ShieldAlert size={20} />}
            title={
              filter === "OPEN"
                ? "Nenhuma disputa aberta"
                : filter === "CLOSED"
                  ? "Nenhuma disputa fechada"
                  : "Nenhuma disputa registrada"
            }
            body="Quando o banco de um doador abre um chargeback, o webhook do Stripe grava a disputa aqui com valor, motivo e prazo."
            compact={filter !== "ALL"}
          />
        )}
      </div>
    </>
  );
}
