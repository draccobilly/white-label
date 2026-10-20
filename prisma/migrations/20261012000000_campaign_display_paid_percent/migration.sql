-- Percent of paid gifts shown on top of the baseline, per campaign.
-- 1 = 1%. The deploy applies this with `prisma db push`.

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "displayPaidPercent" INTEGER NOT NULL DEFAULT 1;
