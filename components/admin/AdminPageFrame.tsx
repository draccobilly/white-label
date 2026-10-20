"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const NOTICE_COPY: Record<string, { title: string; body: string }> = {
  "desk-switch": {
    title: "This campaign is in another country",
    body: "Each desk only edits its own campaigns. You are now on the selected country — open a product from this list to continue.",
  },
};

export function AdminPageFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("notice");
    if (!value) {
      setNotice(null);
      return;
    }
    setNotice(value);
    params.delete("notice");
    const query = params.toString();
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }, [pathname]);

  const copy = notice ? NOTICE_COPY[notice] : null;

  return (
    <div key={pathname} className="admin-page admin-page-enter">
      {copy ? (
        <div className="admin-desk-notice" role="status">
          <div>
            <strong>{copy.title}</strong>
            <p>{copy.body}</p>
          </div>
          <Link className="secondary-button" href="/admin/campaigns">
            View campaigns
          </Link>
        </div>
      ) : null}
      {children}
    </div>
  );
}
