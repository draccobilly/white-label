"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type OperatorRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
};

type InviteRow = {
  id: string;
  expiresAt: string;
  createdAt: string;
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function joinUrl(token: string) {
  if (typeof window === "undefined") return `/join?token=${token}`;
  return `${window.location.origin}/join?token=${encodeURIComponent(token)}`;
}

export function TeamBoard({
  operators,
  invites,
}: {
  operators: OperatorRow[];
  invites: InviteRow[];
}) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createInvite() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/team", { method: "POST" });
      const result = (await response.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
      };
      if (!response.ok || !result.token) {
        throw new Error(result.error ?? "Unable to create invite");
      }
      setLink(joinUrl(result.token));
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to create invite");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function remove(body: { inviteId?: string; adminId?: string }) {
    setMessage(null);
    const response = await fetch("/api/admin/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(result.error ?? "Unable to update team");
      return;
    }
    if (body.inviteId) setLink(null);
    router.refresh();
  }

  return (
    <div className="admin-form">
      <p className="admin-help">
        The invite works once and expires in 7 days. Send the link privately.
      </p>
      <div className="admin-inline-actions">
        <button
          type="button"
          className="primary-button"
          disabled={loading}
          onClick={() => void createInvite()}
        >
          {loading ? "Criando…" : "Criar link de convite"}
        </button>
      </div>
      {link ? (
        <label>
          Invite link
          <div className="copy-link-wrap">
            <button type="button" className="secondary-button" onClick={() => void copyLink()}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <span className="copy-link-url" title={link}>
              {link}
            </span>
          </div>
        </label>
      ) : null}

      <h3>Open invites</h3>
      {invites.length ? (
        <ul className="team-account-list">
          {invites.map((invite) => (
            <li key={invite.id}>
              <div>
                <strong>Unused invite</strong>
                <p>Expires {formatWhen(invite.expiresAt)}</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void remove({ inviteId: invite.id })}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-field-hint">No unused invites.</p>
      )}

      <h3>Afiliados com acesso</h3>
      {operators.length ? (
        <ul className="team-account-list">
          {operators.map((operator) => (
            <li key={operator.id}>
              <div>
                <strong>{operator.name || operator.email}</strong>
                <p>{operator.email}</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void remove({ adminId: operator.id })}
              >
                Revoke access
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-field-hint">Nenhum afiliado com acesso ainda.</p>
      )}
      {message ? <p className="form-error">{message}</p> : null}
    </div>
  );
}
