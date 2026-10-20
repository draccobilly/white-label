import JSZip from "jszip";
import { SaleStatus } from "@/generated/prisma/enums";
import {
  buildDonationLetterPdf,
  donationLetterFileName,
  letterDate,
  letterMoney,
} from "@/lib/donation-letter";
import { sendDonationLetterVoidEmail } from "@/lib/mail";
import { DONATION_LETTER } from "@/lib/donation-letter-config";
import type { EmailAttachment } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

/**
 * A filed copy of every donation acknowledgment letter that was e-mailed.
 * The Cartas desk downloads these by the month they were sent. Sample
 * letters are not filed. The PDF saved here is the one the donor received.
 */

const PROVIDER = "resend";
const LETTER_EVENT = "donation.tax_letter";
const LETTER_PREFIX = "donation-tax-letter:";
const BACKFILL_BATCH = 8;

export type LetterArchiveMonth = {
  /** YYYY-MM in the operation's timezone. */
  month: string;
  label: string;
  copies: number;
  /** Letters already e-mailed whose PDF is not filed yet. */
  unstored: number;
  totalCents: number;
  /** Gifts at or above the automatic-letter threshold, the ones the IRS asks about. */
  reportableCount: number;
  reportableCents: number;
  letters: LetterArchiveItem[];
};

export type LetterArchiveItem = {
  id: string;
  sentAt: string;
  donorName: string;
  reference: string;
  amountCents: number;
  currency: string;
  voidedAt: string | null;
};

export type LetterArchiveListing = {
  ready: boolean;
  months: LetterArchiveMonth[];
  unstored: number;
};

function missingTable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: string }).code === "P2021" || (error as { code?: string }).code === "P2022")
  );
}

function saleIdFromEvent(eventId: string) {
  return eventId.startsWith(LETTER_PREFIX) ? eventId.slice(LETTER_PREFIX.length) : null;
}

function statedAmount(payloadHash: string | null) {
  const value = Number((payloadHash ?? "").replace(/^amount:/, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Civil month (YYYY-MM) of a send, on the operation clock. */
export function letterSentMonth(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DONATION_LETTER.timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(date);
  return parts.slice(0, 7);
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 15)));
}

function civilDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DONATION_LETTER.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** UTC instant of midnight at the start of a civil month in the operation timezone. */
function monthStartUtc(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const guess = new Date(Date.UTC(year, monthNumber - 1, 1, 12, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DONATION_LETTER.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wallAsUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  const midnight = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0));
  return new Date(midnight.getTime() - (wallAsUtc - guess.getTime()));
}

function nextMonthKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = monthNumber === 12 ? 1 : monthNumber + 1;
  const nextYear = monthNumber === 12 ? year + 1 : year;
  return `${nextYear}-${String(next).padStart(2, "0")}`;
}

function paymentMethodLabel(method: string) {
  return method.trim().toLowerCase() === "paypal" ? "PayPal" : "Card";
}

function referenceOf(sale: { id: string; trackingCode: string | null }) {
  return sale.trackingCode?.trim() || sale.id.slice(0, 8).toUpperCase();
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function zipEntryName(sentAt: Date, reference: string, donorName: string) {
  const day = civilDay(sentAt);
  const ref = reference.replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 40) || "doacao";
  const who =
    donorName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "doador";
  return `${day}_${ref}_${who}.pdf`;
}

/** Saves the PDF that was just accepted by the mail provider. Never throws. */
export async function keepLetterCopy(input: {
  saleId: string;
  amountCents: number;
  attachment: EmailAttachment;
  sentAt?: Date;
}) {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: input.saleId },
      select: {
        id: true,
        currency: true,
        customerName: true,
        trackingCode: true,
        campaign: { select: { companyId: true } },
      },
    });
    const companyId = sale?.campaign.companyId;
    if (!sale || !companyId) return;
    await prisma.donationLetterCopy.create({
      data: {
        companyId,
        saleId: sale.id,
        sentAt: input.sentAt ?? new Date(),
        amountCents: input.amountCents,
        currency: sale.currency,
        reference: referenceOf(sale),
        donorName: sale.customerName.trim() || "Anonymous",
        filename: input.attachment.filename,
        pdf: new Uint8Array(input.attachment.content),
      },
    });
  } catch (error) {
    if (missingTable(error)) return;
    console.error("Could not keep the donation letter copy", error instanceof Error ? error.message : error);
  }
}

