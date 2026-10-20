import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PayoutStatusControl, payoutStatusLabelPt } from "@/components/admin/PayoutStatusControl";
import { requireOwnerPage } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import { payoutAvailability } from "@/lib/organizer-portal";
import { prisma } from "@/lib/prisma";
import { formatMoneyExact } from "@/lib/utils";

const TABS = [
  { id: "PENDING", label: "Em análise" },
  { id: "APPROVED", label: "Aprovados" },
  { id: "PAID", label: "Pagos" },
  { id: "REJECTED", label: "Recusados" },
  { id: "ALL", label: "Todos" },
] as const;

type Filter = (typeof TABS)[number]["id"];

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireOwnerPage();
  const company = await getAdminCompany();
  const { status } = await searchParams;
  const filter: Filter = TABS.find((tab) => tab.id === status)?.id ?? "PENDING";
  const payouts = await prisma.payoutRequest.findMany({
    where: { companyId: company.id, ...(filter === "ALL" ? {} : { status: filter }) },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { id: true, title: true, currency: true } },
      organizer: { select: { id: true, name: true, email: true, whatsapp: true } },
    },
  });
  const availability = new Map<string, Awaited<ReturnType<typeof payoutAvailability>>>();
  for (const payout of payouts) {
    if (!availability.has(payout.campaignId)) {
      availability.set(payout.campaignId, await payoutAvailability(payout.campaignId));
    }
  }
  const pendingCount =
    filter === "PENDING"
      ? payouts.length
      : await prisma.payoutRequest.count({ where: { companyId: company.id, status: "PENDING" } });

  return (
    <>
      <AdminPageHeader
        eyebrow="Suporte · Portal do organizador"
        title="Saques"
        description="Pedidos de transferência enviados pelos organizadores em /portal. Confira o titular contra o beneficiário do caso e os Termos antes de aprovar; o pagamento em si é feito no banco."
        badges={pendingCount ? <span className="portal-chip is-pending">{pendingCount} em análise</span> : null}
        actions={
          <Link className="secondary-button" href="/admin/organizers">
            Organizadores
          </Link>
        }
      />
      <div className="dash-seg admin-queue-tabs" role="group" aria-label="Filtrar por status">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === "PENDING" ? "/admin/payouts" : `/admin/payouts?status=${tab.id}`}
            className={filter === tab.id ? "is-active" : undefined}
            aria-current={filter === tab.id ? "true" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {payouts.length ? (
        payouts.map((payout) => {
          const avail = availability.get(payout.campaignId);
          return (
            <AdminCard
              key={payout.id}
              title={`${formatMoneyExact(payout.amount, payout.currency)} · ${payout.campaign.title}`}
              action={<span className={`portal-chip is-${payout.status.toLowerCase()}`}>{payoutStatusLabelPt(payout.status)}</span>}
            >
              <p className="admin-help">
                Pedido em {payout.createdAt.toLocaleString("pt-BR")} por {payout.organizer.name} (
                <a href={`mailto:${payout.organizer.email}`}>{payout.organizer.email}</a>
                {payout.organizer.whatsapp ? ` · ${payout.organizer.whatsapp}` : ""}).
                {avail
                  ? ` Doações verificadas ${formatMoneyExact(avail.raised, payout.currency)} · disponível agora ${formatMoneyExact(avail.available, payout.currency)}.`
                  : ""}
              </p>
              <dl className="admin-meta-grid">
                <div>
                  <dt>Titular</dt>
                  <dd>{payout.accountHolderName}</dd>
                </div>
                <div>
                  <dt>Endereço do titular</dt>
                  <dd style={{ whiteSpace: "pre-wrap" }}>{payout.holderAddress}</dd>
                </div>
                <div>
                  <dt>País do titular</dt>
                  <dd>{payout.holderCountry}</dd>
                </div>
                <div>
                  <dt>Banco</dt>
                  <dd>
                    {payout.bankName} · {payout.bankCountry}
                  </dd>
                </div>
                <div>
                  <dt>Endereço do banco</dt>
                  <dd style={{ whiteSpace: "pre-wrap" }}>{payout.bankAddress || "—"}</dd>
                </div>
                <div>
                  <dt>Conta / IBAN</dt>
                  <dd>
                    <code>{payout.accountNumber}</code>
                    {payout.accountType ? ` · ${payout.accountType}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Routing / agência</dt>
                  <dd>{payout.routingNumber || "—"}</dd>
                </div>
                <div>
                  <dt>SWIFT / BIC</dt>
                  <dd>{payout.swiftBic || "—"}</dd>
                </div>
                <div>
                  <dt>Banco intermediário</dt>
                  <dd style={{ whiteSpace: "pre-wrap" }}>{payout.intermediaryBank || "—"}</dd>
                </div>
                <div>
                  <dt>Notas do organizador</dt>
                  <dd style={{ whiteSpace: "pre-wrap" }}>{payout.notes || "—"}</dd>
                </div>
              </dl>
              <PayoutStatusControl id={payout.id} status={payout.status} internalNote={payout.internalNote} />
            </AdminCard>
          );
        })
      ) : (
        <AdminCard>
          <p className="admin-help">Nenhum saque {filter === "ALL" ? "ainda" : "neste status"}.</p>
        </AdminCard>
      )}
    </>
  );
}
