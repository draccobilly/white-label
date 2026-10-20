-- Queue status for support and refund requests, ad spend ledger and site checks.
-- Additive only: one new enum, defaulted/nullable columns on two existing tables,
-- two new tables and their indexes. Nothing is dropped, renamed or rewritten.
-- Every statement is idempotent so the file can be applied with
-- `prisma migrate deploy` or pasted into psql on the installation's own database.

DO $$
BEGIN
    CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'ANSWERED', 'RESOLVED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "HelpRequest"
    ADD COLUMN IF NOT EXISTS "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "internalNote" TEXT;

CREATE INDEX IF NOT EXISTS "HelpRequest_companyId_status_idx" ON "HelpRequest"("companyId", "status");

ALTER TABLE "RefundRequest"
    ADD COLUMN IF NOT EXISTS "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "internalNote" TEXT;

CREATE INDEX IF NOT EXISTS "RefundRequest_companyId_status_idx" ON "RefundRequest"("companyId", "status");

CREATE TABLE IF NOT EXISTS "AdSpend" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "campaignId" UUID,
    "affiliateId" UUID,
    "note" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSpend_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdSpend_companyId_day_idx" ON "AdSpend"("companyId", "day");

CREATE INDEX IF NOT EXISTS "AdSpend_companyId_campaignId_day_idx" ON "AdSpend"("companyId", "campaignId", "day");

CREATE TABLE IF NOT EXISTS "SiteCheck" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "target" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "latencyMs" INTEGER NOT NULL,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteCheck_companyId_checkedAt_idx" ON "SiteCheck"("companyId", "checkedAt");
