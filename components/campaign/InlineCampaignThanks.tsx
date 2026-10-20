import Link from "next/link";
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Heart,
  Mail,
  Route,
} from "lucide-react";
import { ClearCampaignReturnQuery } from "@/components/campaign/ClearCampaignReturnQuery";
import { ThankYouCommentForm } from "@/components/campaign/ThankYouCommentForm";
import { formatMoney } from "@/lib/utils";

type Props = {
  affiliatePageId: string;
  campaignTitle: string;
  campaignPath: string;
  sale: {
    id: string;
    amount: number;
    currency: string;
    customerName: string;
    customerEmail: string | null;
    paidAt: Date | null;
    createdAt: Date;
    trackingCode: string | null;
    comment: { id: string } | null;
  };
};

export function InlineCampaignThanks({
  affiliatePageId,
  campaignTitle,
  campaignPath,
  sale,
}: Props) {
  const paidDate = sale.paidAt ?? sale.createdAt;
  const receiptNumber = `RCPT-${paidDate
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")}-${sale.id.slice(0, 6).toUpperCase()}`;
  const trackingHref = sale.trackingCode
    ? `/track-your-donation?code=${encodeURIComponent(sale.trackingCode)}`
    : "/track-your-donation";

  return (
    <main className="thanks-shell">
      <ClearCampaignReturnQuery affiliatePageId={affiliatePageId} />
      <div className="thanks-card">
        <div className="thanks-hero">
          <span className="thanks-success-icon">
            <CheckCircle2 size={48} aria-hidden />
          </span>
          <h1>
            Thank you! <Heart size={25} fill="currentColor" aria-hidden />
          </h1>
          <p>
            Here&apos;s your confirmation — and the official record of your gift
            toward <strong>{campaignTitle}</strong>.
          </p>
        </div>

        <section className="thanks-receipt">
          <div className="thanks-receipt-head">
            <span>Confirmation</span>
            <strong>
              <BadgeCheck size={15} aria-hidden />
              Confirmed
            </strong>
          </div>
          <dl>
            <div>
              <dt>Receipt no.</dt>
              <dd>{receiptNumber}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>
                {paidDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </dd>
            </div>
            <div>
              <dt>Tracking code</dt>
              <dd>{sale.trackingCode ?? "Assigned after confirmation"}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>Card</dd>
            </div>
            <div className="thanks-receipt-total">
              <dt>Total</dt>
              <dd>{formatMoney(sale.amount, sale.currency)}</dd>
            </div>
          </dl>
        </section>

        <div className="thanks-certified">
          <Check size={16} aria-hidden />
          Certified · a better human
        </div>

        <section className="thanks-impact">
          <p>You just made the world a little kinder. Your gift helps:</p>
          <ul>
            <li>
              <Check size={17} aria-hidden />
              Move this campaign closer to its verified goal.
            </li>
            <li>
              <Check size={17} aria-hidden />
              Fund the practical needs described by the organizer.
            </li>
            <li>
              <Check size={17} aria-hidden />
              Show the next supporter that this cause has real momentum.
            </li>
          </ul>
        </section>

        <div className="thanks-email-note">
          <Mail size={18} aria-hidden />
          <span>
            {sale.customerEmail
              ? `A confirmation will be sent to ${sale.customerEmail}.`
              : "Your payment confirmation is securely recorded by Stripe."}
          </span>
        </div>

        <div className="thanks-actions">
          <Link className="primary-button thanks-home-button" href={campaignPath}>
            View your donation on the campaign
          </Link>
          <Link className="secondary-button thanks-track-button" href={trackingHref}>
            <Route size={18} aria-hidden />
            Track your donation
          </Link>
        </div>

        <div className="thanks-comment-panel">
          <ThankYouCommentForm
            saleId={sale.id}
            campaignPath={campaignPath}
            defaultName={sale.customerName === "Anonymous" ? "" : sale.customerName}
            alreadyCommented={Boolean(sale.comment)}
            existingCommentId={sale.comment?.id ?? null}
          />
        </div>
      </div>
      <p className="thanks-footer">
        Thank you for your support <Heart size={13} fill="currentColor" aria-hidden />
      </p>
    </main>
  );
}
