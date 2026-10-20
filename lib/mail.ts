import { Resend } from "resend";
import { createReceiptToken } from "@/lib/receipt-access";
import { refundReasonLabel, type RefundReason } from "@/lib/refund-reasons";
import {
  buildDonationThankYouEmail,
  emailShell,
  escapeEmailHtml,
  thankYouEmailBrand,
} from "@/lib/donation-thank-you-email";

/** A file attached to an e-mail (Resend reads `content` as the raw bytes). */
export type EmailAttachment = { filename: string; content: Buffer; contentType?: string };

export async function sendDonationThankYouEmail(input: {
  to: string;
  trackingCode: string;
  campaignSlug: string;
  affiliateSlug: string;
  saleId?: string | null;
  customerName?: string | null;
  campaignTitle?: string;
  amountLabel?: string;
  paidAt?: Date | null;
  locale?: "en" | "es-MX" | "es-AR";
  pathPrefix?: string | null;
  shortDonationPath?: boolean;
  institutional?: boolean;
  /** Donation acknowledgment letter (PDF) to attach, when the gift qualifies. */
  taxLetter?: EmailAttachment | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not configured; skipping thank-you email");
    return;
  }

  const { taxLetter, ...rest } = input;
  const message = buildDonationThankYouEmail({
    ...rest,
    receiptToken: input.saleId ? createReceiptToken(input.saleId) : null,
    taxLetterAttached: Boolean(taxLetter),
  });

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: message.from,
    to: input.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    ...(taxLetter ? { attachments: [taxLetter] } : {}),
  });
  if (error) {
    throw new Error(error.message);
  }
}

/** The acknowledgment letter on its own: sent from the panel, on the donor's request. */
export async function sendDonationLetterEmail(input: {
  to: string;
  customerName?: string | null;
  amountLabel: string;
  trackingCode: string;
  letter: EmailAttachment;
  /** True when it replaces a letter voided by a partial refund. */
  corrected?: boolean;
  /** Optional note from the panel, sent in this same e-mail when resending. */
  supportNote?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const brand = thankYouEmailBrand(true);
  const name = input.customerName?.trim();
  const greeting = name && !/^anonymous$/i.test(name) ? `Dear ${name.split(/\s+/)[0]},` : "Dear friend,";
  const lead = input.corrected
    ? `Attached is the corrected acknowledgment letter for your donation ${input.trackingCode}, now for ${input.amountLabel}. It replaces the letter we sent before, which is no longer valid.`
    : `Thank you again for your gift of ${input.amountLabel}. Attached is the acknowledgment letter for your donation ${input.trackingCode}, for your tax records.`;
  const support = input.supportNote?.replace(/\r\n/g, "\n").trim();
  const note = "The letter is a PDF. Please keep it with your tax records.";
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: brand.sender,
    to: input.to,
    replyTo: brand.refundInbox,
    subject: `Your donation acknowledgment letter (${input.trackingCode})`,
    text: [greeting, lead, support ? `A message from our support team:\n\n${support}` : "", note, brand.name]
      .filter(Boolean)
      .join("\n\n"),
    html: emailShell({
      preheader: `Your acknowledgment letter for donation ${input.trackingCode} is attached.`,
      brand,
      content: `
        <tr>
          <td style="padding:30px 28px;background:${brand.hero};">
            <h1 style="margin:0;color:#ffffff;font-size:26px;line-height:1.25;">Your donation acknowledgment letter</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 28px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 16px;color:${brand.ink};font-size:16px;line-height:1.7;">${escapeEmailHtml(greeting)}</p>
            <p style="margin:0 0 16px;color:${brand.muted};font-size:16px;line-height:1.7;">${escapeEmailHtml(lead)}</p>
            ${
              support
                ? `<p style="margin:0 0 8px;color:${brand.ink};font-size:16px;line-height:1.7;font-weight:700;">A message from our support team</p>
            <p style="margin:0 0 16px;color:${brand.ink};font-size:16px;line-height:1.7;white-space:pre-wrap;">${escapeEmailHtml(support)}</p>`
                : ""
            }
            <p style="margin:0;color:${brand.muted};font-size:16px;line-height:1.7;">${escapeEmailHtml(note)}</p>
          </td>
        </tr>
      `,
      footer: `${escapeEmailHtml(brand.name)}. Reply to this message if anything on the letter needs correcting.`,
    }),
    attachments: [input.letter],
  });
  if (error) throw new Error(error.message);
}

