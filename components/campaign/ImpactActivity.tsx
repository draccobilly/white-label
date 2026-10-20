"use client";

import { useMemo, useState, type ReactNode } from "react";
import type {
  ActivityComment,
  ActivityDonation,
  ActivityReply,
} from "@/components/campaign/CampaignActivity";
import {
  ImpactCommentComposer,
  type CampaignDonorVoice,
} from "@/components/campaign/ImpactCommentComposer";
import { messagesFor } from "@/lib/i18n";
import { isNewActivity, withoutAiDashes } from "@/lib/campaign-comments";

const COMMENT_PREVIEW = 8;

const COMMENT_AVATARS = [
  { bg: "#3b82f6", color: "#fff" },
  { bg: "#e8eaed", color: "#374151" },
  { bg: "#0f9d8a", color: "#fff" },
  { bg: "#f59e0b", color: "#fff" },
  { bg: "#7c5cbf", color: "#fff" },
  { bg: "#e76f51", color: "#fff" },
  { bg: "#2563eb", color: "#fff" },
  { bg: "#d1d5db", color: "#1f2937" },
] as const;

type Props = {
  donations: ActivityDonation[];
  comments: ActivityComment[];
  supporterCount: number;
  commentsLead: string;
  locale?: string;
  checkoutHref?: string;
  affiliatePageId?: string;
  donor?: CampaignDonorVoice;
};

function donorInitial(name: string) {
  const letter = name.trim().charAt(0);
  return letter ? letter.toUpperCase() : "?";
}

function avatarStyle(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COMMENT_AVATARS[hash % COMMENT_AVATARS.length]!;
}

function compactDuration(iso: string | null | undefined, locale: string) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  const localeTag = locale === "es-AR" ? "es-AR" : locale === "es-MX" ? "es-MX" : "en-US";
  const unit = (value: number, type: "minute" | "hour" | "day") =>
    new Intl.NumberFormat(localeTag, {
      style: "unit",
      unit: type,
      unitDisplay: "long",
    }).format(value);
  if (seconds < 60) return locale === "es-MX" || locale === "es-AR" ? "ahora" : "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return unit(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 48) return unit(hours, "hour");
  return unit(Math.round(hours / 24), "day");
}

