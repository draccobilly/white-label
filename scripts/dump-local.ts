import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const data = {
  dumpedAt: new Date().toISOString(),
  companies: await prisma.company.findMany(),
  affiliates: await prisma.affiliate.findMany(),
  campaigns: await prisma.campaign.findMany(),
  options: await prisma.donationOption.findMany(),
  pages: await prisma.affiliatePage.findMany(),
  paymentLinks: await prisma.paymentLink.findMany(),
};

writeFileSync(".local-db-backup.json", JSON.stringify(data, null, 2));
console.log(`Backed up ${data.campaigns.length} campaigns`);
await prisma.$disconnect();
