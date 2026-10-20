import { STANDARD_DONATION_AMOUNTS } from "@/lib/donation-ticket";

type CauseCopy = {
  title: string;
  summary: string;
  storyHeading: string;
  story: string;
  updateTitle: string;
  updateBody: string;
  notes: string[];
};

type CauseDraft = {
  slug: string;
  image: string;
  category: string;
  currentAmount: number;
  goalAmount: number;
  coverFocusX: number;
  coverFocusY: number;
  en: CauseCopy;
  es: CauseCopy;
};

export type FoundationCause = CauseDraft &
  CauseCopy & {
    supporterCount: number;
  };

function settle(cause: CauseDraft): FoundationCause {
  return {
    ...cause,
    ...cause.en,
    supporterCount: 0,
  };
}

/** Empty until this organization publishes its own cause pages. */
const CAUSES: CauseDraft[] = [];

export const FOUNDATION_CAUSES: FoundationCause[] = CAUSES.map(settle);

export function foundationCause(slug: string) {
  return FOUNDATION_CAUSES.find((cause) => cause.slug === slug) ?? null;
}

export function causeText(cause: FoundationCause, lang: "en" | "es"): CauseCopy {
  return lang === "es" ? cause.es : cause.en;
}

export function causePath(slug: string, lang?: "en" | "es") {
  return lang === "es" ? `/cause/${slug}?lang=es` : `/cause/${slug}`;
}

/** Opens the cause page on the give block, with the chosen amount selected. */
export function causeGivePath(slug: string, lang?: "en" | "es", amountCents?: number) {
  const params = new URLSearchParams();
  if (lang === "es") params.set("lang", "es");
  if (amountCents) params.set("amount", String(amountCents));
  const query = params.toString();
  return `/cause/${slug}${query ? `?${query}` : ""}#give`;
}

export function causeCheckoutPath(slug: string, amountCents?: number) {
  return causeGivePath(slug, undefined, amountCents);
}

export function causeCheckoutOptions(amountCents?: number) {
  const amounts = [...STANDARD_DONATION_AMOUNTS];
  if (amountCents && !amounts.includes(amountCents)) amounts.push(amountCents);
  return amounts.map((amount) => ({
    id: `opt-${amount}`,
    amount,
    suggested: amount === (amountCents || 10000),
    paymentLinkId: null as string | null,
  }));
}

export function causeCover(cause: { image: string }) {
  return cause.image;
}

export const CAUSE_PAGE_ID = "22222222-2222-4222-8222-222222222222";
export const CAUSE_ORGANIZER = process.env.APP_NAME?.trim() || "the organization";

/** English cause title for a public-cause checkout. Other pages keep their own campaign name. */
export function causeSoldLabel(pageId: string, slug: string | null | undefined) {
  if (pageId !== CAUSE_PAGE_ID) return null;
  const cause = slug ? foundationCause(slug) : null;
  const title = cause?.title.trim();
  return title ? title.slice(0, 180) : null;
}
