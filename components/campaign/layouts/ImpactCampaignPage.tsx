import { ShieldCheck } from "lucide-react";
import { ImpactCoverCarousel } from "@/components/campaign/ImpactCoverCarousel";
import { ImpactActivity } from "@/components/campaign/ImpactActivity";
import { ImpactConversionWidget } from "@/components/campaign/ImpactConversionWidget";
import { OrganizerAvatar } from "@/components/campaign/OrganizerAvatar";
import { EmphasizedText } from "@/components/campaign/EmphasizedText";
import { VerifiedTick } from "@/components/campaign/VerifiedTick";
import { ImpactOrganizers } from "@/components/campaign/ImpactOrganizers";
import { DonateModalProvider } from "@/components/campaign/DonateModalContext";
import { ImpactSharePreview } from "@/components/campaign/ImpactSharePreview";
import { ImpactStickyBar } from "@/components/campaign/ImpactStickyBar";
import { ImpactStoryBody } from "@/components/campaign/ImpactStoryBody";
import { CampaignGallery } from "@/components/campaign/CampaignGallery";
import { CampaignDocuments } from "@/components/campaign/CampaignDocuments";
import { ImpactUpdates } from "@/components/campaign/ImpactUpdates";
import { ImpactValuesBlock } from "@/components/campaign/ImpactValuesBlock";
import { RelatedCampaignsCarousel } from "@/components/campaign/RelatedCampaignsCarousel";
import { CampaignGiveBlock } from "@/components/campaign/CampaignGiveBlock";
import { CampaignCheckoutModal } from "@/components/campaign/CampaignCheckoutModal";
import { PublicHeader } from "@/components/public/PublicHeader";
import type { SearchCampaign, SearchOrg } from "@/components/public/ImpactSearch";
import { ImpactSiteFooter } from "@/components/public/ImpactSiteFooter";
import { withPublicPrefix } from "@/lib/public-site-url";
import { isAnonymousDonorName } from "@/lib/social-proof";
import { withoutAiDashes } from "@/lib/campaign-comments";
import { campaignStageView } from "@/lib/campaign-stages";
import { plainStoryText } from "@/lib/story-text";
import { formatMoney } from "@/lib/utils";
import type { CampaignLayoutProps } from "@/components/campaign/layouts/types";

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function coverDonorInitials(
  donations: Array<{ name: string }>,
  organizerName: string,
): [string, string] {
  const letters: string[] = [];
  for (const donation of donations) {
    if (isAnonymousDonorName(donation.name)) continue;
    const letter = donation.name.trim().charAt(0).toUpperCase();
    if (letter && !letters.includes(letter)) letters.push(letter);
    if (letters.length === 2) break;
  }
  const fallback = organizerName.trim().charAt(0).toUpperCase() || "A";
  return [letters[0] ?? fallback, letters[1] ?? fallback];
}

