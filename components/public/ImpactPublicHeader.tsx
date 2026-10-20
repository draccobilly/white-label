"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Menu, Search, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  ImpactSearchPanel,
  type SearchCampaign,
  type SearchOrg,
} from "@/components/public/ImpactSearch";
import { messagesFor } from "@/lib/i18n";
import { impactMenu, institutionalHeaderLinks } from "@/lib/public-nav";
import { withPublicPrefix } from "@/lib/public-site-url";

type Props = {
  siteName?: string;
  logoUrl?: string | null;
  donateHref?: string | null;
  locale?: string;
  pathPrefix?: string | null;
  searchCampaigns?: SearchCampaign[];
  searchOrgs?: SearchOrg[];
  campaignHref?: string | null;
  institutional?: boolean;
};

function HeaderBar({
  siteName,
  logoUrl,
  donateHref,
  donateLabel,
  searchLabel,
  menuLabel,
  searchExpanded,
  menuExpanded,
  onSearch,
  onMenu,
}: {
  siteName?: string;
  logoUrl?: string | null;
  donateHref?: string | null;
  donateLabel: string;
  searchLabel: string;
  menuLabel: string;
  searchExpanded?: boolean;
  menuExpanded?: boolean;
  onSearch: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="shell public-header-inner impact-header-inner">
      <div className="impact-header-slot impact-header-start">
        <button
          type="button"
          className="impact-header-icon"
          aria-expanded={searchExpanded}
          aria-controls="impact-search-panel"
          onClick={onSearch}
        >
          <Search size={22} strokeWidth={1.6} aria-hidden />
          <span className="sr-only">{searchLabel}</span>
        </button>
      </div>
      <BrandLogo siteName={siteName} logoUrl={logoUrl} href="/" />
      <div className="impact-header-slot impact-header-end">
        <button
          type="button"
          className="impact-header-icon"
          aria-expanded={menuExpanded}
          aria-controls="impact-menu-panel"
          onClick={onMenu}
        >
          <Menu size={22} strokeWidth={1.6} aria-hidden />
          <span className="sr-only">{menuLabel}</span>
        </button>
        {donateHref ? (
          <Link className="primary-button header-donate" href={donateHref}>
            {donateLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ImpactPublicHeader({
  siteName,
  logoUrl,
  donateHref,
  locale = "en",
  pathPrefix,
  searchCampaigns,
  searchOrgs,
  campaignHref,
  institutional,
}: Props) {
  const messages = messagesFor(locale);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuTitleId = useId();
  const items = impactMenu(messages, pathPrefix, campaignHref, {
    donateHref,
    institutional,
  });
  const startHref = withPublicPrefix(pathPrefix, "/start-a-fundraiser");
  const homeHref = withPublicPrefix(pathPrefix, "/");
  const headerLinks = institutional ? institutionalHeaderLinks(messages, pathPrefix) : [];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!searchOpen && !menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (menuOpen) setMenuOpen(false);
      else setSearchOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.body.classList.add("impact-overlay-open");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("impact-overlay-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, searchOpen]);

  const bar = (searchExpanded: boolean) =>
    institutional ? (
      <div className="shell public-header-inner wh-header-inner">
        <button
          type="button"
          className="impact-header-icon wh-header-search"
          aria-expanded={searchExpanded}
          aria-controls="impact-search-panel"
          onClick={() => setSearchOpen((open) => !open)}
        >
          <Search size={20} strokeWidth={1.8} aria-hidden />
          <span className="sr-only">{messages.nav.search}</span>
        </button>
        <BrandLogo siteName={siteName} logoUrl={logoUrl} compact href={homeHref} />
        <nav className="wh-header-nav" aria-label={siteName}>
          {headerLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="wh-header-end">
          <Link className="wh-header-cta" href={startHref}>
            {messages.site.navShare}
          </Link>
          <button
            type="button"
            className="impact-header-icon wh-header-menu"
            aria-expanded={menuOpen}
            aria-controls="impact-menu-panel"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={22} strokeWidth={1.6} aria-hidden />
            <span className="sr-only">{messages.nav.openMenu}</span>
          </button>
        </div>
      </div>
    ) : (
      <HeaderBar
        siteName={siteName}
        logoUrl={logoUrl}
        donateHref={donateHref}
        donateLabel={messages.nav.donate}
        searchLabel={messages.nav.search}
        menuLabel={messages.nav.openMenu}
        searchExpanded={searchExpanded}
        menuExpanded={menuOpen}
        onSearch={() => setSearchOpen((open) => !open)}
        onMenu={() => setMenuOpen(true)}
      />
    );

  return (
    <>
      <header className={`public-header${institutional ? " wh-header" : ""}`}>{bar(searchOpen)}</header>

      {mounted && searchOpen
        ? createPortal(
            <div
              id="impact-search-panel"
              className="impact-search-layer"
              role="dialog"
              aria-modal="true"
              aria-label={messages.nav.search}
            >
              <header className={`public-header${institutional ? " wh-header" : ""}`}>{bar(true)}</header>
              <ImpactSearchPanel
                locale={locale}
                campaigns={searchCampaigns ?? []}
                orgs={searchOrgs ?? []}
                startHref={startHref}
                onSelect={() => setSearchOpen(false)}
              />
            </div>,
            document.body,
          )
        : null}

      {mounted && menuOpen
        ? createPortal(
            <div className="impact-menu-layer">
              <button
                type="button"
                className="impact-menu-backdrop"
                aria-label={messages.nav.closeMenu}
                onClick={() => setMenuOpen(false)}
              />
              <aside
                id="impact-menu-panel"
                className={`impact-menu-drawer${institutional ? " wh-menu-drawer" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={menuTitleId}
              >
                <div className="impact-menu-head">
                  <BrandLogo
                    siteName={siteName}
                    logoUrl={logoUrl}
                    compact
                    href={homeHref}
                  />
                  <strong id={menuTitleId} className="sr-only">
                    {messages.nav.menu}
                  </strong>
                  <button
                    type="button"
                    className="impact-header-icon"
                    onClick={() => setMenuOpen(false)}
                  >
                    <X size={22} strokeWidth={1.5} aria-hidden />
                    <span className="sr-only">{messages.nav.closeMenu}</span>
                  </button>
                </div>
                <nav className="impact-menu-nav">
                  {items.map((item) => (
                    <Link
                      key={`${item.title}-${item.href}`}
                      href={item.href}
                      className="impact-menu-row"
                      onClick={() => {
                        setMenuOpen(false);
                        setSearchOpen(false);
                      }}
                    >
                      <span className="impact-menu-row-copy">
                        <strong>{item.title}</strong>
                        <span>{item.description}</span>
                      </span>
                      <ChevronRight size={18} strokeWidth={1.5} aria-hidden />
                    </Link>
                  ))}
                </nav>
                <div className="wh-menu-foot">
                  <Link
                    className="wh-cta"
                    href={startHref}
                    onClick={() => setMenuOpen(false)}
                  >
                    {messages.site.navShare}
                  </Link>
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
