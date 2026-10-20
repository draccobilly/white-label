import type { Metadata } from "next";
import Link from "next/link";
import { loadPortalCampaign, PortalCampaignFrame } from "@/components/portal/PortalCampaignPage";
import { PortalPayoutForm } from "@/components/portal/PortalPayoutForm";
import { moneyLocale } from "@/lib/i18n";
import { maskAccountNumber, payoutAvailability } from "@/lib/organizer-portal";
import { payoutStatusLabel, portalCopy, portalStrings } from "@/lib/portal-copy";
import { prisma } from "@/lib/prisma";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";
import { formatMoneyExact } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await getPublicPageChrome();
  const copy = portalCopy(chrome.locale);
  return { title: `${copy.payouts} · ${chrome.brand.siteName}`, robots: { index: false } };
}

export default async function PortalCampaignPayoutsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await loadPortalCampaign(id, "/payouts");
  const { chrome, copy, campaign, organizer } = loaded;
  const [availability, payouts, lastPayout] = await Promise.all([
    payoutAvailability(campaign.id),
    prisma.payoutRequest.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payoutRequest.findFirst({
      where: { organizerId: organizer.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const money = moneyLocale(chrome.locale, campaign.currency);
  const dateLocale = chrome.locale === "en" ? "en-US" : chrome.locale;
  const pending = payouts.some((payout) => payout.status === "PENDING");

  return (
    <PortalCampaignFrame loaded={loaded} lead={copy.payoutsLead}>
      <div className="portal-stats">
        <div className="portal-stat is-accent">
          <span>{copy.verifiedGifts}</span>
          <strong>{formatMoneyExact(availability.raised, campaign.currency, money)}</strong>
          <small>{copy.giftCount(availability.giftCount)}</small>
        </div>
        <div className="portal-stat">
          <span>{copy.available}</span>
          <strong>{formatMoneyExact(availability.available, campaign.currency, money)}</strong>
          <small>&nbsp;</small>
          <p>
            {copy.availableHint}{" "}
            <Link className="inst-terms-link" href={withPublicPrefix(chrome.pathPrefix, "/fundraiser-terms")}>
              Terms
            </Link>
          </p>
        </div>
      </div>

      <section className="portal-section">
        <h2>{copy.payoutHistory}</h2>
        {payouts.length ? (
          <ul className="portal-payout-list">
            {payouts.map((payout) => (
              <li key={payout.id}>
                <div>
                  <strong>{formatMoneyExact(payout.amount, payout.currency, money)}</strong>
                  <small>
                    {copy.requestedOn}{" "}
                    {payout.createdAt.toLocaleDateString(dateLocale, { dateStyle: "medium" })} · {payout.bankName} ·{" "}
                    {maskAccountNumber(payout.accountNumber)}
                  </small>
                </div>
                <span className={`portal-chip is-${payout.status.toLowerCase()}`}>
                  {payoutStatusLabel(copy, payout.status)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-help">{copy.noPayouts}</p>
        )}
      </section>

      {!pending ? (
        <section className="portal-section">
          <PortalPayoutForm
            campaignId={campaign.id}
            availableCents={availability.available}
            availableLabel={formatMoneyExact(availability.available, campaign.currency, money)}
            amountHint={copy.payoutAmountHint(formatMoneyExact(availability.available, campaign.currency, money))}
            currency={campaign.currency}
            copy={portalStrings(copy)}
            defaults={
              lastPayout
                ? {
                    accountHolderName: lastPayout.accountHolderName,
                    holderAddress: lastPayout.holderAddress,
                    holderCountry: lastPayout.holderCountry,
                    bankName: lastPayout.bankName,
                    bankCountry: lastPayout.bankCountry,
                    bankAddress: lastPayout.bankAddress ?? "",
                    accountType: (lastPayout.accountType as "" | "checking" | "savings" | null) ?? "",
                    routingNumber: lastPayout.routingNumber ?? "",
                    swiftBic: lastPayout.swiftBic ?? "",
                    intermediaryBank: lastPayout.intermediaryBank ?? "",
                  }
                : { accountHolderName: organizer.name }
            }
          />
        </section>
      ) : null}
    </PortalCampaignFrame>
  );
}
