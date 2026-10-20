-- Copies of donation acknowledgment letters that were e-mailed.
-- Additive: one new table. No existing table is touched.
-- The deploy applies this with `prisma db push`.

CREATE TABLE IF NOT EXISTS "DonationLetterCopy" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "sourceEventId" UUID,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "pdf" BYTEA NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationLetterCopy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DonationLetterCopy_sourceEventId_key" ON "DonationLetterCopy"("sourceEventId");

CREATE INDEX IF NOT EXISTS "DonationLetterCopy_companyId_sentAt_idx" ON "DonationLetterCopy"("companyId", "sentAt");

CREATE INDEX IF NOT EXISTS "DonationLetterCopy_saleId_sentAt_idx" ON "DonationLetterCopy"("saleId", "sentAt");
