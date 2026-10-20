import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";
import { IntegrationEditor } from "@/components/admin/IntegrationEditor";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import { companyPublicPrefix, publicAbsoluteUrl, publicCampaignPath } from "@/lib/public-site-url";
import { isInstitutionalSiteMode } from "@/lib/site-mode";
import { campaignNameTag } from "@/lib/campaign-label";

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwnerPage();
  const { id } = await params;
  const company = await getAdminCompany();
  const page = await prisma.affiliatePage.findFirst({
    where: { id, campaign: { companyId: company.id } },
    include: {
      affiliate: true,
      campaign: { include: { options: { orderBy: { sortOrder: "asc" } } } },
      paymentLinks: { where: { active: true } },
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!page) notFound();

  const prefix = companyPublicPrefix(company);
  const publicPath = publicCampaignPath(
    prefix,
    page.campaign.slug,
    page.affiliate.slug,
    "",
    { short: isInstitutionalSiteMode(company.siteMode) },
  );
  const checkoutPath = `${publicPath}/checkout`;

  return (
    <>
      <AdminPageHeader
        eyebrow={`${campaignNameTag(page.campaign.title)} · ${page.campaign.slug}`}
        title={page.affiliate.name}
        description={page.campaign.title}
        actions={
          <div className="admin-inline-actions">
            <CopyLinkButton path={publicPath} prefix={prefix} />
            <Link className="secondary-button" href={publicAbsoluteUrl(publicPath, prefix)} target="_blank">
              Open live
            </Link>
            <Link className="secondary-button" href={publicAbsoluteUrl(checkoutPath, prefix)} target="_blank">
              Live checkout
            </Link>
          </div>
        }
      />
      <AdminCard title="Isolated page configuration">
        <IntegrationEditor
          affiliatePageId={page.id}
          currency={page.campaign.currency}
          initialPixels={{
            googlePixelId: page.googlePixelId ?? "",
            tiktokPixelId: page.tiktokPixelId ?? "",
          }}
          hasUtmifyToken={Boolean(page.utmifyTokenEnc || page.affiliate.defaultUtmifyTokenEnc)}
          links={page.campaign.options.map((option) => {
            const current = page.paymentLinks.find(
              (link) => link.donationOptionId === option.id,
            );
            return {
              donationOptionId: option.id,
              amount: option.amount,
              url: current?.url ?? "",
              stripeCheckoutUrl: current?.stripeCheckoutUrl ?? current?.stripePaymentLinkId ?? "",
            };
          })}
        />
      </AdminCard>
      <AdminCard title="Utmify delivery log">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Attempts</th>
                <th>Last error</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {page.deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td data-label="Status">
                    <span className="status-pill">{delivery.status}</span>
                  </td>
                  <td data-label="Attempts">{delivery.attemptCount}</td>
                  <td data-label="Last error">{delivery.lastError ?? "—"}</td>
                  <td data-label="Created">{delivery.createdAt.toLocaleString()}</td>
                </tr>
              ))}
              {!page.deliveries.length && (
                <tr>
                  <td colSpan={4}>No conversion deliveries yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </>
  );
}
