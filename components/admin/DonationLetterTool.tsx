"use client";

import { Ban, Download, FileText, Search, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminChip } from "@/components/admin/AdminChip";
import { AdminFormMessage } from "@/components/admin/AdminFormMessage";
import { DONATION_LETTER } from "@/lib/donation-letter-config";
import type { LetterSaleRow, PendingLetterRow } from "@/lib/donation-letter-desk";
import { formatMoneyExact, formatRelativeTime } from "@/lib/utils";

type Message = { tone: "error" | "success" | "info"; text: string };
type Pending = { count: number; totalCents: number; rows: PendingLetterRow[] };
type BatchResult = { sent: number; failed: Array<{ id: string; email: string; error: string }>; remaining: number };
type ArchiveLetter = {
  id: string;
  sentAt: string;
  donorName: string;
  reference: string;
  amountCents: number;
  currency: string;
  voidedAt: string | null;
};
type ArchiveMonth = {
  month: string;
  label: string;
  copies: number;
  unstored: number;
  totalCents: number;
  reportableCount: number;
  reportableCents: number;
  letters: ArchiveLetter[];
};
type ArchiveListing = { ready: boolean; months: ArchiveMonth[]; unstored: number };

function shortDay(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
}

/**
 * Donation acknowledgment letters on request: find the gift by the donor's
 * e-mail, name or tracking code, check the PDF, and e-mail it. Gifts of
 * `automaticLabel` or more already get the letter with the thank-you e-mail.
 */