/** Tells the donor that a letter already sent is void: the gift was refunded or lost in a payment dispute. */
export async function sendDonationLetterVoidEmail(input: {
  to: string;
  customerName?: string | null;
  /** What the voided letter stated. */
  originalAmountLabel: string;
  refundedAmountLabel: string;
  trackingCode: string;
  issuedOn: string;
  /** Part of the gift stays with the organisation: a corrected letter can be requested. */
  partial: boolean;
  /**
   * "dispute": the money went back through a chargeback.
   * "withdrawn": the organisation cancelled the letter. The gift itself was not refunded.
   */
  reason?: "refund" | "dispute" | "withdrawn";
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const brand = thankYouEmailBrand(true);
  const name = input.customerName?.trim();
  const greeting = name && !/^anonymous$/i.test(name) ? `Dear ${name.split(/\s+/)[0]},` : "Dear friend,";
  const lead =
    input.reason === "withdrawn"
      ? `The donation acknowledgment letter issued on ${input.issuedOn} for your donation ${input.trackingCode} of ${input.originalAmountLabel} has been cancelled.`
      : input.reason === "dispute"
        ? input.partial
          ? `${input.refundedAmountLabel} of your donation ${input.trackingCode} was returned to you through a payment dispute with your bank or card issuer.`
          : `Your donation ${input.trackingCode} of ${input.originalAmountLabel} was returned to you through a payment dispute with your bank or card issuer.`
        : input.partial
          ? `We refunded ${input.refundedAmountLabel} of your donation ${input.trackingCode}.`
          : `Your donation ${input.trackingCode} of ${input.originalAmountLabel} was refunded in full.`;
  const body =
    input.reason === "withdrawn"
      ? `That letter is no longer valid. Please do not use it for tax purposes, and discard any copy you saved.`
      : `For that reason, the donation acknowledgment letter issued on ${input.issuedOn} for ${input.originalAmountLabel} is cancelled and no longer valid. Please do not use it for tax purposes, and discard any copy you saved.`;
  const next =
    input.reason === "withdrawn"
      ? "If you still need an acknowledgment letter, reply to this message and we will send a corrected one."
      : input.partial
        ? "If you would like a corrected letter for the amount that remains, reply to this message and we will send it."
        : "If you believe this is a mistake, reply to this message and we will look into it.";
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: brand.sender,
    to: input.to,
    replyTo: brand.refundInbox,
    subject: `Your donation acknowledgment letter was cancelled (${input.trackingCode})`,
    text: [greeting, lead, body, next, brand.name].join("\n\n"),
    html: emailShell({
      preheader: `The acknowledgment letter for donation ${input.trackingCode} is no longer valid.`,
      brand,
      content: `
        <tr>
          <td style="padding:30px 28px;background:${brand.hero};">
            <h1 style="margin:0;color:#ffffff;font-size:26px;line-height:1.25;">Acknowledgment letter cancelled</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 28px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 16px;color:${brand.ink};font-size:16px;line-height:1.7;">${escapeEmailHtml(greeting)}</p>
            <p style="margin:0 0 16px;color:${brand.muted};font-size:16px;line-height:1.7;">${escapeEmailHtml(lead)}</p>
            <div style="margin:0 0 16px;padding:16px 18px;border-left:4px solid ${brand.accent};border-radius:12px;background:${brand.panel};color:${brand.ink};font-size:15px;line-height:1.6;">${escapeEmailHtml(body)}</div>
            <p style="margin:0;color:${brand.muted};font-size:16px;line-height:1.7;">${escapeEmailHtml(next)}</p>
          </td>
        </tr>
      `,
      footer: `${escapeEmailHtml(brand.name)}`,
    }),
  });
  if (error) throw new Error(error.message);
}

