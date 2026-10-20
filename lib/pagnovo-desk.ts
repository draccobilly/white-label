export type PagnovoRail = "MXN" | "ARS";

export type PagnovoCredentials = {
  rail: PagnovoRail;
  secret: string;
  webhookSecret: string;
  responsibleDocument: string;
  responsibleExternalId: string;
};

export function pagnovoRailFromCurrency(
  currency: string | null | undefined,
): PagnovoRail | null {
  if (currency === "MXN") return "MXN";
  if (currency === "ARS") return "ARS";
  return null;
}

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export function pagnovoCredentials(rail: PagnovoRail): PagnovoCredentials {
  if (rail === "ARS") {
    return {
      rail,
      secret: env("PAGNOVO_ARS_SECRET_KEY"),
      webhookSecret: env("PAGNOVO_ARS_WEBHOOK_SECRET"),
      responsibleDocument: env("PAGNOVO_ARS_RESPONSIBLE_DOCUMENT").replace(/\D/g, ""),
      responsibleExternalId: env("PAGNOVO_ARS_RESPONSIBLE_EXTERNAL_ID"),
    };
  }
  return {
    rail,
    secret: env("PAGNOVO_SECRET_KEY"),
    webhookSecret: env("PAGNOVO_WEBHOOK_SECRET"),
    responsibleDocument: env("PAGNOVO_RESPONSIBLE_DOCUMENT").replace(/\D/g, ""),
    responsibleExternalId: env("PAGNOVO_RESPONSIBLE_EXTERNAL_ID"),
  };
}

export function isPagnovoRailConfigured(rail: PagnovoRail) {
  const creds = pagnovoCredentials(rail);
  return Boolean(
    creds.secret && creds.responsibleDocument && creds.responsibleExternalId,
  );
}

export function isPagnovoRailLive(rail: PagnovoRail) {
  const secret = pagnovoCredentials(rail).secret;
  return Boolean(secret) && !secret.startsWith("sk_test_");
}

export function pagnovoChargeBlockedReason(currency: string | null | undefined) {
  const rail = pagnovoRailFromCurrency(currency);
  if (rail === "MXN") return null;
  if (rail === "ARS") {
    return isPagnovoRailConfigured("ARS")
      ? null
      : "Argentina bank transfer is not connected yet";
  }
  return "This campaign is not set to MXN";
}
