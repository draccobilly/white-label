import Link from "next/link";
import { Megaphone, Pencil, Search } from "lucide-react";
import { CampaignStatus } from "@/generated/prisma/enums";
import { AdminChip, type AdminChipTone } from "@/components/admin/AdminChip";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminRowMenu } from "@/components/admin/AdminRowMenu";
import { CampaignDeleteButton } from "@/components/admin/CampaignDeleteButton";
import { CampaignDuplicateButton } from "@/components/admin/CampaignDuplicateButton";
import { currentAdminAccess } from "@/lib/admin-access";
import { assignedCampaignWhere, ensureOperatorAffiliate } from "@/lib/operator-affiliate";
import { getAdminCompany } from "@/lib/company";
import { companyDesk } from "@/lib/company-desk";
import { campaignNameTag, isNewCampaign } from "@/lib/campaign-label";
import { campaignStageView } from "@/lib/campaign-stages";
import { prisma } from "@/lib/prisma";
import { paidLiveSalesWhere } from "@/lib/sale-filters";
import { formatMoney, progressPercent } from "@/lib/utils";

const TABS = [
  { id: "ACTIVE", label: "Active" },
  { id: "DRAFT", label: "Drafts" },
  { id: "PAUSED", label: "Paused" },
  { id: "ALL", label: "All" },
] as const;

