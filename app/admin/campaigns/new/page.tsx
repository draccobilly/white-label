import { CampaignEditor } from "@/components/admin/CampaignEditor";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { currentAdminAccess } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import {
  applyDeskCreateDefaults,
  isArgentinaCompany,
  isMexicoCompany,
  isPagnovoCompany,
} from "@/lib/campaign-defaults";
import { duplicatedCampaignForm } from "@/lib/duplicate-campaign";
import { campaignSeedFromFundraiser } from "@/lib/fundraiser-campaign-seed";
import { isGatewayNamesAiConfigured } from "@/lib/gateway-ai-names";
import { prisma } from "@/lib/prisma";
import { companyPublicPrefix } from "@/lib/public-site-url";
import Link from "next/link";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; request?: string }>;
}) {
  const { from, request } = await searchParams;
  const { isOwner } = await currentAdminAccess();
  const operatorMode = !isOwner;
  const fromId =
    from &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(from)
      ? from
      : undefined;
  const requestId =
    !fromId &&
    request &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request)
      ? request
      : undefined;
  const affiliates = operatorMode
    ? []
    : await prisma.affiliate.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      });

  const company = await getAdminCompany();
  const mexicoDesk = isMexicoCompany(company);
  const argentinaDesk = isArgentinaCompany(company);
  const pagnovoDesk = isPagnovoCompany(company);
  const source = fromId
    ? await prisma.campaign.findFirst({
        where: { id: fromId, companyId: company.id },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      })
    : null;
  const duplicatedForm = source
    ? duplicatedCampaignForm({
        organizerName: source.organizerName,
        fallbackOrganizerName: company.siteName,
        organizerVerified: source.organizerVerified,
        organizerBoldText: source.organizerBoldText,
        titleBoldText: source.titleBoldText,
        checkoutSubtitle: source.checkoutSubtitle,
        socialProofText: source.socialProofText,
        storyHeading: source.storyHeading,
        recentDonationsDescription: source.recentDonationsDescription,
        commentsDescription: source.commentsDescription,
        thankYouTitle: source.thankYouTitle,
        thankYouMessage: source.thankYouMessage,
        goalAmount: source.goalAmount,
        goalStages: source.goalStages,
        displayPaidPercent: source.displayPaidPercent,
        currency: source.currency,
        showMissionTip: source.showMissionTip,
        missionTipBold: source.missionTipBold,
        options: source.options,
      })
    : null;
  const duplicated = duplicatedForm
    ? applyDeskCreateDefaults(duplicatedForm, company, false)
    : duplicatedForm;
  const fundraiser = requestId
    ? await prisma.helpRequest.findFirst({
        where: { id: requestId, companyId: company.id },
        select: {
          name: true,
          story: true,
          priorRaisedCents: true,
          priorDonationCount: true,
          priorRaisedCurrency: true,
        },
      })
    : null;
  const fromRequest = fundraiser
    ? applyDeskCreateDefaults(
        campaignSeedFromFundraiser({
          name: fundraiser.name,
          story: fundraiser.story,
          priorRaisedCents: fundraiser.priorRaisedCents,
          priorDonationCount: fundraiser.priorDonationCount,
          currency: fundraiser.priorRaisedCurrency,
          fallbackOrganizerName: company.siteName,
          mexico: mexicoDesk,
          argentina: argentinaDesk,
        }),
        company,
        false,
      )
    : null;

  return (
    <>
      <AdminPageHeader
        eyebrow={duplicated ? "Duplicate campaign" : fromRequest ? "Fundraiser request" : "New campaign"}
        title={duplicated ? "Duplicate campaign" : "Create campaign"}
        description={
          fromRequest && !duplicated
            ? "Raised and donations come from the fundraiser request. New gifts still add on top."
            : operatorMode
            ? "Complete each step, then copy the public link to test the campaign."
            : duplicated
            ? mexicoDesk
              ? "Product page starts blank. Checkout, thank you and amounts are copied from the original when you save."
              : pagnovoDesk
                ? "Product page starts blank. Checkout, thank you and amounts are copied from the original when you save."
              : "Product page starts blank. Checkout, thank you, amounts and Payment Links are copied from the original when you save."
            : "Complete each step, choose the affiliate, and the public link keeps that person's slug."
        }
        actions={
          <Link className="secondary-button" href="/admin/campaigns">
            Back to campaigns
          </Link>
        }
      />
      <AdminCard className="studio-card">
        <CampaignEditor
          affiliates={affiliates}
          initial={duplicated ?? fromRequest ?? undefined}
          duplicateFromId={source?.id}
          defaultOrganizerName={company.siteName}
          hidePaymentLinks={pagnovoDesk || operatorMode}
          operatorMode={operatorMode}
          pathPrefix={companyPublicPrefix(company)}
          shortDonationPath={false}
          isMexico={mexicoDesk}
          isArgentina={argentinaDesk}
          gatewayNamesInfo={{
            source: null,
            at: null,
            stale: false,
            aiConfigured: isGatewayNamesAiConfigured(),
          }}
        />
      </AdminCard>
    </>
  );
}
