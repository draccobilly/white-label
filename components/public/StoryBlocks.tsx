import type { ReactNode } from "react";
import Link from "next/link";

export function StoryCta({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: string;
  variant?: "primary" | "ghost";
}) {
  const external = href.startsWith("http") || href.startsWith("mailto:");
  const className = variant === "ghost" ? "inst-story-ghost" : "inst-story-cta";
  if (external) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }
  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

export function StorySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="inst-story-block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