type OpenLetter = {
  eventId: string;
  eventDbId: string;
  saleId: string;
  processedAt: Date;
  amountCents: number | null;
};

async function lettersNotYetFiled(companyId: string): Promise<OpenLetter[]> {
  const events = await prisma.webhookEvent.findMany({
    where: { provider: PROVIDER, eventType: LETTER_EVENT },
    select: { id: true, eventId: true, payloadHash: true, processedAt: true },
  });
  const saleIds = [...new Set(events.flatMap((event) => {
    const saleId = saleIdFromEvent(event.eventId);
    return saleId ? [saleId] : [];
  }))];
  if (!saleIds.length) return [];
  const [owned, filedSales, filedEvents] = await Promise.all([
    prisma.sale.findMany({
      where: { id: { in: saleIds }, campaign: { companyId } },
      select: { id: true },
    }),
    prisma.donationLetterCopy.findMany({
      where: { companyId },
      select: { saleId: true },
    }),
    prisma.donationLetterCopy.findMany({
      where: { companyId, sourceEventId: { not: null } },
      select: { sourceEventId: true },
    }),
  ]);
  const ownedIds = new Set(owned.map((sale) => sale.id));
  const filedSaleIds = new Set(filedSales.map((copy) => copy.saleId));
  const filedEventIds = new Set(filedEvents.map((copy) => copy.sourceEventId));
  return events.flatMap((event) => {
    const saleId = saleIdFromEvent(event.eventId);
    if (!saleId || !ownedIds.has(saleId)) return [];
    if (filedEventIds.has(event.id) || filedSaleIds.has(saleId)) return [];
    return [{
      eventId: event.eventId,
      eventDbId: event.id,
      saleId,
      processedAt: event.processedAt,
      amountCents: statedAmount(event.payloadHash),
    }];
  });
}

/** Files the next few letters that were e-mailed before copies were kept. */
export async function backfillLetterCopies(companyId: string, limit = BACKFILL_BATCH) {
  const open = await lettersNotYetFiled(companyId);
  const batch = open.slice(0, Math.max(1, Math.min(limit, 20)));
  if (!batch.length) return { stored: 0, remaining: 0 };
  const sales = await prisma.sale.findMany({
    where: { id: { in: batch.map((letter) => letter.saleId) }, campaign: { companyId } },
    select: {
      id: true,
      amount: true,
      amountRefunded: true,
      currency: true,
      status: true,
      customerName: true,
      customerEmail: true,
      paymentMethod: true,
      trackingCode: true,
      paidAt: true,
      createdAt: true,
      campaign: { select: { companyId: true } },
    },
  });
  const byId = new Map(sales.map((sale) => [sale.id, sale]));
  const voids = await prisma.webhookEvent.findMany({
    where: {
      provider: PROVIDER,
      eventId: { in: batch.map((letter) => `donation-tax-letter-void:${letter.saleId}`) },
    },
    select: { eventId: true, processedAt: true },
  });
  const voidAt = new Map(voids.map((event) => [event.eventId, event.processedAt]));
  let stored = 0;
  for (const letter of batch) {
    const sale = byId.get(letter.saleId);
    const company = sale?.campaign.companyId;
    const amountCents = letter.amountCents ?? (sale ? Math.max(0, sale.amount - sale.amountRefunded) : 0);
    if (!sale || !company || amountCents <= 0 || sale.status === SaleStatus.PENDING) continue;
    const reference = referenceOf(sale);
    const pdf = await buildDonationLetterPdf({
      donorName: sale.customerName,
      donorEmail: sale.customerEmail,
      amountCents,
      currency: sale.currency,
      paidAt: sale.paidAt ?? sale.createdAt,
      reference,
      paymentMethod: paymentMethodLabel(sale.paymentMethod),
      issuedAt: letter.processedAt,
    });
    try {
      await prisma.donationLetterCopy.create({
        data: {
          companyId: company,
          saleId: sale.id,
          sourceEventId: letter.eventDbId,
          sentAt: letter.processedAt,
          amountCents,
          currency: sale.currency,
          reference,
          donorName: sale.customerName.trim() || "Anonymous",
          filename: donationLetterFileName(reference),
          pdf: new Uint8Array(pdf),
          voidedAt: (() => {
            const at = voidAt.get(`donation-tax-letter-void:${sale.id}`);
            return at && at >= letter.processedAt ? at : null;
          })(),
        },
      });
      stored += 1;
    } catch (error) {
      const duplicate =
        typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
      if (!duplicate) throw error;
    }
  }
  return { stored, remaining: Math.max(0, open.length - batch.length) };
}

