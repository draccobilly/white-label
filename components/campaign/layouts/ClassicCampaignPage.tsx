import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { CampaignActivity } from "@/components/campaign/CampaignActivity";
import { CampaignEngagement } from "@/components/campaign/CampaignEngagement";
import { CoverMedia } from "@/components/campaign/CoverMedia";
import { EmphasizedText } from "@/components/campaign/EmphasizedText";
import { CampaignGallery } from "@/components/campaign/CampaignGallery";
import { CampaignDocuments } from "@/components/campaign/CampaignDocuments";
import { PersonalDonationProgress } from "@/components/campaign/PersonalDonationProgress";
import { StageGoal } from "@/components/campaign/StageGoal";
import { StoryText } from "@/components/campaign/StoryText";
import { RelatedCampaignsCarousel } from "@/components/campaign/RelatedCampaignsCarousel";
import { SocialProofCarousel } from "@/components/campaign/SocialProofCarousel";
import { PaymentMethodBadges } from "@/components/checkout/PaymentMethodBadges";
import { PublicHeader } from "@/components/public/PublicHeader";
import { campaignStageView } from "@/lib/campaign-stages";
import { formatMoney, formatRelativeTime } from "@/lib/utils";
import type { CampaignLayoutProps } from "@/components/campaign/layouts/types";

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

