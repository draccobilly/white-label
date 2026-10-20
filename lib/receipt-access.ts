import "server-only";
import { SaleStatus } from "@/generated/prisma/enums";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  isReceiptAvailable,
  receiptAvailableAt,
} from "@/lib/receipt-timing";

type ReceiptTokenPayload = {
  version: 1;
  purpose: "receipt";
  saleId: string;
};

export function createReceiptToken(saleId: string) {
  if (!process.env.ENCRYPTION_KEY) return null;
  const payload: ReceiptTokenPayload = {
    version: 1,
    purpose: "receipt",
    saleId,
  };
  return encryptSecret(JSON.stringify(payload), process.env.ENCRYPTION_KEY);
}

function saleIdFromReceiptToken(token: string) {
  if (!process.env.ENCRYPTION_KEY) return null;
  try {
    const payload = JSON.parse(
      decryptSecret(token, process.env.ENCRYPTION_KEY),
    ) as Partial<ReceiptTokenPayload>;
    return payload.version === 1 &&
      payload.purpose === "receipt" &&
      typeof payload.saleId === "string"
      ? payload.saleId
      : null;
  } catch {
    return null;
  }
}

export async function getReceiptAccess(token: string) {
  const saleId = saleIdFromReceiptToken(token);
  if (!saleId) return null;
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, status: SaleStatus.PAID },
    select: {
      id: true,
      amount: true,
      currency: true,
      customerName: true,
      customerEmail: true,
      trackingCode: true,
      paidAt: true,
      createdAt: true,
      campaign: { select: { title: true } },
    },
  });
  if (!sale) return null;

  const confirmedAt = sale.paidAt ?? sale.createdAt;
  const availableAt = receiptAvailableAt(confirmedAt);
  const receiptPath = `/receipt?token=${encodeURIComponent(token)}`;

  return {
    saleId: sale.id,
    sale,
    token,
    availableAt,
    available: isReceiptAvailable(availableAt),
    receiptPath,
  };
}
