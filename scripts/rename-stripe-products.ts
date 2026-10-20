import "dotenv/config";
import Stripe from "stripe";

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  if (!secret.startsWith("sk_")) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }
  const stripe = new Stripe(secret);
  let updated = 0;
  let startingAfter: string | undefined;

  for (let page = 0; page < 30; page += 1) {
    const list = await stripe.products.list({
      limit: 100,
      active: true,
      starting_after: startingAfter,
    });
    for (const product of list.data) {
      const match =
        product.name.startsWith("Giving Site") ||
        Boolean(product.metadata?.lions_amount_cents);
      if (!match) continue;
      await stripe.products.update(product.id, {
        name: "Web Support",
        description: "",
      });
      updated += 1;
      console.log(`${product.id}  ${product.name} -> Web Support`);
    }
    if (!list.has_more || list.data.length === 0) break;
    startingAfter = list.data.at(-1)?.id;
  }

  console.log(`Renamed ${updated} Stripe products to Web Support.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
