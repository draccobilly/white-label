import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { OrganizerCampaignLinks } from "@/components/admin/OrganizerCampaignLinks";
import { requireOwnerPage } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export default async function AdminOrganizersPage() {
  await requireOwnerPage();
  const company = await getAdminCompany();
  const [organizers, campaigns] = await Promise.all([
    prisma.organizer.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      include: {
        campaigns: { select: { id: true, title: true }, orderBy: { createdAt: "desc" } },
        helpRequests: { select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" } },
        _count: { select: { payoutRequests: true } },
      },
    }),
    prisma.campaign.findMany({
      where: { companyId: company.id },
      select: { id: true, title: true, organizerId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Suporte · Portal do organizador"
        title="Organizadores"
        description="Contas criadas em Start a fundraiser. Vincule a campanha publicada para a pessoa acompanhar doações, publicar novidades, editar a página e pedir saques em /portal."
        actions={
          <>
            <Link className="secondary-button" href="/admin/payouts">
              Saques
            </Link>
            <Link className="secondary-button" href="/admin/requests">
              Pedidos
            </Link>
          </>
        }
      />
      {organizers.length ? (
        organizers.map((organizer) => (
          <AdminCard key={organizer.id} title={organizer.name}>
            <dl className="admin-meta-grid">
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${organizer.email}`}>{organizer.email}</a>
                </dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>{organizer.whatsapp || "—"}</dd>
              </div>
              <div>
                <dt>Conta criada</dt>
                <dd>{organizer.createdAt.toLocaleString("pt-BR")}</dd>
              </div>
              <div>
                <dt>Último acesso</dt>
                <dd>{organizer.lastLoginAt ? organizer.lastLoginAt.toLocaleString("pt-BR") : "—"}</dd>
              </div>
              <div>
                <dt>Pedidos enviados</dt>
                <dd>
                  {organizer.helpRequests.length ? (
                    organizer.helpRequests.map((request, index) => (
                      <span key={request.id}>
                        {index ? " · " : ""}
                        <Link href={`/admin/requests/${request.id}`}>
                          {request.createdAt.toLocaleDateString("pt-BR")}
                        </Link>
                      </span>
                    ))
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Saques</dt>
                <dd>{organizer._count.payoutRequests}</dd>
              </div>
            </dl>
            <div className="admin-detail-section">
              <h3>Campanhas no portal</h3>
              <OrganizerCampaignLinks organizerId={organizer.id} linked={organizer.campaigns} options={campaigns} />
            </div>
          </AdminCard>
        ))
      ) : (
        <AdminCard>
          <p className="admin-help">
            Nenhuma conta ainda. Quando alguém enviar um caso em /start-a-fundraiser com uma senha, a conta
            aparece aqui.
          </p>
        </AdminCard>
      )}
    </>
  );
}
