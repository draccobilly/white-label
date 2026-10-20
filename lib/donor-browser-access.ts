import "server-only";
import { cookies } from "next/headers";
import { SaleStatus } from "@/generated/prisma/enums";
import {
  donorBrowserCookieName,
  readDonorBrowserToken,
} from "@/lib/donor-browser-token";
import { prisma } from "@/lib/prisma";

export async function getAuthorizedBrowserDonation(
  affiliatePageId: string,
  stripeCheckoutSessionId?: string | null,
) {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) return null;
  const cookieStore = await cookies();
  const encrypted = cookieStore.get(donorBrowserCookieName(affiliatePageId))?.value;
  if (!encrypted) return null;
  const token = readDonorBrowserToken(encrypted, secret);
  if (
    !token ||
    !token.authorized ||
    token.affiliatePageId !== affiliatePageId
  ) {
    return null;
  }

  const sale = await prisma.sale.findFirst({
    where: {
      affiliatePageId,
      checkoutIntentId: token.checkoutIntentId,
      status: SaleStatus.PAID,
      livemode: true,
      ...(stripeCheckoutSessionId ? { stripeCheckoutSessionId } : {}),
    },
    select: {
      id: true,
      checkoutIntentId: true,
      stripeCheckoutSessionId: true,
      amount: true,
      currency: true,
      customerName: true,
      customerEmail: true,
      paidAt: true,
      createdAt: true,
      trackingCode: true,
      livemode: true,
      comments: { select: { id: true, parentId: true } },
    },
  });
  if (!sale) return null;
  const topComment = sale.comments.find((item) => !item.parentId) ?? null;
  return {
    id: sale.id,
    checkoutIntentId: sale.checkoutIntentId,
    stripeCheckoutSessionId: sale.stripeCheckoutSessionId,
    amount: sale.amount,
    currency: sale.currency,
    customerName: sale.customerName,
    customerEmail: sale.customerEmail,
    paidAt: sale.paidAt,
    createdAt: sale.createdAt,
    trackingCode: sale.trackingCode,
    livemode: sale.livemode,
    comment: topComment ? { id: topComment.id } : null,
    hasReply: sale.comments.some((item) => Boolean(item.parentId)),
    showInlineThankYou: token.showInlineThankYou,
  };
}
