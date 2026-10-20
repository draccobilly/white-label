import { decryptSecret } from "@/lib/crypto";
import { utmifyTrackingForNewPage } from "@/lib/utmify-desk";
import { utmifyPixelIdFromConfig } from "@/lib/utmify-pixel";

export type TrackingIds = {
  fbPixelId?: string | null;
  googlePixelId?: string | null;
  tiktokPixelId?: string | null;
  utmifyPixelScript?: string | null;
  utmifyPixelId?: string | null;
  utmifyToken?: string | null;
  pagnovoDesk?: boolean;
};

export class PixelConflictError extends Error {
  constructor(
    message = "This pixel or Utmify ID is already used by another company. Mexico and the global operation must use separate pixels.",
  ) {
    super(message);
    this.name = "PixelConflictError";
  }
}

export class PixelCompanyConflictError extends PixelConflictError {}

export function findConflictingTrackingId(
  candidate: string | null | undefined,
  usedByOtherCompanies: Array<string | null | undefined>,
) {
  const needle = candidate?.trim() ?? "";
  if (!needle) return null;
  return usedByOtherCompanies.some((value) => value?.trim() === needle)
    ? needle
    : null;
}

export function hasCrossCompanyPixelConflict(
  other: TrackingIds[],
  candidate: TrackingIds,
) {
  const usedFb = other.map((row) => row.fbPixelId);
  const usedGoogle = other.map((row) => row.googlePixelId);
  const usedTiktok = other.map((row) => row.tiktokPixelId);
  const utmifyOthers =
    candidate.pagnovoDesk === true
      ? other.filter((row) => row.pagnovoDesk !== true)
      : other;
  const usedUtmify = utmifyOthers.flatMap((row) => [
    row.utmifyPixelId,
    utmifyPixelIdFromConfig(row.utmifyPixelScript),
  ]);
  const usedTokens = utmifyOthers.map((row) => row.utmifyToken);
  const candidateUtmify =
    candidate.utmifyPixelId ?? utmifyPixelIdFromConfig(candidate.utmifyPixelScript);
  return Boolean(
    findConflictingTrackingId(candidate.fbPixelId, usedFb) ||
      findConflictingTrackingId(candidate.googlePixelId, usedGoogle) ||
      findConflictingTrackingId(candidate.tiktokPixelId, usedTiktok) ||
      findConflictingTrackingId(candidateUtmify, usedUtmify) ||
      findConflictingTrackingId(candidate.utmifyToken, usedTokens),
  );
}

export const EMPTY_PAGE_TRACKING = {
  fbPixelId: null as string | null,
  googlePixelId: null as string | null,
  tiktokPixelId: null as string | null,
  utmifyTokenEnc: null as string | null,
  utmifyPixelScript: null as string | null,
  utmifyWebhookUrl: null as string | null,
};

function decryptToken(value: string | null | undefined) {
  const secret = process.env.ENCRYPTION_KEY;
  if (!value || !secret) return null;
  try {
    return decryptSecret(value, secret).trim() || null;
  } catch {
    return null;
  }
}

export async function assertTrackingUniqueToCompany(
  db: {
    affiliatePage: {
      findMany: (args: never) => Promise<
        Array<{
          fbPixelId: string | null;
          googlePixelId: string | null;
          tiktokPixelId: string | null;
          utmifyTokenEnc: string | null;
          utmifyPixelScript: string | null;
          campaign?: { company?: { paymentGateway?: string | null } | null } | null;
          affiliate: {
            defaultFbPixelId: string | null;
            defaultGooglePixelId: string | null;
            defaultTiktokPixelId: string | null;
            defaultUtmifyTokenEnc: string | null;
            utmifyPixelScript: string | null;
          };
        }>
      >;
    };
  },
  input: {
    companyId: string;
    fbPixelId?: string | null;
    googlePixelId?: string | null;
    tiktokPixelId?: string | null;
    utmifyPixelId?: string | null;
    utmifyPixelScript?: string | null;
    utmifyToken?: string | null;
    pagnovoDesk?: boolean;
  },
) {
  const pages = await db.affiliatePage.findMany({
    where: { campaign: { companyId: { not: input.companyId } } },
    select: {
      fbPixelId: true,
      googlePixelId: true,
      tiktokPixelId: true,
      utmifyTokenEnc: true,
      utmifyPixelScript: true,
      campaign: {
        select: { company: { select: { paymentGateway: true } } },
      },
      affiliate: {
        select: {
          defaultFbPixelId: true,
          defaultGooglePixelId: true,
          defaultTiktokPixelId: true,
          defaultUtmifyTokenEnc: true,
          utmifyPixelScript: true,
        },
      },
    },
  } as never);

  const other: TrackingIds[] = pages.flatMap((page) => {
    const pagnovoDesk = page.campaign?.company?.paymentGateway === "PAGNOVO";
    return [
      {
        fbPixelId: page.fbPixelId,
        googlePixelId: page.googlePixelId,
        tiktokPixelId: page.tiktokPixelId,
        utmifyPixelScript: page.utmifyPixelScript,
        utmifyToken: decryptToken(page.utmifyTokenEnc),
        pagnovoDesk,
      },
      {
        fbPixelId: page.affiliate.defaultFbPixelId,
        googlePixelId: page.affiliate.defaultGooglePixelId,
        tiktokPixelId: page.affiliate.defaultTiktokPixelId,
        utmifyPixelScript: page.affiliate.utmifyPixelScript,
        utmifyToken: decryptToken(page.affiliate.defaultUtmifyTokenEnc),
        pagnovoDesk,
      },
    ];
  });

  if (
    hasCrossCompanyPixelConflict(other, {
      fbPixelId: input.fbPixelId,
      googlePixelId: input.googlePixelId,
      tiktokPixelId: input.tiktokPixelId,
      utmifyPixelId: input.utmifyPixelId,
      utmifyPixelScript: input.utmifyPixelScript,
      pagnovoDesk: input.pagnovoDesk,
      utmifyToken: input.utmifyToken,
    })
  ) {
    throw new PixelConflictError();
  }
}

