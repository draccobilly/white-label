import "dotenv/config";
import { prisma } from "../lib/prisma";
import { backfillMissingSocialActivity } from "../lib/seed-social-activity";

async function main() {
  console.log("Backfilling conversion social proof for empty campaigns…");
  const results = await backfillMissingSocialActivity();
  console.log(
    JSON.stringify(
      {
        seeded: results.length,
        campaigns: results.map((result) => ({
          slug: result.slug,
          donors: result.donors,
          comments: result.comments,
          replies: result.replies,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
