import { isOwnerAdmin } from "@/lib/admin-role";
import { notifyAdminDevices } from "@/lib/admin-push";
import { loadAnalytics } from "@/lib/analytics";
import { defaultSalesRange } from "@/lib/date-range";
import { previousPeriod } from "@/lib/periods";
import { buildInsights } from "@/lib/insights";
import { prisma } from "@/lib/prisma";

const ALERTABLE = /^(gap-|fatigue-|delivery-|rising-|checkout-leak)/;

/**
 * Tells each affiliate, once, about a sales gap or a campaign that needs a new
 * creative. Owners are not included: the note is only about that affiliate's pages.
 */
export async function notifyAffiliateInsights() {
  const operators = await prisma.admin.findMany({
    where: { role: "OPERATOR", pushSubscriptions: { some: {} } },
    select: {
      id: true,
      email: true,
      role: true,
      affiliate: { select: { id: true } },
    },
  });
  const range = defaultSalesRange();
  const previous = previousPeriod(range);
  let sent = 0;

  for (const operator of operators) {
    if (isOwnerAdmin(operator) || !operator.affiliate) continue;
    const affiliateId = operator.affiliate.id;
    const links = await prisma.affiliatePage.findMany({
      where: { affiliateId },
      select: { campaign: { select: { companyId: true } } },
    });
    const companyIds = [
      ...new Set(links.map((link) => link.campaign.companyId).filter((id): id is string => Boolean(id))),
    ];
    for (const companyId of companyIds) {
      const [current, before] = await Promise.all([
        loadAnalytics(companyId, range, { affiliateId }),
        loadAnalytics(companyId, previous, { affiliateId }),
      ]);
      const insights = buildInsights(current, before)
        .filter((item) => ALERTABLE.test(item.id))
        .slice(0, 3);
      for (const insight of insights) {
        const eventId = `${operator.id}:${insight.id}`;
        try {
          await prisma.webhookEvent.create({
            data: {
              provider: "insight",
              eventId,
              eventType: insight.tone,
              payloadHash: insight.title.slice(0, 120),
            },
          });
        } catch {
          continue;
        }
        try {
          await notifyAdminDevices({
            adminIds: [operator.id],
            title: insight.title,
            body: insight.action,
            url: insight.href ?? "/admin/health",
          });
          sent += 1;
        } catch (error) {
          console.error("Could not send insight alert", error);
          await prisma.webhookEvent.deleteMany({ where: { provider: "insight", eventId } });
        }
      }
    }
  }
  return sent;
}