export function ClassicCampaignPage({
  theme,
  siteName,
  logoUrl,
  footerText,
  locale,
  messages,
  pathPrefix,
  paymentGateway,
  checkoutHref,
  percent,
  raisedAmount,
  campaign,
  donations,
  socialDonations,
  personalSale,
  related,
}: CampaignLayoutProps) {
  const shownRaised = raisedAmount ?? 0;
  const stage = campaignStageView({ ...campaign, currentAmount: shownRaised });
  return (
    <div className="campaign-page" style={theme}>
      <PublicHeader
        siteName={siteName}
        logoUrl={logoUrl}
        donateHref={checkoutHref}
        messages={messages}
        locale={locale}
        pathPrefix={pathPrefix}
      />

      <main>
        <section className="campaign-hero">
          {campaign.coverImageUrl ? (
            <CoverMedia
              src={campaign.coverImageUrl}
              alt={campaign.title}
              priority
              sizes="100vw"
              focusX={campaign.coverFocusX}
              focusY={campaign.coverFocusY}
            />
          ) : (
            <div className="campaign-hero-fallback" aria-hidden />
          )}
          <div className="campaign-hero-copy">
            {campaign.category ? (
              <span className="campaign-kicker">{campaign.category}</span>
            ) : null}
            <h1 className="campaign-title">
              <EmphasizedText text={campaign.title} bold={campaign.titleBoldText} />
            </h1>
          </div>
        </section>

        <div className="campaign-main">
          <div className="shell campaign-grid">
            <div className="campaign-content">
              <div className="campaign-overview">
                <div className="metric-line">
                  <strong>
                    {formatMoney(shownRaised, campaign.currency, locale)}
                  </strong>
                  <span>
                    {messages.campaign.raisedOf}{" "}
                    <StageGoal
                      amount={formatMoney(stage.goalAmount, campaign.currency, locale)}
                      stageCompletedLabel={stage.stageCompletedLabel}
                      amountClassName="metric-goal-amount"
                    />
                  </span>
                </div>
                <p className="supporter-count">
                  {campaign.supporterCount.toLocaleString(locale)}{" "}
                  {messages.campaign.supporters}
                </p>
                <CampaignEngagement
                  campaignId={campaign.id}
                  title={campaign.title}
                  likeCount={campaign.likeCount}
                  shareCount={campaign.shareCount}
                  locale={locale}
                />
                <PersonalDonationProgress
                  currentAmount={shownRaised}
                  goalAmount={stage.goalAmount}
                  personalSale={personalSale}
                  label={`Campaign progress ${percent}%`}
                />
                <SocialProofCarousel
                  donations={socialDonations}
                  supporterCount={campaign.supporterCount}
                />
              </div>

              <p className="campaign-summary">{campaign.summary}</p>

              <article id="story" className="story">
                <h2>{campaign.storyHeading}</h2>
                <StoryText text={campaign.story} />
              </article>

              <CampaignGallery
                heading={messages.campaign.gallery}
                images={campaign.galleryImageUrls}
                campaignTitle={campaign.title}
                closeLabel={messages.campaign.closePhoto}
                previousLabel={messages.campaign.previousPhoto}
                nextLabel={messages.campaign.nextPhoto}
              />

              <CampaignDocuments
                heading={messages.campaign.documents}
                images={campaign.verificationDocumentUrls}
                note={campaign.verificationNote}
                campaignTitle={campaign.title}
                closeLabel={messages.campaign.closePhoto}
                previousLabel={messages.campaign.previousPhoto}
                nextLabel={messages.campaign.nextPhoto}
              />

              {campaign.updates?.length ? (
                <section id="updates" className="campaign-updates">
                  <h2>{messages.campaign.updates}</h2>
                  <ul className="campaign-updates-list">
                    {campaign.updates.map((update) => (
                      <li key={update.id} className="campaign-update">
                        <time dateTime={new Date(update.createdAt).toISOString()}>
                          {formatRelativeTime(update.createdAt, locale)}
                        </time>
                        {update.title ? (
                          <h3 className="campaign-update-title">{update.title}</h3>
                        ) : null}
                        <p className="campaign-update-body">{update.body}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <CampaignActivity
                donations={donations}
                comments={campaign.comments.map((comment) => ({
                  id: comment.id,
                  authorName: comment.authorName,
                  body: comment.body,
                  createdAt: toIso(comment.createdAt),
                  replies: comment.replies.map((reply) => ({
                    id: reply.id,
                    authorName: reply.authorName,
                    body: reply.body,
                    createdAt: toIso(reply.createdAt),
                  })),
                }))}
                supporterCount={campaign.supporterCount}
                recentLead={campaign.recentDonationsDescription}
                commentsLead={campaign.commentsDescription}
                locale={locale}
              />
            </div>

            <aside className="donation-aside">
              <div className="donation-card">
                <div className="metric-line">
                  <strong>
                    {formatMoney(shownRaised, campaign.currency, locale)}
                  </strong>
                  <span>
                    {messages.campaign.ofGoal}{" "}
                    <StageGoal
                      amount={formatMoney(stage.goalAmount, campaign.currency, locale)}
                      stageCompletedLabel={stage.stageCompletedLabel}
                      amountClassName="metric-goal-amount"
                    />
                  </span>
                </div>
                <p className="supporter-count">
                  {messages.campaign.supportersPercent(
                    campaign.supporterCount.toLocaleString(locale),
                    percent,
                  )}
                </p>
                <CampaignEngagement
                  campaignId={campaign.id}
                  title={campaign.title}
                  likeCount={campaign.likeCount}
                  shareCount={campaign.shareCount}
                  locale={locale}
                />
                <PersonalDonationProgress
                  currentAmount={shownRaised}
                  goalAmount={stage.goalAmount}
                  personalSale={personalSale}
                />
                <SocialProofCarousel
                  donations={socialDonations}
                  supporterCount={campaign.supporterCount}
                />
                <Link
                  href={checkoutHref}
                  className="primary-button donate-card-cta"
                >
                  {messages.campaign.donateNow}
                </Link>
                <div className="trust-row">
                  <LockKeyhole size={15} />
                  {messages.campaign.secureDonation}
                </div>
                <div className="aside-protection">
                  <ShieldCheck size={18} color="var(--green)" />
                  <span>
                    {paymentGateway === "PAGNOVO"
                      ? messages.campaign.protectedCheckoutPagnovo
                      : messages.campaign.protectedCheckout}
                  </span>
                </div>
                <PaymentMethodBadges
                  gateway={paymentGateway}
                  locale={locale}
                  currency={campaign.currency}
                />
              </div>
            </aside>
          </div>
        </div>

        <RelatedCampaignsCarousel items={related} />
      </main>

      <footer className="public-footer">
        <div className="shell">
          <BrandLogo compact siteName={siteName} logoUrl={logoUrl} href="/" />
          <p>{footerText}</p>
        </div>
      </footer>

      <div className="mobile-donate">
        <div className="mobile-donate-meta">
          <strong>
            {formatMoney(shownRaised, campaign.currency, locale)}
          </strong>
          <span>{messages.campaign.funded(percent)}</span>
        </div>
        <Link className="primary-button" href={checkoutHref}>
          {messages.campaign.donateNow}
        </Link>
      </div>
    </div>
  );
}
