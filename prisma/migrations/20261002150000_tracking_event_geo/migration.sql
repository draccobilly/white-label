-- Visitor location on tracking events, for the live globe in the admin.
-- Additive only: five nullable columns and one index on an existing table.
-- Nothing is dropped, renamed or rewritten. Every statement is idempotent so
-- the file can be applied with `prisma migrate deploy` or pasted into psql on
-- the installation's own database. The IP address is never stored.

ALTER TABLE "TrackingEvent"
    ADD COLUMN IF NOT EXISTS "country" CHAR(2),
    ADD COLUMN IF NOT EXISTS "region" TEXT,
    ADD COLUMN IF NOT EXISTS "city" TEXT,
    ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "TrackingEvent_createdAt_idx" ON "TrackingEvent"("createdAt");
