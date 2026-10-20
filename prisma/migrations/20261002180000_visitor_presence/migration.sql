-- Open-tab presence and an optional session id on the checkout intent.
-- Additive only: one new table, one nullable column. Nothing is dropped.

ALTER TABLE "CheckoutIntent"
    ADD COLUMN IF NOT EXISTS "visitorSessionId" TEXT;

CREATE TABLE IF NOT EXISTS "VisitorPresence" (
    "id" UUID NOT NULL,
    "sessionId" TEXT NOT NULL,
    "affiliatePageId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "country" CHAR(2),
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "VisitorPresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VisitorPresence_sessionId_affiliatePageId_key"
    ON "VisitorPresence"("sessionId", "affiliatePageId");

CREATE INDEX IF NOT EXISTS "VisitorPresence_lastSeenAt_idx"
    ON "VisitorPresence"("lastSeenAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'VisitorPresence_affiliatePageId_fkey'
    ) THEN
        ALTER TABLE "VisitorPresence"
            ADD CONSTRAINT "VisitorPresence_affiliatePageId_fkey"
            FOREIGN KEY ("affiliatePageId") REFERENCES "AffiliatePage"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
