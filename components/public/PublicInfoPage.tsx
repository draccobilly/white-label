import type { ReactNode } from "react";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import type { getPublicPageChrome } from "@/lib/public-campaigns";

type Chrome = Awaited<ReturnType<typeof getPublicPageChrome>>;

export function PublicInfoPage({
  chrome,
  kicker,
  title,
  lead,
  updated,
  wide,
  children,
  after,
}: {
  chrome: Chrome;
  kicker?: string;
  title: string;
  lead: string;
  updated?: string;
  wide?: boolean;
  children: ReactNode;
  after?: ReactNode;
}) {
  return (
    <PublicSiteShell chrome={chrome}>
      <main className="public-info inst-info inst-story">
        <div
          className={`shell public-info-inner${wide ? " is-wide" : ""}`}
        >
          {kicker ? <p className="wh-kicker inst-story-kicker">{kicker}</p> : null}
          <h1>{title}</h1>
          {updated ? <p className="inst-story-updated">{updated}</p> : null}
          <p className="public-info-lead">{lead}</p>
          <div className="public-info-body">{children}</div>
        </div>
      </main>
      {after}
    </PublicSiteShell>
  );
}
