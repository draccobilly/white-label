import { SaleStatus } from "@/generated/prisma/enums";
import {
  buildDonationLetterPdf,
  canIssueLetter,
  donationLetterFileName,
  letterDate,
  letterMoney,
  qualifiesForAutomaticLetter,
} from "@/lib/donation-letter";
import { keepLetterCopy, markLetterCopiesVoided } from "@/lib/donation-letter-archive";
import { sendDonationLetterEmail, sendDonationLetterVoidEmail, type EmailAttachment } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

/**
 * Who gets the donation acknowledgment letter and when:
 *  - automatically, attached to the thank-you e-mail, for qualifying gifts;
 *  - on request, sent from the panel, for any paid gift;
 *  - cancelled by e-mail when the gift is refunded, or lost in a payment
 *    dispute (chargeback), after a letter went out.
 *
 * What was sent is kept in WebhookEvent (provider "resend"), the same ledger
 * the thank-you e-mail already uses, so no table changes are needed. The
 * payloadHash of a letter event holds the amount the letter stated.
 */

const PROVIDER = "resend";
const LETTER_EVENT = "donation.tax_letter";
const VOID_EVENT = "donation.tax_letter_void";
const VOID_LOOKBACK_DAYS = 45;
/** Stripe dispute statuses that mean the money went back to the donor. */
const LOST_DISPUTE_STATUSES = ["lost", "charge_refunded"];

function letterEventId(saleId: string) {
  return `donation-tax-letter:${saleId}`;
}

function voidEventId(saleId: string) {
  return `donation-tax-letter-void:${saleId}`;
}

