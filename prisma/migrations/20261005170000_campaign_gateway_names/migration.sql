-- Product names a campaign sends to Stripe, PayPal, and PagNovo, written by a
-- language model from the campaign's own text and reviewed in the admin.
-- The deploy applies this with `prisma db push`.

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "gatewayNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "gatewayNamesHash" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "gatewayNamesSource" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "gatewayNamesAt" TIMESTAMP(3);
