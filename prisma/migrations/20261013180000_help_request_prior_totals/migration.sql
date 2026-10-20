-- Prior totals a fundraiser organizer already collected before opening the campaign here.
-- The deploy applies this with `prisma db push`.

ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "priorRaisedCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "priorDonationCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "priorRaisedCurrency" CHAR(3) NOT NULL DEFAULT 'USD';