export function ImpactActivity({
  comments,
  commentsLead,
  locale = "en",
  checkoutHref,
  affiliatePageId,
  donor = null,
}: Props) {
  const messages = messagesFor(locale);
  const [showAllComments, setShowAllComments] = useState(false);
  const [postedComments, setPostedComments] = useState<ActivityComment[]>([]);
  const [postedReplies, setPostedReplies] = useState<Record<string, ActivityReply[]>>(
    {},
  );
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [donorState, setDonorState] = useState(donor);

  const threadComments = useMemo(() => {
    const extras = postedComments.filter(
      (item) => !comments.some((comment) => comment.id === item.id),
    );
    return [...extras, ...comments].map((comment) => ({
      ...comment,
      replies: [
        ...(postedReplies[comment.id] ?? []),
        ...comment.replies.filter(
          (reply) =>
            !(postedReplies[comment.id] ?? []).some((item) => item.id === reply.id),
        ),
      ],
    }));
  }, [comments, postedComments, postedReplies]);
  const visibleComments = showAllComments
    ? threadComments
    : threadComments.slice(0, COMMENT_PREVIEW);
  const hiddenComments = threadComments.length > visibleComments.length;

  return (
    <>
      <section
        className="impact-comments glass-comments"
        id="comments"
        aria-labelledby="impact-comments-heading"
      >
        <div className="impact-activity-head">
          <h2 id="impact-comments-heading" className="impact-activity-title">
            {messages.comments.heading}
          </h2>
          <span className="impact-count-badge">
            {threadComments.length.toLocaleString(locale)}
          </span>
        </div>
        {commentsLead ? (
          <p className="impact-comments-lead">{withoutAiDashes(commentsLead)}</p>
        ) : null}

        {affiliatePageId && checkoutHref ? (
          <ImpactCommentComposer
            affiliatePageId={affiliatePageId}
            checkoutHref={checkoutHref}
            messages={messages}
            donor={donorState}
            onPublished={(comment) => {
              setPostedComments((current) => [
                {
                  id: comment.id,
                  authorName: comment.authorName,
                  body: comment.body,
                  createdAt: comment.createdAt,
                  replies: [],
                },
                ...current,
              ]);
              setDonorState((current) =>
                current ? { ...current, hasComment: true } : current,
              );
            }}
          />
        ) : null}

        {visibleComments.length ? (
          <div className="impact-comments-list">
            {visibleComments.map((comment) => (
              <ImpactComment
                comment={comment}
                locale={locale}
                newTag={messages.comments.newTag}
                replyLabel={messages.comments.reply}
                canReply={Boolean(donorState && !donorState.hasReply)}
                replying={replyingTo === comment.id}
                onReply={() =>
                  setReplyingTo((current) =>
                    current === comment.id ? null : comment.id,
                  )
                }
                replyForm={
                  affiliatePageId && checkoutHref && donorState && !donorState.hasReply ? (
                    <ImpactCommentComposer
                      affiliatePageId={affiliatePageId}
                      checkoutHref={checkoutHref}
                      messages={messages}
                      donor={donorState}
                      parentId={comment.id}
                      compact
                      onPublished={(reply) => {
                        setPostedReplies((current) => ({
                          ...current,
                          [comment.id]: [
                            {
                              id: reply.id,
                              authorName: reply.authorName,
                              body: reply.body,
                              createdAt: reply.createdAt,
                            },
                            ...(current[comment.id] ?? []),
                          ],
                        }));
                        setDonorState((current) =>
                          current ? { ...current, hasReply: true } : current,
                        );
                        setReplyingTo(null);
                      }}
                    />
                  ) : null
                }
                key={comment.id}
              />
            ))}
          </div>
        ) : (
          <p className="impact-activity-empty">{messages.comments.noneYet}</p>
        )}

        {hiddenComments ? (
          <button
            type="button"
            className="impact-activity-see-all"
            onClick={() => setShowAllComments(true)}
          >
            {messages.campaign.seeAll}
          </button>
        ) : null}
      </section>
    </>
  );
}

function ImpactComment({
  comment,
  locale,
  nested = false,
  newTag,
  replyLabel,
  canReply = false,
  replying = false,
  onReply,
  replyForm,
}: {
  comment: ActivityComment | ActivityComment["replies"][number];
  locale: string;
  nested?: boolean;
  newTag: string;
  replyLabel?: string;
  canReply?: boolean;
  replying?: boolean;
  onReply?: () => void;
  replyForm?: ReactNode;
}) {
  const initial = donorInitial(comment.authorName);
  const palette = avatarStyle(comment.authorName);
  const when = compactDuration(comment.createdAt, locale);
  const replies = "replies" in comment ? comment.replies : [];
  const isNew = isNewActivity(comment.createdAt);

  return (
    <article
      className={[
        nested ? "impact-comment impact-comment--reply" : "impact-comment",
        isNew ? "impact-comment--new" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      id={nested ? undefined : `comment-${comment.id}`}
    >
      <div className="impact-comment-head">
        <span
          className="impact-comment-avatar"
          aria-hidden
          style={{ background: palette.bg, color: palette.color }}
        >
          {initial}
        </span>
        <div className="impact-comment-byline">
          <div className="impact-comment-name-row">
            <strong className="impact-comment-name">{comment.authorName}</strong>
            {isNew ? (
              <span className="impact-new-tag">{newTag}</span>
            ) : null}
          </div>
          {when ? (
            <time dateTime={comment.createdAt} className="impact-comment-time">
              {when}
            </time>
          ) : null}
        </div>
      </div>
      <p className="impact-comment-body">{withoutAiDashes(comment.body)}</p>
      {!nested && canReply && replyLabel ? (
        <button
          type="button"
          className="impact-comment-reply-btn"
          aria-expanded={replying}
          onClick={onReply}
        >
          {replyLabel}
        </button>
      ) : null}
      {replying ? replyForm : null}
      {replies.length ? (
        <div className="impact-comment-replies">
          {replies.map((reply) => (
            <ImpactComment
              comment={reply}
              locale={locale}
              nested
              newTag={newTag}
              key={reply.id}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
