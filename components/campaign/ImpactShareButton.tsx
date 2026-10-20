"use client";

import { useState, type ReactNode } from "react";

type Props = {
  campaignId: string;
  title: string;
  shareLabel: string;
  copiedLabel: string;
  className?: string;
  children?: ReactNode;
};

export function ImpactShareButton({
  campaignId,
  title,
  shareLabel,
  copiedLabel,
  className,
  children,
}: Props) {
  const [copied, setCopied] = useState(false);

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
      await fetch("/api/campaign-engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, action: "share" }),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  const label = copied ? copiedLabel : shareLabel;

  return (
    <button type="button" className={className} onClick={share} aria-label={label}>
      {children ? (
        <>
          {children}
          <span>{label}</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}
