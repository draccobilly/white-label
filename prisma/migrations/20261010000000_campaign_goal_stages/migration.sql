-- Goal ladder per campaign, set in the admin: stage 1 first, cents. The public
-- page shows only the open stage and opens the next one on its own.
-- The deploy applies this with `prisma db push`.

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "goalStages" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
