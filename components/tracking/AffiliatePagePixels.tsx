"use client";

import Script from "next/script";
import { useMemo } from "react";
import {
  googleEventForPixel,
  type PixelConversionEvent,
} from "@/lib/affiliate-pixels";
import { parseUtmifyPixelScript } from "@/lib/utmify-pixel";
import { sanitizePixelId } from "@/lib/validators";

type Props = {
  pageKey: string;
  googlePixelId?: string | null;
  tiktokPixelId?: string | null;
  utmifyPixelScript?: string | null;
  eventName?: PixelConversionEvent;
};

export function AffiliatePagePixels({
  pageKey,
  googlePixelId,
  tiktokPixelId,
  utmifyPixelScript,
  eventName,
}: Props) {
  const google = sanitizePixelId(googlePixelId);
  const tiktok = sanitizePixelId(tiktokPixelId);
  const utmifyScripts = useMemo(
    () => parseUtmifyPixelScript(utmifyPixelScript ?? ""),
    [utmifyPixelScript],
  );

  const safeKey = pageKey.replace(/[^a-zA-Z0-9_-]/g, "");
  const scriptKey = eventName ?? "page";
  const googleConversion = eventName
    ? `\n            gtag('event', ${JSON.stringify(googleEventForPixel(eventName))}, { send_to: ${JSON.stringify(google)} });`
    : "";
  const tiktokConversion = eventName
    ? `\n            ttq.instance(${JSON.stringify(tiktok)}).track(${JSON.stringify(eventName)});`
    : "";
  return (
    <>
      {google && (
        <>
          <Script
            id={`gtag-src-${safeKey}-${scriptKey}`}
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(google)}`}
            strategy="afterInteractive"
          />
          <Script id={`gtag-${safeKey}-${scriptKey}`} strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', ${JSON.stringify(google)}, { send_page_view: false });
            gtag('event', 'page_view', { send_to: ${JSON.stringify(google)} });${googleConversion}
          `}</Script>
        </>
      )}
      {tiktok && (
        <Script id={`tt-${safeKey}-${scriptKey}`} strategy="afterInteractive">{`
          !function (w, d, t) {
            w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
            ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
            ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
            for (var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
            ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
            ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
            ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};
            var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
            var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
            ttq.load(${JSON.stringify(tiktok)});
            ttq.page();${tiktokConversion}
          }(window, document, 'ttq');
        `}</Script>
      )}
      {utmifyScripts.map((item, index) =>
        item.src ? (
          <Script
            key={`utmify-src-${safeKey}-${index}`}
            id={`utmify-src-${safeKey}-${index}`}
            src={item.src}
            strategy="afterInteractive"
            {...item.dataAttributes}
          />
        ) : item.inline ? (
          <Script
            key={`utmify-inline-${safeKey}-${index}`}
            id={`utmify-inline-${safeKey}-${index}`}
            strategy="afterInteractive"
          >
            {item.inline}
          </Script>
        ) : null,
      )}
    </>
  );
}
