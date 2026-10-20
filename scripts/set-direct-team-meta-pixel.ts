import "dotenv/config";
import { prisma } from "../lib/prisma";
import { sanitizeMetaPixelId } from "../lib/validators";

async function main() {
  const pixelId = sanitizeMetaPixelId(process.argv[2] || process.env.META_PIXEL_ID);
  if (!pixelId) {
    throw new Error(
      "Pass the numeric Events Manager Pixel ID: npx tsx scripts/set-direct-team-meta-pixel.ts 848018481127732",
    );
  }
  const affiliate = await prisma.affiliate.findFirst({
    where: { slug: "direct-team" },
    select: { id: true, name: true },
  });
  if (!affiliate) {
    throw new Error("Affiliate slug direct-team was not found");
  }
  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: { defaultFbPixelId: pixelId },
  });
  const pages = await prisma.affiliatePage.updateMany({
    where: { affiliateId: affiliate.id, fbPixelId: null },
    data: { fbPixelId: pixelId },
  });
  console.log(
    `Saved Meta Pixel ${pixelId} on ${affiliate.name}; filled ${pages.count} empty campaign pages.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
