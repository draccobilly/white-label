import type { Prisma } from "@/generated/prisma/client";
import { CampaignStatus, SaleStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  deskDirectTeamName,
  deskDirectTeamSlug,
} from "@/lib/campaign-defaults";
import { trackingForNewAffiliatePage } from "@/lib/pixel-isolation";
import {
  campaignCommentPool,
  campaignReplyPool,
  dailySeedTimestamps,
  hashSeed,
  pickFromPool,
  rng,
  seededSocialNeedsRefresh,
  utcDateKey,
  withoutAiDashes,
} from "@/lib/campaign-comments";
import {
  createSocialProofSeed,
  pickAffiliateForCampaignSeed,
  shouldSeedSocialTotals,
  socialActivitySeedPlan,
  SOCIAL_SEED_SESSION_PREFIX,
  socialSeedSessionId,
  splitSocialProofGifts,
  type SeedAffiliateCandidate,
} from "@/lib/social-proof";

type SeedPageDb = Prisma.TransactionClient | Prisma.DefaultPrismaClient;

const FULL_NAMES = [
  "Maya Reynolds",
  "James Okonkwo",
  "Sofia Alvarez",
  "Daniel Whitaker",
  "Priya Mehta",
  "Luis Navarro",
  "Hannah Brooks",
  "Omar Haddad",
  "Grace Patel",
  "Noah Brennan",
  "Elena Vasquez",
  "Marcus Hale",
  "Aisha Rahman",
  "Peter Lang",
  "Chloe Nguyen",
  "Ravi Kapoor",
  "Laura Bennett",
  "Gabriel Santos",
  "Nina Kowalski",
  "Theo Marin",
  "Amelia Foster",
  "Ibrahim Diallo",
  "Claire Jensen",
  "Mateo Ruiz",
  "Ruth Adler",
  "Leo Hartmann",
  "Fatima El-Sayed",
  "Owen Gallagher",
  "Isla McKenzie",
  "Andre Baptiste",
  "Camila Torres",
  "Jordan Ellis",
  "Yara Mansour",
  "Sean O'Brien",
  "Leila Haddad",
  "David Chen",
  "Rosa Delgado",
  "Michael Grant",
  "Ananya Sharma",
  "Chris Walker",
  "Nadia Petrova",
  "Tyler Brooks",
  "Samira Khan",
  "Benjamin Cole",
  "Lucia Ferreira",
  "Helen Park",
  "Antoine Dubois",
  "Keisha Walters",
  "Marco Bianchi",
  "Jun Nakamura",
];

const MX_NAMES = [
  "Sofía Hernández",
  "Diego Ramírez",
  "Valentina López",
  "Mateo García",
  "Camila Torres",
  "Santiago Morales",
  "Renata Castillo",
  "Leonardo Ruiz",
  "Fernanda Ortega",
  "Emiliano Vargas",
  "Isabella Flores",
  "Sebastián Reyes",
  "Mariana Guzmán",
  "Joaquín Mendoza",
  "Ximena Aguilar",
  "Gael Navarro",
  "Regina Pineda",
  "Iker Salazar",
  "Paula Domínguez",
  "Andrés Medina",
  "Daniela Ríos",
  "Emmanuel Soto",
  "Aitana Vega",
  "Rodrigo Peña",
  "Luciana Campos",
  "Maximiliano Cruz",
  "Natalia Herrera",
  "Iván Romero",
  "Alejandra Núñez",
  "Bruno Espinoza",
];

export type SocialActivitySeedResult = {
  slug: string;
  donors: number;
  comments: number;
  replies: number;
  skipped?: boolean;
};

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

function pickUnused(pool: string[], used: Set<string>, random: () => number) {
  const available = pool.filter((item) => !used.has(item));
  const source = available.length ? available : pool;
  return source[Math.floor(random() * source.length)]!;
}

