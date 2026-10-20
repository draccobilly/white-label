import type { Metadata } from "next";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import { TrackDonationLookup } from "@/components/track/TrackDonationLookup";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getPublicPageChrome();
  return {
    title: messages.track.title,
    description: messages.track.description,
  };
}

export default async function TrackYourDonationPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const [query, chrome] = await Promise.all([
    searchParams,
    getPublicPageChrome(),
  ]);
  const track = chrome.messages.track;
  const phone = chrome.brand.contactPhone;
  const email = chrome.brand.contactEmail;

  return (
    <PublicSiteShell chrome={chrome}>
      <main className="track-page">
        <div className="shell track-page-inner">
          <p className="inst-kicker">{chrome.brand.siteName}</p>
          <h1>{track.title}</h1>
          <p className="inst-lead">{track.lead}</p>

          <div className="track-explain">
            <article>
              <h2>{track.whereTitle}</h2>
              <p>{track.whereBody}</p>
            </article>
            <article>
              <h2>{track.whatTitle}</h2>
              <p>{track.whatBody}</p>
            </article>
          </div>

          <TrackDonationLookup
            initialCode={query.code ?? ""}
            pathPrefix={chrome.pathPrefix}
            labels={track}
          />

          <section className="track-faq" aria-labelledby="track-faq-heading">
            <h2 id="track-faq-heading">{chrome.messages.site.faqHeading}</h2>
            <dl className="inst-faq-list">
              <div>
                <dt>{track.faqCodeQ}</dt>
                <dd>{track.faqCodeA}</dd>
              </div>
              <div>
                <dt>{track.faqTimeQ}</dt>
                <dd>{track.faqTimeA}</dd>
              </div>
            </dl>
            <p>{track.contactPrompt}</p>
            <div className="inst-hero-actions">
              {email ? (
                <a className="secondary-button" href={`mailto:${email}`}>
                  {email}
                </a>
              ) : null}
              {phone ? (
                <a className="primary-button" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                  {phone}
                </a>
              ) : null}
              <a className="secondary-button" href={withPublicPrefix(chrome.pathPrefix, "/help")}>
                {track.helpCta}
              </a>
            </div>
          </section>
        </div>
      </main>
    </PublicSiteShell>
  );
}
