export type AdminRoleName = "OWNER" | "OPERATOR";

export type AdminAccess = {
  email: string;
  role: AdminRoleName;
};

export function ownerEmail() {
  return (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
}

export function isOwnerAdmin(admin: AdminAccess) {
  const owner = ownerEmail();
  if (owner && admin.email.toLowerCase() === owner) return true;
  return admin.role === "OWNER";
}
