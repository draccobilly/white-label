/** Owner sees every affiliate page in the company. An affiliate login sees
 * every page already attached to that affiliate, including campaigns the owner assigned. */
export function affiliatePagesForAdmin(input: {
  isOwner: boolean;
  companyId: string;
  adminId: string;
  affiliateId?: string | null;
  directTeamSlug: string;
}) {
  if (input.isOwner) {
    return { campaign: { companyId: input.companyId } };
  }
  return {
    ...(input.affiliateId
      ? { affiliateId: input.affiliateId }
      : { affiliate: { slug: input.directTeamSlug } }),
    campaign: { companyId: input.companyId },
  };
}
