import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import type { RequestStatus } from "@/generated/prisma/enums";
import { AdminChip } from "@/components/admin/AdminChip";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminFormMessage } from "@/components/admin/AdminFormMessage";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
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
  name: string;
  email: string;
  whatsapp: string;
  about: string;
  mediaUrls: string[];
  createdAt: Date;
  status: RequestStatus;
  statusChangedAt: Date | null;
  priorRaisedCents: number;
  priorDonationCount: number;
  priorRaisedCurrency: string;
};

const TABS: Array<{ id: RequestStatus | "ALL"; label: string }> = [
  { id: "OPEN", label: "Abertos" },
  { id: "ANSWERED", label: "Respondidos" },
  { id: "RESOLVED", label: "Resolvidos" },
  { id: "ALL", label: "Todos" },
];

/**
 * Reads the queue with the status columns; before the migration runs the
 * database has no such columns, so the page falls back to the plain list and
 * says so instead of failing.
 */
async function loadRequests(companyId: string): Promise<{ rows: Row[]; statusReady: boolean }> {
  try {
    const rows = await prisma.helpRequest.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        whatsapp: true,
        about: true,
        mediaUrls: true,
        createdAt: true,
        status: true,
        statusChangedAt: true,
        priorRaisedCents: true,
        priorDonationCount: true,
        priorRaisedCurrency: true,
      },
    });
    return { rows, statusReady: true };
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    const rows = await prisma.helpRequest.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        whatsapp: true,
        about: true,
        mediaUrls: true,
        createdAt: true,
      },
    });
    return {
      rows: rows.map((row) => ({
        ...row,
        status: "OPEN" as const,
        statusChangedAt: null,
        priorRaisedCents: 0,
        priorDonationCount: 0,
        priorRaisedCurrency: "USD",
      })),
      statusReady: false,
    };
  }
}

export default async function AdminHelpRequestsPage({
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
  const resolvedWeek = requests.filter(
    (request) =>
      request.status === "RESOLVED" &&
      request.statusChangedAt &&
      now - request.statusChangedAt.getTime() < 7 * DAY_MS,
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
        title="Fundraiser requests"
        description="Submissions from Start a fundraiser. If Resend is configured, the same note is emailed to the public support address. The status below is the panel's own queue; the request itself never changes."
        badges={
          openCount ? <AdminChip tone="info">{openCount} aberto{openCount > 1 ? "s" : ""}</AdminChip> : null
        }
        actions={
          <Link className="secondary-button" href="/admin/refunds">
            Reembolsos
          </Link>
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
          <small>aguardando desfecho</small>
        </div>
        <div className="admin-summary-item">
          <span>Últimas 24h</span>
          <strong>{newCount}</strong>
          <small>chegaram hoje</small>
        </div>
        <div className="admin-summary-item">
          <span>Resolvidos</span>
          <strong>{resolvedWeek}</strong>
          <small>nos últimos 7 dias</small>
        </div>
      </div>

      {statusReady ? (
        <div className="dash-seg admin-queue-tabs" role="group" aria-label="Filtrar por status">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === "OPEN" ? "/admin/requests" : `/admin/requests?status=${tab.id}`}
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
                href={`/admin/requests/${request.id}`}
                className="admin-list-row"
              >
                <div className="admin-list-main">
                  <strong>{request.name}</strong>
                  <div className="admin-list-sub">
                    <span>{request.about === "myself" ? "Own case" : "Someone they know"}</span>
                    <span>{request.email}</span>
                    <span>{request.whatsapp}</span>
                  </div>
                </div>
                <div className="admin-list-meta">
                  {statusReady ? (
                    <AdminChip tone={requestStatusTone(request.status)}>
                      {requestStatusLabel(request.status)}
                    </AdminChip>
                  ) : null}
                  {isNew ? <AdminChip tone="info">Novo</AdminChip> : null}
                  {request.priorRaisedCents > 0 || request.priorDonationCount > 0 ? (
                    <AdminChip>
                      {formatMoney(request.priorRaisedCents, request.priorRaisedCurrency)} ·{" "}
                      {request.priorDonationCount.toLocaleString("en-US")}
                    </AdminChip>
                  ) : null}
                  {request.mediaUrls.length ? (
                    <AdminChip>
                      {request.mediaUrls.length} {request.mediaUrls.length === 1 ? "file" : "files"}
                    </AdminChip>
                  ) : null}
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
            icon={<LifeBuoy size={20} />}
            title={
              filter === "ALL"
                ? "Nenhum pedido ainda"
                : `Nenhum pedido ${requestStatusLabel(filter).toLowerCase()}`
            }
            body={
              filter === "ALL"
                ? "When someone submits /start-a-fundraiser, it appears here with name, contact and story."
                : "Troque a aba acima para ver os outros status."
            }
            compact={filter !== "ALL"}
          />
        )}
      </div>
    </>
  );
}
