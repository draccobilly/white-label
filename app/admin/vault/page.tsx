import { AdminChip } from "@/components/admin/AdminChip";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { VaultManager } from "@/components/admin/VaultManager";
import { requireOwnerPage } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { serializeVaultItem, vaultSummarySelect } from "@/lib/vault";
import { isVaultUnlocked, vaultLockReason } from "@/lib/vault-crypto";

export default async function AdminVaultPage() {
  await requireOwnerPage();
  const unlocked = isVaultUnlocked();
  const lockReason = vaultLockReason();
  // The listing only reads masked columns; values are decrypted on demand
  // through /api/admin/vault/[id]/reveal.
  const items = await prisma.adminVaultItem.findMany({
    select: vaultSummarySelect,
    orderBy: [{ category: "asc" }, { label: "asc" }],
  });

  return (
    <>
      <AdminPageHeader
        eyebrow="Dono · Privado"
        title="Vault"
        description="Credenciais desta operação, gravadas cifradas no banco desta instalação. Cada item exige uma categoria para a lista não virar um bolo só. Revelar é sempre uma ação explícita."
        badges={
          unlocked ? (
            <AdminChip tone="success">Destrancado</AdminChip>
          ) : (
            <AdminChip tone="warning">Trancado</AdminChip>
          )
        }
      />
      <VaultManager
        initialItems={items.map(serializeVaultItem)}
        unlocked={unlocked}
        lockReason={lockReason}
      />
    </>
  );
}