export function DonationLetterTool({
  automaticLabel,
  defaultSince,
}: {
  automaticLabel: string;
  /** First day (YYYY-MM-DD) the catch-up of older gifts starts from. */
  defaultSince: string;
}) {
  const [since, setSince] = useState(defaultSince);
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingArmed, setPendingArmed] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [pendingMessage, setPendingMessage] = useState<Message | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testMessage, setTestMessage] = useState<Message | null>(null);
  const [archive, setArchive] = useState<ArchiveListing | null>(null);
  const [filing, setFiling] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState<Message | null>(null);
  const [cancelArmed, setCancelArmed] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<LetterSaleRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [includeSupport, setIncludeSupport] = useState(false);
  const [supportNote, setSupportNote] = useState("");
  const [message, setMessage] = useState<Message | null>(null);

  async function readArchive() {
    const response = await fetch("/api/admin/tax-letters/archive", { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as ArchiveListing & { error?: string };
    if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
    return data;
  }

  async function loadArchive() {
    setArchiveMessage(null);
    try {
      let listing = await readArchive();
      setFiling(listing.ready && listing.unstored > 0);
      for (let round = 0; listing.ready && listing.unstored > 0 && round < 200; round += 1) {
        setArchive(listing);
        const step = await fetch("/api/admin/tax-letters/archive", { method: "POST" });
        const stepData = (await step.json().catch(() => ({}))) as { stored?: number; error?: string };
        if (!step.ok) throw new Error(stepData.error ?? `HTTP ${step.status}`);
        if (!stepData.stored) break;
        listing = await readArchive();
      }
      setArchive(listing);
      setFiling(false);
    } catch (error) {
      setFiling(false);
      setArchiveMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Não foi possível listar as cartas.",
      });
    }
  }

  async function saveFile(path: string, fallbackName: string) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadZip(month: string) {
    setBusy(`zip:${month}`);
    setArchiveMessage(null);
    try {
      await saveFile(`/api/admin/tax-letters/archive/download?month=${encodeURIComponent(month)}`, "cartas-doacao.zip");
    } catch (error) {
      setArchiveMessage({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível baixar." });
    } finally {
      setBusy(null);
    }
  }

  async function downloadCopy(copyId: string) {
    setBusy(copyId);
    setArchiveMessage(null);
    setMessage(null);
    try {
      await saveFile(`/api/admin/tax-letters/archive/${copyId}`, "carta.pdf");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Não foi possível baixar a carta.";
      setArchiveMessage({ tone: "error", text });
    } finally {
      setBusy(null);
    }
  }

  async function cancelCopy(copyId: string) {
    setBusy(copyId);
    setArchiveMessage(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/tax-letters/archive/${copyId}`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { to?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      setCancelArmed(null);
      const text = `Carta cancelada. O doador foi avisado em ${data.to}.`;
      setArchiveMessage({ tone: "success", text });
      setMessage({ tone: "success", text });
      await loadArchive();
      if (query.trim().length >= 3) await search();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Não foi possível cancelar a carta.";
      setArchiveMessage({ tone: "error", text });
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void loadArchive();
  }, []);

  async function search(term = query) {
    if (term.trim().length < 3) {
      setMessage({ tone: "error", text: "Digite ao menos 3 caracteres do e-mail, nome ou código." });
      return;
    }
    setBusy("search");
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/tax-letters?q=${encodeURIComponent(term.trim())}`, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { rows?: LetterSaleRow[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      setRows(data.rows ?? []);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível buscar." });
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy("test");
    setTestMessage(null);
    try {
      const response = await fetch("/api/admin/tax-letters/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail.trim() }),
      });
      const data = (await response.json().catch(() => ({}))) as { to?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      setTestMessage({ tone: "success", text: `Carta de teste enviada para ${data.to}. Confira a caixa de entrada e o spam.` });
    } catch (error) {
      setTestMessage({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível enviar o teste." });
    } finally {
      setBusy(null);
    }
  }

  async function checkPending() {
    setBusy("pending");
    setPendingMessage(null);
    setPendingArmed(false);
    try {
      const response = await fetch(`/api/admin/tax-letters/pending?since=${encodeURIComponent(since)}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as Pending & { error?: string };
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      setPending({ count: data.count, totalCents: data.totalCents, rows: data.rows });
    } catch (error) {
      setPendingMessage({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível verificar." });
    } finally {
      setBusy(null);
    }
  }

  /** Sends the pending letters a few at a time until none remain. */
  async function sendPending() {
    if (!pending?.count) return;
    setBusy("pending-send");
    setPendingMessage(null);
    const total = pending.count;
    const failed: BatchResult["failed"] = [];
    let sent = 0;
    setProgress({ sent, total });
    try {
      for (let round = 0; round < 2000; round += 1) {
        const response = await fetch("/api/admin/tax-letters/pending", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ since, exclude: failed.map((item) => item.id) }),
        });
        const data = (await response.json().catch(() => ({}))) as BatchResult & { error?: string };
        if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
        sent += data.sent;
        failed.push(...data.failed);
        setProgress({ sent, total });
        if (data.remaining <= 0 || (data.sent === 0 && data.failed.length === 0)) break;
      }
      setPendingMessage(
        failed.length
          ? {
              tone: "error",
              text: `${sent} carta(s) enviada(s). ${failed.length} falharam: ${failed
                .slice(0, 5)
                .map((item) => `${item.email} (${item.error})`)
                .join("; ")}${failed.length > 5 ? "…" : ""}`,
            }
          : { tone: "success", text: `${sent} carta(s) enviada(s). Nenhuma doação pendente neste período.` },
      );
    } catch (error) {
      setPendingMessage({
        tone: "error",
        text: `${sent} carta(s) enviada(s) antes do erro: ${error instanceof Error ? error.message : "falha"}. Verifique de novo para continuar de onde parou.`,
      });
    } finally {
      setProgress(null);
      setPendingArmed(false);
      setBusy(null);
      await checkPending();
    }
  }

  function armSend(rowId: string) {
    setArmed(rowId);
    setIncludeSupport(false);
    setSupportNote("");
    setMessage(null);
  }

  async function send(row: LetterSaleRow) {
    const note = row.letterSentAt && includeSupport ? supportNote.trim() : "";
    if (row.letterSentAt && includeSupport && !note) {
      setMessage({ tone: "error", text: "Escreva a mensagem de suporte ou desmarque a opção." });
      return;
    }
    setBusy(row.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/tax-letters/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note ? { supportNote: note } : {}),
      });
      const data = (await response.json().catch(() => ({}))) as { to?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      setArmed(null);
      setIncludeSupport(false);
      setSupportNote("");
      setMessage({
        tone: "success",
        text: note
          ? `Carta enviada para ${data.to ?? row.customerEmail}, com a mensagem de suporte.`
          : `Carta enviada para ${data.to ?? row.customerEmail}.`,
      });
      await search();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível enviar a carta." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="letter-tool" id="letters">
      <div className="letter-pending">
        <div className="letter-pending-head">
          <strong>Testar o envio</strong>
          <small>
            Manda para o e-mail abaixo uma carta com dados de exemplo, carimbada como amostra. Não usa nenhuma doação
            e não fica registrada. Serve para ver como o doador recebe.
          </small>
        </div>
        <form
          className="letter-pending-controls"
          onSubmit={(event) => {
            event.preventDefault();
            void sendTest();
          }}
        >
          <label className="letter-test-email">
            <span>Seu e-mail</span>
            <input
              className="admin-input"
              type="email"
              required
              value={testEmail}
              placeholder="voce@exemplo.com"
              autoComplete="email"
              onChange={(event) => setTestEmail(event.target.value)}
            />
          </label>
          <button type="submit" className="secondary-button" disabled={busy !== null}>
            <Send size={15} aria-hidden />
            {busy === "test" ? "Enviando…" : "Enviar carta de teste"}
          </button>
        </form>
        {testMessage ? <AdminFormMessage tone={testMessage.tone}>{testMessage.text}</AdminFormMessage> : null}
      </div>

      <div className="letter-pending">
        <div className="letter-pending-head">
          <strong>Cópias das cartas enviadas</strong>
          <small>
            Cada carta que saiu por e-mail fica guardada aqui, no mês em que foi enviada. Baixe o mês, todas de uma vez,
            ou uma carta só. Cancelar avisa o doador e tira essa carta do relatório para o IRS; o arquivo continua
            disponível. A carta de teste não entra.
          </small>
        </div>
        {archiveMessage ? <AdminFormMessage tone={archiveMessage.tone}>{archiveMessage.text}</AdminFormMessage> : null}
        {!archive ? <p className="dash-empty">Carregando as cartas…</p> : null}
        {archive && !archive.ready ? (
          <p className="dash-empty">As cópias passam a ser guardadas depois que esta versão for publicada no servidor.</p>
        ) : null}
        {archive?.ready && archive.unstored > 0 ? (
          <p className="letter-pending-summary">Guardando {archive.unstored} carta(s) que já tinham sido enviadas…</p>
        ) : null}
        {archive?.ready && !archive.months.length && archive.unstored === 0 ? (
          <p className="dash-empty">Nenhuma carta enviada ainda. As próximas ficam guardadas aqui.</p>
        ) : null}
        {archive?.ready && archive.months.length ? (
          <>
            <div className="letter-actions">
              <button
                type="button"
                className="primary-button"
                disabled={busy !== null || filing}
                onClick={() => void downloadZip("all")}
              >
                <Download size={15} aria-hidden />
                {busy === "zip:all" ? "Baixando…" : "Baixar todas (.zip)"}
              </button>
            </div>
            <div className="letter-archive">
              {archive.months.map((month) => (
                <section className="letter-month" key={month.month}>
                  <div className="letter-month-head">
                    <div className="letter-main">
                      <strong>{month.label}</strong>
                      <small>
                        {month.copies} carta{month.copies === 1 ? "" : "s"}
                        {month.reportableCount
                          ? ` · ${month.reportableCount} de ${automaticLabel} ou mais (${formatMoneyExact(month.reportableCents, "USD")})`
                          : ""}
                        {month.unstored ? ` · ${month.unstored} ainda sendo guardada(s)` : ""}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy !== null || filing || month.copies === 0}
                      onClick={() => void downloadZip(month.month)}
                    >
                      <Download size={15} aria-hidden />
                      {busy === `zip:${month.month}` ? "Baixando…" : "Baixar mês (.zip)"}
                    </button>
                  </div>
                  {month.letters.length ? (
                    <ul className="letter-list">
                      {month.letters.map((letter) => (
                        <li className="letter-copy-row" key={letter.id}>
                          <div className="letter-main">
                            <strong>{letter.donorName || "Anonymous"}</strong>
                            <small>
                              {shortDay(letter.sentAt)}
                              {letter.reference ? ` · ${letter.reference}` : ""}
                            </small>
                          </div>
                          <div className="letter-state">
                            <b>{formatMoneyExact(letter.amountCents, letter.currency)}</b>
                            {letter.voidedAt ? (
                              <AdminChip tone="warning">cancelada {formatRelativeTime(letter.voidedAt)}</AdminChip>
                            ) : letter.amountCents >= DONATION_LETTER.automaticFromCents ? (
                              <AdminChip tone="success">IRS</AdminChip>
                            ) : null}
                          </div>
                          <div className="letter-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={busy !== null}
                              onClick={() => void downloadCopy(letter.id)}
                            >
                              <Download size={15} aria-hidden />
                              {busy === letter.id ? "Baixando…" : "Baixar"}
                            </button>
                            {letter.voidedAt ? null : cancelArmed === letter.id ? (
                              <button
                                type="button"
                                className="primary-button"
                                disabled={busy !== null}
                                onClick={() => void cancelCopy(letter.id)}
                              >
                                <Ban size={15} aria-hidden />
                                {busy === letter.id ? "Cancelando…" : "Confirmar cancelamento"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={busy !== null}
                                onClick={() => setCancelArmed(letter.id)}
                              >
                                <Ban size={15} aria-hidden />
                                Cancelar carta
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="letter-pending">
        <div className="letter-pending-head">
          <strong>Doações antigas sem carta</strong>
          <small>
            Doações de {automaticLabel} ou mais pagas antes de a carta existir. Confira a lista e envie de uma vez; cada
            doador recebe um e-mail com a carta em PDF. Quem já recebeu não entra de novo.
          </small>
        </div>
        <div className="letter-pending-controls">
          <label>
            <span>Pagas desde</span>
            <input
              className="admin-input"
              type="date"
              value={since}
              onChange={(event) => {
                setSince(event.target.value);
                setPending(null);
              }}
            />
          </label>
          <button type="button" className="secondary-button" disabled={busy !== null || !since} onClick={() => void checkPending()}>
            {busy === "pending" ? "Verificando…" : "Verificar"}
          </button>
          {pending?.count ? (
            pendingArmed ? (
              <button type="button" className="primary-button" disabled={busy !== null} onClick={() => void sendPending()}>
                <Send size={15} aria-hidden />
                {progress
                  ? `Enviando ${progress.sent} de ${progress.total}…`
                  : `Confirmar: enviar ${pending.count} e-mail${pending.count === 1 ? "" : "s"} agora`}
              </button>
            ) : (
              <button type="button" className="primary-button" disabled={busy !== null} onClick={() => setPendingArmed(true)}>
                <Send size={15} aria-hidden />
                Enviar {pending.count} carta{pending.count === 1 ? "" : "s"}
              </button>
            )
          ) : null}
        </div>
        {pendingMessage ? <AdminFormMessage tone={pendingMessage.tone}>{pendingMessage.text}</AdminFormMessage> : null}
        {pending ? (
          pending.count ? (
            <>
              <p className="letter-pending-summary">
                <b>{pending.count}</b> doaç{pending.count === 1 ? "ão" : "ões"} sem carta, somando{" "}
                <b>{formatMoneyExact(pending.totalCents, pending.rows[0]?.currency ?? "USD")}</b>.
                {pending.count > pending.rows.length ? ` Mostrando as ${pending.rows.length} mais antigas.` : ""}
              </p>
              <div className="admin-table-wrap letter-pending-table">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Doador</th>
                      <th>E-mail</th>
                      <th>Código</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.rows.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Data">{shortDay(row.paidAt)}</td>
                        <td data-label="Doador">{row.customerName || "Anonymous"}</td>
                        <td data-label="E-mail">{row.customerEmail}</td>
                        <td data-label="Código">{row.trackingCode ?? "—"}</td>
                        <td data-label="Valor" className="admin-metric">
                          {formatMoneyExact(row.amount, row.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="dash-empty">Nenhuma doação de {automaticLabel} ou mais sem carta desde essa data.</p>
          )
        ) : null}
      </div>

      <div className="letter-pending-head">
        <strong>Buscar uma doação</strong>
        <small>Para valores menores (a pedido do doador) ou para reenviar uma carta.</small>
      </div>

      <form
        className="letter-search"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <label className="sr-only" htmlFor="letter-query">
          E-mail, nome do doador ou código da doação
        </label>
        <input
          id="letter-query"
          className="admin-input"
          value={query}
          placeholder="E-mail, nome do doador ou código da doação"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="primary-button" disabled={busy !== null}>
          <Search size={15} aria-hidden />
          {busy === "search" ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {message ? <AdminFormMessage tone={message.tone}>{message.text}</AdminFormMessage> : null}

      {rows && !rows.length ? <p className="dash-empty">Nenhuma doação paga encontrada para essa busca.</p> : null}

      {rows?.length ? (
        <ul className="letter-list">
          {rows.map((row) => {
            const net = row.amount - row.amountRefunded;
            const refunded = row.status === "REFUNDED";
            const disputed = row.status === "DISPUTED";
            return (
              <li key={row.id}>
                <div className="letter-main">
                  <strong>{row.customerName || "Anonymous"}</strong>
                  <small>
                    {row.customerEmail ?? "sem e-mail"}
                    {row.trackingCode ? `, ${row.trackingCode}` : ""}
                  </small>
                  <small>
                    {row.campaignTitle}
                    {row.paidAt ? `, ${formatRelativeTime(row.paidAt)}` : ""}
                  </small>
                </div>
                <div className="letter-state">
                  <b>{formatMoneyExact(net, row.currency)}</b>
                  {refunded ? (
                    <AdminChip tone="danger">reembolsada</AdminChip>
                  ) : disputed ? (
                    <AdminChip tone="danger">em disputa</AdminChip>
                  ) : row.amountRefunded > 0 ? (
                    <AdminChip tone="warning">reembolso parcial</AdminChip>
                  ) : null}
                  {row.letterVoidedAt ? (
                    <AdminChip tone="warning" title="O doador foi avisado por e-mail que a carta perdeu a validade">
                      carta cancelada {formatRelativeTime(row.letterVoidedAt)}
                    </AdminChip>
                  ) : row.letterSentAt ? (
                    <AdminChip tone="success">carta enviada {formatRelativeTime(row.letterSentAt)}</AdminChip>
                  ) : (
                    <AdminChip tone="neutral">sem carta</AdminChip>
                  )}
                </div>
                <div className="letter-actions">
                  {row.canIssue ? (
                    <>
                      <a
                        className="secondary-button"
                        href={`/api/admin/tax-letters/${row.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText size={15} aria-hidden />
                        Ver PDF
                      </a>
                      {row.letterCopyId ? (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={busy !== null}
                          onClick={() => void downloadCopy(row.letterCopyId!)}
                        >
                          <Download size={15} aria-hidden />
                          Baixar
                        </button>
                      ) : null}
                      {row.letterCopyId && !row.letterVoidedAt ? (
                        cancelArmed === row.letterCopyId ? (
                          <button
                            type="button"
                            className="primary-button"
                            disabled={busy !== null}
                            onClick={() => void cancelCopy(row.letterCopyId!)}
                          >
                            <Ban size={15} aria-hidden />
                            {busy === row.letterCopyId ? "Cancelando…" : "Confirmar cancelamento"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={busy !== null}
                            onClick={() => setCancelArmed(row.letterCopyId)}
                          >
                            <Ban size={15} aria-hidden />
                            Cancelar carta
                          </button>
                        )
                      ) : null}
                      {armed === row.id ? (
                        <button
                          type="button"
                          className="primary-button"
                          disabled={
                            busy !== null ||
                            !row.customerEmail ||
                            Boolean(row.letterSentAt && includeSupport && !supportNote.trim())
                          }
                          onClick={() => void send(row)}
                        >
                          <Send size={15} aria-hidden />
                          {busy === row.id ? "Enviando…" : `Confirmar envio para ${row.customerEmail}`}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={busy !== null || !row.customerEmail}
                          onClick={() => armSend(row.id)}
                        >
                          <Send size={15} aria-hidden />
                          {row.letterSentAt ? "Reenviar carta" : "Enviar carta"}
                        </button>
                      )}
                    </>
                  ) : (
                    <small className="admin-help">
                      {refunded
                        ? "Doação reembolsada: não há carta a emitir."
                        : disputed
                          ? "Doação em disputa no banco: sem carta enquanto não for resolvida."
                          : "Sem carta para esta moeda."}
                    </small>
                  )}
                </div>
                {armed === row.id && row.letterSentAt ? (
                  <div className="letter-resend-note">
                    <label className="letter-resend-toggle">
                      <input
                        type="checkbox"
                        checked={includeSupport}
                        onChange={(event) => {
                          setIncludeSupport(event.target.checked);
                          if (!event.target.checked) setSupportNote("");
                        }}
                      />
                      Enviar uma mensagem de suporte junto
                    </label>
                    {includeSupport ? (
                      <textarea
                        className="admin-textarea"
                        rows={4}
                        maxLength={2000}
                        value={supportNote}
                        placeholder="Escreva a mensagem que o doador vai ler neste e-mail, junto com a carta."
                        aria-label="Mensagem de suporte"
                        onChange={(event) => setSupportNote(event.target.value)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