function statedAmount(payloadHash: string | null) {
  const value = Number((payloadHash ?? "").replace(/^amount:/, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const LETTER_SALE_SELECT = {
  id: true,
  amount: true,
  amountRefunded: true,
  currency: true,
  status: true,
  livemode: true,
  customerName: true,
  customerEmail: true,
  paymentMethod: true,
  trackingCode: true,
  paidAt: true,
  createdAt: true,
  campaign: { select: { title: true, companyId: true } },
} as const;

type LetterSale = {
  id: string;
  amount: number;
  amountRefunded: number;
  currency: string;
  status: SaleStatus;
  livemode: boolean;
  customerName: string;
  customerEmail: string | null;
  paymentMethod: string;
  trackingCode: string | null;
  paidAt: Date | null;
  createdAt: Date;
  campaign: { title: string; companyId: string | null };
};

function netAmount(sale: Pick<LetterSale, "amount" | "amountRefunded">) {
  return Math.max(0, sale.amount - sale.amountRefunded);
}

function referenceOf(sale: Pick<LetterSale, "id" | "trackingCode">) {
  return sale.trackingCode?.trim() || sale.id.slice(0, 8).toUpperCase();
}

function paymentMethodLabel(method: string) {
  return method.trim().toLowerCase() === "paypal" ? "PayPal" : "Card";
}

async function letterAttachment(sale: LetterSale, issuedAt = new Date()): Promise<EmailAttachment> {
  const reference = referenceOf(sale);
  const pdf = await buildDonationLetterPdf({
    donorName: sale.customerName,
    donorEmail: sale.customerEmail,
    amountCents: netAmount(sale),
    currency: sale.currency,
    paidAt: sale.paidAt ?? sale.createdAt,
    reference,
    paymentMethod: paymentMethodLabel(sale.paymentMethod),
    issuedAt,
  });
  return { filename: donationLetterFileName(reference), content: Buffer.from(pdf), contentType: "application/pdf" };
}

async function recordLetterSent(saleId: string, amountCents: number, attachment: EmailAttachment) {
  const now = new Date();
  await prisma.webhookEvent.upsert({
    where: { provider_eventId: { provider: PROVIDER, eventId: letterEventId(saleId) } },
    update: { payloadHash: `amount:${amountCents}`, processedAt: now },
    create: {
      provider: PROVIDER,
      eventId: letterEventId(saleId),
      eventType: LETTER_EVENT,
      payloadHash: `amount:${amountCents}`,
      processedAt: now,
    },
  });
  await keepLetterCopy({ saleId, amountCents, attachment, sentAt: now });
}

/* ------------------------------------------------------------------------ */
/* Automatic letter, with the thank-you e-mail                               */
/* ------------------------------------------------------------------------ */

/**
 * The letter to attach to the thank-you e-mail, or null when the gift does
 * not qualify. Never throws: a letter problem must not hold back the
 * thank-you e-mail (the letter can still be sent from the panel).
 */
export async function prepareAutomaticLetter(sale: {
  id: string;
  amount: number;
  currency: string;
}): Promise<{ attachment: EmailAttachment; amountCents: number } | null> {
  if (!qualifiesForAutomaticLetter(sale)) return null;
  try {
    const row = await prisma.sale.findUnique({ where: { id: sale.id }, select: LETTER_SALE_SELECT });
    if (!row || row.status !== SaleStatus.PAID || !qualifiesForAutomaticLetter(row)) return null;
    return { attachment: await letterAttachment(row), amountCents: netAmount(row) };
  } catch (error) {
    console.error("Could not build the donation letter", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Call after the thank-you e-mail with the letter was accepted by the mail provider. */
export async function markAutomaticLetterSent(saleId: string, amountCents: number, attachment: EmailAttachment) {
  await recordLetterSent(saleId, amountCents, attachment).catch((error) => {
    console.error("Could not record the donation letter", error instanceof Error ? error.message : error);
  });
}

/* ------------------------------------------------------------------------ */
/* On request, from the panel                                                 */
/* ------------------------------------------------------------------------ */

export class DonationLetterError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "DonationLetterError";
    this.status = status;
  }
}

async function loadLetterSale(companyId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, campaign: { companyId } },
    select: LETTER_SALE_SELECT,
  });
  if (!sale) throw new DonationLetterError("Doação não encontrada", 404);
  if (sale.status !== SaleStatus.PAID && sale.status !== SaleStatus.PARTIALLY_REFUNDED) {
    throw new DonationLetterError("Só doações pagas recebem carta (esta foi reembolsada ou não foi paga)");
  }
  if (!canIssueLetter(sale)) {
    throw new DonationLetterError("A carta só é emitida para doações em dólar com valor depois de reembolsos");
  }
  return sale;
}

/** The PDF itself, to preview or download in the panel. Sends nothing. */
export async function letterPdfForSale(companyId: string, saleId: string) {
  const sale = await loadLetterSale(companyId, saleId);
  return letterAttachment(sale);
}

/** E-mails the letter to the donor and records it. `supportNote` rides in that same e-mail. */
export async function sendLetterOnRequest(companyId: string, saleId: string, supportNote?: string) {
  const sale = await loadLetterSale(companyId, saleId);
  const to = sale.customerEmail?.trim();
  if (!to) throw new DonationLetterError("Esta doação não tem e-mail do doador");
  const note = supportNote?.replace(/\r\n/g, "\n").trim();
  if (note && note.length > 2000) {
    throw new DonationLetterError("A mensagem de suporte precisa ter até 2000 caracteres.");
  }
  const voided = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: PROVIDER, eventId: voidEventId(sale.id) } },
    select: { id: true },
  });
  const amountCents = netAmount(sale);
  const letter = await letterAttachment(sale);
  await sendDonationLetterEmail({
    to,
    customerName: sale.customerName,
    amountLabel: letterMoney(amountCents, sale.currency),
    trackingCode: referenceOf(sale),
    letter,
    corrected: Boolean(voided),
    supportNote: note || undefined,
  });
  await recordLetterSent(sale.id, amountCents, letter);
  return { to, amountCents, currency: sale.currency };
}

export type LetterSaleRow = {
  id: string;
  customerName: string;
  customerEmail: string | null;
  campaignTitle: string;
  trackingCode: string | null;
  amount: number;
  amountRefunded: number;
  currency: string;
  status: SaleStatus;
  paidAt: string | null;
  /** When a letter was last e-mailed, and for how much. */
  letterSentAt: string | null;
  letterAmount: number | null;
  /** Set when the last letter was cancelled by e-mail after a refund. */
  letterVoidedAt: string | null;
  /** Latest filed PDF for this gift, so the panel can download that exact file. */
  letterCopyId: string | null;
  canIssue: boolean;
};

