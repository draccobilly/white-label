import { CoverMedia } from "@/components/campaign/CoverMedia";
import { ImpactProgressRing } from "@/components/campaign/ImpactProgressRing";
import { ImpactShareButton } from "@/components/campaign/ImpactShareButton";
import { DonateTrigger } from "@/components/campaign/DonateModalContext";

type Props = {
  heading: string;
  lead: string;
  title: string;
  siteName: string;
  organizedBy: string;
  coverImageUrl: string | null;
  coverFocusX: number;
  coverFocusY: number;
  checkoutHref: string;
  donateLabel: string;
  raisedLabel: string;
  percent: number;
  campaignId: string;
  shareLabel: string;
  copiedLabel: string;
};

function ShareGlyph() {
  return (
    <svg
      className="impact-share-glyph"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="impact-share-ig-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#f58529" />
          <stop offset="45%" stopColor="#dd2a7b" />
          <stop offset="100%" stopColor="#8134af" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#impact-share-ig-grad)" />
      <circle
        cx="12"
        cy="12.2"
        r="4.15"
        fill="none"
        stroke="#fff"
        strokeWidth="1.7"
      />
      <circle cx="17.15" cy="6.9" r="1.15" fill="#fff" />
    </svg>
  );
}

function ShareSun() {
  return (
    <svg
      className="impact-share-sun"
      viewBox="0 0 32 32"
      aria-hidden
      focusable="false"
    >
      <circle cx="16" cy="16" r="4.2" fill="#ccf88e" />
      <path
        fill="#ccf88e"
        d="M16 3.2 17.3 9.2 23.4 8.2 19.2 12.8 25.2 16 19.2 19.2 23.4 23.8 17.3 22.8 16 28.8 14.7 22.8 8.6 23.8 12.8 19.2 6.8 16 12.8 12.8 8.6 8.2 14.7 9.2Z"
      />
    </svg>
  );
}

export function ImpactSharePreview({
  heading,
  lead,
  title,
  siteName,
  organizedBy,
  coverImageUrl,
  coverFocusX,
  coverFocusY,
  checkoutHref,
  donateLabel,
  raisedLabel,
  percent,
  campaignId,
  shareLabel,
  copiedLabel,
}: Props) {
  const initial = title.trim().charAt(0).toUpperCase() || "•";

  return (
    <section className="impact-share-section" aria-labelledby="impact-share-heading">
      <div className="impact-share-section-inner">
        <h2 id="impact-share-heading">{heading}</h2>
        <p className="impact-share-lead">{lead}</p>

        <div className="impact-share-frame">
          <article className="impact-share-card">
            <ShareSun />
            <div className="impact-share-photo">
              {coverImageUrl ? (
                <CoverMedia
                  src={coverImageUrl}
                  alt={title}
                  sizes="(max-width: 480px) 86vw, 320px"
                  focusX={coverFocusX}
                  focusY={coverFocusY}
                />
              ) : (
                <div className="impact-share-photo-fallback" aria-hidden>
                  {initial}
                </div>
              )}
            </div>
            <h3 className="impact-share-card-title">{title}</h3>
            <p className="impact-share-org">
              <span>{organizedBy}</span> {siteName}
            </p>
            <div className="impact-share-stickers">
                <DonateTrigger href={checkoutHref} className="impact-share-donate-pill">
                  {donateLabel}
                </DonateTrigger>
              <span className="impact-share-raised-pill">{raisedLabel}</span>
              <ImpactProgressRing
                percent={percent}
                className="impact-share-ring"
              />
            </div>
          </article>
          <div className="impact-share-dots" aria-hidden>
            <span className="is-active" />
          </div>
        </div>

        <ImpactShareButton
          campaignId={campaignId}
          title={title}
          shareLabel={shareLabel}
          copiedLabel={copiedLabel}
          className="impact-share-trigger"
        >
          <ShareGlyph />
        </ImpactShareButton>
      </div>
    </section>
  );
}
