"use client";

import { useEffect } from "react";
import { ShieldCheck, X } from "lucide-react";
import { ImpactCheckoutPanel } from "@/components/checkout/ImpactCheckoutPanel";
import { useDonateModal } from "@/components/campaign/DonateModalContext";
import type { CheckoutOption, CheckoutRecentDonation } from "@/components/checkout/useCheckoutPayment";
import { messagesFor } from "@/lib/i18n";

export function CampaignCheckoutModal({
  affiliatePageId,
  campaignPath,
  currency,
  locale,
  options,
  showMissionTip = true,
  missionTipBold = false,
  siteName,
  campaignTitle,
  recentDonations,
  termsHref,
  privacyHref,
  refundHref,
  googlePixelId,
  tiktokPixelId,
}: {
  affiliatePageId: string;
  campaignPath: string;
  currency: string;
  locale: string;
  options: CheckoutOption[];
  showMissionTip?: boolean;
  missionTipBold?: boolean;
  siteName: string;
  campaignTitle: string;
  recentDonations: CheckoutRecentDonation[];
  termsHref: string;
  privacyHref: string;
  refundHref: string;
  googlePixelId?: string | null;
  tiktokPixelId?: string | null;
}) {
  const messages = messagesFor(locale);
  const modal = useDonateModal();

  useEffect(() => {
    if (!modal?.isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") modal.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  if (!modal?.isOpen) return null;

  return (
    <div className="glass-donate-layer" role="dialog" aria-modal="true" aria-label={messages.checkout.title}>
      <button
        type="button"
        className="glass-donate-backdrop"
        aria-label={messages.nav.closeMenu}
        onClick={modal.close}
      />
      <div className="glass-donate-modal">
        <button type="button" className="glass-donate-close" onClick={modal.close}>
          <X size={18} strokeWidth={2.2} aria-hidden />
          <span className="sr-only">{messages.nav.closeMenu}</span>
        </button>
        <header className="glass-donate-head">
          <p>
            <ShieldCheck size={16} strokeWidth={2.2} aria-hidden />
            {messages.campaign.protectedGift}
          </p>
          <strong>{campaignTitle}</strong>
        </header>
        <ImpactCheckoutPanel
          affiliatePageId={affiliatePageId}
          campaignPath={campaignPath}
          currency={currency}
          locale={locale}
          options={options}
          showMissionTip={showMissionTip}
          missionTipBold={missionTipBold}
          embeddedCheckout
          googlePixelId={googlePixelId}
          tiktokPixelId={tiktokPixelId}
          recentDonations={recentDonations}
          siteName={siteName}
          termsHref={termsHref}
          privacyHref={privacyHref}
          refundHref={refundHref}
        />
      </div>
    </div>
  );
}
