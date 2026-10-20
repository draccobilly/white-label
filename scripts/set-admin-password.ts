import "dotenv/config";

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.argv[2] ?? "";
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!email || !url || !service) {
  console.error("Need ADMIN_EMAIL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Usage: npx tsx scripts/set-admin-password.ts 'your-password-here'");
  process.exit(1);
}

type AuthUser = { id: string; email?: string | null };
type AuthErrorBody = { msg?: string; message?: string; error_description?: string };

async function authAdmin<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${url}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: service!,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as AuthErrorBody & T;
  if (!response.ok) {
    throw new Error(
      body.msg || body.message || body.error_description || `Auth admin ${response.status}`,
    );
  }
  return body;
}

const listed = await authAdmin<{ users?: AuthUser[] }>("/admin/users?page=1&per_page=200");
const existing = (listed.users ?? []).find((user) => user.email?.toLowerCase() === email);

if (existing) {
  await authAdmin(`/admin/users/${existing.id}`, {
    method: "PUT",
    body: JSON.stringify({ password, email_confirm: true }),
  });
  console.log(`Password updated for ${email}`);
} else {
  await authAdmin("/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  console.log(`Admin user created for ${email}`);
}
