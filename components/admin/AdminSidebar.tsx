"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Newspaper,
  Users,
  Landmark,
  Link2,
  Settings,
  X,
  Receipt,
  Building2,
  Menu,
  LifeBuoy,
  Undo2,
  Vault,
  ChartColumn,
  HeartPulse,
  ShieldAlert,
  FileText,
  Bell,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { AdminDashboardClocks } from "@/components/admin/AdminOperationClock";
import { AdminRefreshButton } from "@/components/admin/AdminRefreshButton";
import { CompanySwitcher } from "@/components/admin/CompanySwitcher";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { ADMIN_DASHBOARD_CLOCKS } from "@/lib/admin-clock";

type BadgeKey = "support" | "refunds" | "disputes";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  ownerOnly: boolean;
  badge?: BadgeKey;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "operation",
    label: "Operação",
    items: [
      { href: "/admin", label: "Home", icon: LayoutDashboard, ownerOnly: false },
      { href: "/admin/sales", label: "Donations", icon: Receipt, ownerOnly: false },
      { href: "/admin/alerts", label: "Alertas", icon: Bell, ownerOnly: false },
      { href: "/admin/analytics", label: "Analytics", icon: ChartColumn, ownerOnly: false },
      { href: "/admin/health", label: "Saúde", icon: HeartPulse, ownerOnly: false },
      { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone, ownerOnly: false },
      { href: "/admin/integrations", label: "Page links", icon: Link2, ownerOnly: false },
    ],
  },
  {
    id: "support",
    label: "Suporte",
    items: [
      { href: "/admin/requests", label: "Suporte", icon: LifeBuoy, ownerOnly: true, badge: "support" },
      { href: "/admin/refunds", label: "Reembolsos", icon: Undo2, ownerOnly: true, badge: "refunds" },
      { href: "/admin/disputes", label: "Disputas", icon: ShieldAlert, ownerOnly: true, badge: "disputes" },
      { href: "/admin/letters", label: "Cartas", icon: FileText, ownerOnly: true },
      { href: "/admin/organizers", label: "Organizadores", icon: Users, ownerOnly: true },
      { href: "/admin/payouts", label: "Saques", icon: Landmark, ownerOnly: true },
    ],
  },
  {
    id: "site",
    label: "Site público",
    items: [{ href: "/admin/posts", label: "Posts", icon: Newspaper, ownerOnly: true }],
  },
  {
    id: "owner",
    label: "Dono",
    items: [
      { href: "/admin/companies", label: "Empresas", icon: Building2, ownerOnly: true },
      { href: "/admin/affiliates", label: "Affiliates", icon: Users, ownerOnly: true },
      { href: "/admin/settings", label: "Settings", icon: Settings, ownerOnly: true },
      { href: "/admin/vault", label: "Vault", icon: Vault, ownerOnly: true },
    ],
  },
];

