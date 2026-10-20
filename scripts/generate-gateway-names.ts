/**
 * Writes product names for Stripe/PayPal for the campaigns that still send
 * word-matched names: every campaign with no stored list, or whose text moved
 * on after the list was written (hand-typed lists are left alone).
 *
 * Run on the VPS after OPENAI_API_KEY or ANTHROPIC_API_KEY is in .env:
 *   npm run gateway:names                 # campaigns that need names
 *   npm run gateway:names -- --force      # rewrite every campaign's list
 *   npm run gateway:names -- --campaign <id-or-slug>
 *   npm run gateway:names -- --dry        # print what would be written, save nothing
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { syncCampaignGatewayNames } from "../lib/campaign-gateway-names";
import {
  generateGatewayNames,
  gatewayNamesProvider,
} from "../lib/gateway-ai-names";
import { GATEWAY_AI_VOICE } from "../lib/gateway-product-names";

function flag(name: string) {
  return process.argv.includes(`--${name}`);
}

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const provider = gatewayNamesProvider();
  if (!provider) {
    throw new Error("Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env first.");
  }
  const force = flag("force");
  const dry = flag("dry");
  const only = option("campaign");
  console.log(`Provider ${provider.kind}, model ${provider.model}${dry ? " (dry run)" : ""}`);

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: { in: ["ACTIVE", "DRAFT", "PAUSED"] },
      ...(only ? { OR: [{ id: only }, { slug: only }] } : {}),
    },
    select: { id: true, slug: true, title: true, category: true, summary: true, story: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!campaigns.length) {
    console.log("No campaigns matched.");
    return;
  }

  let written = 0;
  for (const campaign of campaigns) {
    const label = `${campaign.slug}  (${campaign.title.slice(0, 60)})`;
    if (dry) {
      try {
        const generated = await generateGatewayNames(campaign, GATEWAY_AI_VOICE);
        console.log(`\n${label}`);
        for (const name of generated.names) console.log(`  - ${name}`);
      } catch (error) {
        console.log(`\n${label}\n  FAILED: ${error instanceof Error ? error.message : error}`);
      }
      continue;
    }
    const result = await syncCampaignGatewayNames(campaign.id, { force });
    switch (result.status) {
      case "generated":
        written += 1;
        console.log(`\n${label}\n  ${result.names.length} names written by ${result.model}`);
        for (const name of result.names) console.log(`  - ${name}`);
        break;
      case "current":
        console.log(`${label}: already current (${result.names.length} names)`);
        break;
      case "kept":
        console.log(`${label}: typed by hand, kept (${result.names.length} names)`);
        break;
      case "failed":
        console.log(`${label}: FAILED ${result.error}`);
        break;
      default:
        console.log(`${label}: ${result.status}`);
    }
  }
  console.log(`\nWrote names for ${written} of ${campaigns.length} campaign(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
