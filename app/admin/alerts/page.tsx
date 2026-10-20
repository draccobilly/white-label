import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPushSettings } from "@/components/admin/AdminPushSettings";
import { currentAdminAccess } from "@/lib/admin-access";

export default async function AlertsPage() {
  const { isOwner } = await currentAdminAccess();
  return (
    <div className="dash">
      <AdminPageHeader
        eyebrow="Operação"
        title="Alertas"
        description={
          isOwner
            ? "Ligue os alertas de venda neste celular. Cada doação paga pode avisar este aparelho."
            : "Ligue os alertas neste celular. Você recebe um aviso quando uma venda sua é paga."
        }
      />
      <AdminCard title="Alertas de venda">
        <AdminPushSettings />
      </AdminCard>
    </div>
  );
}
