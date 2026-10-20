import { redirect } from "next/navigation";
import { isOwnerAdmin } from "@/lib/admin-role";
import { requireAdmin } from "@/lib/auth";

export async function requireOwnerPage() {
  const admin = await requireAdmin();
  if (!isOwnerAdmin(admin)) redirect("/admin");
  return admin;
}

export async function currentAdminAccess() {
  const admin = await requireAdmin();
  return {
    admin,
    isOwner: isOwnerAdmin(admin),
  };
}