function excerptForCover(summary: string, story: string, max = 240) {
  const text = plainStoryText(summary || story).replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

function formatCampaignCreated(date: Date | string, locale: string) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "es-AR" ? "es-AR" : locale === "es-MX" ? "es-MX" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

export function ImpactCampaignPage({
  theme,
  siteName,
  logoUrl,
  footerText,
  locale,
  messages,
  pathPrefix,
  checkoutHref,
  affiliatePageId,
  percent,
  raisedAmount,
  campaign,
  donations,
  related,
  personalSale,
  searchOrgs = [],
  searchCampaigns: catalog = [],
  institutional = false,
  contactEmail = null,
  contactPhone = null,
  contactAddress = null,
  nonprofitEin = null,
  nonprofitName = null,
  checkoutOptions = [],
  googlePixelId = null,
  tiktokPixelId = null,
  embeddedCheckout = false,
  publishableKey = "",
  paypalClientId = "",
}: CampaignLayoutProps & {
  searchOrgs?: SearchOrg[];
  searchCampaigns?: SearchCampaign[];
  institutional?: boolean;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  nonprofitEin?: string | null;
  nonprofitName?: string | null;
  checkoutOptions?: Array<{
    id: string;
    amount: number;
    suggested: boolean;
    paymentLinkId: string | null;
  }>;
  googlePixelId?: string | null;
  tiktokPixelId?: string | null;
  embeddedCheckout?: boolean;
  publishableKey?: string;
  paypalClientId?: string;
}) {
  const shownRaised = raisedAmount ?? campaign.currentAmount ?? 0;
  const stage = campaignStageView({ ...campaign, currentAmount: shownRaised });
  const createdDate = formatCampaignCreated(campaign.createdAt, locale);
  const createdLabel = createdDate
    ? messages.campaign.created.replace("{date}", createdDate)
    : null;
  const countLabel = campaign.supporterCount.toLocaleString(locale);
  const latestDonation = donations[0];
  const latestDonor = latestDonation
    ? isAnonymousDonorName(latestDonation.name)
      ? messages.campaign.anonymous
      : latestDonation.name
    : null;
  const otherDonors = Math.max(0, campaign.supporterCount - (latestDonor ? 1 : 0));
  const socialProof = latestDonor
    ? messages.campaign.othersDonated(
        latestDonor,
        otherDonors.toLocaleString(locale),
      )
    : messages.campaign.donationsCount(countLabel);
  const campaignHref = checkoutHref.split("?")[0].replace(/\/checkout$/, "");
  const organizerName = (campaign.organizerName ?? "").trim() || siteName;
  const organizerImageUrl = campaign.organizerImageUrl;
  const showYou = Boolean(personalSale?.livemode);
  const coverInitials = coverDonorInitials(donations, organizerName);
  const seenHrefs = new Set<string>([campaignHref]);
  const fromRelated = related.flatMap((item) => {
    if (seenHrefs.has(item.href)) return [];
    seenHrefs.add(item.href);
    return [
      {
        href: item.href,
        title: item.title,
        category: item.category,
        coverImageUrl: item.coverImageUrl,
        organizer: item.organizerName?.trim() || siteName,
        currentAmount: item.currentAmount,
        goalAmount: item.goalAmount,
        currency: item.currency,
      },
    ];
  });
  const fromCatalog = catalog.flatMap((item) => {
    if (seenHrefs.has(item.href)) return [];
    seenHrefs.add(item.href);
    return [item];
  });
  const searchCampaigns = [
    {
      href: campaignHref,
      title: campaign.title,
      category: campaign.category,
      coverImageUrl: campaign.coverImageUrl,
      organizer: organizerName,
      currentAmount: shownRaised,
      goalAmount: stage.goalAmount,
      currency: campaign.currency,
    },
    ...fromCatalog,
    ...fromRelated,
  ];

  return (
    <DonateModalProvider scrollTarget={embeddedCheckout ? "give" : undefined}>
    <div className={`impact-campaign${institutional ? " inst-site" : ""}`} style={theme}>
      <PublicHeader
        variant="impact"
        siteName={siteName}
        logoUrl={logoUrl}
        donateHref={checkoutHref}
        messages={messages}
        locale={locale}
        pathPrefix={pathPrefix}
        searchCampaigns={searchCampaigns}
        searchOrgs={searchOrgs}
        campaignHref={campaignHref}
        institutional
      />

      <main className="impact-main">
        <div className="impact-shell">
          <div className="impact-grid">
            <div className="impact-hero">
              <div className="impact-cover">
                <ImpactCoverCarousel
                  alt={campaign.title}
                  coverImageUrl={campaign.coverImageUrl}
                  galleryImageUrls={campaign.galleryImageUrls}
                  focusX={campaign.coverFocusX}
                  focusY={campaign.coverFocusY}
                  coverPhotosLabel={messages.campaign.coverPhotos}
                  photoOfLabel={messages.campaign.photoOf}
                  previousLabel={messages.campaign.previousPhoto}
                  nextLabel={messages.campaign.nextPhoto}
                  summary={{
                    excerpt: excerptForCover(campaign.summary, campaign.story),
                    donorCountLabel: messages.campaign.donorsShort.replace(
                      "{count}",
                      campaign.supporterCount.toLocaleString(locale),
                    ),
                    percent,
                    readStoryLabel: messages.campaign.readStory,
                    initials: coverInitials,
                  }}
                >
                  <p className="impact-byline">
                    <OrganizerAvatar
                      className="impact-byline-avatar"
                      name={organizerName}
                      imageUrl={organizerImageUrl}
                    />
                    <span className="impact-byline-name">
                      <EmphasizedText
                        text={organizerName}
                        bold={campaign.organizerBoldText}
                      />
                      {campaign.organizerVerified !== false ? <VerifiedTick /> : null}
                    </span>
                  </p>
                </ImpactCoverCarousel>
                <h1 className="impact-title">
                  <EmphasizedText text={campaign.title} bold={campaign.titleBoldText} />
                </h1>
              </div>
            </div>

            <div className="impact-lead">
              <ImpactStoryBody
                variant="excerpt"
                heading={campaign.storyHeading}
                story={campaign.story}
                readMoreLabel={messages.campaign.readMore}
                locale={locale}
                checkoutHref={checkoutHref}
                donations={donations}
                comments={(campaign.comments ?? []).map((comment) => ({
                  id: comment.id,
                  authorName: comment.authorName,
                  body: withoutAiDashes(comment.body),
                  createdAt: toIso(comment.createdAt),
                }))}
              />
            </div>

            <ImpactConversionWidget
              raisedAmount={shownRaised}
              campaign={campaign}
              locale={locale}
              checkoutHref={checkoutHref}
              percent={percent}
              donations={donations}
              showYou={showYou}
              socialProof={socialProof}
              donateLabel={messages.nav.donate}
              give={
                embeddedCheckout ? (
                  <CampaignGiveBlock
                    affiliatePageId={affiliatePageId}
                    campaignPath={campaignHref}
                    campaignTitle={campaign.title}
                    currency={campaign.currency}
                    locale={locale}
                    options={checkoutOptions}
                    showMissionTip={campaign.showMissionTip !== false}
                    missionTipBold={campaign.missionTipBold === true}
                    percent={percent}
                    recentDonations={donations}
                    googlePixelId={googlePixelId}
                    tiktokPixelId={tiktokPixelId}
                    publishableKey={publishableKey}
                    paypalClientId={paypalClientId}
                    causeSlug={campaign.slug}
                  />
                ) : null
              }
            />

            <div className="impact-story">
              <ImpactStoryBody
                variant="full"
                heading={campaign.storyHeading}
                story={campaign.story}
                readMoreLabel={messages.campaign.readMore}
                locale={locale}
                checkoutHref={checkoutHref}
                donations={donations}
                comments={(campaign.comments ?? []).map((comment) => ({
                  id: comment.id,
                  authorName: comment.authorName,
                  body: withoutAiDashes(comment.body),
                  createdAt: toIso(comment.createdAt),
                }))}
                badge={
                  <span className="impact-trust-badge">
                    <ShieldCheck size={14} />
                    {messages.campaign.protectedGift}
                  </span>
                }
              />

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

              <ImpactOrganizers
                heading={messages.campaign.organizers}
                name={organizerName}
                boldText={campaign.organizerBoldText}
                verified={campaign.organizerVerified !== false}
                imageUrl={organizerImageUrl}
                role={messages.campaign.organizerRole}
                messageLabel={messages.campaign.message}
                messageHref={withPublicPrefix(pathPrefix, "/start-a-fundraiser")}
                createdLabel={createdLabel}
                category={campaign.category}
              />

              <ImpactUpdates
                raisedAmount={shownRaised}
                campaign={campaign}
                locale={locale}
                messages={messages}
                checkoutHref={checkoutHref}
                percent={percent}
                organizerName={organizerName}
                organizerImageUrl={organizerImageUrl}
                showYou={showYou}
              />

              <div id="donations">
                <ImpactActivity
                  donations={donations}
                  comments={campaign.comments.map((comment) => ({
                    id: comment.id,
                    authorName: comment.authorName,
                    body: withoutAiDashes(comment.body),
                    createdAt: toIso(comment.createdAt),
                    replies: comment.replies.map((reply) => ({
                      id: reply.id,
                      authorName: reply.authorName,
                      body: withoutAiDashes(reply.body),
                      createdAt: toIso(reply.createdAt),
                    })),
                  }))}
                  supporterCount={campaign.supporterCount}
                  commentsLead={campaign.commentsDescription}
                  locale={locale}
                  checkoutHref={checkoutHref}
                  affiliatePageId={affiliatePageId}
                  donor={
                    personalSale?.livemode
                      ? {
                          saleId: personalSale.id,
                          name: isAnonymousDonorName(
                            personalSale.customerName ?? "",
                          )
                            ? messages.campaign.anonymous
                            : personalSale.customerName?.trim() ||
                              messages.campaign.anonymous,
                          hasComment: Boolean(personalSale.hasComment),
                          hasReply: Boolean(personalSale.hasReply),
                        }
                      : null
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <ImpactSharePreview
          heading={messages.campaign.shareHeading}
          lead={messages.campaign.shareLead}
          title={campaign.title}
          siteName={organizerName}
          organizedBy={messages.campaign.organizedBy}
          coverImageUrl={campaign.coverImageUrl}
          coverFocusX={campaign.coverFocusX}
          coverFocusY={campaign.coverFocusY}
          checkoutHref={checkoutHref}
          donateLabel={messages.campaign.donateNow}
          raisedLabel={`${formatMoney(shownRaised, campaign.currency, locale)} ${messages.campaign.raisedSuffix}`}
          percent={percent}
          campaignId={campaign.id}
          shareLabel={messages.campaign.share}
          copiedLabel={messages.campaign.linkCopied}
        />

        <ImpactValuesBlock
          heading={messages.campaign.valuesHeading}
          easyTitle={messages.campaign.valuesEasyTitle}
          easyBody={messages.campaign.valuesEasyBody}
          powerfulTitle={messages.campaign.valuesPowerfulTitle}
          powerfulBody={messages.campaign.valuesPowerfulBody}
          trustedTitle={messages.campaign.valuesTrustedTitle}
          trustedBodyBefore={messages.campaign.valuesTrustedBodyBefore}
          trustedGuarantee={messages.campaign.valuesTrustedGuarantee}
          trustedBodyAfter={messages.campaign.valuesTrustedBodyAfter}
          refundHref={withPublicPrefix(pathPrefix, "/refund")}
        />

        <RelatedCampaignsCarousel
          items={related}
          heading={messages.campaign.relatedHeading}
          ofGoalLabel={messages.campaign.ofGoal}
          percentLabel={messages.campaign.relatedPercent}
          previousLabel={messages.campaign.previousCampaigns}
          nextLabel={messages.campaign.nextCampaigns}
          showWorldwideCta
          worldwideHref={withPublicPrefix(pathPrefix, "/start-a-fundraiser")}
          worldwideLabel={messages.campaign.happeningWorldwide}
        />
      </main>

      <ImpactSiteFooter
        siteName={siteName}
        footerText={footerText}
        messages={messages}
        pathPrefix={pathPrefix}
        donateHref={checkoutHref}
        institutional={institutional}
        contactEmail={contactEmail}
        contactPhone={contactPhone}
        contactAddress={contactAddress}
      />

      <ImpactStickyBar
        percent={percent}
        raised={formatMoney(shownRaised, campaign.currency, locale)}
        raisedSuffix={messages.campaign.raisedSuffix}
        ofLabel={messages.campaign.ofGoal}
        goal={formatMoney(stage.goalAmount, campaign.currency, locale)}
        stageCompletedLabel={stage.stageCompletedLabel}
        socialProof={socialProof}
        checkoutHref={checkoutHref}
        donateLabel={messages.nav.donate}
        campaignId={campaign.id}
        title={campaign.title}
        shareLabel={messages.campaign.share}
        copiedLabel={messages.campaign.linkCopied}
        proofHref="#recent-donations"
        showYou={showYou}
      />
      {embeddedCheckout ? null : (
        <CampaignCheckoutModal
          affiliatePageId={affiliatePageId}
          campaignPath={campaignHref}
          currency={campaign.currency}
          locale={locale}
          options={checkoutOptions}
          showMissionTip={campaign.showMissionTip !== false}
          missionTipBold={campaign.missionTipBold === true}
          siteName={siteName}
          campaignTitle={campaign.title}
          recentDonations={donations}
          termsHref={withPublicPrefix(pathPrefix, "/terms")}
          privacyHref={withPublicPrefix(pathPrefix, "/privacy")}
          refundHref={withPublicPrefix(pathPrefix, "/refund")}
          googlePixelId={googlePixelId}
          tiktokPixelId={tiktokPixelId}
        />
      )}
    </div>
    </DonateModalProvider>
  );
}
