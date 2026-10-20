"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Copies any short value (ids, codes, secrets) to the clipboard. */
export function CopyValueButton({
  value,
  label = "Copy",
  className = "secondary-button",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — the value stays visible on screen */
    }
  }

  return (
    <button type="button" className={className} onClick={() => void copy()}>
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}
