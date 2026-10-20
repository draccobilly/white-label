import "dotenv/config";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
  const links = await prisma.paymentLink.findMany({
    where: { active: true },
    include: { donationOption: true },
  });
  for (const link of links.sort((a, b) => a.donationOption.amount - b.donationOption.amount)) {
    if (!link.stripePaymentLinkId) continue;
    const items = await stripe.paymentLinks.listLineItems(link.stripePaymentLinkId, {
      limit: 1,
      expand: ["data.price"],
    });
    const price = items.data[0]?.price;
    const unit = typeof price === "object" && price ? price.unit_amount : null;
    const ok = unit === link.donationOption.amount ? "OK" : "MISMATCH";
    console.log(
      `${ok} ticket=$${(link.donationOption.amount / 100).toFixed(0)} stripe=$${((unit ?? 0) / 100).toFixed(0)} ${link.url}`,
    );
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
