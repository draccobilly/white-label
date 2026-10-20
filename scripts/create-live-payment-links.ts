import "dotenv/config";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { restoreStripeHostedConfirmation } from "@/lib/stripe-payment-links";

const AMOUNTS_CENTS = [
  2500, 5000, 6000, 7000, 8000, 9000, 10000, 12000, 15000, 16000, 18000, 20000,
] as const;

const GIFT_BY_CENTS: Record<number, { id: string; name: string }> = {
  2500: { id: "gift-25", name: "Gift $25" },
  5000: { id: "gift-50", name: "Gift $50" },
  6000: { id: "gift-60", name: "Gift $60" },
  7000: { id: "gift-70", name: "Gift $70" },
  8000: { id: "gift-80", name: "Gift $80" },
  9000: { id: "gift-90", name: "Gift $90" },
  10000: { id: "gift-100", name: "Gift $100" },
  12000: { id: "gift-120", name: "Gift $120" },
  15000: { id: "gift-150", name: "Gift $150" },
  16000: { id: "gift-160", name: "Gift $160" },
  18000: { id: "gift-180", name: "Gift $180" },
  20000: { id: "gift-200", name: "Gift $200" },
};

function dollars(cents: number) {
  return `$${cents / 100}`;
}

async function findOrCreatePrice(stripe: Stripe, cents: number) {
  const gift = GIFT_BY_CENTS[cents];
  if (!gift) throw new Error(`No gift mapped for ${cents}`);

  const existing = await stripe.prices.search({
    query: `active:'true' AND metadata['gift_amount_cents']:'${cents}'`,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0];

  const product = await stripe.products.create({
    name: "Web Support",
    metadata: {
      gift_plan_id: gift.id,
      gift_amount_cents: String(cents),
    },
  });
  return stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: cents,
    metadata: {
      gift_plan_id: gift.id,
      gift_amount_cents: String(cents),
    },
  });
}

async function findOrCreatePaymentLink(stripe: Stripe, priceId: string, cents: number) {
  let startingAfter: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const list = await stripe.paymentLinks.list({
      limit: 100,
      starting_after: startingAfter,
      active: true,
    });
    for (const link of list.data) {
      if (link.metadata?.gift_amount_cents === String(cents)) return link;
    }
    if (!list.has_more || list.data.length === 0) break;
    startingAfter = list.data.at(-1)?.id;
  }

  return stripe.paymentLinks.create({
    line_items: [{ price: priceId, quantity: 1 }],
    after_completion: { type: "hosted_confirmation" },
    metadata: {
      gift_amount_cents: String(cents),
      gift_plan_id: GIFT_BY_CENTS[cents]?.id ?? "",
    },
  });
}

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  if (!secret.startsWith("sk_live_")) {
    throw new Error(
      "STRIPE_SECRET_KEY must be sk_live_ to create production Payment Links. The current .env is still test mode.",
    );
  }

  const stripe = new Stripe(secret);
  const created: Array<{
    cents: number;
    url: string;
    plink: string;
    planId: string;
  }> = [];

  for (const cents of AMOUNTS_CENTS) {
    const price = await findOrCreatePrice(stripe, cents);
    const link = await findOrCreatePaymentLink(stripe, price.id, cents);
    await restoreStripeHostedConfirmation(link.id);
    created.push({
      cents,
      url: link.url,
      plink: link.id,
      planId: GIFT_BY_CENTS[cents]?.id ?? "",
    });
    console.log(`${dollars(cents)}\t${link.id}\t${link.url}`);
  }

  const pages = await prisma.paymentLink.findMany({
    where: { active: true },
    include: { donationOption: true, affiliatePage: true },
  });
  let updated = 0;
  for (const row of pages) {
    const match = created.find((item) => item.cents === row.donationOption.amount);
    if (!match) continue;
    await prisma.paymentLink.update({
      where: { id: row.id },
      data: {
        url: match.url,
        stripeCheckoutUrl: match.url,
        stripePaymentLinkId: match.plink,
        active: true,
      },
    });
    updated += 1;
  }

  console.log(`\nUpdated ${updated} campaign PaymentLink row(s).`);
  console.log("\nPayment Link URLs:");
  for (const item of created) {
    console.log(`  ${item.planId}: ${item.url}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
