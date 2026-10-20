import "dotenv/config";
import { prisma } from "../lib/prisma";
import { seedCampaignSocialActivity } from "../lib/seed-social-activity";

console.log("Seeding social-proof comments…");

async function main() {
  const onlySlug = process.argv[2]?.trim();
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: { in: ["ACTIVE", "COMPLETED"] },
      ...(onlySlug ? { slug: onlySlug } : {}),
    },
    select: { id: true, slug: true },
    orderBy: { slug: "asc" },
  });
  if (onlySlug && !campaigns.length) {
    throw new Error(`No ACTIVE/COMPLETED campaign with slug "${onlySlug}"`);
  }
  const results = [];
  for (const campaign of campaigns) {
    console.log(`Seeding ${campaign.slug}…`);
    const result = await seedCampaignSocialActivity(campaign.id, {
      replace: true,
    });
    console.log(
      `  ${result.donors} donors, ${result.comments} comments, ${result.replies} replies`,
    );
    results.push(result);
  }
  console.log(JSON.stringify({ campaigns: results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
