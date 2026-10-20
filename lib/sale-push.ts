import { campaignNameTag } from "@/lib/campaign-label";

export type SalePushInput = {
  campaignTitle?: string | null;
  amount: number;
  gatewayFee?: number | null;
  currency: string;
};

const PRODUCT_CODE_STOP = new Set([
  "a",
  "after",
  "and",
  "ayuda",
  "bless",
  "build",
  "campaign",
  "care",
  "day",
  "de",
  "del",
  "el",
  "every",
  "for",
  "from",
  "get",
  "give",
  "hard",
  "help",
  "her",
  "his",
  "just",
  "la",
  "las",
  "let",
  "lets",
  "life",
  "lifetime",
  "los",
  "make",
  "more",
  "my",
  "not",
  "of",
  "old",
  "on",
  "para",
  "retire",
  "survive",
  "the",
  "this",
  "to",
  "up",
  "work",
  "works",
  "years",
  "y",
]);

export function formatDonationPushAmount(amountInCents: number, currency = "USD") {
  return new Intl.NumberFormat(
    currency === "MXN" ? "es-MX" : currency === "ARS" ? "es-AR" : "en-US",
    {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(amountInCents / 100);
}

export function saleNetCents(amount: number, gatewayFee?: number | null) {
  return Math.max(0, amount - (gatewayFee ?? 0));
}

function lettersFrom(value: string) {
  return value.replace(/[^\p{L}]/gu, "").slice(0, 3).toUpperCase();
}

export function saleProductCode(title?: string | null) {
  const text = title?.trim() || "Campaign";
  const words = text.split(/[^\p{L}]+/u).filter((word) => word.length >= 3);
  const product =
    words.find((word) => !PRODUCT_CODE_STOP.has(word.toLowerCase())) ??
    campaignNameTag(text);
  return `${lettersFrom(product) || "CAM"}***`;
}

export function salePushDeskLabel(currency: string) {
  if (currency === "MXN") return "MX";
  if (currency === "ARS") return "AR";
  return "US (global)";
}

export function salePushNotification(input: SalePushInput) {
  const net = saleNetCents(input.amount, input.gatewayFee);
  const desk = salePushDeskLabel(input.currency);
  return {
    title: desk,
    body: `Parabéns, mais uma venda aprovada\nNet: ${formatDonationPushAmount(net, input.currency)} - ${saleProductCode(input.campaignTitle)}`,
    url: "/admin/sales",
  };
}
