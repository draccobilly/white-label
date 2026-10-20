import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Stripe from "stripe";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { encryptSecret } from "../lib/crypto";

const siteUrl = (
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");
const ENDPOINT = `${siteUrl}/api/webhooks/stripe`;
const EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payment_intent.succeeded",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
];

function mask(value: string) {
  if (value.length < 12) return "••••";
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}

function upsertEnv(key: string, value: string) {
  const envPath = join(process.cwd(), ".env");
  let text = readFileSync(envPath, "utf8");
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=`, "m").test(text)) {
    text = text.replace(new RegExp(`^${key}=.*$`, "m"), line);
  } else {
    text += `\n${line}\n`;
  }
  writeFileSync(envPath, text);
}

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey?.startsWith("sk_")) {
  throw new Error("STRIPE_SECRET_KEY is missing");
}
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  throw new Error("ENCRYPTION_KEY is missing");
}

const stripe = new Stripe(secretKey);
const existing = await stripe.webhookEndpoints.list({ limit: 100 });
const current = existing.data.find((item) => item.url === ENDPOINT);

let signingSecret = process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")
  && process.env.STRIPE_WEBHOOK_SECRET !== "whsec_xxx"
  ? process.env.STRIPE_WEBHOOK_SECRET
  : "";

if (current) {
  console.log(`Existing endpoint ${current.id} status=${current.status}`);
  await stripe.webhookEndpoints.update(current.id, { enabled_events: EVENTS });
  console.log(`Updated enabled events on ${current.id}`);
  if (!signingSecret) {
    console.log("Stripe does not re-send the signing secret for an existing endpoint.");
    console.log("Create a new secret in Dashboard → Developers → Webhooks → Reveal, or delete this endpoint and re-run.");
    process.exit(2);
  }
} else {
  const created = await stripe.webhookEndpoints.create({
    url: ENDPOINT,
    enabled_events: EVENTS,
    description: `${new URL(ENDPOINT).hostname} public storefront`,
  });
  signingSecret = created.secret ?? "";
  if (!signingSecret) {
    throw new Error("Stripe created the endpoint but did not return a signing secret");
  }
  console.log(`Created endpoint ${created.id}`);
}

upsertEnv("STRIPE_WEBHOOK_SECRET", signingSecret);
console.log(`Saved STRIPE_WEBHOOK_SECRET ${mask(signingSecret)} to .env`);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const enc = encryptSecret(signingSecret, process.env.ENCRYPTION_KEY);
const company = await prisma.company.updateMany({
  where: { isDefault: true },
  data: { stripeWebhookSecretEnc: enc },
});
await prisma.siteSettings.upsert({
  where: { id: "default" },
  update: { stripeWebhookSecretEnc: enc },
  create: {
    id: "default",
    stripeWebhookSecretEnc: enc,
  },
});
console.log(`Stored encrypted signing secret on ${company.count} default company row(s)`);
await prisma.$disconnect();
await pool.end();
