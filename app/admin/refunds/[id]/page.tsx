import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Info } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminChip } from "@/components/admin/AdminChip";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CopyValueButton } from "@/components/admin/CopyValueButton";
import { RequestStatusControl } from "@/components/admin/RequestStatusControl";
import { refundReasonLabel, type RefundReason } from "@/lib/refund-reasons";
import { requireOwnerPage } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import { formatMoney } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import {
  isMissingColumnError,
  requestStatusLabel,
  requestStatusTone,
} from "@/lib/request-status";

export default async function AdminRefundRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireOwnerPage();
  const company = await getAdminCompany();
  const saleSelect = {
    sale: {
      select: {
        id: true,
        amount: true,
        currency: true,
        trackingCode: true,
        stripePaymentIntentId: true,
        paypalCaptureId: true,
        paidAt: true,
        campaign: { select: { title: true } },
      },
    },
  } as const;
  // Before the status migration runs the columns do not exist; read without them.
  const loaded = await prisma.refundRequest
    .findFirst({ where: { id, companyId: company.id }, include: saleSelect })
    .then((row) => ({ row, statusReady: true }))
    .catch(async (error: unknown) => {
      if (!isMissingColumnError(error)) throw error;
      const row = await prisma.refundRequest.findFirst({
        where: { id, companyId: company.id },
        include: saleSelect,
        omit: { status: true, statusChangedAt: true, internalNote: true },
      });
      return {
        row: row ? { ...row, status: "OPEN" as const, statusChangedAt: null, internalNote: null } : null,
        statusReady: false,
      };
    });
  const request = loaded.row;
  if (!request) {
    const elsewhere = await prisma.refundRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (elsewhere) redirect("/admin/refunds?notice=desk-switch");
    notFound();
  }

  const received = request.createdAt.toLocaleString("en-US");

  return (
    <>
      <AdminPageHeader
        eyebrow="Suporte · Refund request"
        title={request.name || request.email}
        description={`${refundReasonLabel(request.reason as RefundReason)} · received ${received}`}
        badges={
          <>
            {loaded.statusReady ? (
              <AdminChip tone={requestStatusTone(request.status)}>
                {requestStatusLabel(request.status)}
              </AdminChip>
            ) : null}
            <AdminChip tone={request.sale ? "success" : "warning"}>
              {request.sale ? "Doação localizada" : "Sem correspondência"}
            </AdminChip>
          </>
        }
        actions={
          <>
            <a className="primary-button" href={`mailto:${request.email}`}>
              Responder por e-mail
            </a>
            <Link className="secondary-button" href="/admin/refunds">
              Voltar
            </Link>
          </>
        }
      />
      {loaded.statusReady ? (
        <AdminCard>
          <RequestStatusControl
            kind="refunds"
            id={request.id}
            status={request.status}
            internalNote={request.internalNote}
            statusChangedAt={request.statusChangedAt?.toISOString() ?? null}
          />
        </AdminCard>
      ) : null}
      <AdminCard title="Pedido">
        <dl className="admin-meta-grid">
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${request.email}`}>{request.email}</a>
            </dd>
          </div>
          <div>
            <dt>Tracking code</dt>
            <dd>{request.trackingCode || "Not provided"}</dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{refundReasonLabel(request.reason as RefundReason)}</dd>
          </div>
          <div>
            <dt>Amount note</dt>
            <dd>{request.amountNote || "—"}</dd>
          </div>
        </dl>
        <div className="admin-detail-section">
          <h3>What happened</h3>
          <p className="admin-detail-text">{request.details}</p>
        </div>
      </AdminCard>
      <AdminCard title="Doação correspondente">
        {request.sale ? (
          <>
            <dl className="admin-meta-grid">
              <div>
                <dt>Campaign</dt>
                <dd>{request.sale.campaign.title}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{formatMoney(request.sale.amount, request.sale.currency)}</dd>
              </div>
              <div>
                <dt>Paid at</dt>
                <dd>{request.sale.paidAt ? request.sale.paidAt.toLocaleString("en-US") : "—"}</dd>
              </div>
              <div>
                <dt>Sale tracking code</dt>
                <dd>{request.sale.trackingCode || "—"}</dd>
              </div>
              <div>
                <dt>Stripe payment intent</dt>
                <dd>
                  {request.sale.stripePaymentIntentId ? (
                    <span className="admin-inline-actions">
                      <code>{request.sale.stripePaymentIntentId}</code>
                      <CopyValueButton value={request.sale.stripePaymentIntentId} label="Copy id" />
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>PayPal capture</dt>
                <dd>
                  {request.sale.paypalCaptureId ? (
                    <span className="admin-inline-actions">
                      <code>{request.sale.paypalCaptureId}</code>
                      <CopyValueButton value={request.sale.paypalCaptureId} label="Copy id" />
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
            <p className="admin-note">
              <Info size={16} aria-hidden />
              <span>
                The refund itself is executed in Stripe or PayPal with the id above. This panel
                only records the request and does not change the sale.
              </span>
            </p>
          </>
        ) : (
          <p className="admin-note is-warning">
            <Info size={16} aria-hidden />
            <span>
              Not matched automatically — look up the donor by email or amount in{" "}
              <Link href="/admin/sales">Donations</Link> before replying.
            </span>
          </p>
        )}
      </AdminCard>
    </>
  );
}