export async function sendRefundRequestEmail(input: {
  to?: string;
  donorEmail: string;
  donorName?: string | null;
  trackingCode?: string | null;
  reason: RefundReason;
  details: string;
  campaignTitle?: string | null;
  amountLabel?: string | null;
  amountNote?: string | null;
  paidAt?: Date | null;
  stripePaymentIntentId?: string | null;
  siteName?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const brand = thankYouEmailBrand();
  const reason = refundReasonLabel(input.reason);
  const code = input.trackingCode?.trim() || "Not provided";
  const campaign = input.campaignTitle?.trim() || "Not matched yet";
  const amount = input.amountLabel?.trim() || input.amountNote?.trim() || "Not provided";
  const paidAt = input.paidAt?.toISOString() ?? "Not available";
  const to = input.to?.trim() || brand.refundInbox;
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: brand.sender,
    to,
    replyTo: input.donorEmail,
    subject: `Refund request — ${code} — ${input.siteName || brand.name}`,
    text: [
      `Name: ${input.donorName?.trim() || "Not provided"}`,
      `Tracking code: ${code}`,
      `Donor email: ${input.donorEmail}`,
      `Campaign: ${campaign}`,
      `Amount: ${amount}`,
      `Paid at: ${paidAt}`,
      `Stripe payment intent: ${input.stripePaymentIntentId ?? "Not available"}`,
      `Reason: ${reason}`,
      `Details: ${input.details}`,
    ].join("\n"),
    html: emailShell({
      preheader: `New refund request for ${code}.`,
      brand,
      content: `
        <tr>
          <td style="padding:30px 28px;background:${brand.hero};">
            <p style="margin:0 0 6px;color:${brand.accent};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-family:Arial,Helvetica,sans-serif;">Refund desk</p>
            <h1 style="margin:0;color:#ffffff;font-size:27px;line-height:1.25;">New refund request</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 28px;font-family:Arial,Helvetica,sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${brand.panel};border:1px solid ${brand.panelBorder};border-radius:16px;">
              <tr><td style="padding:14px 18px;color:${brand.muted};">Name</td><td align="right" style="padding:14px 18px;color:${brand.ink};font-weight:700;">${escapeEmailHtml(input.donorName?.trim() || "Not provided")}</td></tr>
              <tr><td style="padding:14px 18px;border-top:1px solid ${brand.panelBorder};color:${brand.muted};">Tracking code</td><td align="right" style="padding:14px 18px;border-top:1px solid ${brand.panelBorder};color:${brand.ink};font-weight:800;">${escapeEmailHtml(code)}</td></tr>
              <tr><td style="padding:14px 18px;border-top:1px solid ${brand.panelBorder};color:${brand.muted};">Donor email</td><td align="right" style="padding:14px 18px;border-top:1px solid ${brand.panelBorder};color:${brand.ink};font-weight:700;">${escapeEmailHtml(input.donorEmail)}</td></tr>
              <tr><td style="padding:14px 18px;border-top:1px solid ${brand.panelBorder};color:${brand.muted};">Campaign</td><td align="right" style="padding:14px 18px;border-top:1px solid ${brand.panelBorder};color:${brand.ink};font-weight:700;">${escapeEmailHtml(campaign)}</td></tr>
              <tr><td style="padding:14px 18px;border-top:1px solid ${brand.panelBorder};color:${brand.muted};">Amount</td><td align="right" style="padding:14px 18px;border-top:1px solid ${brand.panelBorder};color:${brand.ink};font-weight:800;">${escapeEmailHtml(amount)}</td></tr>
              <tr><td style="padding:14px 18px;border-top:1px solid ${brand.panelBorder};color:${brand.muted};">Reason</td><td align="right" style="padding:14px 18px;border-top:1px solid ${brand.panelBorder};color:${brand.ink};font-weight:700;">${escapeEmailHtml(reason)}</td></tr>
            </table>
            <div style="margin-top:22px;padding:20px;border-left:4px solid ${brand.accent};border-radius:12px;background:${brand.panel};">
              <p style="margin:0 0 8px;color:${brand.ink};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">Donor’s message</p>
              <p style="margin:0;color:${brand.muted};font-size:15px;line-height:1.7;">${escapeEmailHtml(input.details).replaceAll("\n", "<br/>")}</p>
            </div>
            <p style="margin:22px 0 0;color:${brand.muted};font-size:12px;line-height:1.6;">
              Paid at: ${escapeEmailHtml(paidAt)}<br/>
              Stripe payment intent: ${escapeEmailHtml(input.stripePaymentIntentId ?? "Not available")}
            </p>
          </td>
        </tr>
      `,
      footer: `Reply directly to this message to contact ${escapeEmailHtml(input.donorEmail)}.`,
    }),
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function sendShareStoryEmail(input: {
  about: "myself" | "someone";
  name: string;
  email: string;
  whatsapp: string;
  address: string;
  story: string;
  mediaUrls?: string[];
  siteName: string;
  to: string;
  priorRaised: string;
  priorDonations: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Email service is not configured");
  }

  const brand = thankYouEmailBrand();
  const aboutLabel = input.about === "myself" ? "themselves" : "someone they know";
  const mediaLines = (input.mediaUrls ?? []).map((url) => `Media: ${url}`);
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: brand.sender,
    to: input.to,
    replyTo: input.email,
    subject: `Fundraiser request — ${input.name} — ${input.siteName}`,
    text: [
      `About: ${aboutLabel}`,
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      `WhatsApp: ${input.whatsapp}`,
      `Address: ${input.address}`,
      `Raised: ${input.priorRaised}`,
      `Donations: ${input.priorDonations}`,
      `Site: ${input.siteName}`,
      ...mediaLines,
      "",
      input.story,
    ].join("\n"),
    html: emailShell({
      preheader: `New fundraiser request from ${input.name}.`,
      brand,
      content: `
        <tr>
          <td style="padding:30px 28px;background:${brand.hero};">
            <p style="margin:0 0 6px;color:${brand.accent};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-family:Arial,Helvetica,sans-serif;">Start a fundraiser</p>
            <h1 style="margin:0;color:#ffffff;font-size:27px;line-height:1.25;">${escapeEmailHtml(input.name)} asked for a review</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 28px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 18px;color:${brand.muted};font-size:15px;line-height:1.7;">
              This note is about ${escapeEmailHtml(aboutLabel)}. WhatsApp ${escapeEmailHtml(input.whatsapp)}.
              Reply directly to reach ${escapeEmailHtml(input.email)}.
            </p>
            <p style="margin:0 0 18px;color:${brand.muted};font-size:15px;line-height:1.7;">
              ${escapeEmailHtml(input.address)}
            </p>
            <p style="margin:0 0 18px;color:${brand.muted};font-size:15px;line-height:1.7;">
              Raised ${escapeEmailHtml(input.priorRaised)} · Donations ${escapeEmailHtml(input.priorDonations)}
            </p>
            <div style="padding:20px;border-left:4px solid ${brand.accent};border-radius:12px;background:${brand.panel};">
              <p style="margin:0;color:${brand.muted};font-size:15px;line-height:1.7;">${escapeEmailHtml(input.story).replaceAll("\n", "<br/>")}</p>
            </div>
            ${(input.mediaUrls ?? [])
              .map(
                (url) =>
                  `<p style="margin:16px 0 0;"><a href="${escapeEmailHtml(url)}">${escapeEmailHtml(url)}</a></p>`,
              )
              .join("")}
          </td>
        </tr>
      `,
      footer: `${escapeEmailHtml(input.siteName)} · Fundraiser desk`,
    }),
  });
  if (error) {
    throw new Error(error.message);
  }
}
