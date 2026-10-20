"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BadgeCheck, X } from "lucide-react";
import { useDonateModal } from "@/components/campaign/DonateModalContext";
import { StoryText } from "@/components/campaign/StoryText";
import { isNewActivity } from "@/lib/campaign-comments";
import { messagesFor } from "@/lib/i18n";
import { plainStoryText } from "@/lib/story-text";
import { formatMoney } from "@/lib/utils";

const PREVIEW_CHARS = 118;

const AVATARS = [
  { bg: "#3b82f6", color: "#fff" },
  { bg: "#e8eaed", color: "#374151" },
  { bg: "#0f9d8a", color: "#fff" },
  { bg: "#f59e0b", color: "#fff" },
  { bg: "#7c5cbf", color: "#fff" },
  { bg: "#e76f51", color: "#fff" },
  { bg: "#2563eb", color: "#fff" },
  { bg: "#d1d5db", color: "#1f2937" },
] as const;

type StoryDonation = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  paidAt?: string | null;
};

type StoryComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt?: string | null;
};

type VerifiedCard = {
  name: string;
  amount?: number;
  currency?: string;
  when?: string | null;
  body?: string;
};

function previewStory(story: string) {
  const text = plainStoryText(story).replace(/\s+/g, " ").trim();
  if (text.length <= PREVIEW_CHARS) return text;
  return `${text.slice(0, PREVIEW_CHARS).replace(/\s+\S*$/, "")}…`;
}

function donorInitial(name: string) {
  const letter = name.trim().charAt(0);
  return letter ? letter.toUpperCase() : "?";
}

function avatarStyle(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[hash % AVATARS.length]!;
}