const ownerTabs = [
  { href: "/admin", label: "Home", icon: LayoutDashboard },
  { href: "/admin/sales", label: "Donations", icon: Receipt },
  { href: "/admin/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
] as const;

const operatorTabs = [
  { href: "/admin", label: "Home", icon: LayoutDashboard },
  { href: "/admin/sales", label: "Donations", icon: Receipt },
  { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/admin/integrations", label: "Links", icon: Link2 },
] as const;

const brandName = "Admin";

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarCompany = {
  id: string;
  name: string;
  isDefault: boolean;
  slug?: string | null;
  locale?: string | null;
  paymentGateway?: string | null;
};

export function AdminSidebar({
  companies = [],
  currentCompanyId,
  isOwner = true,
  singleSite = false,
  badges,
}: {
  companies?: SidebarCompany[];
  currentCompanyId?: string;
  isOwner?: boolean;
  singleSite?: boolean;
  badges?: Partial<Record<BadgeKey, number>>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!isOwner && item.ownerOnly) return false;
      if (singleSite && item.href === "/admin/companies") return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
  const tabItems = isOwner ? ownerTabs : operatorTabs;
  const onPrimaryTab = tabItems.some((item) => isActive(pathname, item.href));
  const moreActive = open || !onPrimaryTab;
  const currentCompany = companies.find((company) => company.id === currentCompanyId);
  const pending = isOwner
    ? (badges?.support ?? 0) + (badges?.refunds ?? 0) + (badges?.disputes ?? 0)
    : 0;
  // With a single desk the top bar names it under the brand; with several,
  // the desk chip on the right does that and opens the switcher.
  const showDeskLine = Boolean(
    currentCompany && singleSite && currentCompany.name.trim().toLowerCase() !== brandName.toLowerCase(),
  );

  // The menu is a bottom sheet on phones: Escape closes it and the page
  // behind it stops scrolling while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    if (window.matchMedia("(max-width: 900px)").matches) {
      document.body.style.overflow = "hidden";
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="admin-mobile-bar">
        <Link href="/admin" className="admin-mobile-brand" aria-label={`${brandName} home`}>
          <BrandLogo compact siteName={brandName} logoUrl="/admin-icon-192.png" />
          <span className="admin-mobile-brand-copy">
            <strong>{brandName}</strong>
            {showDeskLine ? <small>{currentCompany?.name}</small> : null}
          </span>
        </Link>
        <div className="admin-mobile-tools">
          {currentCompany && !singleSite ? (
            <button
              type="button"
              className="admin-mobile-desk"
              onClick={() => setOpen(true)}
              aria-label={`Desk: ${currentCompany.name}. Open menu`}
            >
              <Building2 size={14} aria-hidden />
              <span>{currentCompany.name}</span>
            </button>
          ) : null}
          <AdminRefreshButton />
        </div>
      </header>
      {open ? (
        <button
          type="button"
          className="admin-sidebar-overlay"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside id="admin-sidebar" className={`admin-sidebar ${open ? "is-open" : ""}`}>
        <span className="admin-sheet-handle" aria-hidden />
        <div className="admin-sidebar-brand">
          <BrandLogo compact siteName={brandName} logoUrl="/admin-icon-192.png" />
          <span className="admin-wordmark">{brandName}</span>
          <button
            type="button"
            className="admin-menu-button admin-drawer-close"
            onClick={() => setOpen(false)}
          >
            <X size={18} aria-hidden />
            <span className="sr-only">Close menu</span>
          </button>
        </div>
        {isOwner && currentCompanyId && companies.length && !singleSite ? (
          <CompanySwitcher companies={companies} currentId={currentCompanyId} />
        ) : currentCompany ? (
          <p className="admin-sidebar-desk" title={currentCompany.name}>
            <Building2 size={14} aria-hidden />
            <span>{currentCompany.name}</span>
          </p>
        ) : null}
        <nav className="admin-nav" aria-label="Administration">
          {groups.map((group) => (
            <div key={group.id} className="admin-nav-group">
              <p className="admin-nav-label" id={`admin-nav-${group.id}`}>
                {group.label}
              </p>
              <ul aria-labelledby={`admin-nav-${group.id}`}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  const count = item.badge ? (badges?.[item.badge] ?? 0) : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={active ? "is-active" : undefined}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                      >
                        <Icon size={18} aria-hidden />
                        <span>{item.label}</span>
                        {count > 0 ? (
                          <b className="admin-nav-badge" title={`${count} em aberto`}>
                            {count > 99 ? "99+" : count}
                            <span className="sr-only"> em aberto</span>
                          </b>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <SignOutButton />
          <AdminDashboardClocks clocks={ADMIN_DASHBOARD_CLOCKS} variant="sidebar" />
        </div>
      </aside>
      <div className="admin-bottombar">
        <AdminDashboardClocks clocks={ADMIN_DASHBOARD_CLOCKS} variant="mobile" />
        <nav className="admin-tabbar" aria-label="Primary">
          {tabItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active && !open ? "is-active" : undefined}
                aria-current={active && !open ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <span className="admin-tab-icon">
                  <Icon size={20} aria-hidden />
                </span>
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            className={moreActive ? "is-active" : undefined}
            aria-expanded={open}
            aria-controls="admin-sidebar"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="admin-tab-icon">
              {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
              {pending > 0 && !open ? (
                <b className="admin-tab-badge">
                  {pending > 9 ? "9+" : pending}
                  <span className="sr-only"> pedidos em aberto</span>
                </b>
              ) : null}
            </span>
            Menu
          </button>
        </nav>
      </div>
    </>
  );
}
