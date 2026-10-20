import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { redirect } from "next/navigation";
import { AdminPageFrame } from "@/components/admin/AdminPageFrame";
import { AdminPwa } from "@/components/admin/AdminPwa";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminSplash } from "@/components/admin/AdminSplash";
import { requireAdmin } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/admin-role";
import { adminNavBadges } from "@/lib/admin-attention";
import { getAdminCompany, listCompanies } from "@/lib/company";

export const metadata: Metadata = {
  title: "Admin",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Admin",
    statusBarStyle: "default",
    startupImage: ["/admin-splash.png"],
  },
  icons: {
    apple: [{ url: "/apple-touch-icon.png?v=3", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f6fa",
};

const adminSans = Inter({
  subsets: ["latin"],
  variable: "--font-admin",
});

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`admin-body ${adminSans.variable} ${adminSans.className}`}>
      <AdminSplash />
      <AdminAuthenticatedShell>{children}</AdminAuthenticatedShell>
    </div>
  );
}

async function AdminAuthenticatedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "MUST_CHANGE_PASSWORD") redirect("/login/senha");
    if (code === "FORBIDDEN") redirect("/login?error=forbidden");
    if (code === "AUTH_NOT_CONFIGURED") redirect("/login?error=auth");
    redirect("/login");
  }

  const [companies, current] = await Promise.all([
    listCompanies(),
    getAdminCompany(),
  ]);
  const isOwner = isOwnerAdmin(admin);
  // Read-only counters for the menu badges (requests received in the last 24h).
  const badges = isOwner ? await adminNavBadges(current.id) : { support: 0, refunds: 0, disputes: 0 };

  return (
    <div className="admin-layout">
      <AdminSidebar
        isOwner={isOwner}
        badges={badges}
        companies={companies.map((company) => ({
          id: company.id,
          name: company.name,
          isDefault: company.isDefault,
          slug: company.slug,
          locale: company.locale,
          paymentGateway: company.paymentGateway,
        }))}
        currentCompanyId={current.id}
        singleSite={
          current.siteMode === "INSTITUTIONAL" && companies.length <= 1
        }
      />
      <main className="admin-main">
        <AdminPwa />
        <AdminPageFrame>{children}</AdminPageFrame>
      </main>
    </div>
  );
}
