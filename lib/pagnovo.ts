import { pagnovoPostbackUrl } from "@/lib/public-site-url";
import { resolvePayerCpf, resolvePayerPhone } from "@/lib/pagnovo-payer";
import {
  isPagnovoRailConfigured,
  isPagnovoRailLive,
  pagnovoChargeBlockedReason,
  pagnovoCredentials,
  pagnovoRailFromCurrency,
  type PagnovoRail,
} from "@/lib/pagnovo-desk";

export {
  isPagnovoRailConfigured,
  isPagnovoRailLive,
  pagnovoChargeBlockedReason,
  pagnovoCredentials,
  pagnovoRailFromCurrency,
};
export type { PagnovoRail };

const BASE_URL = "https://api.pagnovo.com";

export type PagnovoPaymentMethod = "SPEI" | "CREDIT_CARD" | "BANK_TRANSFER";

export type PagnovoPurchaseInput = {
  name: string;
  email: string;
  amount: number;
  currency: "MXN" | "ARS";
  description: string;
  externalId: string;
  paymentMethod: PagnovoPaymentMethod;
  creditCard?: {
    token: string;
    holder: string;
    installments?: number;
    brand?: string;
    last4?: string;
  };
};

export type PagnovoPurchaseResult = {
  id: string;
  status: string;
  mappedStatus: "paid" | "failed" | "pending";
  amount: number;
  currency?: string;
  method?: string;
  clabe?: string | null;
  cvu?: string | null;
  beneficiary?: string | null;
  requiresAction?: boolean;
  clientSecret?: string | null;
  costFee?: number | null;
};

export type PagnovoCardConfig = {
  available: boolean;
  tokenizationKey: string | null;
  allowsInstallments: boolean;
};

export class PagnovoApiError extends Error {
  status: number;
  traceId: string | null;

  constructor(message: string, status: number, traceId: string | null) {
    super(message);
    this.name = "PagnovoApiError";
    this.status = status;
    this.traceId = traceId;
  }
}

function secretKey(rail: PagnovoRail) {
  const key = pagnovoCredentials(rail).secret;
  if (!key) {
    throw new Error(
      rail === "ARS"
        ? "PAGNOVO_ARS_SECRET_KEY is not configured"
        : "PAGNOVO_SECRET_KEY is not configured",
    );
  }
  return key;
}

export function isPagnovoConfigured() {
  return isPagnovoRailConfigured("MXN");
}

export function isAnyPagnovoRailConfigured() {
  return isPagnovoRailConfigured("MXN") || isPagnovoRailConfigured("ARS");
}

export function isPagnovoLive(rail: PagnovoRail = "MXN") {
  return isPagnovoRailLive(rail);
}

export function friendlyPagnovoPurchaseError(message: string, rail: PagnovoRail = "MXN") {
  if (/adquirente|opera na moeda ARS|no ARS acquirer/i.test(message)) {
    return "Pagnovo has no ARS acquirer on this seller. Ask Pagnovo to enable ARS bank transfer (CVU).";
  }
  return message;
}

export function mapPagnovoStatus(status: string | null | undefined): "paid" | "failed" | "pending" {
  const value = (status ?? "").trim().toUpperCase();
  if (value === "APPROVED" || value === "PAID" || value === "COMPLETED") return "paid";
  if (
    value === "REJECTED" ||
    value === "FAILED" ||
    value === "CANCELLED" ||
    value === "CANCELED"
  ) {
    return "failed";
  }
  return "pending";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function clabeDigits(value: unknown) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 18 ? digits : null;
}

function cvuDigits(value: unknown) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 22 ? digits : null;
}

function nestedPaymentRecords(result: Record<string, unknown>) {
  return [
    result,
    asRecord(result.payment),
    asRecord(result.data),
    asRecord(result.bankAccount),
    asRecord(result.bank_account),
    asRecord(result.spei),
    asRecord(result.paymentInstruction),
    asRecord(result.payment_instruction),
  ];
}

/** Deposit CLABE returned by Pagnovo — never the payer refund CLABE. */
export function extractDepositClabe(result: Record<string, unknown>): string | null {
  for (const record of nestedPaymentRecords(result)) {
    if (!record) continue;
    const found =
      clabeDigits(record.deposit_clabe) ??
      clabeDigits(record.depositClabe) ??
      clabeDigits(record.clabe) ??
      clabeDigits(record.destinationClabe) ??
      clabeDigits(record.destination_clabe);
    if (found) return found;
  }
  return null;
}

/** Argentine CVU. Empty on purchase create; filled after polling GET /transactions/:id. */
export function extractDepositCvu(result: Record<string, unknown>): string | null {
  for (const record of nestedPaymentRecords(result)) {
    if (!record) continue;
    const found =
      cvuDigits(record.cvu) ??
      cvuDigits(record.CVU) ??
      cvuDigits(record.deposit_cvu) ??
      cvuDigits(record.depositCvu);
    if (found) return found;
  }
  return null;
}

