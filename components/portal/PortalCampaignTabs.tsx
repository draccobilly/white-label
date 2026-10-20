"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PortalCampaignTabs({
  base,
  items,
}: {
  base: string;
  items: { suffix: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="portal-tabs" aria-label="Campaign">
      {items.map((item) => {
        const href = `${base}${item.suffix}`;
        const active = item.suffix === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link key={item.suffix} href={href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
