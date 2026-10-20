"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { RequestStatus } from "@/generated/prisma/enums";
import { AdminFormMessage } from "@/components/admin/AdminFormMessage";
import { REQUEST_STATUSES, requestStatusLabel } from "@/lib/request-status";

const HINTS: Record<RequestStatus, string> = {
  OPEN: "Ninguém respondeu ainda.",
  ANSWERED: "Já foi respondido; aguardando o donatário ou o estorno.",
  RESOLVED: "Encerrado. Some da fila e do contador do menu.",
};

/**
 * Queue status of a support or refund request. Writes only the panel-side
 * columns (status, note); the request body and the sale are never touched.
 */
export function RequestStatusControl({
  kind,
  id,
  status,
  internalNote,
  statusChangedAt,
}: {
  kind: "requests" | "refunds";
  id: string;
  status: RequestStatus;
  internalNote: string | null;
  statusChangedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<RequestStatus | "note" | null>(null);
  const [note, setNote] = useState(internalNote ?? "");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const noteDirty = note.trim() !== (internalNote ?? "").trim();

  async function save(body: { status?: RequestStatus; internalNote?: string }) {
    setMessage(null);
    const response = await fetch(`/api/admin/${kind}/${id}`, {
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

  async function setStatus(next: RequestStatus) {
    if (next === status || busy) return;
    setBusy(next);
    const ok = await save({ status: next });
    if (ok) setMessage({ tone: "success", text: `Marcado como ${requestStatusLabel(next).toLowerCase()}.` });
    setBusy(null);
  }

  async function saveNote() {
    if (busy) return;
    setBusy("note");
    const ok = await save({ internalNote: note });
    if (ok) setMessage({ tone: "success", text: "Nota salva." });
    setBusy(null);
  }

  const changed = statusChangedAt ? new Date(statusChangedAt) : null;

  return (
    <div className="admin-status-control">
      <div className="admin-status-head">
        <h3>Status do pedido</h3>
        {changed ? (
          <small>
            alterado em{" "}
            <time dateTime={changed.toISOString()}>{changed.toLocaleString("pt-BR")}</time>
          </small>
        ) : null}
      </div>
      <div className="dash-seg admin-status-seg" role="group" aria-label="Status">
        {REQUEST_STATUSES.map((option) => (
          <button
            key={option}
            type="button"
            className={option === status ? "is-active" : undefined}
            aria-pressed={option === status}
            disabled={busy !== null || pending}
            onClick={() => void setStatus(option)}
          >
            {busy === option ? "Salvando…" : requestStatusLabel(option)}
          </button>
        ))}
      </div>
      <p className="admin-help">{HINTS[status]}</p>
      <label className="admin-status-note">
        <span>Nota interna (só o painel vê)</span>
        <textarea
          className="admin-textarea"
          rows={3}
          value={note}
          maxLength={4000}
          placeholder="Ex.: respondido por e-mail em 2/10, estorno feito no Stripe…"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="admin-inline-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={!noteDirty || busy !== null}
          onClick={() => void saveNote()}
        >
          {busy === "note" ? "Salvando…" : "Salvar nota"}
        </button>
        {message ? <AdminFormMessage tone={message.tone}>{message.text}</AdminFormMessage> : null}
      </div>
    </div>
  );
}