export function canAttachAffiliateToCompany(input: {
  usedByThisCompany: boolean;
  usedByOtherCompany: boolean;
}) {
  return input.usedByThisCompany || !input.usedByOtherCompany;
}

type AffiliatePageDb = {
  affiliatePage: {
    findFirst: (...args: never[]) => Promise<unknown>;
    findMany: (...args: never[]) => Promise<unknown>;
  };
};

function queryAffiliatePages(
  db: AffiliatePageDb,
  args: {
    where: { affiliateId: string };
    select: { campaign: { select: { companyId: true } } };
  },
) {
  return (
    db.affiliatePage.findMany as (input: typeof args) => Promise<
      Array<{ campaign: { companyId: string | null } }>
    >
  )(args);
}

type SiblingPageTracking = {
  fbPixelId: string | null;
  googlePixelId: string | null;
  tiktokPixelId: string | null;
  utmifyTokenEnc: string | null;
  utmifyPixelScript?: string | null;
  utmifyWebhookUrl?: string | null;
};

const SIBLING_TRACKING_SELECT = {
  fbPixelId: true,
  googlePixelId: true,
  tiktokPixelId: true,
  utmifyTokenEnc: true,
} as const;

const SIBLING_TRACKING_SELECT_WITH_PAGE_UTMIFY = {
  ...SIBLING_TRACKING_SELECT,
  utmifyPixelScript: true,
  utmifyWebhookUrl: true,
} as const;

function isUnknownUtmifyPageField(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Unknown (arg|argument|field) `?utmify(PixelScript|WebhookUrl)/i.test(
    message,
  );
}

async function querySiblingPage(
  db: AffiliatePageDb,
  where: {
    affiliateId: string;
    campaign: { companyId: string };
  },
): Promise<SiblingPageTracking | null> {
  const findFirst = db.affiliatePage.findFirst as (input: {
    where: typeof where;
    select:
      | typeof SIBLING_TRACKING_SELECT_WITH_PAGE_UTMIFY
      | typeof SIBLING_TRACKING_SELECT;
  }) => Promise<SiblingPageTracking | null>;
  try {
    return await findFirst({
      where,
      select: SIBLING_TRACKING_SELECT_WITH_PAGE_UTMIFY,
    });
  } catch (error) {
    if (!isUnknownUtmifyPageField(error)) throw error;
    return findFirst({
      where,
      select: SIBLING_TRACKING_SELECT,
    });
  }
}

export async function trackingForNewAffiliatePage<
  T extends {
    defaultFbPixelId: string | null;
    defaultGooglePixelId: string | null;
    defaultTiktokPixelId: string | null;
    defaultUtmifyTokenEnc: string | null;
    utmifyPixelScript?: string | null;
    utmifyWebhookUrl?: string | null;
  },
>(
  db: AffiliatePageDb,
  affiliate: T & { id: string },
  targetCompanyId: string,
  companyIsDefault = false,
) {
  const pages = await queryAffiliatePages(db, {
    where: { affiliateId: affiliate.id },
    select: { campaign: { select: { companyId: true } } },
  });
  const usedByThisCompany = pages.some(
    (page) => page.campaign.companyId === targetCompanyId,
  );
  const usedByOtherCompany = pages.some(
    (page) =>
      page.campaign.companyId && page.campaign.companyId !== targetCompanyId,
  );
  if (!canAttachAffiliateToCompany({ usedByThisCompany, usedByOtherCompany })) {
    return EMPTY_PAGE_TRACKING;
  }
  const sibling = usedByThisCompany
    ? await querySiblingPage(db, {
        affiliateId: affiliate.id,
        campaign: { companyId: targetCompanyId },
      })
    : null;
  const utmify = utmifyTrackingForNewPage({
    companyIsDefault,
    pageScript: sibling?.utmifyPixelScript,
    pageTokenEnc: sibling?.utmifyTokenEnc,
    pageWebhookUrl: sibling?.utmifyWebhookUrl,
    affiliateScript: affiliate.utmifyPixelScript,
    affiliateTokenEnc: affiliate.defaultUtmifyTokenEnc,
    affiliateWebhookUrl: affiliate.utmifyWebhookUrl,
  });
  if (sibling) {
    return {
      fbPixelId: sibling.fbPixelId,
      googlePixelId: sibling.googlePixelId,
      tiktokPixelId: sibling.tiktokPixelId,
      ...utmify,
    };
  }
  return {
    fbPixelId: affiliate.defaultFbPixelId,
    googlePixelId: affiliate.defaultGooglePixelId,
    tiktokPixelId: affiliate.defaultTiktokPixelId,
    ...utmify,
  };
}

export async function affiliateUsedByOtherCompany(
  db: AffiliatePageDb,
  affiliateId: string,
  companyId: string,
) {
  const pages = await queryAffiliatePages(db, {
    where: { affiliateId },
    select: { campaign: { select: { companyId: true } } },
  });
  const usedByThisCompany = pages.some(
    (page) => page.campaign.companyId === companyId,
  );
  const usedByOtherCompany = pages.some(
    (page) => page.campaign.companyId && page.campaign.companyId !== companyId,
  );
  return !canAttachAffiliateToCompany({
    usedByThisCompany,
    usedByOtherCompany,
  });
}
