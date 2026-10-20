export type UtmifyStatus =
  | "waiting_payment"
  | "paid"
  | "refused"
  | "refunded"
  | "chargedback";

export type UtmifyPayload = {
  orderId: string;
  platform: string;
  paymentMethod: "credit_card" | "boleto" | "pix" | "paypal" | "free_price";
  status: UtmifyStatus;
  createdAt: string;
  approvedDate: string | null;
  refundedAt: string | null;
  customer: {
    name: string;
    email: string;
    phone: string | null;
    document: string | null;
    ip?: string;
  };
  products: Array<{
    id: string;
    name: string;
    planId: string | null;
    planName: string | null;
    quantity: number;
    priceInCents: number;
  }>;
  trackingParameters: {
    src: string | null;
    sck: string | null;
    utm_source: string | null;
    utm_campaign: string | null;
    utm_medium: string | null;
    utm_content: string | null;
    utm_term: string | null;
  };
  commission: {
    totalPriceInCents: number;
    gatewayFeeInCents: number;
    userCommissionInCents: number;
    currency?: string;
  };
  isTest?: boolean;
};

export function formatUtmifyDate(date: Date) {
  // Utmify requires naive UTC (`YYYY-MM-DD HH:MM:SS`), not the ads calendar
  // timezone. Their dashboard then converts to America/Los_Angeles.
  return date.toISOString().replace("T", " ").slice(0, 19);
}

/** SPEI is Utmify's closest analog to PIX (bank transfer waiting for payment). */
export function utmifyPaymentMethod(
  method: string | null | undefined,
): UtmifyPayload["paymentMethod"] {
  const value = (method ?? "").trim().toLowerCase();
  if (value === "pix" || value === "spei" || value === "bank_transfer") return "pix";
  if (value === "boleto") return "boleto";
  if (value === "paypal") return "paypal";
  return "credit_card";
}

function queryParam(url: string | null | undefined, key: string) {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get(key);
  } catch {
    return null;
  }
}

export function resolveUtmifyTracking(input: {
  src?: string | null;
  sck?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  landingUrl?: string | null;
}) {
  const landing = input.landingUrl ?? null;
  const sck =
    input.sck ||
    queryParam(landing, "sck") ||
    queryParam(landing, "fbclid");
  return {
    src: input.src || queryParam(landing, "src") || input.utmSource || null,
    sck: sck || null,
    utm_source:
      input.utmSource || queryParam(landing, "utm_source") || null,
    utm_campaign:
      input.utmCampaign || queryParam(landing, "utm_campaign") || null,
    utm_medium: input.utmMedium || queryParam(landing, "utm_medium") || null,
    utm_content: input.utmContent || queryParam(landing, "utm_content") || null,
    utm_term: input.utmTerm || queryParam(landing, "utm_term") || null,
  };
}

export function utmifySoldName(input: {
  soldLabel?: string | null;
  campaignTitle: string;
  affiliateName: string;
}) {
  const sold = input.soldLabel?.trim();
  if (sold) return sold.slice(0, 180);
  const campaign = input.campaignTitle.trim();
  const affiliate = input.affiliateName.trim();
  if (campaign && affiliate) return `${campaign} — ${affiliate}`.slice(0, 180);
  return (campaign || affiliate || "Donation").slice(0, 180);
}

/** A gift with no ad click still names what was bought, instead of arriving blank. */
export function labelSaleWithoutAdClick(
  tracking: UtmifyPayload["trackingParameters"],
  soldName: string,
): UtmifyPayload["trackingParameters"] {
  const hasAd =
    tracking.src ||
    tracking.sck ||
    tracking.utm_source ||
    tracking.utm_campaign ||
    tracking.utm_medium ||
    tracking.utm_content ||
    tracking.utm_term;
  if (hasAd) return tracking;
  return {
    ...tracking,
    utm_source: "site",
    utm_medium: "direct",
    utm_campaign: soldName,
  };
}

export function buildUtmifyPayload(input: {
  saleId: string;
  orderId?: string | null;
  affiliatePageId: string;
  campaignTitle: string;
  affiliateName: string;
  amount: number;
  gatewayFee: number;
  currency: string;
  customerName: string;
  customerEmail?: string | null;
  paymentMethod?: string;
  status: UtmifyStatus;
  createdAt: Date;
  paidAt?: Date | null;
  refundedAt?: Date | null;
  clientIp?: string | null;
  attribution: {
    src?: string | null;
    sck?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmContent?: string | null;
    utmTerm?: string | null;
    landingUrl?: string | null;
  };
  isTest?: boolean;
  platform?: string;
  soldLabel?: string | null;
}): UtmifyPayload {
  const currency = input.currency.toUpperCase();
  const method =
    utmifyPaymentMethod(input.paymentMethod);
  const soldName = utmifySoldName({
    soldLabel: input.soldLabel,
    campaignTitle: input.campaignTitle,
    affiliateName: input.affiliateName,
  });
  const tracking = labelSaleWithoutAdClick(
    resolveUtmifyTracking(input.attribution),
    soldName,
  );
  return {
    orderId: input.orderId || input.saleId,
    platform: input.platform || "ArcHumanDirect",
    paymentMethod: method,
    status: input.status,
    createdAt: formatUtmifyDate(input.createdAt),
    approvedDate: input.paidAt ? formatUtmifyDate(input.paidAt) : null,
    refundedAt: input.refundedAt ? formatUtmifyDate(input.refundedAt) : null,
    customer: {
      name: input.customerName || "Anonymous",
      email: input.customerEmail || "anonymous@donation.local",
      phone: null,
      document: null,
      ip: input.clientIp || undefined,
    },
    products: [
      {
        id: input.soldLabel?.trim()
          ? `${input.affiliatePageId}:${soldName}`
          : input.affiliatePageId,
        name: soldName,
        planId: input.affiliatePageId,
        planName: input.soldLabel?.trim() ? soldName : input.affiliateName,
        quantity: 1,
        priceInCents: input.amount,
      },
    ],
    trackingParameters: tracking,
    commission: {
      totalPriceInCents: input.amount,
      gatewayFeeInCents: input.gatewayFee,
      userCommissionInCents: Math.max(0, input.amount - input.gatewayFee),
      currency: currency === "BRL" ? undefined : currency,
    },
    isTest: input.isTest === true ? true : undefined,
  };
}

export async function sendUtmifyOrder(token: string, payload: UtmifyPayload) {
  const response = await fetch("https://api.utmify.com.br/api-credentials/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-token": token,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Utmify ${response.status}: ${body.slice(0, 600)}`);
  }
  return body;
}
