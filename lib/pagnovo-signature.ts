import { createHmac, timingSafeEqual } from "crypto";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortObjectKeys(value[key])]),
  );
}

export function stripSignature(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSignature);
  if (!isPlainObject(value)) return value;
  const { signature: _signature, ...rest } = value;
  return Object.fromEntries(
    Object.entries(rest).map(([key, nested]) => [key, stripSignature(nested)]),
  );
}

export function canonicalWebhookBody(payload: unknown) {
  return JSON.stringify(sortObjectKeys(stripSignature(payload)));
}

export function pagnovoWebhookSignature(payload: unknown, secret: string) {
  return createHmac("sha256", secret)
    .update(canonicalWebhookBody(payload))
    .digest("hex");
}

export function verifyPagnovoSignature(
  payload: unknown,
  header: string | null | undefined,
  secret: string,
) {
  const expected = pagnovoWebhookSignature(payload, secret);
  const provided = header?.trim() ?? "";
  if (!provided || provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function verifyAnyPagnovoSignature(
  payload: unknown,
  header: string | null | undefined,
  secrets: string[],
) {
  return secrets.some((secret) => verifyPagnovoSignature(payload, header, secret));
}
