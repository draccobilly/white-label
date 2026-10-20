import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { LETTER_LOGO, LETTER_SIGNATURE } from "@/lib/donation-letter-assets";
import { DONATION_LETTER } from "@/lib/donation-letter-config";

/**
 * Donation acknowledgment letter: one US Letter page with the logo centred
 * at the top, the gift details, the tax-exemption statement and the signed
 * closing. Pure PDF building; who gets it and when lives in
 * lib/donation-letter-desk.ts.
 */

export type DonationLetterInput = {
  donorName: string;
  donorEmail?: string | null;
  /** Net gift in cents (what was charged, tip included, minus refunds). */
  amountCents: number;
  currency: string;
  paidAt: Date;
  /** Donation reference shown to the donor (tracking code). */
  reference: string;
  /** "PayPal", "Card"… */
  paymentMethod?: string | null;
  /** When the letter is issued; defaults to now. */
  issuedAt?: Date;
  /** Test letter: stamped "SAMPLE - NOT VALID" so it cannot pass for a real one. */
  sample?: boolean;
};

const PAGE = { width: 612, height: 792, margin: 68 };
const INK = rgb(0.13, 0.15, 0.2);
const MUTED = rgb(0.4, 0.43, 0.49);
const RULE = rgb(0.9, 0.86, 0.78);
const PANEL = rgb(0.985, 0.968, 0.93);
const ACCENT = rgb(0.83, 0.42, 0.1);

/** Is this gift big enough, and in the right currency, for the automatic letter? */
export function qualifiesForAutomaticLetter(sale: { amount: number; currency: string; amountRefunded?: number | null }) {
  return (
    sale.currency.toUpperCase() === DONATION_LETTER.currency &&
    sale.amount - (sale.amountRefunded ?? 0) >= DONATION_LETTER.automaticFromCents
  );
}

/** A letter can be issued for any paid gift in the letter currency with something left after refunds. */
export function canIssueLetter(sale: { amount: number; currency: string; amountRefunded?: number | null }) {
  return sale.currency.toUpperCase() === DONATION_LETTER.currency && sale.amount - (sale.amountRefunded ?? 0) > 0;
}

export function donationLetterFileName(reference: string) {
  const safe = reference.replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 40) || "donation";
  return `donation-acknowledgment-${safe}.pdf`;
}

export function letterMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function letterDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DONATION_LETTER.timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * The standard PDF fonts only know WinAnsi. Anything else (emoji, CJK…) would
 * make pdf-lib throw, so each character is tested and replaced when needed.
 */
