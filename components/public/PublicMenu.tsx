"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Menu, X } from "lucide-react";
import { publicNav } from "@/lib/public-nav";
import { messagesFor } from "@/lib/i18n";

export function PublicMenu({
  locale = "en",
  pathPrefix,
}: {
  locale?: string;
  pathPrefix?: string | null;
}) {
  const messages = messagesFor(locale);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const items = publicNav(messages, pathPrefix);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="public-menu-button"
        aria-expanded={open}
        aria-controls="public-menu-drawer"
        onClick={() => setOpen(true)}
      >
        <Menu size={24} aria-hidden />
        <span className="sr-only">{messages.nav.openMenu}</span>
      </button>

      {open ? (
        <div className="public-menu-layer">
          <button
            type="button"
            className="public-menu-backdrop"
            aria-label={messages.nav.closeMenu}
            onClick={() => setOpen(false)}
          />
          <aside
            id="public-menu-drawer"
            className="public-menu-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="public-menu-drawer-head">
              <strong id={titleId}>{messages.nav.menu}</strong>
              <button
                type="button"
                className="public-menu-button"
                onClick={() => setOpen(false)}
              >
                <X size={22} aria-hidden />
                <span className="sr-only">{messages.nav.closeMenu}</span>
              </button>
            </div>
            <nav className="public-menu-nav">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
