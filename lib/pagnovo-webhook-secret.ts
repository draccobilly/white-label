import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { hostnameFromHost, isLocalHost } from "@/lib/app-role";
import { pagnovoCredentials } from "@/lib/pagnovo-desk";

async function decryptWebhook(encoded: string | null | undefined) {
  if (!encoded || !process.env.ENCRYPTION_KEY) return null;
  try {
    const value = decryptSecret(encoded, process.env.ENCRYPTION_KEY).trim();
    return value || null;
  } catch {
    return null;
  }
}

export async function listPagnovoWebhookSecrets() {
  const secrets = new Set<string>();
  const companies = await prisma.company.findMany({
    where: { paymentGateway: "PAGNOVO" },
    select: { pagnovoWebhookSecretEnc: true },
  });
  for (const company of companies) {
    const fromCompany = await decryptWebhook(company.pagnovoWebhookSecretEnc);
    if (fromCompany) secrets.add(fromCompany);
  }
  for (const rail of ["MXN", "ARS"] as const) {
    const fromEnv = pagnovoCredentials(rail).webhookSecret;
    if (fromEnv) secrets.add(fromEnv);
  }
  return [...secrets];
}

export async function getPagnovoWebhookSecret(host?: string | null) {
  const hostname = hostnameFromHost(host);
  if (!isLocalHost(hostname)) {
    const byDomain = await prisma.company.findFirst({
      where: { domain: hostname },
      select: { pagnovoWebhookSecretEnc: true },
    });
    const fromDomain = await decryptWebhook(byDomain?.pagnovoWebhookSecretEnc);
    if (fromDomain) return fromDomain;
  }

  const secrets = await listPagnovoWebhookSecrets();
  return secrets[0] ?? null;
}
