import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { restoreStripeHostedConfirmation } from "@/lib/stripe-payment-links";

async function main() {
  const links = await prisma.paymentLink.findMany({
    where: {
      active: true,
      stripePaymentLinkId: { not: null },
    },
    select: {
      stripePaymentLinkId: true,
    },
  });

  const configured = new Set<string>();
  for (const link of links) {
    const stripePaymentLinkId = link.stripePaymentLinkId;
    if (!stripePaymentLinkId || configured.has(stripePaymentLinkId)) continue;
    await restoreStripeHostedConfirmation(stripePaymentLinkId);
    configured.add(stripePaymentLinkId);
  }

  console.log(
    `Restored Stripe hosted confirmation for ${configured.size} Payment Links.`,
  );
}

main()
  .catch((error) => {
    console.error("Could not restore Stripe hosted confirmation", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
