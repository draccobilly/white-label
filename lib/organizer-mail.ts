import { Resend } from "resend";
import { emailShell, escapeEmailHtml, thankYouEmailBrand } from "@/lib/donation-thank-you-email";

function client() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

/** Inbox the panel reads: the company's contact address, then ADMIN_EMAIL, then the sender. */
export function operationsInbox(contactEmail: string | null | undefined) {
  const inbox =
    process.env.RESEND_FROM?.match(/<([^>]+)>/)?.[1] || process.env.RESEND_FROM?.trim();
  return contactEmail || process.env.ADMIN_EMAIL?.trim() || inbox || null;
}

export async function sendOrganizerResetEmail(input: {
  to: string;
  siteName: string;
  subject: string;
  text: string;
  link: string;
  buttonLabel: string;
}) {
  const resend = client();
  if (!resend) {
    console.warn("RESEND_API_KEY is not configured; skipping organizer reset email");
    return false;
  }
  const brand = thankYouEmailBrand();
  const { error } = await resend.emails.send({
    from: brand.sender,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: emailShell({
      preheader: input.subject,
      brand,
      content: `
        <tr>
          <td style="padding:30px 28px;background:${brand.hero};">
            <p style="margin:0 0 6px;color:${brand.accent};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-family:Arial,Helvetica,sans-serif;">${escapeEmailHtml(input.siteName)}</p>
            <h1 style="margin:0;color:#ffffff;font-size:27px;line-height:1.25;">${escapeEmailHtml(input.subject)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 28px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 22px;color:${brand.muted};font-size:15px;line-height:1.7;">${escapeEmailHtml(input.text).replaceAll(input.link, "").replaceAll("\n", "<br/>")}</p>
            <p style="margin:0;"><a href="${escapeEmailHtml(input.link)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:${brand.accent};color:#ffffff;font-weight:800;text-decoration:none;">${escapeEmailHtml(input.buttonLabel)}</a></p>
            <p style="margin:22px 0 0;color:${brand.muted};font-size:12px;line-height:1.6;word-break:break-all;">${escapeEmailHtml(input.link)}</p>
          </td>
        </tr>
      `,
      footer: escapeEmailHtml(input.siteName),
    }),
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function sendPayoutRequestEmail(input: {
  to: string;
  replyTo: string;
  subject: string;
  siteName: string;
  campaignTitle: string;
  organizerName: string;
  organizerEmail: string;
  amountLabel: string;
  availableLabel: string;
  rows: [string, string][];
  adminHref: string;
}) {
  const resend = client();
  if (!resend) return false;
  const brand = thankYouEmailBrand();
  const table = input.rows
    .map(
      ([label, value], index) =>
        `<tr><td style="padding:12px 18px;${index ? `border-top:1px solid ${brand.panelBorder};` : ""}color:${brand.muted};">${escapeEmailHtml(label)}</td><td align="right" style="padding:12px 18px;${index ? `border-top:1px solid ${brand.panelBorder};` : ""}color:${brand.ink};font-weight:700;white-space:pre-wrap;">${escapeEmailHtml(value || "—")}</td></tr>`,
    )
    .join("");
  const { error } = await resend.emails.send({
    from: brand.sender,
    to: input.to,
    replyTo: input.replyTo,
    subject: input.subject,
    text: [
      `Campaign: ${input.campaignTitle}`,
      `Organizer: ${input.organizerName} <${input.organizerEmail}>`,
      `Requested: ${input.amountLabel} (available ${input.availableLabel})`,
      "",
      ...input.rows.map(([label, value]) => `${label}: ${value || "—"}`),
      "",
      `Review: ${input.adminHref}`,
    ].join("\n"),
    html: emailShell({
      preheader: `Payout request · ${input.campaignTitle}`,
      brand,
      content: `
        <tr>
          <td style="padding:30px 28px;background:${brand.hero};">
            <p style="margin:0 0 6px;color:${brand.accent};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-family:Arial,Helvetica,sans-serif;">Payout request</p>
            <h1 style="margin:0;color:#ffffff;font-size:27px;line-height:1.25;">${escapeEmailHtml(input.campaignTitle)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 28px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 18px;color:${brand.muted};font-size:15px;line-height:1.7;">
              ${escapeEmailHtml(input.organizerName)} (${escapeEmailHtml(input.organizerEmail)}) asked for
              <strong style="color:${brand.ink};">${escapeEmailHtml(input.amountLabel)}</strong>. Verified gifts available: ${escapeEmailHtml(input.availableLabel)}.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${brand.panel};border:1px solid ${brand.panelBorder};border-radius:16px;">${table}</table>
            <p style="margin:22px 0 0;"><a href="${escapeEmailHtml(input.adminHref)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:${brand.accent};color:#ffffff;font-weight:800;text-decoration:none;">Open in the panel</a></p>
          </td>
        </tr>
      `,
      footer: `${escapeEmailHtml(input.siteName)} · Payout desk`,
    }),
  });
  if (error) throw new Error(error.message);
  return true;
}
