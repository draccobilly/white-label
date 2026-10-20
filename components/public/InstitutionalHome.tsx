import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  FileText,
  HeartHandshake,
  HeartPulse,
  Home,
  Landmark,
  PersonStanding,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SiteMission } from "@/components/public/SiteMission";
import { HomeDonateSection } from "@/components/public/HomeDonateSection";
import { HomeFaq } from "@/components/public/HomeFaq";
import { paypalPublicClientId } from "@/lib/paypal";
import "./institutional-home.css";
import { ImpactCampaignGrid } from "@/components/public/ImpactCampaignGrid";
import { ProgramsInAction } from "@/components/public/ProgramsInAction";
import type { PublicSitePost } from "@/lib/site-posts";
import { postPath } from "@/lib/site-posts";
import { withPublicPrefix } from "@/lib/public-site-url";
import type { getPublicPageChrome } from "@/lib/public-campaigns";

type Chrome = Awaited<ReturnType<typeof getPublicPageChrome>>;

function splitHeading(value: string) {
  const [first, ...rest] = value.split("\n");
  return { first, accent: rest.join(" ").trim() };
}

function ComposePanel({
  variant,
  chips,
}: {
  variant: "hero" | "start";
  chips: string[];
}) {
  return (
    <div className={`wh-compose wh-compose--${variant}`} aria-hidden>
      <span className="wh-compose-glow" />
      <span className="wh-compose-orb a" />
      <span className="wh-compose-orb b" />
      <span className="wh-compose-orb c" />
      {variant === "hero" ? (
        <ul className="wh-compose-chips">
          {chips.map((chip) => (
            <li key={chip}>{chip}</li>
          ))}
        </ul>
      ) : (
        <div className="wh-compose-letter">
          <span />
          <span />
          <span />
          <strong>{chips[0]}</strong>
        </div>
      )}
    </div>
  );
}

