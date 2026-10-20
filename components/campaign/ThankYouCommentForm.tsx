"use client";

import { useState, type FormEvent } from "react";

type Props = {
  saleId: string;
  campaignPath: string;
  defaultName?: string | null;
  alreadyCommented?: boolean;
  existingCommentId?: string | null;
};

export function ThankYouCommentForm({
  saleId,
  campaignPath,
  defaultName,
  alreadyCommented = false,
  existingCommentId = null,
}: Props) {
  const [authorName, setAuthorName] = useState(defaultName || "");
  const [body, setBody] = useState("");
  const [done, setDone] = useState(alreadyCommented);
  const [commentId, setCommentId] = useState<string | null>(existingCommentId);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (done) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId, authorName, body }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to post comment");
      if (typeof result.id === "string") setCommentId(result.id);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to post comment");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="thanks-comment-done">
        <div className="thanks-comment-done-copy">
          <strong>Thank you for sharing.</strong>
          <p>Your message is now visible on the campaign page.</p>
        </div>
        {commentId ? (
          <a
            className="thanks-comment-view"
            href={`${campaignPath}#comment-${commentId}`}
          >
            view
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <form className="thanks-comment-form" onSubmit={submit}>
      <h2>Leave one note of support</h2>
      <p>
        After a successful donation you can leave a single public comment. Choose
        words that encourage the next supporter.
      </p>
      <label>
        Display name
        <input
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          maxLength={80}
          required
          placeholder="Your name or Anonymous"
        />
      </label>
      <label>
        Comment
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={600}
          required
          rows={4}
          placeholder="Share why you decided to help…"
        />
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="primary-button" disabled={loading}>
        {loading ? "Posting…" : "Post comment"}
      </button>
    </form>
  );
}