function pickName(
  random: () => number,
  anonymous: boolean,
  usedNames: Set<string>,
  spanish: boolean,
) {
  if (anonymous) return spanish ? "Anónimo" : "Anonymous";
  const name = pickUnused(spanish ? MX_NAMES : FULL_NAMES, usedNames, random);
  usedNames.add(name);
  return name;
}

function isUniqueConstraint(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function clearSeededActivity(campaignId: string) {
  await prisma.donationComment.deleteMany({
    where: {
      campaignId,
      saleId: null,
    },
  });
  await prisma.donationComment.deleteMany({
    where: {
      campaignId,
      sale: {
        stripeCheckoutSessionId: { startsWith: SOCIAL_SEED_SESSION_PREFIX },
      },
    },
  });

  const sales = await prisma.sale.findMany({
    where: {
      campaignId,
      stripeCheckoutSessionId: {
        startsWith: SOCIAL_SEED_SESSION_PREFIX,
      },
    },
    select: { id: true, checkoutIntentId: true },
  });
  if (!sales.length) return;

  await prisma.sale.deleteMany({
    where: { id: { in: sales.map((sale) => sale.id) } },
  });
  await prisma.checkoutIntent.deleteMany({
    where: { id: { in: sales.map((sale) => sale.checkoutIntentId) } },
  });
}

const campaignSeedInclude = {
  options: { select: { amount: true } },
  pages: {
    where: { active: true },
    include: {
      affiliate: true,
      paymentLinks: { where: { active: true }, take: 1 },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

export async function ensureCampaignHasAffiliatePage(
  db: SeedPageDb,
  input: { campaignId: string; companyId: string },
) {
  const existing = await db.affiliatePage.findFirst({
    where: { campaignId: input.campaignId, active: true },
    select: { id: true, affiliateId: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return { ...existing, created: false };

  const company = await db.company.findUnique({
    where: { id: input.companyId },
    select: {
      isDefault: true,
      slug: true,
      locale: true,
      publicPathPrefix: true,
    },
  });
  const affiliateSelect = {
    id: true,
    slug: true,
    defaultFbPixelId: true,
    defaultGooglePixelId: true,
    defaultTiktokPixelId: true,
    defaultUtmifyTokenEnc: true,
    utmifyPixelScript: true,
    utmifyWebhookUrl: true,
  } as const;

  let affiliates = await db.affiliate.findMany({
    where: { active: true },
    select: affiliateSelect,
  });

  async function candidatesFor(
    rows: typeof affiliates,
  ): Promise<SeedAffiliateCandidate[]> {
    const pages = await db.affiliatePage.findMany({
      where: { affiliateId: { in: rows.map((item) => item.id) } },
      select: {
        affiliateId: true,
        campaign: { select: { companyId: true } },
      },
    });
    return rows.map((affiliate) => ({
      id: affiliate.id,
      slug: affiliate.slug,
      usedByThisCompany: pages.some(
        (page) =>
          page.affiliateId === affiliate.id &&
          page.campaign.companyId === input.companyId,
      ),
      usedByOtherCompany: pages.some(
        (page) =>
          page.affiliateId === affiliate.id &&
          Boolean(page.campaign.companyId) &&
          page.campaign.companyId !== input.companyId,
      ),
    }));
  }

  let picked = pickAffiliateForCampaignSeed(await candidatesFor(affiliates));
  if (!picked) {
    const deskSlug = deskDirectTeamSlug(company);
    const created = await db.affiliate.upsert({
      where: { slug: deskSlug },
      update: { active: true },
      create: {
        name: deskDirectTeamName(company),
        slug: deskSlug,
      },
      select: affiliateSelect,
    });
    affiliates = [created, ...affiliates.filter((item) => item.id !== created.id)];
    picked = pickAffiliateForCampaignSeed(await candidatesFor(affiliates));
  }
  if (!picked) {
    const created = await db.affiliate.create({
      data: {
        name: deskDirectTeamName(company),
        slug: `${deskDirectTeamSlug(company)}-${crypto.randomUUID().slice(0, 8)}`,
      },
      select: affiliateSelect,
    });
    affiliates = [created, ...affiliates];
    picked = {
      id: created.id,
      slug: created.slug,
      usedByThisCompany: false,
      usedByOtherCompany: false,
    };
  }

  const affiliate = affiliates.find((item) => item.id === picked.id);
  if (!affiliate) {
    throw new Error(`No affiliate available to seed ${input.campaignId}`);
  }
  const tracking = await trackingForNewAffiliatePage(
    db,
    affiliate,
    input.companyId,
    company?.isDefault !== false,
  );

  const page = await db.affiliatePage.upsert({
    where: {
      campaignId_affiliateId: {
        campaignId: input.campaignId,
        affiliateId: affiliate.id,
      },
    },
    update: { active: true },
    create: {
      campaignId: input.campaignId,
      affiliateId: affiliate.id,
      ...tracking,
    },
    select: { id: true, affiliateId: true },
  });
  return { ...page, created: true };
}

export async function guaranteeCampaignSocialProof(
  campaignId: string,
  options: { preserveTotals?: boolean } = {},
) {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { options: { select: { amount: true } } },
  });
  if (!campaign.companyId) {
    throw new Error(`Campaign ${campaign.slug} has no company`);
  }
  if (
    !options.preserveTotals &&
    shouldSeedSocialTotals(campaign.currentAmount)
  ) {
    const seed = createSocialProofSeed(
      campaign.options.map((option) => option.amount),
    );
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...seed,
        baselineAmount: seed.currentAmount,
        baselineSupporterCount: seed.supporterCount,
      },
    });
  }
  await ensureCampaignHasAffiliatePage(prisma, {
    campaignId,
    companyId: campaign.companyId,
  });
  return seedCampaignSocialActivity(campaignId);
}

export async function seedCampaignSocialActivity(
  campaignId: string,
  options: { replace?: boolean } = {},
): Promise<SocialActivitySeedResult> {
  let campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: campaignSeedInclude,
  });

  if (campaign.companyId && !campaign.pages.length) {
    await ensureCampaignHasAffiliatePage(prisma, {
      campaignId,
      companyId: campaign.companyId,
    });
    campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: campaignSeedInclude,
    });
  }

  const donorCount =
    campaign.baselineSupporterCount || campaign.supporterCount || 0;
  const total = campaign.baselineAmount || campaign.currentAmount || 0;
  const tickets = campaign.options.map((option) => option.amount);
  const giftAmounts = splitSocialProofGifts(total, donorCount, tickets);
  const seedSaleCount = await prisma.sale.count({
    where: {
      campaignId,
      stripeCheckoutSessionId: {
        startsWith: SOCIAL_SEED_SESSION_PREFIX,
      },
    },
  });
  const livePaidSaleCount = await prisma.sale.count({
    where: {
      campaignId,
      status: SaleStatus.PAID,
      NOT: {
        stripeCheckoutSessionId: { startsWith: SOCIAL_SEED_SESSION_PREFIX },
      },
    },
  });
  const plan = socialActivitySeedPlan({
    replace: options.replace,
    seedSaleCount,
    livePaidSaleCount,
    expectedDonors: giftAmounts.length,
  });
  if (plan === "skip") {
    return {
      slug: campaign.slug,
      donors: 0,
      comments: 0,
      replies: 0,
      skipped: true,
    };
  }

  const page =
    campaign.pages.find((item) => item.affiliate.slug === "direct-team") ??
    campaign.pages.find((item) => item.paymentLinks.length > 0) ??
    campaign.pages[0];
  if (!page) {
    throw new Error(`No affiliate page for ${campaign.slug}`);
  }

  let paymentLink = page.paymentLinks[0];
  if (!paymentLink) {
    const option = await prisma.donationOption.findFirst({
      where: { campaignId: campaign.id },
      orderBy: { sortOrder: "asc" },
    });
    if (!option) throw new Error(`No donation options for ${campaign.slug}`);
    paymentLink = await prisma.paymentLink.upsert({
      where: {
        affiliatePageId_donationOptionId: {
          affiliatePageId: page.id,
          donationOptionId: option.id,
        },
      },
      update: {},
      create: {
        affiliatePageId: page.id,
        donationOptionId: option.id,
        url: "https://buy.stripe.com/seed-placeholder",
        stripeCheckoutUrl: "https://buy.stripe.com/seed-placeholder",
        stripePaymentLinkId: null,
        active: false,
      },
    });
  }

  const amounts = shuffle(
    giftAmounts,
    rng(hashSeed(`${campaign.slug}-amounts`)),
  );
  if (!amounts.length) {
    return { slug: campaign.slug, donors: 0, comments: 0, replies: 0 };
  }

  if (options.replace) {
    await clearSeededActivity(campaign.id);
  }

  const source = {
    title: campaign.title,
    summary: campaign.summary,
    story: campaign.story,
    organizerName: campaign.organizerName,
    currency: campaign.currency,
  };
  const commentPool = campaignCommentPool(source);
  const replyPool = campaignReplyPool(source);
  const spanish = campaign.currency === "MXN" || campaign.currency === "ARS";
  const random = rng(hashSeed(`${campaign.slug}:${utcDateKey(new Date())}`));
  const paidAtStamps = dailySeedTimestamps(amounts.length, new Date(), random);
  const usedComments = new Set<number>();
  const usedReplies = new Set<number>();
  const usedNames = new Set<string>();
  let donors = 0;
  let comments = 0;
  let replies = 0;

  for (const [index, amount] of amounts.entries()) {
    const sessionId = socialSeedSessionId(campaign.id, index);
    const anonymous = index % 5 === 1 || random() < 0.12;
    const name = pickName(random, anonymous, usedNames, spanish);
    const leaveComment = random() > 0.08;
    const paidAt = paidAtStamps[index] ?? new Date();

    const existingSale = await prisma.sale.findUnique({
      where: { stripeCheckoutSessionId: sessionId },
      select: { id: true, campaignId: true },
    });
    if (existingSale) continue;

    const intent = await prisma.checkoutIntent.create({
      data: {
        affiliatePageId: page.id,
        paymentLinkId: paymentLink.id,
        amount,
        currency: campaign.currency,
        expiresAt: new Date(paidAt.getTime() + 86_400_000),
        createdAt: paidAt,
      },
    });
    let sale;
    try {
      sale = await prisma.sale.create({
        data: {
          checkoutIntentId: intent.id,
          affiliatePageId: page.id,
          campaignId: campaign.id,
          affiliateId: page.affiliateId,
          stripeCheckoutSessionId: sessionId,
          amount,
          currency: campaign.currency,
          status: SaleStatus.PAID,
          customerName: name,
          paidAt,
          livemode: true,
        },
      });
    } catch (error) {
      if (isUniqueConstraint(error)) {
        await prisma.checkoutIntent.delete({ where: { id: intent.id } }).catch(() => {});
        continue;
      }
      throw error;
    }
    donors += 1;

    if (!leaveComment) continue;

    const comment = await prisma.donationComment.create({
      data: {
        saleId: sale.id,
        campaignId: campaign.id,
        authorName: name,
        body: withoutAiDashes(pickFromPool(commentPool, random, usedComments)),
        createdAt: paidAt,
      },
    });
    comments += 1;

    const replyCount = random() < 0.12 ? 2 : random() < 0.46 ? 1 : 0;
    for (let replyIndex = 0; replyIndex < replyCount; replyIndex += 1) {
      const replyAnonymous = random() < 0.18;
      await prisma.donationComment.create({
        data: {
          campaignId: campaign.id,
          parentId: comment.id,
          authorName: pickName(random, replyAnonymous, usedNames, spanish),
          body: withoutAiDashes(pickFromPool(replyPool, random, usedReplies)),
          createdAt: new Date(
            paidAt.getTime() + (12 + replyIndex * 40 + random() * 90) * 60_000,
          ),
        },
      });
      replies += 1;
    }
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      likeCount: Math.max(18, Math.round(donorCount * (2.1 + random() * 1.7))),
      shareCount: Math.max(7, Math.round(donorCount * (0.35 + random() * 0.5))),
    },
  });

  return {
    slug: campaign.slug,
    donors,
    comments,
    replies,
    skipped: donors === 0,
  };
}

