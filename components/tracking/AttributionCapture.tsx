"use client";

import { useEffect } from "react";
import { mergeAdClick, type AdClick } from "@/lib/ad-click";

export type Attribution = AdClick;

function storageKey(pageId: string) {
  return `arc_direct_attr_${pageId}`;
}

const GLOBAL_STORAGE_KEY = "arc_direct_attr_global";

function readBrowserCookie(name: string) {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function facebookBrowserCookies() {
  return {
    fbp: readBrowserCookie("_fbp"),
    fbc: readBrowserCookie("_fbc"),
  };
}

function locationAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const cookies = facebookBrowserCookies();
  const fbclid = params.get("fbclid");
  return {
    src: params.get("src"),
    sck: params.get("sck") || fbclid,
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    utmContent: params.get("utm_content"),
    utmTerm: params.get("utm_term"),
    fbp: cookies.fbp,
    fbc: cookies.fbc,
    landingUrl: window.location.href.slice(0, 4000),
    referrer: document.referrer ? document.referrer.slice(0, 4000) : null,
  };
}

function storedAttribution(pageId: string): Attribution {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(pageId)) ?? "{}") as Attribution;
  } catch {
    return {};
  }
}

function storedGlobalAttribution(): Attribution {
  try {
    return JSON.parse(sessionStorage.getItem(GLOBAL_STORAGE_KEY) ?? "{}") as Attribution;
  } catch {
    return {};
  }
}

function persistAttribution(pageId: string, attribution: Attribution) {
  const encoded = JSON.stringify(attribution);
  sessionStorage.setItem(storageKey(pageId), encoded);
  sessionStorage.setItem(GLOBAL_STORAGE_KEY, encoded);
}

export function mergeAttribution(stored: Attribution, incoming: Attribution) {
  return mergeAdClick(stored, incoming);
}

export function readAttribution(pageId: string): Attribution {
  if (typeof window === "undefined") return {};
  const stored = mergeAttribution(storedGlobalAttribution(), storedAttribution(pageId));
  const incoming = locationAttribution();
  return mergeAttribution(stored, incoming);
}

const VISIT_SESSION_KEY = "arc_visit_session";

/** Stable id for this browser tab. Payment and pixels do not read it. */
export function visitSessionId() {
  if (typeof window === "undefined") return "";
  const existing = sessionStorage.getItem(VISIT_SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(VISIT_SESSION_KEY, created);
  return created;
}

export function AttributionCapture({
  affiliatePageId,
  eventType = "PAGE_VIEW",
}: {
  affiliatePageId: string;
  eventType?: "PAGE_VIEW" | "CHECKOUT_STARTED";
}) {
  useEffect(() => {
    const attribution = readAttribution(affiliatePageId);
    persistAttribution(affiliatePageId, attribution);

    const sessionKey = `arc_direct_lock_${eventType}_${affiliatePageId}`;
    const lastRecorded = Number(sessionStorage.getItem(sessionKey) || "0");
    if (Date.now() - lastRecorded >= 2500) {
      sessionStorage.setItem(sessionKey, String(Date.now()));
      void fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          affiliatePageId,
          type: eventType,
          attribution,
        }),
      });
    }

    const sessionId = visitSessionId();
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ affiliatePageId, sessionId }),
      });
    };
    ping();
    const timer = window.setInterval(ping, 20_000);
    return () => window.clearInterval(timer);
  }, [affiliatePageId, eventType]);

  return null;
}
