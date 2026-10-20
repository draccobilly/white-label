import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  throw new Error(
    "Meta CAPI is disabled. Conversions go to Utmify only; do not backfill Facebook Purchases.",
  );
}

main()
  .catch((error) => {
    console.error("Could not backfill Stripe Meta CAPI", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
