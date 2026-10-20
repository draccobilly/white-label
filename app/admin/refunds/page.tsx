import Link from "next/link";
import { Undo2 } from "lucide-react";
import type { RequestStatus } from "@/generated/prisma/enums";
import { AdminChip } from "@/components/admin/AdminChip";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminFormMessage } from "@/components/admin/AdminFormMessage";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { refundReasonLabel, type RefundReason } from "@/lib/refund-reasons";
import { requireOwnerPage } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import {
  isMissingColumnError,
  parseRequestStatusFilter,
  requestStatusLabel,
  requestStatusTone,
} from "@/lib/request-status";
import { formatMoney, formatRelativeTime } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

type Row = {
  id: string;
  name: string | null;
  email: string;
  reason: string;
  trackingCode: string | null;
  createdAt: Date;
  status: RequestStatus;
  statusChangedAt: Date | null;
  sale: {
    amount: number;
    currency: string;
    trackingCode: string | null;
    campaign: { title: string };
  } | null;
};

const TABS: Array<{ id: RequestStatus | "ALL"; label: string }> = [
  { id: "OPEN", label: "Abertos" },
  { id: "ANSWERED", label: "Respondidos" },
  { id: "RESOLVED", label: "Resolvidos" },
  { id: "ALL", label: "Todos" },
];

const saleSelect = {
  sale: {
    select: {
      amount: true,
      currency: true,
      trackingCode: true,
      campaign: { select: { title: true } },
    },
  },
} as const;

/** Same pre-migration fallback as the support queue. */
async function loadRequests(companyId: string): Promise<{ rows: Row[]; statusReady: boolean }> {
  try {
    const rows = await prisma.refundRequest.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        reason: true,
        trackingCode: true,
        createdAt: true,
        status: true,
        statusChangedAt: true,
        ...saleSelect,
      },
    });
    return { rows, statusReady: true };
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    const rows = await prisma.refundRequest.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        reason: true,
        trackingCode: true,
        createdAt: true,
        ...saleSelect,
      },
    });
    return {
      rows: rows.map((row) => ({ ...row, status: "OPEN" as const, statusChangedAt: null })),
      statusReady: false,
    };
  }
}

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireOwnerPage();
  const company = await getAdminCompany();
  const query = await searchParams;
  const { rows: requests, statusReady } = await loadRequests(company.id);
  const filter = statusReady ? parseRequestStatusFilter(query.status) : "ALL";
  // Request time is the reference for the "new" chips by design.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const openCount = requests.filter((request) => request.status === "OPEN").length;
  const answeredCount = requests.filter((request) => request.status === "ANSWERED").length;
  const newCount = requests.filter((request) => now - request.createdAt.getTime() < DAY_MS).length;
  const unmatchedOpen = requests.filter(
    (request) => request.status !== "RESOLVED" && !request.sale,
  ).length;
  const visible = filter === "ALL" ? requests : requests.filter((request) => request.status === filter);
  const counts: Record<string, number> = {
    OPEN: openCount,
    ANSWERED: answeredCount,
    RESOLVED: requests.length - openCount - answeredCount,
    ALL: requests.length,
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Suporte"
        title="Refund requests"
        description="Submissions from /refund. Process the return in Stripe or PayPal, then reply to the donor by email. The status here is bookkeeping for the queue — nothing on this page moves money."
        badges={
          openCount ? <AdminChip tone="info">{openCount} aberto{openCount > 1 ? "s" : ""}</AdminChip> : null
        }
        actions={
          <>
            <Link className="secondary-button" href="/admin/disputes">
              Disputas
            </Link>
            <Link className="secondary-button" href="/admin/requests">
              Suporte
            </Link>
          </>
        }
      />

      {!statusReady ? (
        <AdminFormMessage tone="info">
          A coluna de status ainda não existe neste banco. Aplique a migration{" "}
          <code>20261002100000_request_status_ad_spend_site_check</code> para marcar pedidos como
          respondidos ou resolvidos.
        </AdminFormMessage>
      ) : null}

      <div className="admin-summary">
        <div className="admin-summary-item">
          <span>Abertos</span>
          <strong>{openCount}</strong>
          <small>sem resposta</small>
        </div>
        <div className="admin-summary-item">
          <span>Respondidos</span>
          <strong>{answeredCount}</strong>
          <small>aguardando estorno</small>
        </div>
        <div className="admin-summary-item">
          <span>Últimas 24h</span>
          <strong>{newCount}</strong>
          <small>chegaram hoje</small>
        </div>
        <div className="admin-summary-item">
          <span>Sem correspondência</span>
          <strong>{unmatchedOpen}</strong>
          <small>em aberto, procurar em Donations</small>
        </div>
      </div>

      {statusReady ? (
        <div className="dash-seg admin-queue-tabs" role="group" aria-label="Filtrar por status">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === "OPEN" ? "/admin/refunds" : `/admin/refunds?status=${tab.id}`}
              className={filter === tab.id ? "is-active" : undefined}
              aria-current={filter === tab.id ? "true" : undefined}
            >
              {tab.label}
              <small>{counts[tab.id]}</small>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="admin-list">
        {visible.length ? (
          visible.map((request) => {
            const isNew = now - request.createdAt.getTime() < DAY_MS;
            return (
              <Link
                key={request.id}
                href={`/admin/refunds/${request.id}`}
                className="admin-list-row"
              >
                <div className="admin-list-main">
                  <strong>{request.name || request.email}</strong>
                  <div className="admin-list-sub">
                    <span>{refundReasonLabel(request.reason as RefundReason)}</span>
                    <span>{request.trackingCode || "no code"}</span>
                    <span>{request.sale?.campaign.title || "unmatched"}</span>
                  </div>
                </div>
                <div className="admin-list-meta">
                  {request.sale ? (
                    <span className="admin-list-amount">
                      {formatMoney(request.sale.amount, request.sale.currency)}
                    </span>
                  ) : null}
                  {statusReady ? (
                    <AdminChip tone={requestStatusTone(request.status)}>
                      {requestStatusLabel(request.status)}
                    </AdminChip>
                  ) : null}
                  {isNew ? <AdminChip tone="info">Novo</AdminChip> : null}
                  <AdminChip tone={request.sale ? "success" : "warning"}>
                    {request.sale ? "Doação localizada" : "Sem correspondência"}
                  </AdminChip>
                  <time
                    dateTime={request.createdAt.toISOString()}
                    title={request.createdAt.toLocaleString("en-US")}
                  >
                    {formatRelativeTime(request.createdAt)}
                  </time>
                </div>
              </Link>
            );
          })
        ) : (
          <AdminEmptyState
            icon={<Undo2 size={20} />}
            title={
              filter === "ALL"
                ? "Nenhum pedido de reembolso"
                : `Nenhum pedido ${requestStatusLabel(filter).toLowerCase()}`
            }
            body={
              filter === "ALL"
                ? "When someone submits /refund, it appears here with the reason, the tracking code and the matched donation when there is one."
                : "Troque a aba acima para ver os outros status."
            }
            compact={filter !== "ALL"}
          />
        )}
      </div>
    </>
  );
}
