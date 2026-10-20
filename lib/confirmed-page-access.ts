import "server-only";
import { cookies } from "next/headers";
import { SaleStatus } from "@/generated/prisma/enums";
import {
  confirmedVisitCookieName,
  donorBrowserCookieName,
  readConfirmedVisitToken,
  readDonorBrowserToken,
} from "@/lib/donor-browser-token";
import { prisma } from "@/lib/prisma";

const saleSelect = {
  id: true,
  checkoutIntentId: true,
  stripeCheckoutSessionId: true,
  pagnovoTransactionId: true,
  amount: true,
  currency: true,
  customerName: true,
  customerEmail: true,
  paidAt: true,
  createdAt: true,
  trackingCode: true,
  livemode: true,
} as const;

export async function getConfirmedPageSale(
  affiliatePageId: string,
  stripeCheckoutSessionId: string,
) {
  return getConfirmedSale(affiliatePageId, {
    stripeCheckoutSessionId,
  });
}

export async function getConfirmedSale(
  affiliatePageId: string,
  ref: { stripeCheckoutSessionId?: string; intentId?: string },
) {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) return null;

  const cookieStore = await cookies();
  const donorEncrypted = cookieStore.get(donorBrowserCookieName(affiliatePageId))?.value;
  const donorToken = donorEncrypted
    ? readDonorBrowserToken(donorEncrypted, secret)
    : null;
  if (donorToken?.authorized && donorToken.affiliatePageId === affiliatePageId) {
    const liveSale = await prisma.sale.findFirst({
      where: {
        affiliatePageId,
        checkoutIntentId: donorToken.checkoutIntentId,
        status: SaleStatus.PAID,
        livemode: true,
        ...(ref.stripeCheckoutSessionId
          ? { stripeCheckoutSessionId: ref.stripeCheckoutSessionId }
          : {}),
        ...(ref.intentId ? { checkoutIntentId: ref.intentId } : {}),
      },
      select: saleSelect,
    });
    if (liveSale) return liveSale;
  }

  const visitEncrypted = cookieStore.get(confirmedVisitCookieName(affiliatePageId))?.value;
  const visitToken = visitEncrypted
    ? readConfirmedVisitToken(visitEncrypted, secret)
    : null;
  const visitMatchesSession =
    !ref.stripeCheckoutSessionId ||
    visitToken?.stripeCheckoutSessionId === ref.stripeCheckoutSessionId;
  const visitMatchesIntent =
    !ref.intentId || visitToken?.checkoutIntentId === ref.intentId;
  if (
    !visitToken ||
    visitToken.affiliatePageId !== affiliatePageId ||
    !visitMatchesSession ||
    !visitMatchesIntent
  ) {
    return null;
  }

  return prisma.sale.findFirst({
    where: {
      affiliatePageId,
      checkoutIntentId: visitToken.checkoutIntentId,
      status: SaleStatus.PAID,
      livemode: false,
      ...(ref.stripeCheckoutSessionId
        ? { stripeCheckoutSessionId: ref.stripeCheckoutSessionId }
        : {}),
    },
    select: saleSelect,
  });
}
