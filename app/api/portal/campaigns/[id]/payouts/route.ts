import { companyBrand, getRequestCompany } from "@/lib/company";
import { operationsInbox, sendPayoutRequestEmail } from "@/lib/organizer-mail";
import { payoutAvailability } from "@/lib/organizer-portal";
import { ownedCampaign, portalError, portalJson, requirePortalOrganizer } from "@/lib/organizer-route";
import { payoutRequestSchema } from "@/lib/organizer-validators";
import { portalCopy } from "@/lib/portal-copy";
import { prisma } from "@/lib/prisma";
import { publicSiteUrl } from "@/lib/public-site-url";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { formatMoneyExact } from "@/lib/utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organizer, response: denied } = await requirePortalOrganizer();
  if (!organizer) return denied;
  if (!rateLimit(`portal-payout:${organizer.id}:${clientIp(request)}`, 5, 60 * 60_000)) {
    return portalError("Too many requests. Try again later.", 429);
  }
  const { id } = await params;
  const campaign = await ownedCampaign(organizer.id, id);
  if (!campaign) return portalError("Campaign not found.", 404);

  const parsed = payoutRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return portalError(parsed.error.issues[0]?.message ?? "Check the bank details.", 400);
  }
  const input = parsed.data;
  if (input.bankCountry.trim().toUpperCase() !== input.holderCountry.trim().toUpperCase() && !input.swiftBic) {
    return portalError("Add the SWIFT / BIC for an international wire.", 400);
  }
  if (/^(US|USA|UNITED STATES|ESTADOS UNIDOS)$/i.test(input.bankCountry.trim()) && !input.routingNumber) {
    return portalError("US accounts need the routing / ABA number.", 400);
  }

  const pending = await prisma.payoutRequest.count({
    where: { campaignId: campaign.id, status: "PENDING" },
  });
  if (pending > 0) {
    return portalError("A payout request for this campaign is already under review.", 409);
  }

  const availability = await payoutAvailability(campaign.id);
  const amount = input.amount ?? availability.available;
  if (amount <= 0 || amount > availability.available) {
    return portalError("The amount is above what is available to withdraw.", 400);
  }

  const company = await getRequestCompany();
  const payout = await prisma.payoutRequest.create({
    data: {
      companyId: campaign.companyId ?? company.id,
      campaignId: campaign.id,
      organizerId: organizer.id,
      amount,
      currency: campaign.currency,
      accountHolderName: input.accountHolderName,
      holderAddress: input.holderAddress,
      holderCountry: input.holderCountry,
      bankName: input.bankName,
      bankCountry: input.bankCountry,
      bankAddress: input.bankAddress || null,
      accountNumber: input.accountNumber,
      accountType: input.accountType || null,
      routingNumber: input.routingNumber || null,
      swiftBic: input.swiftBic || null,
      intermediaryBank: input.intermediaryBank || null,
      notes: input.notes || null,
    },
  });

  try {
    const brand = companyBrand(company);
    const to = operationsInbox(brand.contactEmail);
    if (to) {
      await sendPayoutRequestEmail({
        to,
        replyTo: organizer.email,
        subject: portalCopy(brand.locale).payoutEmailSubject(brand.siteName, campaign.title),
        siteName: brand.siteName,
        campaignTitle: campaign.title,
        organizerName: organizer.name,
        organizerEmail: organizer.email,
        amountLabel: formatMoneyExact(amount, campaign.currency),
        availableLabel: formatMoneyExact(availability.available, campaign.currency),
        rows: [
          ["Account holder", input.accountHolderName],
          ["Holder address", input.holderAddress],
          ["Holder country", input.holderCountry],
          ["Bank", input.bankName],
          ["Bank country", input.bankCountry],
          ["Bank address", input.bankAddress],
          ["Account / IBAN", input.accountNumber],
          ["Account type", input.accountType],
          ["Routing / branch", input.routingNumber],
          ["SWIFT / BIC", input.swiftBic],
          ["Intermediary bank", input.intermediaryBank],
          ["Notes", input.notes],
        ],
        adminHref: `${publicSiteUrl().replace(/\/$/, "")}/admin/payouts`,
      });
    }
  } catch (error) {
    console.error("payout request email failed", error instanceof Error ? error.message : error);
  }

  return portalJson({ payout: { id: payout.id, amount: payout.amount, status: payout.status } }, 201);
}