function relativeTime(iso: string | null | undefined, locale: string) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const tag = locale === "es-AR" || locale === "es-MX" ? locale : "en";
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function ImpactStoryBody({
  variant = "excerpt",
  heading,
  story,
  readMoreLabel,
  badge,
  locale,
  checkoutHref,
  donations = [],
  comments = [],
}: {
  variant?: "excerpt" | "full";
  heading: string;
  story: string;
  readMoreLabel: string;
  badge?: ReactNode;
  locale: string;
  checkoutHref?: string;
  donations?: StoryDonation[];
  comments?: StoryComment[];
}) {
  const messages = messagesFor(locale);
  const donate = useDonateModal();
  const [open, setOpen] = useState(false);
  const preview = previewStory(story);
  const long = plainStoryText(story).replace(/\s+/g, " ").trim().length > PREVIEW_CHARS;
  const excerpt = variant === "excerpt";

  function close() {
    setOpen(false);
  }

  function goToDonate() {
    setOpen(false);
    window.setTimeout(() => {
      if (donate) {
        donate.open();
      } else if (checkoutHref) {
        window.location.assign(checkoutHref);
        return;
      } else {
        document.getElementById("give")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
      const give = document.getElementById("give");
      give?.classList.add("is-conversion-focus");
      const input = give?.querySelector<HTMLInputElement>(".donate-amount-input");
      const cta = give?.querySelector<HTMLButtonElement>(".campaign-give-cta");
      (input ?? cta)?.focus({ preventScroll: true });
      window.setTimeout(() => give?.classList.remove("is-conversion-focus"), 1800);
    }, 40);
  }

  return (
    <article id={excerpt ? undefined : "story"} className={`impact-article${excerpt ? " is-excerpt" : " is-full"}`}>
      {excerpt ? null : (
        <header className="impact-story-lead">
          <h2>{heading || messages.campaign.readStory}</h2>
          {badge}
        </header>
      )}
      {excerpt ? (
        <p className="impact-story-preview">
          {preview}
          {long ? (
            <>
              {" "}
              <button type="button" className="impact-read-more" onClick={() => setOpen(true)}>
                {readMoreLabel}
              </button>
            </>
          ) : null}
        </p>
      ) : (
        <div className="impact-story-copy">
          <StoryText text={story} />
        </div>
      )}
      {open ? (
        <StoryReadModal
          heading={heading}
          story={story}
          locale={locale}
          donations={donations}
          comments={comments}
          donateLabel={messages.nav.donate}
          onClose={close}
          onDonate={goToDonate}
        />
      ) : null}
    </article>
  );
}

function StoryReadModal({
  heading,
  story,
  locale,
  donations,
  comments,
  donateLabel,
  onClose,
  onDonate,
}: {
  heading: string;
  story: string;
  locale: string;
  donations: StoryDonation[];
  comments: StoryComment[];
  donateLabel: string;
  onClose: () => void;
  onDonate: () => void;
}) {
  const messages = messagesFor(locale);
  const [verified, setVerified] = useState<VerifiedCard | null>(null);
  const visibleDonations = donations.slice(0, 8);
  const visibleComments = comments.slice(0, 8);
  const topAmount = Math.max(0, ...donations.map((donation) => donation.amount));

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (verified) setVerified(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, verified]);

  return (
    <div className="story-read-layer" role="dialog" aria-modal="true" aria-label={messages.campaign.readStory}>
      <button type="button" className="story-read-backdrop" aria-label={messages.nav.closeMenu} onClick={onClose} />
      <div className="story-read-modal">
        <button type="button" className="story-read-close" onClick={onClose}>
          <X size={18} strokeWidth={2.2} aria-hidden />
          <span className="sr-only">{messages.nav.closeMenu}</span>
        </button>
        <div className="story-read-scroll">
          {heading ? <h2>{heading}</h2> : null}
          <div className="story-read-copy">
            <StoryText text={story} />
          </div>

          {visibleDonations.length ? (
            <section className="story-read-section">
              <div className="impact-activity-head">
                <h3>{messages.campaign.donations}</h3>
                <span className="impact-count-badge">
                  {donations.length.toLocaleString(locale)}
                </span>
              </div>
              <ul className="impact-donors glass-donors story-read-donors">
                {visibleDonations.map((donation, index) => {
                  const when = relativeTime(donation.paidAt, locale);
                  const isNew = isNewActivity(donation.paidAt) || index === 0;
                  const status =
                    index === 0
                      ? messages.campaign.recentDonation
                      : donation.amount === topAmount
                        ? messages.campaign.topDonation
                        : when;
                  const palette = avatarStyle(donation.name);
                  return (
                    <li key={donation.id}>
                      <button
                        type="button"
                        className="impact-donor glass-donor story-read-donor"
                        onClick={() =>
                          setVerified({
                            name: donation.name,
                            amount: donation.amount,
                            currency: donation.currency,
                            when,
                          })
                        }
                      >
                        <span className="story-avatar-wrap">
                          <span
                            className="impact-donor-avatar"
                            aria-hidden
                            style={{ background: palette.bg, color: palette.color }}
                          >
                            {donorInitial(donation.name)}
                          </span>
                          <BadgeCheck className="story-verified-icon" size={16} aria-hidden />
                        </span>
                        <div className="impact-donor-copy">
                          <span className="impact-donor-name">
                            {donation.name}
                            {isNew ? (
                              <span className="impact-new-tag">{messages.comments.newTag}</span>
                            ) : null}
                          </span>
                          <span className="impact-donor-meta">
                            <strong>
                              {formatMoney(donation.amount, donation.currency, locale)}
                            </strong>
                            {status ? (
                              <>
                                <span className="impact-donor-sep" aria-hidden>
                                  ·
                                </span>
                                <span>{status}</span>
                              </>
                            ) : null}
                          </span>
                          <span className="story-verified-label">
                            {messages.campaign.verifiedDonor}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {visibleComments.length ? (
            <section className="story-read-section glass-comments">
              <div className="impact-activity-head">
                <h3>{messages.comments.heading}</h3>
                <span className="impact-count-badge">
                  {comments.length.toLocaleString(locale)}
                </span>
              </div>
              <div className="impact-comments-list">
                {visibleComments.map((comment) => {
                  const palette = avatarStyle(comment.authorName);
                  const when = relativeTime(comment.createdAt, locale);
                  const isNew = isNewActivity(comment.createdAt);
                  const matched = donations.find(
                    (donation) => donation.name === comment.authorName,
                  );
                  return (
                    <button
                      type="button"
                      className={[
                        "impact-comment story-read-comment",
                        isNew ? "impact-comment--new" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={comment.id}
                      onClick={() =>
                        setVerified({
                          name: comment.authorName,
                          amount: matched?.amount,
                          currency: matched?.currency,
                          when,
                          body: comment.body,
                        })
                      }
                    >
                      <div className="impact-comment-head">
                        <span className="story-avatar-wrap">
                          <span
                            className="impact-comment-avatar"
                            aria-hidden
                            style={{ background: palette.bg, color: palette.color }}
                          >
                            {donorInitial(comment.authorName)}
                          </span>
                          <BadgeCheck className="story-verified-icon" size={16} aria-hidden />
                        </span>
                        <div className="impact-comment-byline">
                          <div className="impact-comment-name-row">
                            <strong className="impact-comment-name">{comment.authorName}</strong>
                            {isNew ? (
                              <span className="impact-new-tag">{messages.comments.newTag}</span>
                            ) : null}
                          </div>
                          {when ? (
                            <time dateTime={comment.createdAt ?? undefined} className="impact-comment-time">
                              {when}
                            </time>
                          ) : null}
                          <span className="story-verified-label">
                            {messages.campaign.verifiedDonor}
                          </span>
                        </div>
                      </div>
                      <span className="impact-comment-body">{comment.body}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
        <div className="story-read-bar">
          <button type="button" className="impact-cta" onClick={onDonate}>
            {donateLabel}
          </button>
        </div>

        {verified ? (
          <div className="story-verified-layer">
            <button
              type="button"
              className="story-verified-backdrop"
              aria-label={messages.nav.closeMenu}
              onClick={() => setVerified(null)}
            />
            <div
              className="story-verified-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="story-verified-title"
            >
              <button
                type="button"
                className="story-read-close"
                onClick={() => setVerified(null)}
              >
                <X size={18} strokeWidth={2.2} aria-hidden />
                <span className="sr-only">{messages.nav.closeMenu}</span>
              </button>
              <BadgeCheck size={34} color="#16825d" aria-hidden />
              <h3 id="story-verified-title">{messages.campaign.verifiedDonor}</h3>
              <p>{messages.campaign.verifiedDonorHint}</p>
              <div className="verified-modal-receipt">
                <span>{verified.name}</span>
                {verified.amount != null && verified.currency ? (
                  <strong>{formatMoney(verified.amount, verified.currency, locale)}</strong>
                ) : null}
              </div>
              {verified.when ? <p className="story-verified-when">{verified.when}</p> : null}
              {verified.body ? <p className="story-verified-quote">{verified.body}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
