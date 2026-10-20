import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CampaignEditor,
  type CampaignEditorValue,
} from "@/components/admin/CampaignEditor";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  isArgentinaCompany,
  isMexicoCompany,
  isPagnovoCompany,
  keepsRunningCampaignAddress,
} from "@/lib/campaign-defaults";
import { currentAdminAccess } from "@/lib/admin-access";
import { affiliatePageTrackingFrom } from "@/lib/affiliates";
import { assignedCampaignWhere, ensureOperatorAffiliate } from "@/lib/operator-affiliate";
import { getAdminCompany } from "@/lib/company";
import { inheritMissingPaymentLinksFromCompany } from "@/lib/inherit-campaign-assets";
import { prisma } from "@/lib/prisma";
import { companyPublicPrefix } from "@/lib/public-site-url";
import { usesEmbeddedStripeCheckout } from "@/lib/embedded-stripe";
import { gatewayNamesStale } from "@/lib/campaign-gateway-names";
import { nextGoalStages } from "@/lib/campaign-stages";
import { isGatewayNamesAiConfigured } from "@/lib/gateway-ai-names";

export default async function CampaignEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { admin, isOwner } = await currentAdminAccess();
  const operatorMode = !isOwner;
  const operatorAffiliate = isOwner ? null : await ensureOperatorAffiliate(admin);
  const company = await getAdminCompany();
  const mexicoDesk = isMexicoCompany(company);
  const argentinaDesk = isArgentinaCompany(company);
  const pagnovoDesk = isPagnovoCompany(company);
  const embeddedStripe = usesEmbeddedStripeCheckout(company);
  let campaign = await prisma.campaign.findFirst({
    where: {
      id,
      companyId: company.id,
      ...(operatorAffiliate ? assignedCampaignWhere(operatorAffiliate.id) : {}),
    },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      updates: { orderBy: { createdAt: "desc" } },
      pages: {
        include: {
          affiliate: true,
          paymentLinks: { where: { active: true } },
        },
        orderBy: { affiliate: { name: "asc" } },
      },
    },
  });
  if (!campaign) {
    const elsewhere = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true },
    });
    if (elsewhere) redirect("/admin/campaigns?notice=desk-switch");
    notFound();
  }

  if (!pagnovoDesk && !embeddedStripe) {
    try {
      const copied = await Promise.race([
        inheritMissingPaymentLinksFromCompany(prisma, {
          targetCampaignId: campaign.id,
          companyId: company.id,
          targetOptions: campaign.options.map((option) => ({
            id: option.id,
            amount: option.amount,
          })),
        }),
        new Promise<number>((resolve) => {
          setTimeout(() => resolve(0), 4000);
        }),
      ]);
      if (copied > 0) {
        const reloaded = await prisma.campaign.findFirst({
          where: { id, companyId: company.id },
          include: {
            options: { orderBy: { sortOrder: "asc" } },
            updates: { orderBy: { createdAt: "desc" } },
            pages: {
              include: {
                affiliate: true,
                paymentLinks: { where: { active: true } },
              },
              orderBy: { affiliate: { name: "asc" } },
            },
          },
        });
        if (reloaded) campaign = reloaded;
      }
    } catch (error) {
      console.error("payment link inherit failed", error);
    }
  }

  const affiliates = operatorMode
    ? []
    : await prisma.affiliate.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      });

  let affiliateSlug =
    (operatorAffiliate
      ? campaign.pages.find((page) => page.affiliateId === operatorAffiliate.id)?.affiliate.slug
      : null) ??
    campaign.pages.find((page) => page.affiliate.slug.includes("direct-team"))?.affiliate.slug ??
    campaign.pages[0]?.affiliate.slug ??
    null;
  if (operatorAffiliate && !campaign.pages.some((page) => page.affiliateId === operatorAffiliate.id)) {
    const created = await prisma.affiliatePage.create({
      data: {
        campaignId: campaign.id,
        affiliateId: operatorAffiliate.id,
        ...affiliatePageTrackingFrom(operatorAffiliate),
      },
      select: { affiliate: { select: { slug: true } } },
    });
    affiliateSlug = created.affiliate.slug;
  }

  const value: CampaignEditorValue = {
    title: campaign.title,
    slug: campaign.slug,
    organizerName: campaign.organizerName?.trim() || company.siteName,
    organizerImageUrl: campaign.organizerImageUrl ?? "",
    organizerVerified: campaign.organizerVerified ?? true,
    organizerBoldText: campaign.organizerBoldText ?? "",
    titleBoldText: campaign.titleBoldText ?? "",
    summary: campaign.summary,
    story: campaign.story,
    category: campaign.category ?? "",
    coverImageUrl: campaign.coverImageUrl ?? "",
    coverFocusX: campaign.coverFocusX ?? 50,
    coverFocusY: campaign.coverFocusY ?? 50,
    galleryImageUrls: campaign.galleryImageUrls ?? [],
    verificationDocumentUrls: campaign.verificationDocumentUrls ?? [],
    verificationNote: campaign.verificationNote ?? "",
    videoUrl: campaign.videoUrl ?? "",
    checkoutSubtitle: campaign.checkoutSubtitle ?? "",
    socialProofText: campaign.socialProofText ?? "",
    storyHeading: campaign.storyHeading,
    recentDonationsDescription: campaign.recentDonationsDescription,
    commentsDescription: campaign.commentsDescription,
    thankYouTitle: campaign.thankYouTitle,
    thankYouMessage: campaign.thankYouMessage,
    goalAmount: campaign.goalAmount,
    currentAmount: campaign.currentAmount,
    supporterCount: campaign.supporterCount,
    displayPaidPercent: campaign.displayPaidPercent ?? 1,
    currency: campaign.currency as CampaignEditorValue["currency"],
    amounts: campaign.options.map((option) => option.amount),
    suggestedAmount:
      campaign.options.find((option) => option.suggested)?.amount ??
      campaign.options[0]?.amount ??
      5000,
    showMissionTip: campaign.showMissionTip,
    missionTipBold: campaign.missionTipBold,
    unlisted: campaign.unlisted,
    status: campaign.status,
    updates: campaign.updates.map((update) => ({
      id: update.id,
      title: update.title ?? "",
      body: update.body,
      createdAt: update.createdAt.toISOString(),
    })),
    gatewayNames: campaign.gatewayNames ?? [],
    nextGoals: nextGoalStages(campaign),
  };
  const gatewayNamesInfo = {
    source: campaign.gatewayNamesSource ?? null,
    at: campaign.gatewayNamesAt?.toISOString() ?? null,
    stale: gatewayNamesStale(campaign),
    aiConfigured: isGatewayNamesAiConfigured(),
  };

  const step = Number(query.step);
  const lastVisibleStep = operatorMode || pagnovoDesk || embeddedStripe ? 3 : 4;
  const initialStep = step >= 1 && step <= lastVisibleStep ? step : 1;

  return (
    <>
      <AdminPageHeader
        eyebrow="Campaign"
        title={campaign.title}
        description={
          operatorMode
            ? "Edit the campaign page, then copy the public link to test it."
            : mexicoDesk
            ? "This Mexico company uses Pagnovo. Amounts go live without Stripe Payment Links."
            : argentinaDesk
              ? "This Argentina company uses Pagnovo. Amounts go live without Stripe Payment Links. Donors pay by bank transfer to a CVU."
              : embeddedStripe
              ? "Embedded checkout charges through the Stripe API on this page. Amounts go live without Payment Links."
              : `This page is shared by all ${campaign.pages.length} affiliates. Only Stripe Payment Links are unique.`
        }
        actions={
          <Link className="secondary-button" href="/admin/campaigns">
            Back to campaigns
          </Link>
        }
      />
      <AdminCard className="studio-card">
        <CampaignEditor
          campaignId={campaign.id}
          initial={value}
          initialStep={initialStep}
          defaultOrganizerName={company.siteName}
          affiliates={affiliates}
          options={campaign.options.map((option) => ({
            id: option.id,
            amount: option.amount,
          }))}
          hidePaymentLinks={pagnovoDesk || embeddedStripe || operatorMode}
          operatorMode={operatorMode}
          publicPage={
            affiliateSlug
              ? {
                  campaignSlug: campaign.slug,
                  affiliateSlug,
                }
              : null
          }
          pathPrefix={companyPublicPrefix(company)}
          shortDonationPath={keepsRunningCampaignAddress(campaign.slug)}
          isMexico={mexicoDesk}
          isArgentina={argentinaDesk}
          gatewayNamesInfo={gatewayNamesInfo}
          pages={
            operatorMode
              ? []
              : campaign.pages.map((page) => ({
            id: page.id,
            affiliateId: page.affiliateId,
            affiliateName: page.affiliate.name,
            affiliateSlug: page.affiliate.slug,
            campaignSlug: campaign.slug,
            links: campaign.options.map((option) => {
              const current = page.paymentLinks.find(
                (link) => link.donationOptionId === option.id,
              );
              const stripeUrl =
                current?.stripeCheckoutUrl ||
                current?.stripePaymentLinkId ||
                (current?.url.includes("buy.stripe.com") ? current.url : "") ||
                "";
              const publicUrl =
                current?.url && !current.url.includes("buy.stripe.com")
                  ? current.url
                  : "";
              return {
                donationOptionId: option.id,
                amount: option.amount,
                url: publicUrl,
                stripeCheckoutUrl: stripeUrl,
              };
            }),
          }))}
        />
      </AdminCard>
    </>
  );
}
