import type { AdminRole } from "@/generated/prisma/enums";
import { isOwnerAdmin } from "@/lib/admin-role";
import { uniqueAffiliateSlug } from "@/lib/affiliates";
import { prisma } from "@/lib/prisma";

type OperatorAdmin = {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
};

export async function ensureOperatorAffiliate(admin: OperatorAdmin) {
  const linked = await prisma.affiliate.findUnique({ where: { adminId: admin.id } });
  if (linked) return linked;

  const email = admin.email.trim().toLowerCase();
  const byEmail = await prisma.affiliate.findFirst({
    where: { email, adminId: null },
  });
  if (byEmail) {
    return prisma.affiliate.update({
      where: { id: byEmail.id },
      data: { adminId: admin.id, active: true },
    });
  }

  const name = admin.name?.trim() || email.split("@")[0] || "Affiliate";
  const slug = await uniqueAffiliateSlug(prisma, name);
  return prisma.affiliate.create({
    data: {
      adminId: admin.id,
      name,
      slug,
      email,
      active: true,
    },
  });
}

export function ownAffiliateSales(affiliateId: string) {
  return { affiliateId };
}

export function assignedCampaignWhere(affiliateId: string) {
  return { pages: { some: { affiliateId } } };
}

export async function syncOperatorAffiliates() {
  const operators = await prisma.admin.findMany({
    where: { role: "OPERATOR" },
    select: { id: true, email: true, name: true, role: true },
  });
  const affiliates = [];
  for (const operator of operators) {
    if (isOwnerAdmin(operator)) continue;
    affiliates.push(await ensureOperatorAffiliate(operator));
  }
  return affiliates;
}
