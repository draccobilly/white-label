"use client";

import { useEffect, useState } from "react";
import type { CampaignLiveSnapshot } from "@/lib/campaign-live";
import { PUBLIC_PREFIX_HEADER } from "@/lib/public-site-url";

const POLL_MS = 8_000;

export function useCampaignLiveFeed(
  slug: string,
  initial: CampaignLiveSnapshot,
  pathPrefix?: string | null,
) {
  const [snapshot, setSnapshot] = useState(initial);

  useEffect(() => {
    setSnapshot(initial);
  }, [slug, initial.currentAmount, initial.supporterCount, initial.donations[0]?.id]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    let timer = 0;

    async function pull() {
      if (document.hidden) return;
      try {
        const response = await fetch(
          `/api/campaigns/${encodeURIComponent(slug)}/live`,
          {
            cache: "no-store",
            headers: pathPrefix
              ? { [PUBLIC_PREFIX_HEADER]: pathPrefix }
              : undefined,
          },
        );
        if (!response.ok) return;
        const next = (await response.json()) as CampaignLiveSnapshot;
        if (!cancelled) setSnapshot(next);
      } catch {
        /* keep last snapshot */
      }
    }

    timer = window.setInterval(pull, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug, pathPrefix]);

  return snapshot;
}