export function InstitutionalHome({
  chrome,
  updates,
  programs,
}: {
  chrome: Chrome;
  updates: PublicSitePost[];
  programs: PublicSitePost[];
}) {
  const { messages, pathPrefix, campaigns, brand } = chrome;
  const site = messages.site;
  const hero = splitHeading(site.heroTitle);
  const prefix = pathPrefix;
  const startHref = withPublicPrefix(prefix, "/start-a-fundraiser");
  const docsHref = withPublicPrefix(prefix, "/accountability");
  const ein = brand.nonprofitEin;
  const orgName = brand.nonprofitName || brand.siteName;
  const photos = updates.filter((update) => update.coverImageUrl).slice(0, 4);

  return (
    <main className="wh-home">
      <section className="wh-hero">
        <div className="shell">
          <div className="wh-hero-card">
            <div className="wh-hero-copy">
              <p className="wh-kicker">
                <HeartHandshake size={16} strokeWidth={2} aria-hidden />
                {site.kicker}
              </p>
              <h1>
                {hero.first}
                {hero.accent ? (
                  <>
                    <br />
                    <span className="wh-accent">{hero.accent}</span>
                  </>
                ) : null}
              </h1>
              <p>{site.heroLead}</p>
              <div className="wh-hero-actions">
                <a className="wh-cta" href="#campaigns">
                  {site.findCampaign}
                  <ArrowRight size={18} strokeWidth={2.2} aria-hidden />
                </a>
                <Link className="wh-ghost is-on-dark" href={startHref}>
                  {site.shareCtaButton}
                </Link>
              </div>
            </div>
            <ComposePanel
              variant="hero"
              chips={[
                messages.campaign.protectedGift,
                messages.checkout.oneTime,
                site.trackedReceipt,
              ]}
            />
          </div>
        </div>
      </section>

      <section className="wh-legal" aria-labelledby="wh-legal-heading">
        <div className="shell">
          <div className="wh-legal-card">
            <div className="wh-legal-mark" aria-hidden>
              <Landmark size={26} strokeWidth={1.8} />
            </div>
            <div className="wh-legal-copy">
              <p className="wh-kicker">{site.charityStatus}</p>
              <h2 id="wh-legal-heading">{site.charitySectionTitle}</h2>
              <p>{site.charitySectionLead}</p>
              <p className="wh-legal-meta">
                {orgName}
                {ein ? (
                  <>
                    <span aria-hidden>·</span>
                    {site.contactEin} {ein}
                  </>
                ) : null}
                {brand.contactAddress ? (
                  <>
                    <span aria-hidden>·</span>
                    {brand.contactAddress}
                  </>
                ) : null}
              </p>
            </div>
            <Link className="wh-legal-link" href={docsHref}>
              <FileText size={18} strokeWidth={2} aria-hidden />
              {site.charityDocuments}
            </Link>
          </div>
        </div>
      </section>

      <section className="ih-causes" id="causas" aria-labelledby="ih-cause-grid-heading">
        <div className="shell">
          <HomeDonateSection
            lang={chrome.locale?.toLowerCase().startsWith("es") ? "es" : "en"}
            paypalClientId={paypalPublicClientId()}
          />
        </div>
      </section>

      <SiteMission
        kicker={site.orgKicker}
        title={site.orgTitle}
        lead={site.orgLead}
        p1={site.orgP1}
        p2={site.orgP2}
        verseButton={site.verseButton}
        verseAnother={site.verseAnother}
      />

      <ProgramsInAction
        kicker={site.programsKicker}
        title={site.programsTitle}
        lead={site.programsLead}
        items={programs}
      />

      <section className="wh-field" aria-labelledby="wh-field-heading">
        <div className="shell wh-field-grid">
          <div className="wh-field-copy">
            <h2 id="wh-field-heading">
              {site.fieldMoments} <em>{site.fieldItalic}</em>
            </h2>
            <p>{site.fieldMomentsLead}</p>
            <Link className="wh-dark-cta" href={withPublicPrefix(prefix, "/updates")}>
              {site.readUpdates}
              <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
            </Link>
            <p className="wh-thanks">{site.fieldThanks}</p>
          </div>
          <div className="wh-polaroids" aria-hidden={photos.length === 0}>
            {photos.length ? (
              photos.map((update, index) => (
                <Link
                  key={update.id}
                  href={withPublicPrefix(prefix, postPath(update.kind, update.slug))}
                  className={`wh-polaroid wh-polaroid-${index + 1}`}
                >
                  <span
                    style={{ backgroundImage: `url(${update.coverImageUrl})` }}
                  />
                  <strong>{update.title}</strong>
                </Link>
              ))
            ) : (
              <p className="inst-empty">{site.updatesEmpty}</p>
            )}
            <p className="wh-polaroid-caption">{site.fromVisits}</p>
          </div>
        </div>
      </section>

      <section className="wh-quote" aria-labelledby="wh-quote-heading">
        <div className="shell wh-quote-grid">
          <div>
            <p className="wh-kicker">{site.quoteKicker}</p>
            <h2 id="wh-quote-heading">{site.quoteTitle}</h2>
          </div>
          <blockquote>
            <p>{site.quoteBody}</p>
            <footer>
              <strong>{site.quoteName}</strong>
              <span>{site.quoteRole}</span>
            </footer>
          </blockquote>
        </div>
      </section>

      <section className="wh-causes" aria-labelledby="wh-causes-heading">
        <div className="shell">
          <div className="wh-causes-head">
            <div>
              <p className="wh-kicker">{site.causesKicker}</p>
              <h2 id="wh-causes-heading">{site.causesHeading}</h2>
            </div>
            <div>
              <p>{site.causesLead}</p>
              <Link className="wh-text-link" href={withPublicPrefix(prefix, "/about-us")}>
                {site.meetOrg}
                <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
              </Link>
            </div>
          </div>
          <div className="wh-cause-track">
            <ul className="wh-cause-grid">
              <li>
                <HeartPulse size={22} strokeWidth={1.8} aria-hidden />
                <h3>{site.causeHealthTitle}</h3>
                <p>{site.causeHealthBody}</p>
              </li>
              <li>
                <PersonStanding size={22} strokeWidth={1.8} aria-hidden />
                <h3>{site.causeMobilityTitle}</h3>
                <p>{site.causeMobilityBody}</p>
              </li>
              <li>
                <Home size={22} strokeWidth={1.8} aria-hidden />
                <h3>{site.causeFamilyTitle}</h3>
                <p>{site.causeFamilyBody}</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="wh-stories" id="campaigns">
        <div className="shell">
          <div className="wh-stories-head">
            <div>
              <p className="wh-kicker">{site.storiesKicker}</p>
              <h2>{site.storiesHeading.replace("\n", " ")}</h2>
              <p className="wh-stories-lead">{site.storiesLead}</p>
            </div>
          </div>
          <ImpactCampaignGrid
            campaigns={campaigns}
            locale={chrome.locale}
            emptyLabel={site.emptyCampaigns}
            allLabel={site.allCampaigns}
            searchPlaceholder={site.searchPlaceholder}
            searchCta={site.searchCta}
            raisedSuffix={messages.campaign.raisedSuffix}
            ofGoalLabel={messages.campaign.ofGoal}
          />
        </div>
      </section>

      <section className="wh-how" aria-labelledby="wh-how-heading">
        <div className="shell wh-how-grid">
          <div>
            <p className="wh-kicker">{site.howKicker}</p>
            <h2 id="wh-how-heading">{site.howHeading}</h2>
            <Link className="wh-text-link" href={withPublicPrefix(prefix, "/how-it-works")}>
              {site.howItWorksCta}
              <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
          <ol className="wh-how-card">
            <li>
              <span>1</span>
              <div>
                <h3>{site.how1Title}</h3>
                <p>{site.how1Body}</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>{site.how2Title}</h3>
                <p>{site.how2Body}</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>{site.how3Title}</h3>
                <p>{site.how3Body}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="wh-start" aria-labelledby="wh-start-heading">
        <div className="shell">
          <div className="wh-start-card">
            <div className="wh-start-copy">
              <p className="wh-kicker">{site.navShare}</p>
              <h2 id="wh-start-heading">{site.shareCtaTitle}</h2>
              <p>{site.shareCtaLead}</p>
              <ul className="wh-start-points">
                <li>
                  <Clock3 size={18} strokeWidth={2} aria-hidden />
                  {site.shareLetterHint}
                </li>
                <li>
                  <ShieldCheck size={18} strokeWidth={2} aria-hidden />
                  {site.faq4a}
                </li>
                <li>
                  <Sparkles size={18} strokeWidth={2} aria-hidden />
                  {site.shareLead}
                </li>
              </ul>
              <div className="wh-start-actions">
                <Link className="wh-cta" href={startHref}>
                  {site.shareCtaButton}
                  <ArrowRight size={18} strokeWidth={2.2} aria-hidden />
                </Link>
                <Link
                  className="wh-ghost is-on-dark"
                  href={withPublicPrefix(prefix, "/how-it-works")}
                >
                  {site.howItWorksCta}
                </Link>
              </div>
            </div>
            <ComposePanel variant="start" chips={[site.shareCtaButton]} />
          </div>
        </div>
      </section>

      <HomeFaq
        heading={site.faqHeading}
        helpHref={withPublicPrefix(prefix, "/help")}
        helpLabel={site.visitHelp}
        items={[
          { question: site.faq1q, answer: site.faq1a },
          { question: site.faq2q, answer: site.faq2a },
          { question: site.faq3q, answer: site.faq3a },
          { question: site.faq4q, answer: site.faq4a },
        ]}
      />
    </main>
  );
}
