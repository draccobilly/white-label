const LIVE_API = "https://api-m.paypal.com";

export function paypalClientId() {
  return process.env.PAYPAL_CLIENT_ID?.trim() ?? "";
}

/** Public PayPal button. Off hides it and refuses new orders. */
export const PAYPAL_BUTTON_ENABLED = false;

export function paypalPublicClientId() {
  return PAYPAL_BUTTON_ENABLED ? paypalClientId() : "";
}

export function paypalConfigured() {
  return Boolean(paypalClientId() && process.env.PAYPAL_CLIENT_SECRET?.trim());
}

export function paypalApiBase() {
  return (process.env.PAYPAL_API_BASE?.trim() || LIVE_API).replace(/\/+$/, "");
}

export function paypalLivemode() {
  return !paypalApiBase().includes("sandbox");
}

export function centsToPaypalAmount(cents: number) {
  return (Math.max(0, Math.round(cents)) / 100).toFixed(2);
}

export function paypalAmountToCents(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

type PaypalMoney = { currency_code?: string; value?: string };

export type PaypalCaptureDetails = {
  orderId: string;
  captureId: string;
  status: string;
  amountCents: number | null;
  currency: string;
  feeCents: number;
  customId: string;
  payerName: string | null;
  payerEmail: string | null;
  paidAt: Date | null;
};

type PaypalOrder = {
  id?: string;
  status?: string;
  payer?: {
    email_address?: string;
    name?: { given_name?: string; surname?: string };
  };
  purchase_units?: Array<{
    custom_id?: string;
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        custom_id?: string;
        create_time?: string;
        amount?: PaypalMoney;
        seller_receivable_breakdown?: { paypal_fee?: PaypalMoney };
      }>;
    };
  }>;
};

type PaypalCaptureResource = {
  id?: string;
  status?: string;
  custom_id?: string;
  create_time?: string;
  amount?: PaypalMoney;
  seller_receivable_breakdown?: { paypal_fee?: PaypalMoney };
  supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
  payer?: PaypalOrder["payer"];
  purchase_units?: PaypalOrder["purchase_units"];
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function paypalAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const clientId = paypalClientId();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !secret) throw new Error("PayPal is not configured");
  const response = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;
  if (!response.ok || !body?.access_token) {
    throw new Error("PayPal authentication failed");
  }
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(60, body.expires_in ?? 300) * 1000,
  };
  return body.access_token;
}

async function paypalFetch(path: string, init: RequestInit & { requestId?: string } = {}) {
  const token = await paypalAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  if (init.requestId) headers.set("PayPal-Request-Id", init.requestId);
  return fetch(`${paypalApiBase()}${path}`, { ...init, headers });
}

/** Page URL PayPal may return to. Same value for approve and cancel, no hash. */
export function paypalReturnUrl(candidate: string | undefined, allowedOrigins: string[]) {
  if (!candidate) return null;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const origins = new Set(
    allowedOrigins.flatMap((value) => {
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    }),
  );
  if (!origins.has(url.origin)) return null;
  const value = candidate.split("#")[0];
  return value.length <= 2048 ? value : null;
}

export async function createPaypalOrder(input: {
  checkoutIntentId: string;
  amountCents: number;
  currency: string;
  description: string;
  brandName: string;
  returnUrl?: string | null;
  userAgent?: string | null;
}) {
  const brandName = input.brandName.slice(0, 127);
  const experience: Record<string, unknown> = {
    brand_name: brandName,
    shipping_preference: "NO_SHIPPING",
    user_action: "PAY_NOW",
  };
  const sessionUrl = input.returnUrl || null;
  if (sessionUrl) {
    experience.return_url = sessionUrl;
    experience.cancel_url = sessionUrl;
    experience.app_switch_preference = { return_url: sessionUrl, cancel_url: sessionUrl };
    const mobileWeb: Record<string, string> = { return_flow: "AUTO" };
    const userAgent = input.userAgent?.trim();
    if (userAgent && userAgent.length <= 512) mobileWeb.buyer_user_agent = userAgent;
    experience.app_switch_context = { mobile_web: mobileWeb };
  }
  const purchaseUnit = {
    custom_id: input.checkoutIntentId,
    invoice_id: input.checkoutIntentId,
    description: input.description.slice(0, 127),
    amount: {
      currency_code: input.currency.toUpperCase(),
      value: centsToPaypalAmount(input.amountCents),
    },
  };
  const response = await paypalFetch("/v2/checkout/orders", {
    method: "POST",
    requestId: input.checkoutIntentId,
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [purchaseUnit],
      ...(sessionUrl
        ? { payment_source: { paypal: { experience_context: experience } } }
        : {
            application_context: {
              brand_name: brandName,
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
            },
          }),
    }),
  });
  const body = (await response.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!response.ok || !body?.id) {
    console.error("PayPal order create failed", response.status, body);
    throw new Error("PayPal order was not created");
  }
  return body.id;
}

