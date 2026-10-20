-- Owner-only vault for operation credentials.
-- Additive: creates one table and its indexes. No existing table is touched.
-- Apply manually (psql) or with `prisma migrate deploy` / `prisma db push` on
-- the installation's own database. Values are encrypted at the application
-- layer with VAULT_ENCRYPTION_KEY before they reach this table.

CREATE TABLE IF NOT EXISTS "AdminVaultItem" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueEnc" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "notes" TEXT,
    "createdByEmail" TEXT,
    "lastRevealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminVaultItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminVaultItem_category_label_idx" ON "AdminVaultItem"("category", "label");

CREATE INDEX IF NOT EXISTS "AdminVaultItem_createdAt_idx" ON "AdminVaultItem"("createdAt");
