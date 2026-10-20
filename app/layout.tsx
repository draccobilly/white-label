import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { publicFaviconUrl } from "@/lib/campaign-layout";
import { getRequestCompany } from "@/lib/company";
import { isAppLocale } from "@/lib/i18n";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export async function generateMetadata(): Promise<Metadata> {
  const company = await getRequestCompany().catch(() => null);
  const siteName = company?.siteName?.trim() || "Giving Site";
  const favicon = company ? publicFaviconUrl(company) : null;
  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description:
      company?.landingBody?.trim().slice(0, 160) ||
      "Direct, secure support for urgent human causes.",
    robots: { index: false, follow: false },
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "Admin",
      statusBarStyle: "default",
    },
    icons: {
      icon: [{ url: favicon || "/brand/favicon.png" }],
      shortcut: [{ url: favicon || "/brand/favicon.png" }],
      apple: [{ url: favicon || "/brand/favicon.png" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f4ee",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const company = await getRequestCompany().catch(() => null);
  const lang = isAppLocale(company?.locale) ? company.locale : "en";
  return (
    <html lang={lang}>
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
