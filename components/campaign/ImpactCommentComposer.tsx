"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import {
  PENDING_COMMENT_MAX,
  clearPendingComment,
  savePendingComment,
} from "@/lib/pending-comment";
import { DonateTrigger } from "@/components/campaign/DonateModalContext";
import { withoutAiDashes } from "@/lib/campaign-comments";
import type { Messages } from "@/lib/i18n/types";

export type CampaignDonorVoice = {
  saleId: string;
  name: string;
  hasComment: boolean;
  hasReply: boolean;
} | null;

type PublishedComment = {
  id: string;
  parentId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
};

type Props = {
  affiliatePageId: string;
  checkoutHref: string;
  messages: Messages;
  donor: CampaignDonorVoice;
  onPublished: (comment: PublishedComment) => void;
  parentId?: string | null;
  compact?: boolean;
};

export function ImpactCommentComposer({
  affiliatePageId,
  checkoutHref,
  messages,
  donor,
  onPublished,
  parentId = null,
  compact = false,
}: Props) {
  const titleId = useId();
  const reply = Boolean(parentId);
  const [authorName, setAuthorName] = useState(donor?.name ?? "");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [storedOpen, setStoredOpen] = useState(false);

  useEffect(() => {
    if (donor?.name) setAuthorName(donor.name);
  }, [donor?.name]);

  if (reply && !donor) return null;
  if (reply && donor?.hasReply) return null;
  if (!reply && donor?.hasComment) return null;

  async function publishForDonor() {
    if (!donor) return;
    const displayName = (
      authorName.trim().length >= 2
        ? authorName.trim()
        : donor.name.trim().length >= 2
          ? donor.name.trim()
          : "Anonymous"
    ).slice(0, 80);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: donor.saleId,
          authorName: displayName,
          body: withoutAiDashes(body.trim()),
          parentId,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? messages.comments.replyLimit);
      }
      onPublished({
        id: result.id,
        parentId: result.parentId ?? parentId,
        authorName: result.authorName,
        body: result.body,
        createdAt: result.createdAt,
      });
      setBody("");
      clearPendingComment(affiliatePageId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : messages.comments.replyLimit);
    } finally {
      setLoading(false);
    }
  }

  function storeUntilDonation() {
    const next = withoutAiDashes(body.trim());
    if (next.length < 3) return;
    savePendingComment(affiliatePageId, next, authorName);
    setStoredOpen(true);
    setBody("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    const next = withoutAiDashes(body.trim());
    if (next.length < 3) return;
    if (donor) {
      void publishForDonor();
      return;
    }
    storeUntilDonation();
  }

  return (
    <>
      <form
        className={
          compact
            ? "impact-comment-compose impact-comment-compose--reply"
            : "impact-comment-compose"
        }
        onSubmit={submit}
      >
        {reply ? null : (
          <label className="impact-comment-compose-label">
            <span className="impact-comment-compose-caption">
              {messages.comments.nameLabel}
            </span>
            <input
              className="impact-comment-compose-name"
              value={authorName}
              maxLength={80}
              placeholder={messages.comments.namePlaceholder}
              onChange={(event) => setAuthorName(event.target.value)}
            />
          </label>
        )}
        <label className="impact-comment-compose-label">
          <span className="sr-only">
            {reply
              ? messages.comments.replyPlaceholder
              : messages.comments.writePlaceholder}
          </span>
          <textarea
            className="impact-comment-compose-input"
            value={body}
            maxLength={PENDING_COMMENT_MAX}
            rows={compact ? 3 : 4}
            required
            minLength={3}
            placeholder={
              reply
                ? messages.comments.replyPlaceholder
                : messages.comments.writePlaceholder
            }
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <div className="impact-comment-compose-bar">
          <span className="impact-comment-compose-count">
            {body.length}/{PENDING_COMMENT_MAX}
          </span>
          <button
            type="submit"
            className="impact-comment-compose-post"
            disabled={loading || withoutAiDashes(body.trim()).length < 3}
          >
            {loading ? `${messages.comments.writePost}…` : reply
                ? messages.comments.reply
                : messages.comments.writePost}
          </button>
        </div>
        {error ? (
          <p className="impact-comment-compose-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {storedOpen ? (
        <div
          className="impact-comment-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="impact-comment-modal-card">
            <h3 id={titleId}>{messages.comments.storedTitle}</h3>
            <p>{messages.comments.storedBody}</p>
            <div className="impact-comment-modal-actions">
              <DonateTrigger href={checkoutHref} className="impact-comment-modal-donate">
                {messages.comments.storedDonate}
              </DonateTrigger>
              <button
                type="button"
                className="impact-comment-modal-close"
                onClick={() => setStoredOpen(false)}
              >
                {messages.comments.storedClose}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
