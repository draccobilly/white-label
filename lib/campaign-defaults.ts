import {
  ARS_DONATION_AMOUNTS,
  ARS_SUGGESTED_AMOUNT,
  MXN_DONATION_AMOUNTS,
  MXN_SUGGESTED_AMOUNT,
  STANDARD_DONATION_AMOUNTS,
  STANDARD_SUGGESTED_AMOUNT,
} from "@/lib/donation-ticket";

/** $50,000 USD, MXN, or ARS, stored in cents. */
export const DEFAULT_GOAL_CENTS = 5_000_000;

/** Old Mexico seed used $2,000,000 MXN, which made the progress ring read 0%. */
export const LEGACY_MEXICO_GOAL_CENTS = 200_000_000;

export type CompanyDeskFields = {
  locale?: string | null;
  slug?: string | null;
  publicPathPrefix?: string | null;
  paymentGateway?: string | null;
};

export function isPagnovoCompany(company: CompanyDeskFields) {
  return company.paymentGateway === "PAGNOVO";
}

export function isMexicoCompany(company: CompanyDeskFields) {
  return (
    company.locale === "es-MX" ||
    company.slug === "arc-mexico" ||
    company.publicPathPrefix === "/mexico"
  );
}

export function isArgentinaCompany(company: CompanyDeskFields) {
  return (
    company.locale === "es-AR" ||
    company.slug === "arc-argentina" ||
    company.publicPathPrefix === "/argentina"
  );
}

export function isSpanishDesk(company: CompanyDeskFields) {
  return isMexicoCompany(company) || isArgentinaCompany(company);
}

const RUNNING_SHORT_CAMPAIGN_SLUGS = new Set<string>();

export function keepsRunningCampaignAddress(campaignSlug: string) {
  return RUNNING_SHORT_CAMPAIGN_SLUGS.has(campaignSlug);
}

export function deskDirectTeamSlug(company?: CompanyDeskFields | null) {
  const desk = company ?? {};
  if (isArgentinaCompany(desk)) return "direct-team-argentina";
  if (isMexicoCompany(desk)) return "direct-team-mexico";
  return "direct-team";
}

export function deskDirectTeamName(company?: CompanyDeskFields | null) {
  const desk = company ?? {};
  if (isArgentinaCompany(desk)) return "Direct Team Argentina";
  if (isMexicoCompany(desk)) return "Direct Team Mexico";
  return "Direct Team";
}

export function looksLikeUsdDonationTickets(amounts: number[]) {
  if (amounts.length < 4) return false;
  const usd = new Set(STANDARD_DONATION_AMOUNTS);
  const overlap = amounts.filter((amount) => usd.has(amount)).length;
  return overlap >= Math.min(4, amounts.length);
}

export function normalizeMexicoGoalAmount(goalAmount: number) {
  return goalAmount === LEGACY_MEXICO_GOAL_CENTS
    ? DEFAULT_GOAL_CENTS
    : goalAmount;
}

export function mexicoCreateDefaults() {
  return {
    currency: "MXN" as const,
    goalAmount: DEFAULT_GOAL_CENTS,
    amounts: [...MXN_DONATION_AMOUNTS],
    suggestedAmount: MXN_SUGGESTED_AMOUNT,
  };
}

export function applyMexicoCreateDefaults<
  T extends {
    currency: string;
    goalAmount: number;
    amounts: number[];
    suggestedAmount: number;
  },
>(input: T, company: CompanyDeskFields, isDuplicate = false): T {
  if (!isMexicoCompany(company)) return input;

  // New Mexico campaigns (including duplicates) always get the desk ticket list.
  // PATCH passes isDuplicate so an editor can still customize amounts later.
  const amounts = isDuplicate
    ? input.amounts
    : [...MXN_DONATION_AMOUNTS];
  const suggestedAmount = amounts.includes(
    isDuplicate ? input.suggestedAmount : MXN_SUGGESTED_AMOUNT,
  )
    ? isDuplicate
      ? input.suggestedAmount
      : MXN_SUGGESTED_AMOUNT
    : MXN_SUGGESTED_AMOUNT;

  return mexicoLocalizedCampaignCopy({
    ...input,
    currency: "MXN",
    goalAmount: normalizeMexicoGoalAmount(input.goalAmount),
    amounts,
    suggestedAmount,
  });
}

export const MEXICO_EDITOR_COPY = {
  category: "Causa urgente",
  storyHeading: "Por qué importa esta campaña",
  checkoutSubtitle: "Tu apoyo puede cambiar una vida hoy.",
  socialProofText: "Alguien acaba de donar",
  recentDonationsDescription:
    "Cada donativo aparece aquí para que puedas confirmar que tu ayuda sí se contó.",
  commentsDescription:
    "Los comentarios se desbloquean solo después de un donativo exitoso — una nota por cada apoyo.",
  thankYouTitle: "¡Gracias!",
  thankYouMessage:
    "Esta es tu confirmación y el registro oficial de tu donativo.",
};

const ENGLISH_DEFAULT_TO_MEXICO: Record<string, string> = {
  "Urgent cause": MEXICO_EDITOR_COPY.category,
  "Why this campaign matters": MEXICO_EDITOR_COPY.storyHeading,
  "Your support can change a life today.": MEXICO_EDITOR_COPY.checkoutSubtitle,
  "A supporter donated recently": MEXICO_EDITOR_COPY.socialProofText,
  "Every gift appears here so supporters can confirm their help was counted.":
    MEXICO_EDITOR_COPY.recentDonationsDescription,
  "Comments unlock only after a successful donation — one note per gift.":
    MEXICO_EDITOR_COPY.commentsDescription,
  "Thank you!": MEXICO_EDITOR_COPY.thankYouTitle,
  "Here's your confirmation — and the official record of your gift.":
    MEXICO_EDITOR_COPY.thankYouMessage,
  "Here’s your confirmation — and the official record of your gift.":
    MEXICO_EDITOR_COPY.thankYouMessage,
};

