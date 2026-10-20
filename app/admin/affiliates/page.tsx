import Link from "next/link";
import { Users } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AffiliateManager } from "@/components/admin/AffiliateManager";
import { TeamBoard } from "@/components/admin/TeamBoard";
import { percentChange } from "@/lib/admin-metrics";
import { addCalendarDays, reportingIsoDate, zonedStartOfDay } from "@/lib/date-range";
import { requireOwnerPage } from "@/lib/admin-access";
import { getAdminCompany } from "@/lib/company";
import { syncOperatorAffiliates } from "@/lib/operator-affiliate";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";
import { paidLiveSalesWhere } from "@/lib/sale-filters";
import { companyDesk } from "@/lib/company-desk";

export default async function AffiliatesPage() {
  const owner = await requireOwnerPage();
  await syncOperatorAffiliates();
  const company = await getAdminCompany();
  // Dynamic reporting window uses request time by design.
  // eslint-disable-next-line react-hooks/purity
  const todayIso = reportingIsoDate();
  const today = zonedStartOfDay(todayIso);
  const yesterday = zonedStartOfDay(addCalendarDays(todayIso, -1));
  const [affiliates, todaySales, yesterdaySales, logins, invites] = await Promise.all([
    prisma.affiliate.findMany({
      where: {
        OR: [
          { pages: { some: { campaign: { companyId: company.id } } } },
          { adminId: { not: null } },
        ],
      },
      include: {
        _count: {
          select: {
            pages: { where: { campaign: { companyId: company.id } } },
            sales: { where: paidLiveSalesWhere(company.id) },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.sale.groupBy({
      by: ["affiliateId", "currency"],
      where: { ...paidLiveSalesWhere(company.id), paidAt: { gte: today } },
      _sum: { amount: true },
    }),
    prisma.sale.groupBy({
      by: ["affiliateId"],
      where: {
        ...paidLiveSalesWhere(company.id),
        paidAt: { gte: yesterday, lt: today },
      },
      _sum: { amount: true },
    }),
    prisma.admin.findMany({
      where: { role: "OPERATOR" },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, createdAt: true },
    }),
    prisma.adminInvite.findMany({
      where: { createdById: owner.id, usedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, expiresAt: true, createdAt: true },
    }),
  ]);

  const rows = affiliates
    .map((affiliate) => {
      const todayRow = todaySales.find((row) => row.affiliateId === affiliate.id);
      const yesterdayRow = yesterdaySales.find((row) => row.affiliateId === affiliate.id);
      const todayAmount = todayRow?._sum.amount ?? 0;
      const yesterdayAmount = yesterdayRow?._sum.amount ?? 0;
      return {
        affiliate,
        todayAmount,
        currency: todayRow?.currency ?? "USD",
        change: percentChange(todayAmount, yesterdayAmount),
      };
    })
    .sort((a, b) => b.todayAmount - a.todayAmount);
  const todayTotal = todaySales.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
  const desk = companyDesk(company);
  const todayCurrency = todaySales[0]?.currency ?? desk.currency;

  return (
    <div className="dash">
      <header className="dash-page-head">
        <div>
          <p className="dash-kicker">{desk.region}</p>
          <h1>Affiliates</h1>
        </div>
        <strong className="dash-head-metric">{formatMoney(todayTotal, todayCurrency)}</strong>
      </header>
      <p className="dash-sub">Today’s volume</p>

      <div className="dash-list">
        {rows.map((row) => (
          <Link
            key={row.affiliate.id}
            href={`/admin/affiliates/${row.affiliate.id}`}
            className="dash-row"
          >
            <div>
              <strong>{row.affiliate.name}</strong>
              <p>
                {row.affiliate._count.pages} pages · {row.affiliate._count.sales} paid
              </p>
            </div>
            <em>
              {formatMoney(row.todayAmount, row.currency)}
              <small className={row.change > 0 ? "is-up" : row.change < 0 ? "is-down" : undefined}>
                {row.change >= 0 ? "+" : ""}
                {row.change}%
              </small>
            </em>
          </Link>
        ))}
        {!rows.length ? (
          <AdminEmptyState
            icon={<Users size={20} />}
            title="No affiliates yet"
            body="Affiliates appear here as soon as a campaign page is assigned to them or they accept an invite."
            compact
          />
        ) : null}
      </div>

      <section className="dash-section">
        <header className="dash-section-head">
          <h2>Convite</h2>
          <span>Acesso de operador</span>
        </header>
        <AdminCard>
          <TeamBoard
            operators={logins.map((row) => ({
              id: row.id,
              email: row.email,
              name: row.name,
              createdAt: row.createdAt.toISOString(),
            }))}
            invites={invites.map((row) => ({
              id: row.id,
              expiresAt: row.expiresAt.toISOString(),
              createdAt: row.createdAt.toISOString(),
            }))}
          />
        </AdminCard>
      </section>

      <section className="dash-section dash-desktop-block">
        <header className="dash-section-head">
          <h2>Manage</h2>
        </header>
        <AffiliateManager
          affiliates={affiliates.map((affiliate) => ({
            id: affiliate.id,
            name: affiliate.name,
            slug: affiliate.slug,
            email: affiliate.email,
            active: affiliate.active,
            pageCount: affiliate._count.pages,
            saleCount: affiliate._count.sales,
          }))}
        />
      </section>
    </div>
  );
}
