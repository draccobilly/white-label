import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPushSettings } from "@/components/admin/AdminPushSettings";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { requireOwnerPage } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import { appUrl } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  await requireOwnerPage();
  const company = await getAdminCompany();
  const lastWebhook = await prisma.webhookEvent.findFirst({
    where: { provider: "stripe" },
    orderBy: { createdAt: "desc" },
    select: { eventType: true, createdAt: true },
  });
  return (
    <div className="dash">
      <AdminPageHeader
        eyebrow="Dono · Workspace"
        title="Settings"
        description="Identidade do site, alertas de venda e o webhook do Stripe desta operação. Chaves e segredos ficam no Vault."
        actions={
          <Link className="secondary-button" href="/admin/vault">
            Abrir Vault
          </Link>
        }
      />
      <AdminCard
        title="Convite Direct-Team"
        action={
          <Link className="primary-button" href="/admin/team">
            Criar link de convite
          </Link>
        }
      >
        <p className="admin-help" style={{ margin: 0 }}>
          Envie um link para o Direct-Team criar e-mail e senha. Ele vê campanhas e
          vendas, sem chaves nem rastreamento.
        </p>
      </AdminCard>
      <AdminCard title="Sale alerts">
        <AdminPushSettings />
      </AdminCard>
      <AdminCard title="Site identity">
        <SettingsForm
          initial={{
            siteName: company.siteName,
            logoUrl: company.logoUrl ?? "",
            impactLogoUrl: company.impactLogoUrl ?? "",
            faviconUrl: company.faviconUrl ?? "",
            primaryColor: company.primaryColor,
            accentColor: company.accentColor,
            footerText: company.footerText,
            legalText: company.legalText,
            siteMode:
              company.siteMode === "INSTITUTIONAL" ? "INSTITUTIONAL" : "CAMPAIGN",
            contactEmail: company.contactEmail ?? "",
            contactPhone: company.contactPhone ?? "",
            contactAddress: company.contactAddress ?? "",
            nonprofitEin: company.nonprofitEin ?? "",
            stripeWebhookSecret: "",
            hasStripeWebhookSecret: Boolean(company.stripeWebhookSecretEnc),
            webhookEndpoint: appUrl("/api/webhooks/stripe"),
            lastWebhook: lastWebhook
              ? {
                  eventType: lastWebhook.eventType,
                  createdAt: lastWebhook.createdAt.toISOString(),
                }
              : null,
          }}
        />
      </AdminCard>
    </div>
  );
}
