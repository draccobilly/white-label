"use client";

import { Heart, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { messagesFor } from "@/lib/i18n";

type Props = {
  campaignId: string;
  title: string;
  likeCount: number;
  shareCount: number;
  locale?: string;
};

function likedKey(campaignId: string) {
  return `campaign-liked:${campaignId}`;
}

export function CampaignEngagement({
  campaignId,
  title,
  likeCount,
  shareCount,
  locale = "en",
}: Props) {
  const messages = messagesFor(locale);
  const [likes, setLikes] = useState(likeCount);
  const [shares, setShares] = useState(shareCount);
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLiked(window.localStorage.getItem(likedKey(campaignId)) === "1");
  }, [campaignId]);

  async function record(action: "like" | "share") {
    const response = await fetch("/api/campaign-engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, action }),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      likeCount?: number;
      shareCount?: number;
    };
    if (typeof payload.likeCount === "number") setLikes(payload.likeCount);
    if (typeof payload.shareCount === "number") setShares(payload.shareCount);
  }

  async function like() {
    if (liked) return;
    setLiked(true);
    setLikes((current) => current + 1);
    window.localStorage.setItem(likedKey(campaignId), "1");
    await record("like");
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }
      setShares((current) => current + 1);
      await record("share");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  return (
    <div className="campaign-engagement">
      <button
        type="button"
        className={`engagement-chip${liked ? " is-liked" : ""}`}
        onClick={like}
        aria-pressed={liked}
      >
        <Heart size={16} fill={liked ? "currentColor" : "none"} />
        {messages.campaign.likes(likes.toLocaleString(locale))}
      </button>
      <button type="button" className="engagement-chip" onClick={share}>
        <Share2 size={16} />
        {copied
          ? messages.campaign.linkCopied
          : messages.campaign.shares(shares.toLocaleString(locale))}
      </button>
    </div>
  );
}