export async function getPaypalOrder(orderId: string) {
  const response = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
  });
  const body = (await response.json().catch(() => null)) as PaypalOrder | null;
  if (!response.ok || !body) throw new Error("PayPal order was not found");
  return body;
}

export async function capturePaypalOrder(orderId: string) {
  const response = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    requestId: `capture:${orderId}`,
    body: "{}",
  });
  const body = (await response.json().catch(() => null)) as
    | (PaypalOrder & { details?: Array<{ issue?: string }> })
    | null;
  const alreadyCaptured = body?.details?.some((item) => item.issue === "ORDER_ALREADY_CAPTURED");
  if (alreadyCaptured) return getPaypalOrder(orderId);
  if (!response.ok || !body) {
    console.error("PayPal capture failed", response.status, body);
    throw new Error("PayPal capture failed");
  }
  return body;
}

function payerName(payer: PaypalOrder["payer"]) {
  const name = [payer?.name?.given_name, payer?.name?.surname].filter(Boolean).join(" ").trim();
  return name || null;
}

export function paypalCaptureFromOrder(order: PaypalOrder): PaypalCaptureDetails | null {
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (!capture?.id) return null;
  return {
    orderId: order.id ?? "",
    captureId: capture.id,
    status: (capture.status ?? "").toUpperCase(),
    amountCents: paypalAmountToCents(capture.amount?.value),
    currency: (capture.amount?.currency_code ?? "").toUpperCase(),
    feeCents: paypalAmountToCents(capture.seller_receivable_breakdown?.paypal_fee?.value) ?? 0,
    customId: capture.custom_id || unit?.custom_id || "",
    payerName: payerName(order.payer),
    payerEmail: order.payer?.email_address ?? null,
    paidAt: capture.create_time ? new Date(capture.create_time) : null,
  };
}

export function paypalCaptureFromResource(resource: PaypalCaptureResource): PaypalCaptureDetails | null {
  if (resource.purchase_units?.length) return paypalCaptureFromOrder(resource);
  if (!resource.id) return null;
  return {
    orderId: resource.supplementary_data?.related_ids?.order_id ?? "",
    captureId: resource.id,
    status: (resource.status ?? "").toUpperCase(),
    amountCents: paypalAmountToCents(resource.amount?.value),
    currency: (resource.amount?.currency_code ?? "").toUpperCase(),
    feeCents: paypalAmountToCents(resource.seller_receivable_breakdown?.paypal_fee?.value) ?? 0,
    customId: resource.custom_id ?? "",
    payerName: payerName(resource.payer),
    payerEmail: resource.payer?.email_address ?? null,
    paidAt: resource.create_time ? new Date(resource.create_time) : null,
  };
}

export function paypalRefundFromResource(resource: {
  amount?: PaypalMoney;
  supplementary_data?: { related_ids?: { capture_id?: string } };
  links?: Array<{ rel?: string; href?: string }>;
}) {
  const up = resource.links?.find((link) => link.rel === "up")?.href ?? "";
  const fromLink = up.match(/\/captures\/([A-Z0-9]+)/i)?.[1] ?? "";
  return {
    captureId: resource.supplementary_data?.related_ids?.capture_id || fromLink,
    amountCents: paypalAmountToCents(resource.amount?.value),
  };
}

export function paypalDisputeFromResource(resource: {
  dispute_id?: string;
  status?: string;
  reason?: string;
  create_time?: string;
  dispute_amount?: PaypalMoney;
  disputed_transactions?: Array<{ seller_transaction_id?: string }>;
}) {
  return {
    disputeId: resource.dispute_id ?? "",
    status: resource.status ?? "",
    reason: resource.reason ?? null,
    amountCents: paypalAmountToCents(resource.dispute_amount?.value) ?? 0,
    currency: (resource.dispute_amount?.currency_code ?? "USD").toUpperCase(),
    captureId: resource.disputed_transactions?.[0]?.seller_transaction_id ?? "",
    openedAt: resource.create_time ? new Date(resource.create_time) : new Date(),
    closed: (resource.status ?? "").toUpperCase() === "RESOLVED",
  };
}

const PAYPAL_CERT_HOSTS = new Set(["api.paypal.com", "api.sandbox.paypal.com"]);

export async function verifyPaypalWebhook(headers: Headers, event: unknown) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionSig = headers.get("paypal-transmission-sig");
  const transmissionTime = headers.get("paypal-transmission-time");
  const authAlgo = headers.get("paypal-auth-algo");
  const certUrl = headers.get("paypal-cert-url");
  if (!webhookId || !transmissionId || !transmissionSig || !transmissionTime || !authAlgo || !certUrl) {
    return false;
  }
  let certHost = "";
  try {
    const url = new URL(certUrl);
    certHost = url.hostname;
    if (url.protocol !== "https:" || !PAYPAL_CERT_HOSTS.has(certHost)) return false;
  } catch {
    return false;
  }
  const response = await paypalFetch("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  const body = (await response.json().catch(() => null)) as { verification_status?: string } | null;
  return body?.verification_status === "SUCCESS";
}