export async function listLetterArchive(companyId: string): Promise<LetterArchiveListing> {
  try {
    const [copies, open] = await Promise.all([
      prisma.donationLetterCopy.findMany({
        where: { companyId },
        select: {
          id: true,
          sentAt: true,
          amountCents: true,
          currency: true,
          reference: true,
          donorName: true,
          voidedAt: true,
        },
      }),
      lettersNotYetFiled(companyId),
    ]);
    const months = new Map<string, LetterArchiveMonth>();
    const bucket = (month: string) => {
      const existing = months.get(month);
      if (existing) return existing;
      const created: LetterArchiveMonth = {
        month,
        label: monthLabel(month),
        copies: 0,
        unstored: 0,
        totalCents: 0,
        reportableCount: 0,
        reportableCents: 0,
        letters: [],
      };
      months.set(month, created);
      return created;
    };
    for (const copy of copies) {
      const row = bucket(letterSentMonth(copy.sentAt));
      row.copies += 1;
      row.totalCents += copy.amountCents;
      if (!copy.voidedAt && copy.amountCents >= DONATION_LETTER.automaticFromCents) {
        row.reportableCount += 1;
        row.reportableCents += copy.amountCents;
      }
      row.letters.push({
        id: copy.id,
        sentAt: copy.sentAt.toISOString(),
        donorName: copy.donorName,
        reference: copy.reference,
        amountCents: copy.amountCents,
        currency: copy.currency,
        voidedAt: copy.voidedAt ? copy.voidedAt.toISOString() : null,
      });
    }
    for (const letter of open) {
      const row = bucket(letterSentMonth(letter.processedAt));
      row.unstored += 1;
      const amount = letter.amountCents ?? 0;
      row.totalCents += amount;
      if (amount >= DONATION_LETTER.automaticFromCents) {
        row.reportableCount += 1;
        row.reportableCents += amount;
      }
    }
    for (const row of months.values()) {
      row.letters.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    }
    return {
      ready: true,
      unstored: open.length,
      months: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)),
    };
  } catch (error) {
    if (missingTable(error)) return { ready: false, months: [], unstored: 0 };
    throw error;
  }
}