/** Donations matching a donor e-mail, name or tracking code, with their letter state. */
export async function searchLetterSales(companyId: string, query: string): Promise<LetterSaleRow[]> {
  const term = query.trim();
  if (term.length < 3) return [];
  const sales = await prisma.sale.findMany({
    where: {
      livemode: true,
      campaign: { companyId },
      status: { in: [SaleStatus.PAID, SaleStatus.PARTIALLY_REFUNDED, SaleStatus.REFUNDED, SaleStatus.DISPUTED] },
      OR: [
        { customerEmail: { contains: term, mode: "insensitive" } },
        { customerName: { contains: term, mode: "insensitive" } },
        { trackingCode: { equals: term.toUpperCase() } },
        { trackingCode: { equals: term } },
      ],
    },
    orderBy: { paidAt: "desc" },
    take: 25,
    select: LETTER_SALE_SELECT,
  });
  if (!sales.length) return [];
  const events = await prisma.webhookEvent.findMany({
    where: {
      provider: PROVIDER,
      eventId: { in: sales.flatMap((sale) => [letterEventId(sale.id), voidEventId(sale.id)]) },
    },
    select: { eventId: true, payloadHash: true, processedAt: true },
  });
  const byId = new Map(events.map((event) => [event.eventId, event]));
  const copies = await prisma.donationLetterCopy
    .findMany({
      where: { saleId: { in: sales.map((sale) => sale.id) } },
      select: { id: true, saleId: true, sentAt: true },
      orderBy: { sentAt: "desc" },
    })
    .catch((error: unknown) => {
      const missing =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2021";
      if (missing) return [];
      throw error;
    });
  const copyBySale = new Map<string, string>();
  for (const copy of copies) {
    if (!copyBySale.has(copy.saleId)) copyBySale.set(copy.saleId, copy.id);
  }
  return sales.map((sale) => {
    const letter = byId.get(letterEventId(sale.id));
    const voided = byId.get(voidEventId(sale.id));
    const voidStands = Boolean(letter && voided && voided.processedAt >= letter.processedAt);
    return {
      id: sale.id,
      customerName: sale.customerName,
      customerEmail: sale.customerEmail,
      campaignTitle: sale.campaign.title,
      trackingCode: sale.trackingCode,
      amount: sale.amount,
      amountRefunded: sale.amountRefunded,
      currency: sale.currency,
      status: sale.status,
      paidAt: sale.paidAt ? sale.paidAt.toISOString() : null,
      letterSentAt: letter ? letter.processedAt.toISOString() : null,
      letterAmount: letter ? statedAmount(letter.payloadHash) : null,
      letterVoidedAt: voidStands && voided ? voided.processedAt.toISOString() : null,
      letterCopyId: copyBySale.get(sale.id) ?? null,
      canIssue:
        (sale.status === SaleStatus.PAID || sale.status === SaleStatus.PARTIALLY_REFUNDED) && canIssueLetter(sale),
    };
  });
}

/* ------------------------------------------------------------------------ */
/* Test send                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * E-mails a letter with made-up gift data, stamped as a sample, to check the
 * PDF and the mail provider end to end. Touches no donation and records
 * nothing.
 */
export async function sendSampleLetter(to: string) {
  const reference = "SAMPLE-0000";
  const amountCents = 25_000;
  const pdf = await buildDonationLetterPdf({
    donorName: "Sample Donor",
    donorEmail: to,
    amountCents,
    currency: "USD",
    paidAt: new Date(),
    reference,
    paymentMethod: "Card",
    sample: true,
  });
  await sendDonationLetterEmail({
    to,
    customerName: "Sample Donor",
    amountLabel: letterMoney(amountCents, "USD"),
    trackingCode: reference,
    letter: { filename: donationLetterFileName(reference), content: Buffer.from(pdf), contentType: "application/pdf" },
  });
  return { to };
}

/* ------------------------------------------------------------------------ */
/* Gifts paid before the letter existed                                       */
/* ------------------------------------------------------------------------ */

export type PendingLetterRow = {
  id: string;
  customerName: string;
  customerEmail: string;
  trackingCode: string | null;
  amount: number;
  currency: string;
  paidAt: string | null;
};