export async function refreshDailySeededSocialProof(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      story: true,
      organizerName: true,
      currency: true,
    },
  });
  if (!campaign) return { updated: false };

  const seedSales = await prisma.sale.findMany({
    where: {
      campaignId,
      stripeCheckoutSessionId: { startsWith: SOCIAL_SEED_SESSION_PREFIX },
    },
    orderBy: { paidAt: "desc" },
    select: {
      id: true,
      paidAt: true,
      comments: {
        where: { parentId: null },
        select: {
          id: true,
          body: true,
          createdAt: true,
          replies: { select: { id: true, body: true } },
        },
        take: 1,
      },
    },
  });
  if (!seedSales.length) return { updated: false };

  const bodies = seedSales.flatMap((sale) => {
    const comment = sale.comments[0];
    if (!comment) return [];
    return [comment.body, ...comment.replies.map((reply) => reply.body)];
  });
  const newestPaidAt = seedSales[0]?.paidAt ?? null;
  if (!seededSocialNeedsRefresh({ newestPaidAt, bodies })) {
    return { updated: false };
  }

  const now = new Date();
  const random = rng(hashSeed(`${campaign.slug}:fresh:${utcDateKey(now)}`));
  const stamps = dailySeedTimestamps(seedSales.length, now, random);
  const source = {
    title: campaign.title,
    summary: campaign.summary,
    story: campaign.story,
    organizerName: campaign.organizerName,
    currency: campaign.currency,
  };
  const commentPool = campaignCommentPool(source);
  const replyPool = campaignReplyPool(source);
  const usedComments = new Set<number>();
  const usedReplies = new Set<number>();

  const chronological = [...seedSales].reverse();
  await prisma.$transaction(
    async (tx) => {
      for (const [index, sale] of chronological.entries()) {
        const paidAt = stamps[index] ?? now;
        await tx.sale.update({
          where: { id: sale.id },
          data: { paidAt },
        });
        if (!sale.comments[0]) continue;
        const comment = sale.comments[0];
        await tx.donationComment.update({
          where: { id: comment.id },
          data: {
            body: withoutAiDashes(pickFromPool(commentPool, random, usedComments)),
            createdAt: paidAt,
          },
        });
        for (const [replyIndex, reply] of comment.replies.entries()) {
          await tx.donationComment.update({
            where: { id: reply.id },
            data: {
              body: withoutAiDashes(pickFromPool(replyPool, random, usedReplies)),
              createdAt: new Date(
                paidAt.getTime() + (12 + replyIndex * 40 + random() * 90) * 60_000,
              ),
            },
          });
        }
      }
    },
    { timeout: 20_000 },
  );

  return { updated: true };
}

export async function refreshAllDailySeededSocialProof() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: { in: [CampaignStatus.ACTIVE, CampaignStatus.COMPLETED] } },
    select: { id: true, slug: true },
  });
  let updated = 0;
  for (const campaign of campaigns) {
    try {
      const result = await refreshDailySeededSocialProof(campaign.id);
      if (result.updated) updated += 1;
    } catch (error) {
      console.error(
        `[social-activity] daily refresh failed for ${campaign.slug}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }
  return { scanned: campaigns.length, updated };
}

export async function backfillMissingSocialActivity() {
  const campaigns = await prisma.campaign.findMany({
    select: { id: true, slug: true },
  });
  const results: SocialActivitySeedResult[] = [];
  for (const campaign of campaigns) {
    try {
      const result = await guaranteeCampaignSocialProof(campaign.id);
      if (!result.skipped) results.push(result);
    } catch (error) {
      console.error(
        `[social-activity] seed failed for ${campaign.slug}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }
  return results;
}
