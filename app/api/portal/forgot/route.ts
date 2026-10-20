import { companyBrand, getRequestCompany } from "@/lib/company";
import { issueResetToken, normalizeOrganizerEmail } from "@/lib/organizer-auth";
import { sendOrganizerResetEmail } from "@/lib/organizer-mail";
import { portalError, portalJson } from "@/lib/organizer-route";
import { organizerForgotSchema } from "@/lib/organizer-validators";
import { portalCopy } from "@/lib/portal-copy";
import { prisma } from "@/lib/prisma";
import { publicSiteUrl, withPublicPrefix } from "@/lib/public-site-url";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`portal-forgot:${ip}`, 5, 15 * 60_000)) {
    return portalError("Too many attempts. Wait a few minutes and try again.", 429);
  }
  const parsed = organizerForgotSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return portalError("Enter the email on your case.", 400);

  const company = await getRequestCompany();
  const brand = companyBrand(company);
  const copy = portalCopy(brand.locale);
  const email = normalizeOrganizerEmail(parsed.data.email);
  const organizer = await prisma.organizer.findUnique({
    where: { companyId_email: { companyId: company.id, email } },
  });
  // Same answer whether or not the account exists.
  if (!organizer) return portalJson({ ok: true });

  const token = issueResetToken(organizer);
  const link = `${publicSiteUrl().replace(/\/$/, "")}${withPublicPrefix(
    brand.pathPrefix,
    `/portal/reset?token=${encodeURIComponent(token)}`,
  )}`;
  try {
    await sendOrganizerResetEmail({
      to: organizer.email,
      siteName: brand.siteName,
      subject: copy.resetEmailSubject(brand.siteName),
      text: copy.resetEmailBody(link),
      link,
      buttonLabel: copy.resetTitle,
    });
  } catch (error) {
    console.error("organizer reset email failed", error instanceof Error ? error.message : error);
  }
  return portalJson({ ok: true });
}
