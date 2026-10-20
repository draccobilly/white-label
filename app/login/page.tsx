"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { createClient } from "@/lib/supabase/client";

function nextPath() {
  if (typeof window === "undefined") return "/admin";
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  return next.startsWith("/admin") ? next : "/admin";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error === "forbidden") {
      setMessage("This email signed in, but it is not the admin account on this server.");
    } else if (error === "auth") {
      setMessage("Supabase is not configured on this server.");
    }
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        throw new Error("Configure Supabase environment variables first.");
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      window.location.assign(nextPath());
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : "Unable to sign in";
      setMessage(
        /invalid login credentials/i.test(raw)
          ? "Wrong email or password."
          : raw,
      );
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
        padding: "max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom))",
        background:
          "radial-gradient(circle at top, rgba(21,101,192,0.16), transparent 42%), #eef3f8",
      }}
    >
      <div className="admin-card" style={{ width: "min(440px, 100%)" }}>
        <BrandLogo siteName="Admin" />
        <h1 style={{ margin: "22px 0 6px", letterSpacing: "-0.04em" }}>Admin</h1>
        <p style={{ marginTop: 0, color: "var(--muted)" }}>
          Entre com e-mail e senha.
        </p>
        <form className="admin-form" onSubmit={submit}>
          <label>
            Email
            <input
              className="admin-input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              className="admin-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          {message && <p className="form-message">{message}</p>}
        </form>
      </div>
    </main>
  );
}
