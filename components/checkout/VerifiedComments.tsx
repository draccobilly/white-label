"use client";

import { BadgeCheck, X } from "lucide-react";
import { useState } from "react";
import { withoutAiDashes } from "@/lib/campaign-comments";
import { formatMoney } from "@/lib/utils";

export type VerifiedComment = {
  id: string;
  authorName: string;
  body: string;
  amount: number;
  currency: string;
};

type Props = {
  comments: VerifiedComment[];
  heading?: string;
};

export function VerifiedComments({ comments, heading }: Props) {
  const [selected, setSelected] = useState<VerifiedComment | null>(null);

  if (!comments.length) return null;

  return (
    <>
      <section className="verified-comments">
        <div className="verified-comments-heading">
          <div>
            <span>{heading ?? "Messages from supporters"}</span>
            <strong>Recent verified donors</strong>
          </div>
          <BadgeCheck size={22} aria-hidden />
        </div>
        <div className="verified-comments-viewport" aria-live="polite">
          {comments.map((comment, commentIndex) => (
            <button
              type="button"
              key={comment.id}
              className="verified-comment"
              style={{ animationDelay: `${commentIndex * 700}ms` }}
              onClick={() => setSelected(comment)}
            >
              <span className="verified-comment-copy">
                <strong>{comment.authorName}</strong>
                <span>{withoutAiDashes(comment.body)}</span>
              </span>
              <strong className="verified-comment-amount">
                {formatMoney(comment.amount, comment.currency)}
              </strong>
            </button>
          ))}
        </div>
        <p className="verified-comments-hint">
          Select a message to verify the donor.
        </p>
      </section>

      {selected ? (
        <div
          className="verified-modal-backdrop"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            className="verified-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="verified-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="verified-modal-close"
              aria-label="Close"
              onClick={() => setSelected(null)}
            >
              <X size={18} />
            </button>
            <BadgeCheck size={34} color="#16825d" aria-hidden />
            <h2 id="verified-modal-title">Verified donor</h2>
            <p>
              This comment belongs to a donation confirmed by the payment
              provider.
            </p>
            <div className="verified-modal-receipt">
              <span>{selected.authorName}</span>
              <strong>
                {formatMoney(selected.amount, selected.currency)}
              </strong>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
