import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { SiteMode } from "../generated/prisma/enums";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function orgName() {
  return process.env.APP_NAME?.trim() || "Giving Site";
}

function orgSlug(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "giving-site";
}

function publicHost() {
  const url =
    process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  try {
    return url ? new URL(url).hostname : "localhost";
  } catch {
    return "localhost";
  }
}

async function main() {
  const name = orgName();
  const slug = orgSlug(name);
  const domain = publicHost();

  await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: { siteName: name },
    create: {
      id: "default",
      siteName: name,
      footerText: "Verified fundraisers. One-time gifts. A receipt you can track.",
    },
  });

  await prisma.affiliate.upsert({
    where: { slug: "direct-team" },
    update: { name: "Direct Team" },
    create: {
      name: "Direct Team",
      slug: "direct-team",
      email: process.env.ADMIN_EMAIL?.trim() || "admin@example.com",
    },
  });

  const company = await prisma.company.upsert({
    where: { slug },
    update: {
      isDefault: true,
      name,
      siteName: name,
      domain,
      siteMode: SiteMode.INSTITUTIONAL,
    },
    create: {
      name,
      slug,
      domain,
      isDefault: true,
      siteMode: SiteMode.INSTITUTIONAL,
      siteName: name,
      landingTitle: name,
      landingBody:
        "This organization publishes verified public fundraisers. Set the legal name, EIN, address, and logo in Admin → Settings.",
      footerText: "Verified fundraisers. One-time gifts. A receipt you can track.",
    },
  });

  await prisma.company.updateMany({
    where: { id: { not: company.id } },
    data: { isDefault: false },
  });

  console.log(`Seeded empty storefront "${name}" (${slug}) on ${domain}.`);
  console.log("Create campaigns in Admin. Do not import another organization's database.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