function foldCampaignCopy(value: string) {
  return value.replaceAll("\u2019", "'").replaceAll("\u2018", "'").trim();
}

/** Swap stock English desk copy for Mexico. Custom Spanish (or custom anything) is kept. */
export function mexicoLocalizedText(
  value: string | null | undefined,
  fallback: string,
) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return fallback;
  return (
    ENGLISH_DEFAULT_TO_MEXICO[trimmed] ??
    ENGLISH_DEFAULT_TO_MEXICO[foldCampaignCopy(trimmed)] ??
    trimmed
  );
}

export function mexicoLocalizedCampaignCopy<T extends object>(input: T): T {
  const row = input as T & {
    category?: string | null;
    storyHeading?: string | null;
    checkoutSubtitle?: string | null;
    socialProofText?: string | null;
    recentDonationsDescription?: string | null;
    commentsDescription?: string | null;
    thankYouTitle?: string | null;
    thankYouMessage?: string | null;
  };
  return {
    ...row,
    ...("category" in row
      ? {
          category: mexicoLocalizedText(
            row.category,
            MEXICO_EDITOR_COPY.category,
          ),
        }
      : {}),
    ...("storyHeading" in row
      ? {
          storyHeading: mexicoLocalizedText(
            row.storyHeading,
            MEXICO_EDITOR_COPY.storyHeading,
          ),
        }
      : {}),
    ...("checkoutSubtitle" in row
      ? {
          checkoutSubtitle: mexicoLocalizedText(
            row.checkoutSubtitle,
            MEXICO_EDITOR_COPY.checkoutSubtitle,
          ),
        }
      : {}),
    ...("socialProofText" in row
      ? {
          socialProofText: mexicoLocalizedText(
            row.socialProofText,
            MEXICO_EDITOR_COPY.socialProofText,
          ),
        }
      : {}),
    ...("recentDonationsDescription" in row
      ? {
          recentDonationsDescription: mexicoLocalizedText(
            row.recentDonationsDescription,
            MEXICO_EDITOR_COPY.recentDonationsDescription,
          ),
        }
      : {}),
    ...("commentsDescription" in row
      ? {
          commentsDescription: mexicoLocalizedText(
            row.commentsDescription,
            MEXICO_EDITOR_COPY.commentsDescription,
          ),
        }
      : {}),
    ...("thankYouTitle" in row
      ? {
          thankYouTitle: mexicoLocalizedText(
            row.thankYouTitle,
            MEXICO_EDITOR_COPY.thankYouTitle,
          ),
        }
      : {}),
    ...("thankYouMessage" in row
      ? {
          thankYouMessage: mexicoLocalizedText(
            row.thankYouMessage,
            MEXICO_EDITOR_COPY.thankYouMessage,
          ),
        }
      : {}),
  } as T;
}

export function argentinaCreateDefaults() {
  return {
    currency: "ARS" as const,
    goalAmount: DEFAULT_GOAL_CENTS,
    amounts: [...ARS_DONATION_AMOUNTS],
    suggestedAmount: ARS_SUGGESTED_AMOUNT,
  };
}

export function applyArgentinaCreateDefaults<
  T extends {
    currency: string;
    goalAmount: number;
    amounts: number[];
    suggestedAmount: number;
  },
>(input: T, company: CompanyDeskFields, isDuplicate = false): T {
  if (!isArgentinaCompany(company)) return input;

  const amounts = isDuplicate ? input.amounts : [...ARS_DONATION_AMOUNTS];
  const suggestedAmount = amounts.includes(
    isDuplicate ? input.suggestedAmount : ARS_SUGGESTED_AMOUNT,
  )
    ? isDuplicate
      ? input.suggestedAmount
      : ARS_SUGGESTED_AMOUNT
    : ARS_SUGGESTED_AMOUNT;

  return mexicoLocalizedCampaignCopy({
    ...input,
    currency: "ARS",
    goalAmount: normalizeMexicoGoalAmount(input.goalAmount),
    amounts,
    suggestedAmount,
  });
}

export function applyDeskCreateDefaults<
  T extends {
    currency: string;
    goalAmount: number;
    amounts: number[];
    suggestedAmount: number;
  },
>(input: T, company: CompanyDeskFields, isDuplicate = false): T {
  if (isMexicoCompany(company)) {
    return applyMexicoCreateDefaults(input, company, isDuplicate);
  }
  if (isArgentinaCompany(company)) {
    return applyArgentinaCreateDefaults(input, company, isDuplicate);
  }
  return input;
}

export function defaultDonationSetup(
  kind: boolean | "mexico" | "argentina" = false,
) {
  if (kind === "argentina") return argentinaCreateDefaults();
  if (kind === true || kind === "mexico") return mexicoCreateDefaults();
  return {
    currency: "USD" as const,
    goalAmount: DEFAULT_GOAL_CENTS,
    amounts: [...STANDARD_DONATION_AMOUNTS],
    suggestedAmount: STANDARD_SUGGESTED_AMOUNT,
  };
}
