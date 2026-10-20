"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PortalStrings } from "@/lib/portal-copy";

type Copy = Pick<PortalStrings, "email" | "password" | "signIn" | "forgot" | "loginError" | "genericError" | "noAccount" | "startCase">;

export function PortalLoginForm({
  copy,
  nextHref,
  forgotHref,
  startHref,
}: {
  copy: Copy;
  nextHref: string;
  forgotHref: string;
  startHref: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/portal/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      setError(response.status === 401 ? copy.loginError : data.error ?? copy.genericError);
      return;
    }
    router.push(nextHref);
    router.refresh();
  }

  return (
    <form className="inst-form portal-form" onSubmit={(event) => void submit(event)}>
      <label>
        {copy.email}
        <input
          className="admin-input"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        {copy.password}
        <input
          className="admin-input"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="form-message">{error}</p> : null}
      <div className="start-actions">
        <Link className="inst-terms-link" href={forgotHref}>
          {copy.forgot}
        </Link>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "…" : copy.signIn}
        </button>
      </div>
      <p className="admin-field-hint">
        {copy.noAccount}{" "}
        <Link className="inst-terms-link" href={startHref}>
          {copy.startCase}
        </Link>
      </p>
    </form>
  );
}
