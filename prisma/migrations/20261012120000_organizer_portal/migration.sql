-- Organizer portal: accounts created from Start a fundraiser, campaign
-- ownership, and payout requests. Deploys run `prisma db push`; this file
-- documents the same change for a database that applies migrations by hand.

DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Organizer" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "whatsapp" TEXT,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organizer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Organizer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organizer_companyId_email_key" ON "Organizer"("companyId", "email");

ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "organizerId" UUID;
ALTER TABLE "HelpRequest" DROP CONSTRAINT IF EXISTS "HelpRequest_organizerId_fkey";
ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "HelpRequest_organizerId_idx" ON "HelpRequest"("organizerId");

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "organizerId" UUID;
ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_organizerId_fkey";
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Campaign_organizerId_idx" ON "Campaign"("organizerId");

CREATE TABLE IF NOT EXISTS "PayoutRequest" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "organizerId" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "accountHolderName" TEXT NOT NULL,
  "holderAddress" TEXT NOT NULL,
  "holderCountry" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "bankCountry" TEXT NOT NULL,
  "bankAddress" TEXT,
  "accountNumber" TEXT NOT NULL,
  "accountType" TEXT,
  "routingNumber" TEXT,
  "swiftBic" TEXT,
  "intermediaryBank" TEXT,
  "notes" TEXT,
  "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "internalNote" TEXT,
  "statusChangedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayoutRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PayoutRequest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PayoutRequest_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PayoutRequest_companyId_status_createdAt_idx" ON "PayoutRequest"("companyId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "PayoutRequest_campaignId_createdAt_idx" ON "PayoutRequest"("campaignId", "createdAt");
CREATE INDEX IF NOT EXISTS "PayoutRequest_organizerId_createdAt_idx" ON "PayoutRequest"("organizerId", "createdAt");
