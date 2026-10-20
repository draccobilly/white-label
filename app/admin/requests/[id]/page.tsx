import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminChip } from "@/components/admin/AdminChip";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { RequestStatusControl } from "@/components/admin/RequestStatusControl";
import { requireOwnerPage } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { formatMoneyExact } from "@/lib/utils";
import {
  isMissingColumnError,
  requestStatusLabel,
  requestStatusTone,
} from "@/lib/request-status";

function whatsappHref(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export default async function AdminHelpRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireOwnerPage();
  const company = await getAdminCompany();
  // Before the status migration runs the columns do not exist; read without them.
  const loaded = await prisma.helpRequest
    .findFirst({ where: { id, companyId: company.id } })
    .then((row) => ({ row, statusReady: true }))
    .catch(async (error: unknown) => {
      if (!isMissingColumnError(error)) throw error;
      const row = await prisma.helpRequest.findFirst({
        where: { id, companyId: company.id },
        omit: { status: true, statusChangedAt: true, internalNote: true },
      });
      return {
        row: row ? { ...row, status: "OPEN" as const, statusChangedAt: null, internalNote: null } : null,
        statusReady: false,
      };
    });
  const request = loaded.row;
  if (!request) {
    const elsewhere = await prisma.helpRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (elsewhere) redirect("/admin/requests?notice=desk-switch");
    notFound();
  }

  const chat = whatsappHref(request.whatsapp);
  const received = request.createdAt.toLocaleString("en-US");

  return (
    <>
      <AdminPageHeader
        eyebrow="Suporte · Fundraiser request"
        title={request.name}
        description={`Received ${received}`}
        badges={
          <>
            {loaded.statusReady ? (
              <AdminChip tone={requestStatusTone(request.status)}>
                {requestStatusLabel(request.status)}
              </AdminChip>
            ) : null}
            <AdminChip tone={request.about === "myself" ? "info" : "neutral"}>
              {request.about === "myself" ? "Own case" : "Someone they know"}
            </AdminChip>
          </>
        }
        actions={
          <>
            <Link className="primary-button" href={`/admin/campaigns/new?request=${request.id}`}>
              Create campaign
            </Link>
            <a className="secondary-button" href={`mailto:${request.email}`}>
              Responder por e-mail
            </a>
            {chat ? (
              <a className="secondary-button" href={chat} target="_blank" rel="noreferrer">
                Abrir WhatsApp
              </a>
            ) : null}
            <Link className="secondary-button" href="/admin/requests">
              Voltar
            </Link>
          </>
        }
      />
      {loaded.statusReady ? (
        <AdminCard>
          <RequestStatusControl
            kind="requests"
            id={request.id}
            status={request.status}
            internalNote={request.internalNote}
            statusChangedAt={request.statusChangedAt?.toISOString() ?? null}
          />
        </AdminCard>
      ) : null}
      <AdminCard>
        <dl className="admin-meta-grid">
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${request.email}`}>{request.email}</a>
            </dd>
          </div>
          <div>
            <dt>WhatsApp</dt>
            <dd>
              {chat ? (
                <a href={chat} target="_blank" rel="noreferrer">
                  {request.whatsapp}
                </a>
              ) : (
                request.whatsapp
              )}
            </dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{request.address}</dd>
          </div>
          <div>
            <dt>Portal account</dt>
            <dd>
              {request.organizerId ? (
                <Link href="/admin/organizers">Linked · manage campaigns</Link>
              ) : (
                "No account (sent before the portal existed)"
              )}
            </dd>
          </div>
          <div>
            <dt>LGPD consent</dt>
            <dd>
              Data {request.consentData ? "yes" : "no"} · Media{" "}
              {request.consentImage ? "yes" : "no"} · Terms{" "}
              {request.consentTerms ? "yes" : "no"}
            </dd>
          </div>
          <div>
            <dt>Raised / Doado</dt>
            <dd>
              {formatMoneyExact(request.priorRaisedCents, request.priorRaisedCurrency)}
            </dd>
          </div>
          <div>
            <dt>Donations</dt>
            <dd>{request.priorDonationCount.toLocaleString("en-US")}</dd>
          </div>
        </dl>
        <p className="admin-help">
          Entered on Start a fundraiser so donors can see what was already raised. New gifts still add on top. Create campaign copies these into Raised / Doado and Donations.
        </p>
        <div className="admin-detail-section">
          <h3>Story</h3>
          <p className="admin-detail-text">{request.story}</p>
        </div>
        <div className="admin-detail-section">
          <h3>Photos and video</h3>
          {request.mediaUrls.length ? (
            <ul className="admin-detail-links">
              {request.mediaUrls.map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    <FileText size={14} aria-hidden style={{ verticalAlign: "-2px", marginRight: 6 }} />
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-help">No files attached.</p>
          )}
        </div>
      </AdminCard>
    </>
  );
}
