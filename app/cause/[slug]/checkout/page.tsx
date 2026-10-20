import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { causeGivePath, causeText, foundationCause } from "@/lib/foundation-causes";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ amount?: string; lang?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const cause = foundationCause((await params).slug);
  if (!cause) return { title: "Donate" };
  const text = causeText(cause, "en");
  return { title: text.title, description: text.summary };
}

export default async function FoundationCauseCheckoutPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const cause = foundationCause(slug);
  if (!cause) notFound();

  const requested = Number(query.amount);
  const amountCents =
    Number.isFinite(requested) && requested >= 2500 ? Math.round(requested) : undefined;
  const lang = query.lang === "es" ? "es" : undefined;
  redirect(causeGivePath(cause.slug, lang, amountCents));
}
