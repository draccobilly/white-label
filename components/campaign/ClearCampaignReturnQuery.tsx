"use client";

import { useEffect } from "react";

export function ClearCampaignReturnQuery({
  affiliatePageId,
}: {
  affiliatePageId: string;
}) {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("payment_return");
    url.searchParams.delete("session_id");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    void fetch("/api/donor/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliatePageId }),
      keepalive: true,
    }).catch(() => undefined);
  }, [affiliatePageId]);

  return null;
}
