import { isOwnerAdmin, ownerEmail } from "@/lib/admin-role";
import { mustChangePassword } from "@/lib/must-change-password";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export { authErrorMessage, authHttpStatus, isAuthError } from "@/lib/auth-errors";

export function isLocalAdminBypass() {
  return (
    process.env.LOCAL_ADMIN_BYPASS === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

function displayName(user: {
  user_metadata?: { full_name?: string; name?: string } | null;
}) {
  return user.user_metadata?.full_name ?? user.user_metadata?.name ?? undefined;
}

export async function requireAdmin() {
  if (isLocalAdminBypass()) {
    const email = ownerEmail() || "admin@example.com";
    return prisma.admin.upsert({
      where: { id: "00000000-0000-4000-8000-000000000001" },
      update: { email, role: "OWNER" },
      create: {
        id: "00000000-0000-4000-8000-000000000001",
        email,
        name: "Local administrator",
        role: "OWNER",
      },
    });
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) throw new Error("UNAUTHORIZED");
  if (mustChangePassword(user)) throw new Error("MUST_CHANGE_PASSWORD");
  const email = user.email.toLowerCase();
  const name = displayName(user);
  const isConfiguredOwner = Boolean(ownerEmail()) && email === ownerEmail();

  if (isConfiguredOwner) {
    return prisma.admin.upsert({
      where: { id: user.id },
      update: { email, name, role: "OWNER" },
      create: {
        id: user.id,
        email,
        name: name ?? null,
        role: "OWNER",
      },
    });
  }

  const existing =
    (await prisma.admin.findUnique({ where: { id: user.id } })) ??
    (await prisma.admin.findUnique({ where: { email } }));
  if (!existing) throw new Error("FORBIDDEN");

  if (existing.id !== user.id) {
    await prisma.admin.delete({ where: { id: existing.id } });
    return prisma.admin.create({
      data: {
        id: user.id,
        email,
        name: name ?? existing.name,
        role: existing.role,
      },
    });
  }

  return prisma.admin.update({
    where: { id: existing.id },
    data: {
      email,
      ...(name ? { name } : {}),
    },
  });
}

export async function requireOwner() {
  const admin = await requireAdmin();
  if (!isOwnerAdmin(admin)) throw new Error("FORBIDDEN");
  return admin;
}