function uniqueEntry(used: Set<string>, folder: string, name: string) {
  let entry = `${folder}/${name}`;
  if (!used.has(entry)) {
    used.add(entry);
    return entry;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  while (used.has(`${folder}/${stem}-${n}${ext}`)) n += 1;
  entry = `${folder}/${stem}-${n}${ext}`;
  used.add(entry);
  return entry;
}

/** Zip of the filed letters for one month (YYYY-MM) or every month. */
export async function buildLetterArchiveZip(companyId: string, month: string | null) {
  const where =
    month === null
      ? { companyId }
      : {
          companyId,
          sentAt: { gte: monthStartUtc(month), lt: monthStartUtc(nextMonthKey(month)) },
        };
  const copies = await prisma.donationLetterCopy.findMany({
    where,
    orderBy: { sentAt: "asc" },
  });
  if (!copies.length) return null;
  const zip = new JSZip();
  const used = new Set<string>();
  const lines = ["sent_date,donor_name,reference,amount,currency,cancelled,reportable_250_or_more,file"];
  for (const copy of copies) {
    const folder = letterSentMonth(copy.sentAt);
    const entry = uniqueEntry(used, folder, zipEntryName(copy.sentAt, copy.reference, copy.donorName));
    zip.file(entry, copy.pdf);
    const cancelled = copy.voidedAt ? "yes" : "no";
    const reportable = !copy.voidedAt && copy.amountCents >= DONATION_LETTER.automaticFromCents ? "yes" : "no";
    lines.push(
      [
        civilDay(copy.sentAt),
        csvCell(copy.donorName),
        csvCell(copy.reference),
        (copy.amountCents / 100).toFixed(2),
        copy.currency,
        cancelled,
        reportable,
        entry,
      ].join(","),
    );
  }
  zip.file("indice.csv", lines.join("\n") + "\n");
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const filename = month ? `cartas-doacao-${month}.zip` : "cartas-doacao.zip";
  return { filename, bytes, count: copies.length };
}

export function isLetterMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export class LetterArchiveError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "LetterArchiveError";
    this.status = status;
  }
}

/** The stored PDF, including one that was later cancelled. */
export async function letterCopyFile(companyId: string, copyId: string) {
  return prisma.donationLetterCopy.findFirst({
    where: { id: copyId, companyId },
    select: { filename: true, pdf: true },
  });
}

/** Marks every still-valid copy of a gift cancelled. Used after a refund or lost dispute. */
export async function markLetterCopiesVoided(saleId: string, at = new Date()) {
  try {
    await prisma.donationLetterCopy.updateMany({
      where: { saleId, voidedAt: null },
      data: { voidedAt: at },
    });
  } catch (error) {
    if (!missingTable(error)) {
      console.error("Could not mark letter copies cancelled", error instanceof Error ? error.message : error);
    }
  }
}

/**
 * Cancels one filed letter: e-mails the donor that this PDF is no longer valid,
 * keeps the file, and drops it from the IRS totals.
 */
export async function cancelLetterCopy(companyId: string, copyId: string) {
  const copy = await prisma.donationLetterCopy.findFirst({ where: { id: copyId, companyId } });
  if (!copy) throw new LetterArchiveError("Carta não encontrada", 404);
  if (copy.voidedAt) throw new LetterArchiveError("Esta carta já está cancelada");
  const sale = await prisma.sale.findFirst({
    where: { id: copy.saleId, campaign: { companyId } },
    select: { customerName: true, customerEmail: true },
  });
  const to = sale?.customerEmail?.trim();
  if (!to) throw new LetterArchiveError("Esta carta não tem e-mail do doador");
  await sendDonationLetterVoidEmail({
    to,
    customerName: sale?.customerName,
    originalAmountLabel: letterMoney(copy.amountCents, copy.currency),
    refundedAmountLabel: letterMoney(copy.amountCents, copy.currency),
    trackingCode: copy.reference,
    issuedOn: letterDate(copy.sentAt),
    partial: false,
    reason: "withdrawn",
  });
  const now = new Date();
  await prisma.donationLetterCopy.update({ where: { id: copy.id }, data: { voidedAt: now } });
  const newer = await prisma.donationLetterCopy.findFirst({
    where: { companyId, saleId: copy.saleId, voidedAt: null, sentAt: { gt: copy.sentAt } },
    select: { id: true },
  });
  if (!newer) {
    const eventId = `donation-tax-letter-void:${copy.saleId}`;
    await prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider: PROVIDER, eventId } },
      update: { processedAt: now },
      create: { provider: PROVIDER, eventId, eventType: "donation.tax_letter_void", processedAt: now },
    });
  }
  return { to, reference: copy.reference };
}

