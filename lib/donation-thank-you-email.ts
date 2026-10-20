import { emailAbsoluteUrl, emailPublicSiteUrl } from "@/lib/public-site-url";
import { REPORTING_TIME_ZONE } from "@/lib/date-range";

export type ThankYouLocale = "en" | "es-MX" | "es-AR";

export type EmailBrandTheme = {
  church: boolean;
  name: string;
  logo: string;
  logoWidth: number;
  background: string;
  card: string;
  hero: string;
  accent: string;
  ink: string;
  muted: string;
  heroSub: string;
  buttonText: string;
  panel: string;
  panelBorder: string;
  footerBg: string;
  bodyFont: string;
  sender: string;
  refundInbox: string;
};

export function escapeEmailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function siteBrand(): EmailBrandTheme {
  const origin = emailPublicSiteUrl(true);
  const name = process.env.APP_NAME?.trim() || "Giving Site";
  const customLogo = process.env.EMAIL_LOGO_URL?.trim();
  const logo = customLogo || `${origin}/admin-icon-192.png`;
  return {
    church: true,
    name,
    logo,
    logoWidth: 210,
    background: "#f6f4ee",
    card: "#ffffff",
    hero: "#163c2c",
    accent: "#d4f07a",
    ink: "#14261c",
    muted: "#5d6f64",
    heroSub: "#dce9d8",
    buttonText: "#163c2c",
    panel: "#eef6e3",
    panelBorder: "#d5e4c8",
    footerBg: "#f3f7ec",
    bodyFont: "Georgia,'Times New Roman',Times,serif",
    sender: process.env.RESEND_FROM?.trim() || `${name} <hello@example.com>`,
    refundInbox:
      process.env.REFUND_EMAIL?.trim() ||
      process.env.ADMIN_EMAIL?.trim() ||
      "admin@example.com",
  };
}

export function thankYouEmailBrand(_institutional = false): EmailBrandTheme {
  return siteBrand();
}