function printable(text: string, font: PDFFont) {
  let out = "";
  for (const char of text.replace(/\s+/g, " ").trim()) {
    try {
      font.encodeText(char);
      out += char;
    } catch {
      const plain = char.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      let ok = Boolean(plain) && plain !== char;
      if (ok) {
        try {
          font.encodeText(plain);
        } catch {
          ok = false;
        }
      }
      out += ok ? plain : "?";
    }
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}...`;
}

function centered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color = INK) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE.width - width) / 2, y, size, font, color });
}

function firstName(name: string) {
  const clean = name.trim();
  if (!clean || /^anonymous$/i.test(clean)) return null;
  const first = clean.split(/\s+/)[0];
  // A name the PDF fonts could not print ("??") reads worse than no name.
  return /[A-Za-z\u00c0-\u00ff]/.test(first) && !first.includes("?") ? first : null;
}

export async function buildDonationLetterPdf(input: DonationLetterInput): Promise<Uint8Array> {
  const org = DONATION_LETTER.organization;
  const issuedAt = input.issuedAt ?? new Date();
  const doc = await PDFDocument.create();
  doc.setTitle(`Donation acknowledgment ${input.reference}`);
  doc.setAuthor(org.legalName);
  doc.setSubject("Acknowledgment of charitable contribution");
  doc.setCreationDate(issuedAt);
  doc.setModificationDate(issuedAt);

  const page = doc.addPage([PAGE.width, PAGE.height]);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(Buffer.from(LETTER_LOGO.base64, "base64"));
  const signature = await doc.embedPng(Buffer.from(LETTER_SIGNATURE.base64, "base64"));

  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  const textWidth = right - left;
  let y = PAGE.height - 50;

  /* Letterhead: logo centred, then who is writing ------------------------- */
  const logoWidth = 236;
  const logoHeight = (logoWidth * LETTER_LOGO.height) / LETTER_LOGO.width;
  y -= logoHeight;
  page.drawImage(logo, { x: (PAGE.width - logoWidth) / 2, y, width: logoWidth, height: logoHeight });
  y -= 20;
  centered(page, org.legalName, sansBold, 10.5, y);
  const identity = [...org.addressLines, `EIN ${org.ein}`].map((line) => printable(line, sans));
  for (const line of identity) {
    y -= 13;
    centered(page, line, sans, 9, y, MUTED);
  }
  y -= 16;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.8, color: RULE });

  /* Date and addressee ------------------------------------------------------ */
  y -= 30;
  page.drawText(letterDate(issuedAt), { x: left, y, size: 11, font: serif, color: MUTED });
  const donorName = printable(input.donorName || "Friend", serif) || "Friend";
  y -= 26;
  page.drawText(truncate(donorName, serifBold, 12, textWidth), { x: left, y, size: 12, font: serifBold, color: INK });
  if (input.donorEmail) {
    y -= 15;
    page.drawText(truncate(printable(input.donorEmail, serif), serif, 11, textWidth), {
      x: left,
      y,
      size: 11,
      font: serif,
      color: MUTED,
    });
  }

  /* Body ---------------------------------------------------------------------- */
  const bodySize = 11.5;
  const leading = 17;
  const paragraph = (text: string, font = serif) => {
    for (const line of wrap(printable(text, font), font, bodySize, textWidth)) {
      page.drawText(line, { x: left, y, size: bodySize, font, color: INK });
      y -= leading;
    }
    y -= 8;
  };

  y -= 30;
  const greetingName = firstName(donorName);
  paragraph(greetingName ? `Dear ${greetingName},` : "Dear friend,");
  paragraph(
    `Thank you for your generous gift to ${org.legalName}. Your support makes our work possible, and we are deeply grateful for it. This letter is the official acknowledgment of your contribution.`,
  );

  /* Gift details ---------------------------------------------------------------- */
  const amount = letterMoney(input.amountCents, input.currency);
  const rows: Array<[string, string]> = [
    ["Amount", amount],
    ["Date received", letterDate(input.paidAt)],
  ];
  if (input.paymentMethod) rows.push(["Payment method", input.paymentMethod]);
  rows.push(["Reference", input.reference]);

  const rowHeight = 22;
  const panelPadding = 12;
  const panelHeight = rows.length * rowHeight + panelPadding * 2 - 6;
  y -= 2;
  page.drawRectangle({ x: left, y: y - panelHeight, width: textWidth, height: panelHeight, color: PANEL });
  page.drawRectangle({ x: left, y: y - panelHeight, width: 3, height: panelHeight, color: ACCENT });
  let rowY = y - panelPadding - 9;
  const labelX = left + 18;
  const valueX = left + 138;
  rows.forEach(([label, value], index) => {
    page.drawText(label, { x: labelX, y: rowY, size: 9.5, font: sans, color: MUTED });
    const valueFont = index === 0 ? sansBold : sans;
    const valueSize = index === 0 ? 12 : 10.5;
    page.drawText(truncate(printable(value, valueFont), valueFont, valueSize, right - valueX - 14), {
      x: valueX,
      y: rowY,
      size: valueSize,
      font: valueFont,
      color: INK,
    });
    rowY -= rowHeight;
  });
  y -= panelHeight + 26;

  paragraph(
    `${org.legalName} is a tax-exempt organization under Section ${org.exemptSection} of the Internal Revenue Code. Our Employer Identification Number (EIN) is ${org.ein}. No goods or services were provided in exchange for this contribution. Your gift is tax-deductible to the extent allowed by law.`,
  );
  paragraph("Please keep this letter with your tax records.");

  /* Closing and signature --------------------------------------------------------- */
  y -= 4;
  page.drawText("With gratitude,", { x: left, y, size: bodySize, font: serif, color: INK });
  const signatureWidth = 150;
  const signatureHeight = (signatureWidth * LETTER_SIGNATURE.height) / LETTER_SIGNATURE.width;
  y -= signatureHeight + 6;
  page.drawImage(signature, { x: left - 6, y, width: signatureWidth, height: signatureHeight });
  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: left + 190, y }, thickness: 0.6, color: RULE });
  y -= 15;
  page.drawText(DONATION_LETTER.signer.name, { x: left, y, size: 11.5, font: serifBold, color: INK });
  y -= 14;
  page.drawText(`${DONATION_LETTER.signer.title}, ${org.legalName}`, { x: left, y, size: 10.5, font: serif, color: MUTED });

  /* Footer -------------------------------------------------------------------------- */
  const footerY = 44;
  page.drawLine({
    start: { x: left, y: footerY + 16 },
    end: { x: right, y: footerY + 16 },
    thickness: 0.6,
    color: RULE,
  });
  const footer = [`Reference ${input.reference}.`, `Issued ${letterDate(issuedAt)}.`];
  if (org.contactEmail) footer.push(`Questions: ${org.contactEmail}`);
  centered(page, printable(footer.join(" "), sans), sans, 8.5, footerY, MUTED);

  if (input.sample) {
    const stamp = "SAMPLE - NOT VALID";
    const size = 54;
    const width = sansBold.widthOfTextAtSize(stamp, size);
    const angle = 35;
    const radians = (angle * Math.PI) / 180;
    page.drawText(stamp, {
      x: PAGE.width / 2 - (width / 2) * Math.cos(radians),
      y: PAGE.height / 2 - (width / 2) * Math.sin(radians),
      size,
      font: sansBold,
      color: rgb(0.75, 0.1, 0.1),
      opacity: 0.22,
      rotate: degrees(angle),
    });
  }

  return doc.save();
}
