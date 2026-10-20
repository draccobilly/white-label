import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/BrandLogo";
import { InstitutionalHome } from "@/components/public/InstitutionalHome";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import { getAppRole } from "@/lib/app-role";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { listPublishedSitePosts } from "@/lib/site-posts";
import { SitePostKind } from "@/generated/prisma/enums";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (getAppRole() === "admin") return { title: "Admin" };
  const chrome = await getPublicPageChrome().catch(() => null);
  if (chrome?.institutional) {
    return {
      title: chrome.brand.siteName,
      description: chrome.messages.site.heroLead,
    };
  }
  return {
    title: chrome?.company.landingTitle || chrome?.brand.siteName || "Welcome",
    description:
      chrome?.company.landingBody?.slice(0, 160) || chrome?.brand.footerText,
  };
}

export default async function HomePage() {
  if (getAppRole() === "admin") redirect("/admin");

  const chrome = await getPublicPageChrome();
  if (chrome.institutional) {
    const [updates, programs] = await Promise.all([
      listPublishedSitePosts(chrome.company.id, SitePostKind.FIELD_UPDATE, 9),
      listPublishedSitePosts(chrome.company.id, SitePostKind.PROGRAM, 6),
    ]);
    return (
      <PublicSiteShell chrome={chrome} className="inst-site">
        <InstitutionalHome chrome={chrome} updates={updates} programs={programs} />
      </PublicSiteShell>
    );
  }

  const theme = {
    "--navy": chrome.brand.primaryColor,
    "--gold": chrome.brand.accentColor,
  } as CSSProperties;

  return (
    <main className="company-landing" style={theme}>
      <header className="company-landing-head">
        <BrandLogo siteName={chrome.brand.siteName} logoUrl={chrome.brand.logoUrl} />
      </header>
      <section className="company-landing-body">
        <h1>{chrome.company.landingTitle || chrome.brand.siteName}</h1>
        {(chrome.company.landingBody ?? "")
          .split(/\n{2,}/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
      </section>
      <footer className="company-landing-foot">
        <p>{chrome.brand.footerText}</p>
      </footer>
    </main>
  );
}