/**
 * Paid gifts that qualify for the automatic letter but never got one: the
 * ones paid before the letter went live, or whose letter failed to build.
 * `since` is a civil day (YYYY-MM-DD) or null for everything.
 */
async function pendingAutomaticLetters(companyId: string, since: string | null) {
  const sales = await prisma.sale.findMany({
    where: {
      livemode: true,
      campaign: { companyId },
      status: { in: [SaleStatus.PAID, SaleStatus.PARTIALLY_REFUNDED] },
      customerEmail: { not: null },
      ...(since ? { paidAt: { gte: new Date(`${since}T00:00:00.000Z`) } } : {}),
    },
    orderBy: { paidAt: "asc" },
    take: 5000,
    select: LETTER_SALE_SELECT,
  });
  const qualifying = sales.filter((sale) => qualifiesForAutomaticLetter(sale) && sale.customerEmail?.trim());
  if (!qualifying.length) return [];
  const sent = new Set<string>();
  for (let index = 0; index < qualifying.length; index += 500) {
    const events = await prisma.webhookEvent.findMany({
      where: {
        provider: PROVIDER,
        eventId: { in: qualifying.slice(index, index + 500).map((sale) => letterEventId(sale.id)) },
      },
      select: { eventId: true },
    });
    for (const event of events) sent.add(event.eventId);
  }
  return qualifying.filter((sale) => !sent.has(letterEventId(sale.id)));
}

