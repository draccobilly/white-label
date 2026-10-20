import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/request-status";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminNavBadges = {
  support: number;
  refunds: number;
  /** Disputes still waiting for a response in Stripe. */
  disputes: number;
};

export type AdminAttention = AdminNavBadges & {
  unmatchedRefunds: number;
  openDisputes: number;
  drafts: number;
};

/** A missing table or a slow count must never take the panel down. */
function safeCount(query: Promise<number>) {
  return query.catch(() => 0);
}

/**
 * Open items in a queue. Uses the status column; until the status migration
 * is applied it counts what arrived in the last 24 hours instead.
 */
async function openQueueCount(model: "helpRequest" | "refundRequest", companyId: string) {
  const since = new Date(Date.now() - DAY_MS);
  try {
    return model === "helpRequest"
      ? await prisma.helpRequest.count({ where: { companyId, status: "OPEN" } })
      : await prisma.refundRequest.count({ where: { companyId, status: "OPEN" } });
  } catch (error) {
    if (!isMissingColumnError(error)) return 0;
    return safeCount(
      model === "helpRequest"
        ? prisma.helpRequest.count({ where: { companyId, createdAt: { gte: since } } })
        : prisma.refundRequest.count({ where: { companyId, createdAt: { gte: since } } }),
    );
  }
}

function disputesToAnswer(companyId: string) {
  return safeCount(
    prisma.chargeback.count({
      where: {
        closedAt: null,
        status: { in: ["needs_response", "warning_needs_response"] },
        sale: { campaign: { companyId } },
      },
    }),
  );
}

/** Counters for the navigation badges: what is still open in each queue. */
export async function adminNavBadges(companyId: string): Promise<AdminNavBadges> {
  const [support, refunds, disputes] = await Promise.all([
    openQueueCount("helpRequest", companyId),
    openQueueCount("refundRequest", companyId),
    disputesToAnswer(companyId),
  ]);
  return { support, refunds, disputes };
}

/** What the owner should look at first on the overview. Read-only counts. */
export async function adminAttention(companyId: string): Promise<AdminAttention> {
  const week = new Date(Date.now() - 7 * DAY_MS);
  const [support, refunds, unmatchedRefunds, openDisputes, disputes, drafts] =
    await Promise.all([
      openQueueCount("helpRequest", companyId),
      openQueueCount("refundRequest", companyId),
      safeCount(
        prisma.refundRequest.count({
          where: { companyId, saleId: null, createdAt: { gte: week } },
        }),
      ),
      safeCount(
        prisma.chargeback.count({
          where: { closedAt: null, sale: { campaign: { companyId } } },
        }),
      ),
      disputesToAnswer(companyId),
      safeCount(prisma.campaign.count({ where: { companyId, status: "DRAFT" } })),
    ]);
  return { support, refunds, unmatchedRefunds, openDisputes, disputes, drafts };
}
