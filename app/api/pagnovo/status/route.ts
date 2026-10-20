import { NextResponse } from "next/server";
import { SaleStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { pendingCheckoutCookieName, readDonorBrowserToken } from "@/lib/donor-browser-token";
import {
  extractBeneficiary,
  extractDepositClabe,
  extractDepositCvu,
  getPagnovoTransaction,
  isPagnovoLive,
  mapPagnovoStatus,
  pagnovoRailFromCurrency,
} from "@/lib/pagnovo";
import {
  notifyDonationPaid,
  recordPaidPagnovoTransaction,
} from "@/lib/record-paid-session";
import { companyPublicPrefix, publicCampaignPath } from "@/lib/public-site-url";
import { isInstitutionalSiteMode } from "@/lib/site-mode";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const intentId = url.searchParams.get("intent")?.trim();
  if (!intentId) {
    return NextResponse.json({ error: "Missing payment" }, { status: 400 });
  }

  const intent = await prisma.checkoutIntent.findUnique({
    where: { id: intentId },
    include: {
      sale: true,
      affiliatePage: {
        include: {
          campaign: { include: { company: { select: { publicPathPrefix: true, siteMode: true } } } },
          affiliate: true,
        },
      },
    },
  });
  if (!intent) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const secret = process.env.ENCRYPTION_KEY;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieName = pendingCheckoutCookieName(intent.affiliatePageId);
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  const token = match && secret
    ? readDonorBrowserToken(decodeURIComponent(match.slice(cookieName.length + 1)), secret)
    : null;
  if (!token || token.checkoutIntentId !== intent.id) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  let paid = intent.sale?.status === SaleStatus.PAID;
  let clabe = intent.pagnovoClabe;
  let beneficiary: string | null = null;
  const rail = pagnovoRailFromCurrency(intent.currency) ?? "MXN";
  if (!paid && intent.pagnovoTransactionId) {
    try {
      const remote = await getPagnovoTransaction(intent.pagnovoTransactionId, rail);
      const deposit =
        rail === "ARS" ? extractDepositCvu(remote) : extractDepositClabe(remote);
      beneficiary = extractBeneficiary(remote);
      if (deposit && deposit !== clabe) {
        await prisma.checkoutIntent.update({
          where: { id: intent.id },
          data: { pagnovoClabe: deposit },
        });
        clabe = deposit;
      }
      if (mapPagnovoStatus(String(remote.status ?? "")) === "paid") {
        const recorded = await prisma.$transaction((tx) =>
          recordPaidPagnovoTransaction(tx, {
            transactionId: intent.pagnovoTransactionId!,
            externalId: intent.id,
            amount: intent.amount,
            customerName: intent.payerName,
            customerEmail: intent.payerEmail,
            paymentMethod:
              typeof remote.method === "string"
                ? remote.method
                : typeof remote.payment_method === "string"
                  ? remote.payment_method
                  : rail === "ARS"
                    ? "BANK_TRANSFER"
                    : "SPEI",
            livemode: isPagnovoLive(rail),
            gatewayFee:
              typeof remote.costFee === "number"
                ? remote.costFee
                : typeof remote.cost_fee === "number"
                  ? remote.cost_fee
                  : null,
          }),
        );
        void notifyDonationPaid(recorded);
        paid = Boolean(recorded);
        const { processPendingDeliveries } = await import("@/lib/outbox");
        void processPendingDeliveries(10).catch((error) => {
          console.error("Utmify outbox flush failed", error);
        });
      }
    } catch (error) {
      console.error("pagnovo status poll failed", error);
    }
  }

  const expired =
    rail !== "ARS" && !paid && intent.expiresAt.getTime() < Date.now();
  return NextResponse.json({
    intentId: intent.id,
    status: paid ? "PAID" : expired ? "EXPIRED" : "PENDING",
    clabe,
    cvu: rail === "ARS" ? clabe : null,
    beneficiary,
    amount: intent.amount,
    currency: intent.currency,
    livemode: intent.sale?.livemode ?? null,
    campaignPath: publicCampaignPath(
      companyPublicPrefix(intent.affiliatePage.campaign.company ?? {}),
      intent.affiliatePage.campaign.slug,
      intent.affiliatePage.affiliate.slug,
      "",
      {
        short: isInstitutionalSiteMode(
          intent.affiliatePage.campaign.company?.siteMode,
        ),
      },
    ),
  });
}
