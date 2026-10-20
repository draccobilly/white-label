"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Status = "PENDING" | "APPROVED" | "PAID" | "REJECTED";

const STATUSES: { id: Status; label: string }[] = [
  { id: "PENDING", label: "Em análise" },
  { id: "APPROVED", label: "Aprovado" },
  { id: "PAID", label: "Pago" },
  { id: "REJECTED", label: "Recusado" },
];

export function payoutStatusLabelPt(status: string) {
  return STATUSES.find((item) => item.id === status)?.label ?? status;
}

export function PayoutStatusControl({
  id,
  status,
  internalNote,
}: {
  id: string;
  status: Status;
  internalNote: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Status | "note" | null>(null);
  const [note, setNote] = useState(internalNote ?? "");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const noteDirty = note.trim() !== (internalNote ?? "").trim();

  async function save(body: { status?: Status; internalNote?: string }) {
    setMessage(null);
    const response = await fetch(`/api/admin/payouts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage({ tone: "error", text: data.error ?? "Não foi possível salvar." });
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  return (
    <div className="admin-status-control">
      <div className="dash-seg admin-status-seg" role="group" aria-label="Status do saque">
        {STATUSES.map((option) => (
          <button
            key={option.id}
            type="button"
            className={option.id === status ? "is-active" : undefined}
            aria-pressed={option.id === status}
            disabled={busy !== null || pending || option.id === status}
            onClick={async () => {
              setBusy(option.id);
              const ok = await save({ status: option.id });
              if (ok) setMessage({ tone: "success", text: `Marcado como ${option.label.toLowerCase()}.` });
              setBusy(null);
            }}
          >
            {busy === option.id ? "Salvando…" : option.label}
          </button>
        ))}
      </div>
      <label className="admin-status-note">
        <span>Nota interna (só o painel vê)</span>
        <textarea
          className="admin-textarea"
          rows={2}
          value={note}
          maxLength={4000}
          placeholder="Ex.: wire enviado em 14/10, referência…"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="admin-inline-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={!noteDirty || busy !== null}
          onClick={async () => {
            setBusy("note");
            const ok = await save({ internalNote: note });
            if (ok) setMessage({ tone: "success", text: "Nota salva." });
            setBusy(null);
          }}
        >
          {busy === "note" ? "Salvando…" : "Salvar nota"}
        </button>
        {message ? (
          <p className={message.tone === "error" ? "form-message" : "admin-help"}>{message.text}</p>
        ) : null}
      </div>
    </div>
  );
}
