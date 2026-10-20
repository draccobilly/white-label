import { redirect } from "next/navigation";
import { NewPasswordForm } from "@/components/admin/NewPasswordForm";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { mustChangePassword } from "@/lib/must-change-password";
import { createClient } from "@/lib/supabase/server";

export default async function NewPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!mustChangePassword(user)) redirect("/admin");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom))",
        background:
          "radial-gradient(circle at top, rgba(21,101,192,0.16), transparent 42%), #eef3f8",
      }}
    >
      <div className="admin-card" style={{ width: "min(440px, 100%)" }}>
        <h1 style={{ margin: "0 0 6px", letterSpacing: "-0.04em" }}>Atualize sua senha</h1>
        <p style={{ marginTop: 0, color: "var(--muted)" }}>
          Esta senha foi temporária. Escolha uma nova para abrir o painel. Campanhas e vendas continuam nesta conta.
        </p>
        <NewPasswordForm />
        <div style={{ marginTop: 16 }}>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
