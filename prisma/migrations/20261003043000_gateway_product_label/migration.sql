-- Product name sent to Stripe, PayPal, and PagNovo.
-- The campaign title stays the name of the sale.
-- The deploy applies this with `prisma db push`.

ALTER TABLE "CheckoutIntent" ADD COLUMN IF NOT EXISTS "gatewayLabel" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "gatewayLabel" TEXT;
