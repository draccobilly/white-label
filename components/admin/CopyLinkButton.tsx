"use client";

import { useState } from "react";
import { publicAbsoluteUrl } from "@/lib/public-site-url";

export function CopyLinkButton({
  path,
  prefix,
  label = "Copy link",
}: {
  path: string;
  prefix?: string | null;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const liveUrl = publicAbsoluteUrl(path, prefix);
  async function copy() {
    await navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div className="copy-link-wrap">
      <button type="button" className="secondary-button" onClick={copy}>
        {copied ? "Copied" : label}
      </button>
      <span className="copy-link-url" title={liveUrl}>
        {path}
      </span>
    </div>
  );
}