export function emailShell(input: {
  preheader: string;
  content: string;
  brand: EmailBrandTheme;
  footer?: string | null;
}) {
  const brand = input.brand;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>${escapeEmailHtml(input.preheader)}</title>
  </head>
  <body style="margin:0;padding:0;background:${brand.background};color:${brand.ink};font-family:${brand.bodyFont};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeEmailHtml(input.preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${brand.background};">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:${brand.card};border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(20,38,28,.10);">
            <tr>
              <td align="center" style="padding:28px 28px 22px;background:${brand.card};">
                <img src="${escapeEmailHtml(brand.logo)}" width="${brand.logoWidth}" alt="${escapeEmailHtml(brand.name)}" style="display:block;width:${brand.logoWidth}px;max-width:100%;height:auto;border:0;" />
              </td>
            </tr>
            ${input.content}
            ${
              input.footer === null
                ? ""
                : `<tr>
              <td align="center" style="padding:22px 28px;background:${brand.footerBg};color:${brand.muted};font-size:12px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
                ${input.footer ?? `${escapeEmailHtml(brand.name)} · Secure donations powered by Stripe`}
              </td>
            </tr>`
            }
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export type DonationThankYouInput = {
  trackingCode: string;
  campaignSlug: string;
  affiliateSlug: string;
  saleId?: string | null;
  customerName?: string | null;
  campaignTitle?: string;
  amountLabel?: string;
  paidAt?: Date | null;
  locale?: ThankYouLocale;
  pathPrefix?: string | null;
  shortDonationPath?: boolean;
  institutional?: boolean;
  receiptToken?: string | null;
  /** The donation acknowledgment letter (PDF) goes attached to this e-mail. */
  taxLetterAttached?: boolean;
};

export function buildDonationThankYouEmail(input: DonationThankYouInput) {
  const institutional = Boolean(input.institutional || input.shortDonationPath);
  const brand = thankYouEmailBrand(institutional);
  const spanish = input.locale === "es-MX" || input.locale === "es-AR";
  const originHint = emailPublicSiteUrl(brand.church);
  const campaignPageUrl = emailAbsoluteUrl(
    input.shortDonationPath
      ? `/c/${input.campaignSlug}`
      : `/c/${input.campaignSlug}/${input.affiliateSlug}`,
    input.pathPrefix,
    brand.church,
  );
  const campaignUrl = `${campaignPageUrl}#comments`;
  const refundUrl = emailAbsoluteUrl(
    `/refund?code=${encodeURIComponent(input.trackingCode)}`,
    input.pathPrefix,
    brand.church,
  );
  const unsubscribeUrl = `mailto:${brand.refundInbox}?subject=${encodeURIComponent(`Unsubscribe ${input.trackingCode}`)}`;
  const receiptUrl = input.receiptToken
    ? emailAbsoluteUrl(
        `/api/receipt?token=${encodeURIComponent(input.receiptToken)}`,
        null,
        brand.church,
      )
    : emailAbsoluteUrl(
        `/track-your-donation?code=${encodeURIComponent(input.trackingCode)}`,
        input.pathPrefix,
        brand.church,
      );
  const donorName =
    input.customerName && input.customerName !== "Anonymous"
      ? input.customerName
      : null;
  const greeting = donorName
    ? spanish
      ? `¡Gracias, ${donorName}!`
      : `Thank you, ${donorName}!`
    : spanish
      ? "¡Gracias!"
      : "Thank you!";
  const paidAt = input.paidAt
    ? input.paidAt.toLocaleDateString(
        spanish ? (input.locale === "es-AR" ? "es-AR" : "es-MX") : "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: REPORTING_TIME_ZONE,
        },
      )
    : null;
  const campaignLine = input.campaignTitle?.trim() || null;

  const copy = brand.church
    ? spanish
      ? {
          subject: "Gracias por tu ofrenda",
          preheader: "Tu ofrenda fue recibida. Que Dios te bendiga.",
          heroSub: "Tu ofrenda fue recibida.",
          body1: campaignLine
            ? `Confirmamos tu donación a ${campaignLine}. Puedes ver tu recibo, seguir el avance o dejar un mensaje de aliento.`
            : "Confirmamos tu donación. Puedes ver tu recibo, seguir el avance o dejar un mensaje de aliento.",
          body2:
            "Tu recibo seguro estará listo 24 horas después de la confirmación del pago.",
          amount: "Monto",
          tracking: "Código de rastreo",
          cta: "Ver tu recibo",
          commentPrompt: "¿Quieres compartir una palabra de aliento?",
          commentLink: "Deja un comentario",
          refundLead: "¿Necesitas un reembolso?",
          refundLink: "Puedes solicitarlo aquí",
          refundNote: "Siempre es más rápido a través de nuestro formulario.",
          spam: "Nunca te enviaremos correos de spam. Si quieres, puedes darte de baja aquí.",
          textBigger: "Tu ofrenda ya es parte de esta misión.",
        }
      : {
          subject: "Thank you for your gift",
          preheader: "Your gift was received. You are a blessing.",
          heroSub: "Your gift was received.",
          body1: campaignLine
            ? `Your donation to ${campaignLine} has been confirmed. You can view your receipt, follow the campaign, or leave a word of encouragement.`
            : "Your donation has been confirmed. You can view your receipt, follow the campaign, or leave a word of encouragement.",
          body2:
            "Your secure receipt will be ready 24 hours after payment confirmation.",
          amount: "Amount",
          tracking: "Tracking code",
          cta: "View your receipt",
          commentPrompt: "Want to share a word of encouragement?",
          commentLink: "Leave a comment",
          refundLead: "Looking for a refund?",
          refundLink: "You can request one here",
          refundNote: "It’s always faster through our facilitated form.",
          spam: "We will never send you spam e-mails. You can unsubscribe at any time.",
          textBigger: "Your gift is already part of this mission.",
        }
    : spanish
      ? {
          subject: "Ya eres parte de algo más grande",
          preheader: "Tu pago se confirmó con éxito.",
          heroSub: "Ya eres parte de algo más grande.",
          body1:
            "Tu pago se confirmó. Puedes ver tu recibo, seguir el avance o dejar un mensaje en la página.",
          body2:
            "Como todavía estamos procesando tu solicitud, el PDF de respaldo puede tardar hasta 3 días hábiles.",
          amount: "Monto",
          tracking: "Código de rastreo",
          cta: "Ver tu recibo",
          commentPrompt: "¿Quieres compartir un poco de aliento?",
          commentLink: "Deja un comentario",
          refundLead: "¿Buscas un reembolso?",
          refundLink: "Puedes solicitarlo aquí",
          refundNote: "Siempre es más rápido a través de nuestro formulario.",
          spam: "Nunca te vamos a mandar spam. Si quieres, puedes darte de baja aquí.",
          textBigger: "Ya eres parte de algo más grande.",
        }
      : {
          subject: "Thank you for your gift",
          preheader: "Your payment was successfully confirmed.",
          heroSub: "You're now part of something bigger.",
          body1:
            "Your payment was successfully confirmed. You can view your receipt, follow its progress, or leave a warm message on our page.",
          body2:
            "As we are still processing your request, you may receive your supporting PDF within 3 business days.",
          amount: "Amount",
          tracking: "Tracking code",
          cta: "View your receipt",
          commentPrompt: "Want to share some encouragement?",
          commentLink: "Leave a warm comment",
          refundLead: "Looking for a refund?",
          refundLink: "You can quickly request one here",
          refundNote: "It’s always faster through our facilitated form.",
          spam: "We will never send you spam e-mails. However, you can always opt to unsubscribe from our e-mails.",
          textBigger: "You're now part of something bigger.",
        };

  // The letter and everything about it is in English only.
  const taxLetterNote = input.taxLetterAttached
    ? "Your donation acknowledgment letter for tax purposes is attached to this e-mail as a PDF. Please keep it with your tax records."
    : null;

  const html = emailShell({
    preheader: copy.preheader,
    brand,
    footer: null,
    content: `
        <tr>
          <td align="center" style="padding:40px 32px 36px;background:${brand.hero};">
            <div style="display:inline-block;width:58px;height:58px;line-height:58px;border-radius:50%;background:${brand.accent};color:${brand.buttonText};font-size:30px;font-weight:800;text-align:center;font-family:Arial,Helvetica,sans-serif;">&#10003;</div>
            <h1 style="margin:18px 0 8px;color:#ffffff;font-size:30px;line-height:1.2;font-family:${brand.bodyFont};">${escapeEmailHtml(greeting)}</h1>
            <p style="margin:0;color:${brand.heroSub};font-size:16px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${escapeEmailHtml(copy.heroSub)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px 28px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 18px;color:${brand.muted};font-size:16px;line-height:1.7;">
              ${escapeEmailHtml(copy.body1)}
            </p>
            <p style="margin:0 0 24px;color:${brand.muted};font-size:16px;line-height:1.7;">
              ${escapeEmailHtml(copy.body2)}
            </p>
            ${
              taxLetterNote
                ? `<div style="margin:0 0 24px;padding:16px 18px;border-left:4px solid ${brand.accent};border-radius:12px;background:${brand.panel};color:${brand.ink};font-size:15px;line-height:1.6;">
              ${escapeEmailHtml(taxLetterNote)}
            </div>`
                : ""
            }
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:26px;background:${brand.panel};border:1px solid ${brand.panelBorder};border-radius:16px;">
              ${
                input.amountLabel
                  ? `<tr>
                <td style="padding:20px 22px;border-bottom:1px solid ${brand.panelBorder};color:${brand.muted};font-size:12px;text-transform:uppercase;letter-spacing:.08em;">${escapeEmailHtml(copy.amount)}</td>
                <td align="right" style="padding:20px 22px;border-bottom:1px solid ${brand.panelBorder};color:${brand.ink};font-size:18px;font-weight:800;">${escapeEmailHtml(input.amountLabel)}</td>
              </tr>`
                  : ""
              }
              <tr>
                <td style="padding:20px 22px;color:${brand.muted};font-size:12px;text-transform:uppercase;letter-spacing:.08em;">${escapeEmailHtml(copy.tracking)}</td>
                <td align="right" style="padding:20px 22px;color:${brand.ink};font-family:Courier New,monospace;font-size:15px;font-weight:700;">${escapeEmailHtml(input.trackingCode)}</td>
              </tr>
            </table>
            <a href="${receiptUrl}" style="display:block;padding:16px 24px;border-radius:999px;background:${brand.accent};color:${brand.buttonText};text-align:center;text-decoration:none;font-size:16px;font-weight:800;">${escapeEmailHtml(copy.cta)}</a>
            <p style="margin:22px 0 0;text-align:center;color:${brand.muted};font-size:14px;line-height:1.6;">
              ${escapeEmailHtml(copy.commentPrompt)}
              <a href="${campaignUrl}" style="color:${brand.ink};font-weight:700;">${escapeEmailHtml(copy.commentLink)}</a>.
            </p>
            <div style="margin-top:30px;padding-top:20px;border-top:1px solid ${brand.panelBorder};text-align:center;color:${brand.muted};font-size:12px;line-height:1.6;">
              ${escapeEmailHtml(copy.refundLead)}
              <a href="${refundUrl}" style="color:${brand.ink};font-weight:700;">${escapeEmailHtml(copy.refundLink)}</a>.<br/>
              ${escapeEmailHtml(copy.refundNote)}
            </div>
            <div style="margin-top:18px;text-align:center;color:${brand.muted};font-size:11px;line-height:1.6;">
              ${escapeEmailHtml(copy.spam)}
              <a href="${unsubscribeUrl}" style="color:${brand.muted};text-decoration:underline;">unsubscribe</a>
            </div>
          </td>
        </tr>
      `,
  });

  const text = [
    greeting,
    copy.textBigger,
    copy.body1,
    copy.body2,
    taxLetterNote,
    input.amountLabel
      ? `${copy.amount}: ${input.amountLabel}`
      : null,
    `${copy.tracking}: ${input.trackingCode}`,
    paidAt ? (spanish ? `Fecha: ${paidAt}` : `Date: ${paidAt}`) : null,
    `${copy.cta}: ${receiptUrl}`,
    `${copy.commentLink}: ${campaignUrl}`,
    `${copy.refundLead} ${copy.refundLink}: ${refundUrl}`,
    `${copy.spam} ${unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    brand,
    subject: copy.subject,
    preheader: copy.preheader,
    html,
    text,
    receiptUrl,
    campaignUrl,
    refundUrl,
    origin: originHint,
    church: brand.church,
    from: brand.sender,
  };
}
