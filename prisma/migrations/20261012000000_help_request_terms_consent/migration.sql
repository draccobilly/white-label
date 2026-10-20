-- A fundraiser request records that the sender accepted the fundraiser terms.
-- The deploy applies this with `prisma db push`.

ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "consentTerms" BOOLEAN NOT NULL DEFAULT false;