export function extractBeneficiary(result: Record<string, unknown>): string | null {
  for (const record of nestedPaymentRecords(result)) {
    if (!record) continue;
    const found =
      (typeof record.beneficiary === "string" && record.beneficiary.trim()) ||
      (typeof record.beneficiaryName === "string" && record.beneficiaryName.trim()) ||
      (typeof record.beneficiary_name === "string" && record.beneficiary_name.trim());
    if (found) return found;
  }
  return null;
}

function authHeader(rail: PagnovoRail) {
  return `Basic ${Buffer.from(`secret:${secretKey(rail)}`).toString("base64")}`;
}

async function pagnovoFetch<T>(
  path: string,
  init?: RequestInit,
  rail: PagnovoRail = "MXN",
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(rail),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const traceId = response.headers.get("x-trace-id");
  const body = (await response.json().catch(() => null)) as
    | { message?: string; statusCode?: number }
    | T
    | null;
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && body.message
        ? String(body.message)
        : `Pagnovo request failed (${response.status})`;
    throw new PagnovoApiError(message, response.status, traceId);
  }
  return body as T;
}

export async function getPagnovoCardConfig(): Promise<PagnovoCardConfig> {
  const config = await pagnovoFetch<{
    available?: boolean;
    tokenizationKey?: string;
    allowsInstallments?: boolean;
  }>("/transactions/card-config");
  return {
    available: config.available === true && Boolean(config.tokenizationKey),
    tokenizationKey: config.tokenizationKey ?? null,
    allowsInstallments: config.allowsInstallments === true,
  };
}

export async function createPagnovoPurchase(
  input: PagnovoPurchaseInput,
): Promise<PagnovoPurchaseResult> {
  const rail = pagnovoRailFromCurrency(input.currency);
  if (!rail) throw new Error("Unsupported Pagnovo currency");
  const creds = pagnovoCredentials(rail);
  if (!creds.secret || !creds.responsibleDocument || !creds.responsibleExternalId) {
    throw new Error(
      rail === "ARS"
        ? "Argentina bank transfer is not connected yet"
        : "Pagnovo responsible party is not configured",
    );
  }

  const ars = rail === "ARS";
  const description = ars
    ? "Transferencia bancaria"
    : input.paymentMethod === "SPEI"
      ? "Transferencia SPEI"
      : input.description.slice(0, 120);

  const payload: Record<string, unknown> = {
    name: input.name,
    email: input.email,
    amount: input.amount,
    currency: input.currency,
    paymentMethod: ars ? "BANK_TRANSFER" : input.paymentMethod,
    description,
    responsibleDocument: creds.responsibleDocument,
    responsibleExternalId: creds.responsibleExternalId,
    externalId: input.externalId,
    postbackUrl: pagnovoPostbackUrl(),
  };
  if (!ars) {
    payload.cpf = resolvePayerCpf(input.email);
    payload.phone = resolvePayerPhone(input.email);
  }
  if (input.creditCard) {
    payload.creditCard = {
      token: input.creditCard.token,
      holder: input.creditCard.holder,
      installments: input.creditCard.installments ?? 1,
      brand: input.creditCard.brand,
      last4: input.creditCard.last4,
    };
  }

  let result: Record<string, unknown>;
  try {
    result = await pagnovoFetch<Record<string, unknown>>(
      "/transactions/v2/purchase",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      rail,
    );
  } catch (error) {
    if (error instanceof PagnovoApiError) {
      throw new PagnovoApiError(
        friendlyPagnovoPurchaseError(error.message, rail),
        error.status,
        error.traceId,
      );
    }
    throw error;
  }

  const id = String(result.id ?? result.transactionId ?? "");
  if (!id) throw new Error("Pagnovo did not return a transaction id");

  const status = String(result.status ?? "PENDING");
  const cvu = extractDepositCvu(result);
  const clabe = extractDepositClabe(result);
  return {
    id,
    status,
    mappedStatus: mapPagnovoStatus(status),
    amount: Number(result.amount ?? input.amount),
    currency: typeof result.currency === "string" ? result.currency : input.currency,
    method: typeof result.method === "string" ? result.method : input.paymentMethod,
    clabe: ars ? cvu : clabe,
    cvu,
    beneficiary: extractBeneficiary(result),
    requiresAction: result.requiresAction === true,
    clientSecret:
      typeof result.clientSecret === "string" ? result.clientSecret : null,
    costFee: typeof result.costFee === "number" ? result.costFee : null,
  };
}

export async function getPagnovoTransaction(id: string, rail: PagnovoRail = "MXN") {
  return pagnovoFetch<Record<string, unknown>>(
    `/transactions/${encodeURIComponent(id)}?searchBy=id`,
    undefined,
    rail,
  );
}
