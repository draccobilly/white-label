"use client";

import { CircleUser, Heart } from "lucide-react";
import { useMemo, useState } from "react";
import { isAnonymousDonorName } from "@/lib/social-proof";
import { isNewActivity, withoutAiDashes } from "@/lib/campaign-comments";
import { messagesFor } from "@/lib/i18n";
import { formatMoney, formatRelativeTime } from "@/lib/utils";

const PAGE_SIZE = 7;

export type ActivityDonation = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  paidAt: string | null;
};

export type ActivityReply = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type ActivityComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  replies: ActivityReply[];
};

type Props = {
  donations: ActivityDonation[];
  comments: ActivityComment[];
  supporterCount: number;
  recentLead: string;
  commentsLead: string;
  locale?: string;
};

export function CampaignActivity({
  donations,
  comments,
  supporterCount,
  recentLead,
  commentsLead,
  locale = "en",
}: Props) {
  const messages = messagesFor(locale);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shownDonations = donations.slice(0, visible);
  const shownComments = comments.slice(0, visible);
  const canLoadMore = visible < donations.length || visible < comments.length;

  const donationItems = useMemo(
    () =>
      shownDonations.map((sale) => {
        const anonymous = isAnonymousDonorName(sale.name);
        return { sale, anonymous };
      }),
    [shownDonations],
  );

  return (
    <>
      <section className="recent-section">
        <h2>{locale === "es-MX" || locale === "es-AR" ? "Donativos recientes" : "Recent donations"}</h2>
        <p className="section-lead">{recentLead}</p>
        {donations.length ? (
          <div className="recent-list">
            {donationItems.map(({ sale, anonymous }) => (
              <div className="recent-item" key={sale.id}>
                <span className="recent-item-copy">
                  {anonymous ? (
                    <CircleUser
                      size={18}
                      color="#64748b"
                      aria-hidden
                      className="recent-item-icon"
                    />
                  ) : (
                    <Heart
                      size={17}
                      fill="#41b6e6"
                      color="#41b6e6"
                      aria-hidden
                      className="recent-item-icon"
                    />
                  )}
                  <strong>{anonymous ? messages.campaign.anonymous : sale.name}</strong>
                  {isNewActivity(sale.paidAt) ? (
                    <span className="recent-new-tag">{messages.comments.newTag}</span>
                  ) : null}
                  <em>{formatRelativeTime(sale.paidAt, locale)}</em>
                </span>
                <strong>{formatMoney(sale.amount, sale.currency, locale)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-note">
            {messages.social.recentSupport(supporterCount)}
          </p>
        )}
        {canLoadMore ? (
          <button
            type="button"
            className="secondary-button load-more-button"
            onClick={() => setVisible((current) => current + PAGE_SIZE)}
          >
            {messages.comments.loadMore}
          </button>
        ) : null}
      </section>

      <section className="comments-section" id="comments">
        <h2>{messages.comments.wordsFromSupporters}</h2>
        <p className="section-lead">{withoutAiDashes(commentsLead)}</p>
        {comments.length ? (
          <div className="comments-list">
            {shownComments.map((comment) => (
              <article
                className={`comment-card${isNewActivity(comment.createdAt) ? " comment-card--new" : ""}`}
                id={`comment-${comment.id}`}
                key={comment.id}
              >
                <div className="comment-card-head">
                  <strong>{comment.authorName}</strong>
                  {isNewActivity(comment.createdAt) ? (
                    <span className="recent-new-tag">{messages.comments.newTag}</span>
                  ) : null}
                </div>
                <p>{withoutAiDashes(comment.body)}</p>
                <time dateTime={comment.createdAt}>
                  {formatRelativeTime(comment.createdAt, locale)}
                </time>
                {comment.replies.length ? (
                  <div className="comment-replies">
                    {comment.replies.map((reply) => (
                      <div className="comment-reply" key={reply.id}>
                        <strong>{reply.authorName}</strong>
                        <p>{withoutAiDashes(reply.body)}</p>
                        <time dateTime={reply.createdAt}>
                          {formatRelativeTime(reply.createdAt, locale)}
                        </time>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-note">
            {messages.comments.noneYet}
          </p>
        )}
        {canLoadMore ? (
          <button
            type="button"
            className="secondary-button load-more-button"
            onClick={() => setVisible((current) => current + PAGE_SIZE)}
          >
            {messages.comments.loadMore}
          </button>
        ) : null}
      </section>
    </>
  );
}
