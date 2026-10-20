import { z } from "zod";
import { publicAbsoluteUrl } from "@/lib/public-site-url";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  CRON_SECRET: z.string().min(16),
  ADMIN_EMAIL: z.string().email(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PAGNOVO_SECRET_KEY: z.string().min(8).optional(),
  PAGNOVO_WEBHOOK_SECRET: z.string().min(8).optional(),
  PAGNOVO_RESPONSIBLE_DOCUMENT: z.string().min(11).optional(),
  PAGNOVO_RESPONSIBLE_EXTERNAL_ID: z.string().min(1).optional(),
  PAGNOVO_PAYER_CPF: z.string().min(11).optional(),
  PAGNOVO_PAYER_PHONE: z.string().min(8).optional(),
  PAGNOVO_ARS_SECRET_KEY: z.string().min(8).optional(),
  PAGNOVO_ARS_WEBHOOK_SECRET: z.string().min(8).optional(),
  PAGNOVO_ARS_RESPONSIBLE_DOCUMENT: z.string().min(11).optional(),
  PAGNOVO_ARS_RESPONSIBLE_EXTERNAL_ID: z.string().min(1).optional(),
  // Product names for Stripe/PayPal written from the campaign story (lib/gateway-ai-names.ts).
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GATEWAY_NAMES_PROVIDER: z.string().optional(),
  GATEWAY_NAMES_MODEL: z.string().optional(),
});

export function getServerEnv() {
  return serverSchema.parse(process.env);
}

export function appUrl(path = "/", prefix?: string | null) {
  return publicAbsoluteUrl(path, prefix);
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
