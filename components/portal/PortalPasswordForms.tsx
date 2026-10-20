"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PortalStrings } from "@/lib/portal-copy";

type Status = { tone: "error" | "success"; text: string } | null;

function PasswordPair({
  copy,
  password,
  confirm,
  onPassword,
  onConfirm,
  autoComplete = "new-password",
}: {
  copy: Pick<PortalStrings, "newPassword" | "confirmPassword" | "passwordHint">;
  password: string;
  confirm: string;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
  autoComplete?: string;
}) {
  return (
    <>
      <label>
        {copy.newPassword}
        <input
          className="admin-input"
          type="password"
          required
          minLength={8}
          autoComplete={autoComplete}
          value={password}
          onChange={(event) => onPassword(event.target.value)}
        />
        <span className="admin-field-hint">{copy.passwordHint}</span>
      </label>
      <label>
        {copy.confirmPassword}
        <input
          className="admin-input"
          type="password"
          required
          minLength={8}
          autoComplete={autoComplete}
          value={confirm}
          onChange={(event) => onConfirm(event.target.value)}
        />
      </label>
    </>
  );
}

export function PortalForgotForm({ copy }: { copy: Pick<PortalStrings, "email" | "sendLink" | "forgotSent" | "genericError"> }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const response = await fetch("/api/portal/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setStatus({ tone: "error", text: data.error ?? copy.genericError });
      return;
    }
    setStatus({ tone: "success", text: copy.forgotSent });
  }

  if (status?.tone === "success") return <p className="inst-form-thanks">{status.text}</p>;

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
      {status ? <p className="form-message">{status.text}</p> : null}
      <div className="start-actions">
        <span />
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "…" : copy.sendLink}
        </button>
      </div>
    </form>
  );
}

export function PortalResetForm({
  copy,
  token,
  dashboardHref,
}: {
  copy: Pick<PortalStrings, "newPassword" | "confirmPassword" | "passwordHint" | "passwordMismatch" | "savePassword" | "resetInvalid" | "resetDone" | "genericError">;
  token: string;
  dashboardHref: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setStatus({ tone: "error", text: copy.passwordMismatch });
      return;
    }
    setBusy(true);
    setStatus(null);
    const response = await fetch("/api/portal/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      setStatus({ tone: "error", text: response.status === 410 ? copy.resetInvalid : data.error ?? copy.genericError });
      return;
    }
    setStatus({ tone: "success", text: copy.resetDone });
    router.push(dashboardHref);
    router.refresh();
  }

  return (
    <form className="inst-form portal-form" onSubmit={(event) => void submit(event)}>
      <PasswordPair copy={copy} password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
      {status ? <p className={status.tone === "success" ? "inst-form-thanks" : "form-message"}>{status.text}</p> : null}
      <div className="start-actions">
        <span />
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "…" : copy.savePassword}
        </button>
      </div>
    </form>
  );
}

export function PortalChangePasswordForm({
  copy,
}: {
  copy: Pick<PortalStrings, "currentPassword" | "newPassword" | "confirmPassword" | "passwordHint" | "passwordMismatch" | "changePassword" | "passwordChanged" | "wrongPassword" | "genericError">;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setStatus({ tone: "error", text: copy.passwordMismatch });
      return;
    }
    setBusy(true);
    setStatus(null);
    const response = await fetch("/api/portal/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setStatus({ tone: "error", text: response.status === 403 ? copy.wrongPassword : data.error ?? copy.genericError });
      return;
    }
    setCurrent("");
    setPassword("");
    setConfirm("");
    setStatus({ tone: "success", text: copy.passwordChanged });
    router.refresh();
  }

  return (
    <form className="inst-form portal-form" onSubmit={(event) => void submit(event)}>
      <label>
        {copy.currentPassword}
        <input
          className="admin-input"
          type="password"
          required
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </label>
      <PasswordPair copy={copy} password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
      {status ? <p className={status.tone === "success" ? "inst-form-thanks" : "form-message"}>{status.text}</p> : null}
      <div className="start-actions">
        <span />
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "…" : copy.changePassword}
        </button>
      </div>
    </form>
  );
}