const STATUS_TONE: Record<string, AdminChipTone> = {
  ACTIVE: "success",
  DRAFT: "neutral",
  PAUSED: "warning",
  COMPLETED: "info",
};

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const query = await searchParams;
  const search = (query.q ?? "").trim().slice(0, 80);
  const status = (TABS.find((tab) => tab.id === query.status)?.id ?? "ACTIVE") as
    | CampaignStatus
    | "ALL";
  const { admin, isOwner } = await currentAdminAccess();
  const operatorAffiliate = isOwner ? null : await ensureOperatorAffiliate(admin);
  const company = await getAdminCompany();
  const desk = companyDesk(company);
  const ownSales = operatorAffiliate
    ? { affiliateId: operatorAffiliate.id }
    : {};
  const campaigns = await prisma.campaign.findMany({
    where: {
      companyId: company.id,
      ...(operatorAffiliate ? assignedCampaignWhere(operatorAffiliate.id) : {}),
      ...(status === "ALL" ? {} : { status }),
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    },
    include: {
      _count: {
        select: {
          pages: true,
          sales: { where: { ...paidLiveSalesWhere(company.id), ...ownSales } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  const ownPaid = operatorAffiliate && campaigns.length
    ? await prisma.sale.groupBy({
        by: ["campaignId"],
        where: {
          ...paidLiveSalesWhere(company.id),
          affiliateId: operatorAffiliate.id,
          campaignId: { in: campaigns.map((campaign) => campaign.id) },
        },
        _sum: { amount: true },
      })
    : [];
  const ownPaidByCampaign = new Map(
    ownPaid.map((row) => [row.campaignId, row._sum.amount ?? 0]),
  );

  function isImage(url: string | null) {
    return Boolean(url) && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(url ?? "");
  }

  return (
    <div className="dash">
      <header className="dash-page-head">
        <div>
          <p className="dash-kicker">
            {desk.region}, {desk.gateway}
          </p>
          <h1>Campaigns</h1>
        </div>
        <Link className="primary-button" href="/admin/campaigns/new">
          New campaign
        </Link>
      </header>

      <div className="dash-toolbar">
        <div className="dash-seg" role="group" aria-label="Status">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === "ACTIVE" ? "/admin/campaigns" : `/admin/campaigns?status=${tab.id}`}
              className={status === tab.id ? "is-active" : undefined}
              aria-current={status === tab.id ? "true" : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <form className="dash-search" action="/admin/campaigns" role="search">
          {status === "ACTIVE" ? null : <input type="hidden" name="status" value={status} />}
          <Search size={16} aria-hidden />
          <label className="sr-only" htmlFor="campaign-search">
            Search campaigns by title
          </label>
          <input
            id="campaign-search"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search by title"
            enterKeyHint="search"
          />
        </form>
      </div>

      <div className="dash-list">
        {campaigns.map((campaign) => {
          const amount = operatorAffiliate
            ? (ownPaidByCampaign.get(campaign.id) ?? 0)
            : campaign.currentAmount;
          const stageGoal = campaignStageView(campaign).goalAmount;
          const progress = progressPercent(campaign.currentAmount, stageGoal);
          const blockedReason =
            campaign.slug === "anok"
              ? "Protected campaign"
              : campaign.status === "ACTIVE" || campaign.status === "COMPLETED"
                ? "Pause before deleting"
                : campaign._count.sales > 0
                  ? "Live payment history"
                  : null;
          return (
            <article key={campaign.id} className="dash-product">
              <Link href={`/admin/campaigns/${campaign.id}`} className="dash-product-main">
                <span className="dash-thumb" aria-hidden>
                  {isImage(campaign.coverImageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={campaign.coverImageUrl ?? ""} alt="" loading="lazy" />
                  ) : (
                    campaignNameTag(campaign.title).slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="dash-product-copy">
                  <strong>{campaign.title}</strong>
                  <span className="dash-product-chips">
                    <AdminChip tone={STATUS_TONE[campaign.status] ?? "neutral"}>
                      {campaign.status.toLowerCase()}
                    </AdminChip>
                    {campaign.unlisted ? <AdminChip>hidden</AdminChip> : null}
                    {isNewCampaign(campaign.createdAt) ? <AdminChip tone="info">new</AdminChip> : null}
                    <small>/{campaign.slug}</small>
                  </span>
                  <span className="dash-product-money">
                    <b>{formatMoney(amount, campaign.currency)}</b>
                    {operatorAffiliate ? (
                      <small>{campaign._count.sales} paid through your link</small>
                    ) : (
                      <>
                        <small>of {formatMoney(stageGoal, campaign.currency)}</small>
                        <small className="dash-product-count">
                          {campaign._count.sales} paid
                          <span>
                            , {campaign._count.pages} {campaign._count.pages === 1 ? "page" : "pages"}
                          </span>
                        </small>
                      </>
                    )}
                  </span>
                  {operatorAffiliate ? null : (
                    <span
                      className="dash-progress"
                      role="img"
                      aria-label={`${Math.round(progress)}% of the goal`}
                    >
                      <i style={{ width: `${progress}%` }} />
                    </span>
                  )}
                </span>
              </Link>
              <AdminRowMenu label={`Actions for ${campaign.title}`}>
                <Link className="secondary-button" href={`/admin/campaigns/${campaign.id}`}>
                  <Pencil size={15} aria-hidden />
                  Edit
                </Link>
                <CampaignDuplicateButton campaignId={campaign.id} />
                <CampaignDeleteButton
                  campaignId={campaign.id}
                  campaignTitle={campaign.title}
                  blockedReason={blockedReason}
                />
              </AdminRowMenu>
            </article>
          );
        })}
        {!campaigns.length ? (
          <AdminEmptyState
            icon={<Megaphone size={20} />}
            title={
              search
                ? `No campaign matches “${search}”`
                : `No ${status === "ALL" ? "" : status.toLowerCase() + " "}campaigns for ${desk.region}`
            }
            body={
              search
                ? "Check the spelling or look in another status tab."
                : status === "ACTIVE"
                  ? "Active campaigns are live on the public domain. Create one or check the Drafts tab."
                  : "Switch tabs to see campaigns in another status."
            }
            action={
              search ? (
                <Link className="secondary-button" href="/admin/campaigns">
                  Clear search
                </Link>
              ) : status === "ACTIVE" ? (
                <Link className="primary-button" href="/admin/campaigns/new">
                  New campaign
                </Link>
              ) : null
            }
            compact
          />
        ) : null}
      </div>
    </div>
  );
}
