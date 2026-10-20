import Link from "next/link";
import type { ReactNode } from "react";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import { PortalSignOutButton } from "@/components/portal/PortalSignOutButton";
import type { PortalCopy } from "@/lib/portal-copy";
import type { getPublicPageChrome } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";

type Chrome = Awaited<ReturnType<typeof getPublicPageChrome>>;

export function PortalShell({
  chrome,
  copy,
  organizer,
  kicker,
  title,
  lead,
  actions,
  children,
}: {
  chrome: Chrome;
  copy: PortalCopy;
  organizer: { name: string; email: string } | null;
  kicker?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const prefix = chrome.pathPrefix;
  return (
    <PublicSiteShell chrome={chrome} className="portal-site">
      <main className="portal">
        <div className="shell portal-inner">
          {organizer ? (
            <nav className="portal-nav" aria-label={copy.portalName}>
              <Link href={withPublicPrefix(prefix, "/portal")}>{copy.dashboard}</Link>
              <Link href={withPublicPrefix(prefix, "/portal/account")}>{copy.account}</Link>
              <span className="portal-nav-user">{organizer.email}</span>
              <PortalSignOutButton label={copy.signOut} redirectTo={withPublicPrefix(prefix, "/portal/login")} />
            </nav>
          ) : null}
          <header className="portal-head">
            <div>
              <p className="inst-kicker">{kicker ?? copy.portalName}</p>
              <h1>{title}</h1>
              {lead ? <p className="inst-lead">{lead}</p> : null}
            </div>
            {actions ? <div className="portal-head-actions">{actions}</div> : null}
          </header>
          {children}
        </div>
      </main>
    </PublicSiteShell>
  );
}
