import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { hostnameFromHost, isLocalHost } from "@/lib/app-role";

function usableSecret(value: string | null | undefined) {
  const secret = value?.trim() ?? "";
  if (!secret.startsWith("whsec_") || secret === "whsec_xxx") return null;
  return secret;
}

async function decryptWebhook(encoded: string | null | undefined) {
  if (!encoded || !process.env.ENCRYPTION_KEY) return null;
  try {
    return usableSecret(decryptSecret(encoded, process.env.ENCRYPTION_KEY));
  } catch {
    return null;
  }
}

export async function getStripeWebhookSecret(host?: string | null) {
  const hostname = hostnameFromHost(host);
  if (!isLocalHost(hostname)) {
    const byDomain = await prisma.company.findFirst({
      where: { domain: hostname },
      select: { stripeWebhookSecretEnc: true },
    });
    const fromDomain = await decryptWebhook(byDomain?.stripeWebhookSecretEnc);
    if (fromDomain) return fromDomain;
  }

  const defaultCompany = await prisma.company.findFirst({
    where: { isDefault: true },
    select: { stripeWebhookSecretEnc: true },
  });
  const fromCompany = await decryptWebhook(defaultCompany?.stripeWebhookSecretEnc);
  if (fromCompany) return fromCompany;

  const settings = await prisma.siteSettings.findUnique({
    where: { id: "default" },
    select: { stripeWebhookSecretEnc: true },
  });
  const fromSettings = await decryptWebhook(settings?.stripeWebhookSecretEnc);
  if (fromSettings) return fromSettings;

  return usableSecret(process.env.STRIPE_WEBHOOK_SECRET);
}
