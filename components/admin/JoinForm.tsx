"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { createClient } from "@/lib/supabase/client";

function inviteToken() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

export function JoinForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const nextToken = inviteToken();
    setToken(nextToken);
    if (!nextToken) {
      setChecking(false);
      setMessage("This invite is invalid or expired.");
      return;
    }
    void fetch(`/api/join?token=${encodeURIComponent(nextToken)}`)
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setMessage(result.error ?? "This invite is invalid or expired.");
          setValid(false);
          return;
        }
        setValid(true);
      })
      .catch(() => {
        setMessage("This invite is invalid or expired.");
      })
      .finally(() => setChecking(false));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !valid) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to create account");
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      router.replace("/admin");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding:
          "max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom))",
        background:
          "radial-gradient(circle at top, rgba(21,101,192,0.16), transparent 42%), #eef3f8",
      }}
    >
      <div className="admin-card" style={{ width: "min(440px, 100%)" }}>
        <BrandLogo siteName="Admin" />
        <h1 style={{ margin: "22px 0 6px", letterSpacing: "-0.04em" }}>Admin</h1>
        <p style={{ marginTop: 0, color: "var(--muted)" }}>
          Crie e-mail e senha para acessar campanhas e vendas.
        </p>
        {checking ? (
          <p className="admin-help">Checking invite…</p>
        ) : (
          <form className="admin-form" onSubmit={submit}>
            <label>
              Name
              <input
                className="admin-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                disabled={!valid}
              />
            </label>
            <label>
              Email
              <input
                className="admin-input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={!valid}
              />
            </label>
            <label>
              Password
              <input
                className="admin-input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                disabled={!valid}
              />
            </label>
            <button className="primary-button" type="submit" disabled={loading || !valid}>
              {loading ? "Creating account…" : "Create account"}
            </button>
            {message ? <p className="form-message">{message}</p> : null}
          </form>
        )}
      </div>
    </main>
  );
}
