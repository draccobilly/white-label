import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.paypal.com https://*.paypalobjects.com https://connect.facebook.net https://www.googletagmanager.com https://analytics.tiktok.com https://cdn.utmify.com.br https://api.utmify.com.br https://portal.pagnovo.com"
    : "script-src 'self' 'unsafe-inline' https://*.paypal.com https://*.paypalobjects.com https://connect.facebook.net https://www.googletagmanager.com https://analytics.tiktok.com https://cdn.utmify.com.br https://api.utmify.com.br https://portal.pagnovo.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  isDev
    ? "connect-src 'self' ws: wss: http://localhost:* https://*.paypal.com https://*.paypalobjects.com https://*.supabase.co https://www.google-analytics.com https://analytics.tiktok.com https://www.facebook.com https://fonts.googleapis.com https://fonts.gstatic.com https://*.utmify.com.br https://portal.pagnovo.com"
    : "connect-src 'self' https://*.paypal.com https://*.paypalobjects.com https://*.supabase.co https://www.google-analytics.com https://analytics.tiktok.com https://www.facebook.com https://fonts.googleapis.com https://fonts.gstatic.com https://*.utmify.com.br https://portal.pagnovo.com",
  "frame-src https://*.paypal.com https://*.paypalobjects.com https://js.stripe.com https://hooks.stripe.com https://portal.pagnovo.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.paypal.com",
  "frame-ancestors 'none'",
].join("; ");

const assetPrefix = process.env.NEXT_ASSET_PREFIX?.trim() || undefined;

const nextConfig: NextConfig = {
  assetPrefix,
  experimental: {
    proxyClientMaxBodySize: "25mb",
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/login",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      {
        source: "/join",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      {
        source: "/admin/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/mexico", destination: "/" },
      { source: "/mexico/:path*", destination: "/:path*" },
      { source: "/argentina", destination: "/" },
      { source: "/argentina/:path*", destination: "/:path*" },
    ];
  },
};

export default nextConfig;