/** What would be sent: count, total and the first rows, to check before sending. */
export async function listPendingLetters(companyId: string, since: string | null) {
  const pending = await pendingAutomaticLetters(companyId, since);
  return {
    count: pending.length,
    totalCents: pending.reduce((sum, sale) => sum + netAmount(sale), 0),
    rows: pending.slice(0, 100).map(
      (sale): PendingLetterRow => ({
        id: sale.id,
        customerName: sale.customerName,
        customerEmail: (sale.customerEmail ?? "").trim(),
        trackingCode: sale.trackingCode,
        amount: netAmount(sale),
        currency: sale.currency,
        paidAt: sale.paidAt ? sale.paidAt.toISOString() : null,
      }),
    ),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * E-mails the letter for a few pending gifts and says how many are left; the
 * panel calls it again until none remain. Small batches with a pause keep
 * each request short and inside the mail provider's rate limit. Gifts in
 * `exclude` (the ones that just failed) are skipped so one bad address cannot
 * hold the queue.
 */
export async function sendPendingLetters(
  companyId: string,
  since: string | null,
  options: { batch?: number; exclude?: string[] } = {},
) {
  const exclude = new Set(options.exclude ?? []);
  const pending = (await pendingAutomaticLetters(companyId, since)).filter((sale) => !exclude.has(sale.id));
  const batch = pending.slice(0, Math.max(1, Math.min(options.batch ?? 5, 10)));
  const sent: string[] = [];
  const failed: Array<{ id: string; email: string; error: string }> = [];
  for (const sale of batch) {
    const to = (sale.customerEmail ?? "").trim();
    const amountCents = netAmount(sale);
    try {
      const letter = await letterAttachment(sale);
      await sendDonationLetterEmail({
        to,
        customerName: sale.customerName,
        amountLabel: letterMoney(amountCents, sale.currency),
        trackingCode: referenceOf(sale),
        letter,
      });
      await recordLetterSent(sale.id, amountCents, letter);
      sent.push(sale.id);
    } catch (error) {
      failed.push({ id: sale.id, email: to, error: error instanceof Error ? error.message.slice(0, 200) : "falha" });
    }
    await sleep(600);
  }
  return { sent: sent.length, failed, remaining: pending.length - batch.length };
}

/* ------------------------------------------------------------------------ */
/* Refunds and lost disputes: cancel the letter by e-mail                     */
/* ------------------------------------------------------------------------ */

/**
 * Finds gifts whose letter states more than what stayed with the
 * organisation (refunded, or lost in a payment dispute) and e-mails the donor
 * that the letter is cancelled. Runs from the integration cron, so it covers
 * Stripe, PayPal and manual refunds alike without touching the payment
 * webhooks. Safe to run every minute: each cancellation is claimed in
 * WebhookEvent before the e-mail goes out.
 *
 * A dispute only cancels the letter once it is lost; an open or won dispute
 * leaves it alone.
 */
export async function voidRefundedLetters(limit = 20) {
  const since = new Date(Date.now() - VOID_LOOKBACK_DAYS * 86_400_000);
  const [refunded, lostDisputes] = await Promise.all([
    prisma.sale.findMany({
      where: {
        livemode: true,
        status: { in: [SaleStatus.REFUNDED, SaleStatus.PARTIALLY_REFUNDED] },
        updatedAt: { gte: since },
        customerEmail: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: LETTER_SALE_SELECT,
    }),
    prisma.chargeback.findMany({
      where: {
        status: { in: LOST_DISPUTE_STATUSES },
        updatedAt: { gte: since },
        sale: { livemode: true, customerEmail: { not: null } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { amount: true, sale: { select: LETTER_SALE_SELECT } },
    }),
  ]);
  // What each gift lost to disputes, on top of what was refunded.
  const lostBySale = new Map<string, number>();
  const salesById = new Map<string, LetterSale>(refunded.map((sale) => [sale.id, sale]));
  for (const dispute of lostDisputes) {
    lostBySale.set(dispute.sale.id, (lostBySale.get(dispute.sale.id) ?? 0) + dispute.amount);
    if (!salesById.has(dispute.sale.id)) salesById.set(dispute.sale.id, dispute.sale);
  }
  const sales = [...salesById.values()];
  if (!sales.length) return { voided: 0 };
  const events = await prisma.webhookEvent.findMany({
    where: {
      provider: PROVIDER,
      eventId: { in: sales.flatMap((sale) => [letterEventId(sale.id), voidEventId(sale.id)]) },
    },
    select: { id: true, eventId: true, payloadHash: true, processedAt: true },
  });
  const byId = new Map(events.map((event) => [event.eventId, event]));
  let voided = 0;
  for (const sale of sales) {
    if (voided >= limit) break;
    const letter = byId.get(letterEventId(sale.id));
    if (!letter) continue;
    const stated = statedAmount(letter.payloadHash) ?? sale.amount;
    const lost = lostBySale.get(sale.id) ?? 0;
    const remaining = Math.max(0, netAmount(sale) - lost);
    if (stated <= remaining) continue; // the letter in the donor's hands is still right
    const previous = byId.get(voidEventId(sale.id));
    if (previous && previous.processedAt >= letter.processedAt) continue; // already cancelled

    // Claim first, so two overlapping runs cannot both send the e-mail.
    const claimedAt = new Date();
    let claimed = false;
    if (previous) {
      const result = await prisma.webhookEvent.updateMany({
        where: { id: previous.id, processedAt: previous.processedAt },
        data: { processedAt: claimedAt },
      });
      claimed = result.count === 1;
    } else {
      claimed = await prisma.webhookEvent
        .create({
          data: { provider: PROVIDER, eventId: voidEventId(sale.id), eventType: VOID_EVENT, processedAt: claimedAt },
        })
        .then(() => true)
        .catch(() => false);
    }
    if (!claimed) continue;

    try {
      await sendDonationLetterVoidEmail({
        to: (sale.customerEmail ?? "").trim(),
        customerName: sale.customerName,
        originalAmountLabel: letterMoney(stated, sale.currency),
        refundedAmountLabel: letterMoney(stated - remaining, sale.currency),
        trackingCode: referenceOf(sale),
        issuedOn: letterDate(letter.processedAt),
        partial: remaining > 0,
        reason: lost > 0 ? "dispute" : "refund",
      });
      await markLetterCopiesVoided(sale.id);
      voided += 1;
    } catch (error) {
      console.error("Could not send the letter cancellation", error instanceof Error ? error.message : error);
      // Give the claim back so the next run tries again.
      if (previous) {
        await prisma.webhookEvent
          .update({ where: { id: previous.id }, data: { processedAt: previous.processedAt } })
          .catch(() => undefined);
      } else {
        await prisma.webhookEvent
          .deleteMany({ where: { provider: PROVIDER, eventId: voidEventId(sale.id) } })
          .catch(() => undefined);
      }
    }
  }
  return { voided };
}
