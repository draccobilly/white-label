import { requireOwnerPage } from "@/lib/admin-access";
import { AdminChip } from "@/components/admin/AdminChip";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  CompaniesBoard,
  type CompanyCardData,
} from "@/components/admin/CompaniesBoard";
import { normalizeCampaignLayout } from "@/lib/campaign-layout";
import { getAdminCompany, listCompanies } from "@/lib/company";
import { companyPublicPrefix } from "@/lib/public-site-url";

export default async function CompaniesPage() {
  await requireOwnerPage();
  const [companies, current] = await Promise.all([
    listCompanies(),
    getAdminCompany(),
  ]);
  const cards: CompanyCardData[] = companies.map((company) => ({
    id: company.id,
    name: company.name,
    domain: company.domain ?? "",
    publicPathPrefix: companyPublicPrefix(company),
    landingTitle: company.landingTitle,
    landingBody: company.landingBody,
    locale:
      company.locale === "es-AR"
        ? "es-AR"
        : company.locale === "es-MX"
          ? "es-MX"
          : "en",
    paymentGateway: company.paymentGateway === "PAGNOVO" ? "PAGNOVO" : "STRIPE",
    siteMode: company.siteMode === "INSTITUTIONAL" ? "INSTITUTIONAL" : "CAMPAIGN",
    contactEmail: company.contactEmail ?? "",
    contactPhone: company.contactPhone ?? "",
    contactAddress: company.contactAddress ?? "",
    hasPagnovoWebhookSecret: Boolean(company.pagnovoWebhookSecretEnc),
    campaignLayout: normalizeCampaignLayout(company.campaignLayout),
    impactLogoUrl: company.impactLogoUrl,
    nonprofitListed: company.nonprofitListed,
    nonprofitName: company.nonprofitName ?? "",
    nonprofitDescription: company.nonprofitDescription ?? "",
    nonprofitLogoUrl: company.nonprofitLogoUrl ?? "",
    isDefault: company.isDefault,
    isActive: company.id === current.id,
  }));

  return (
    <>
      <AdminPageHeader
        eyebrow="Dono · Matriz"
        title="Empresas"
        description="Cada desk tem campanhas, vendas e identidade próprias. A empresa ativa é a que o painel mostra agora."
        badges={<AdminChip>{cards.length} {cards.length === 1 ? "desk" : "desks"}</AdminChip>}
      />
      <CompaniesBoard companies={cards} />
    </>
  );
}
