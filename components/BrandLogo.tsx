"use client";

import Link from "next/link";

type Props = {
  siteName?: string;
  logoUrl?: string | null;
  compact?: boolean;
  href?: string | null;
};

export function BrandLogo({
  siteName = "Giving Site",
  logoUrl,
  compact = false,
  href,
}: Props) {
  const custom = logoUrl?.trim();
  const height = compact ? 38 : 46;
  const className = `brand-logo${compact ? " is-compact" : ""}`;

  const inner = custom ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={custom}
      alt={siteName}
      className="brand-logo-img"
      style={{ height, width: "auto", maxWidth: "100%" }}
    />
  ) : (
    <span className="brand-logo-text">{siteName}</span>
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-label={siteName}>
        {inner}
      </Link>
    );
  }

  return <span className={className}>{inner}</span>;
}
