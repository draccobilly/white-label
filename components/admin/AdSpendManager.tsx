"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AdminFormMessage } from "@/components/admin/AdminFormMessage";
import { AD_SPEND_SOURCES, parseMoneyToCents, parseSpendLines } from "@/lib/ad-spend";
import type { SpendRow } from "@/lib/analytics";
import { reportingIsoDate } from "@/lib/date-range";
import { formatMoney } from "@/lib/utils";

type Option = { id: string; label: string; slug: string };

function sameSlug(value: string | undefined, option: Option) {
  if (!value) return false;
  const needle = value.toLowerCase();
  return option.slug.toLowerCase() === needle || option.label.toLowerCase() === needle;
}

/**
 * Ledger of what was spent on ads, typed by the owner. Feeds CPA, ROAS and
 * ROI in Analytics. Entries are per day, optionally tied to a campaign and
 * an affiliate so the per-product tables can split them.
 */
export function AdSpendManager({
  from,
  to,
  currency,
  campaigns,
  affiliates,
  rows,
  ready,
}: {
  from: string;
  to: string;
  currency: string;
  campaigns: Option[];
  affiliates: Option[];
  rows: SpendRow[];
  /** False while the AdSpend table does not exist yet. */
  ready: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [day, setDay] = useState(reportingIsoDate());
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<string>(AD_SPEND_SOURCES[0]);
  const [campaignId, setCampaignId] = useState("");
  const [affiliateId, setAffiliateId] = useState("");
  const [note, setNote] = useState("");
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const campaignById = useMemo(() => new Map(campaigns.map((item) => [item.id, item])), [campaigns]);
  const affiliateById = useMemo(() => new Map(affiliates.map((item) => [item.id, item])), [affiliates]);
  const parsedBulk = useMemo(() => (bulk ? parseSpendLines(bulkText) : []), [bulk, bulkText]);
  const bulkErrors = parsedBulk.filter((line) => !line.ok);
  const bulkRows = parsedBulk.filter((line) => line.ok);

  async function post(entries: Array<Record<string, unknown>>) {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/ad-spend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: entries }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; created?: number };
    setBusy(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: data.error ?? "Não foi possível salvar." });
      return false;
    }
    setMessage({ tone: "success", text: `${data.created ?? entries.length} lançamento(s) salvo(s).` });
    startTransition(() => router.refresh());
    return true;
  }

  async function submitOne() {
    const cents = parseMoneyToCents(amount);
    if (cents === null) {
      setMessage({ tone: "error", text: "Informe o valor gasto, por exemplo 120,50." });
      return;
    }
    const ok = await post([
      {
        day,
        amount: cents,
        source: source.trim() || "Meta",
        currency,
        campaignId: campaignId || null,
        affiliateId: affiliateId || null,
        note: note.trim() || null,
      },
    ]);
    if (ok) {
      setAmount("");
      setNote("");
    }
  }

  async function submitBulk() {
    if (!bulkRows.length) {
      setMessage({ tone: "error", text: "Nenhuma linha válida para lançar." });
      return;
    }
    const entries = bulkRows.map((line) => {
      if (!line.ok) throw new Error("unreachable");
      const campaign = campaigns.find((item) => sameSlug(line.campaign, item));
      const affiliate = affiliates.find((item) => sameSlug(line.affiliate, item));
      return {
        day: line.day,
        amount: line.amount,
        source: line.source,
        currency,
        campaignId: campaign?.id ?? null,
        affiliateId: affiliate?.id ?? null,
        note: line.note ?? null,
      };
    });
    const ok = await post(entries);
    if (ok) setBulkText("");
  }

  async function remove(id: string) {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/admin/ad-spend/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: "Não foi possível apagar o lançamento." });
      return;
    }
    startTransition(() => router.refresh());
  }

  const visibleRows = showAll ? rows : rows.slice(0, 12);

  return (
    <div className="spend-manager" id="spend">
      <div className="spend-head">
        <div>
          <h2>Investimento em anúncios</h2>
          <p>
            {from === to ? from : `${from} – ${to}`}: <strong>{formatMoney(total, currency)}</strong> em{" "}
            {rows.length} lançamento{rows.length === 1 ? "" : "s"}. Opcional: com o gasto lançado aparecem CPA, ROAS
            e ROI.
          </p>
        </div>
        <div className="dash-seg" role="group" aria-label="Modo de lançamento">
          <button type="button" className={bulk ? undefined : "is-active"} onClick={() => setBulk(false)}>
            Um por vez
          </button>
          <button type="button" className={bulk ? "is-active" : undefined} onClick={() => setBulk(true)}>
            Colar vários
          </button>
        </div>
      </div>

      {!ready ? (
        <AdminFormMessage tone="info">
          A tabela de investimento ainda não existe neste banco. Aplique a migration{" "}
          <code>20261002100000_request_status_ad_spend_site_check</code> antes de lançar.
        </AdminFormMessage>
      ) : null}

      {bulk ? (
        <div className="spend-form">
          <label className="spend-bulk">
            <span>Uma linha por dia: data, valor, fonte, campanha (slug), afiliado (slug)</span>
            <textarea
              className="admin-textarea"
              rows={6}
              value={bulkText}
              placeholder={"2026-10-01 120,50 Meta help-maria-recover direct-team\n02/10/2026 98 Google"}
              onChange={(event) => setBulkText(event.target.value)}
            />
          </label>
          <div className="admin-inline-actions">
            <button
              type="button"
              className="primary-button"
              disabled={busy || !ready || !bulkRows.length}
              onClick={() => void submitBulk()}
            >
              {busy ? "Salvando…" : `Lançar ${bulkRows.length} linha${bulkRows.length === 1 ? "" : "s"}`}
            </button>
            {bulkErrors.length ? (
              <AdminFormMessage tone="error">
                {bulkErrors.length} linha{bulkErrors.length === 1 ? "" : "s"} ignorada
                {bulkErrors.length === 1 ? "" : "s"}: {bulkErrors.map((line) => (line.ok ? "" : `"${line.line}" (${line.reason})`)).join("; ")}
              </AdminFormMessage>
            ) : null}
          </div>
        </div>
      ) : (
        <form
          className="spend-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitOne();
          }}
        >
          <div className="spend-grid">
            <label>
              <span>Dia</span>
              <input
                className="admin-input"
                type="date"
                value={day}
                max={reportingIsoDate()}
                onChange={(event) => setDay(event.target.value)}
                required
              />
            </label>
            <label>
              <span>Valor ({currency})</span>
              <input
                className="admin-input"
                inputMode="decimal"
                placeholder="120,50"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>
            <label>
              <span>Fonte</span>
              <input
                className="admin-input"
                list="ad-spend-sources"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                required
              />
              <datalist id="ad-spend-sources">
                {AD_SPEND_SOURCES.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label>
              <span>Campanha</span>
              <select className="admin-select" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
                <option value="">Toda a operação</option>
                {campaigns.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Afiliado</span>
              <select className="admin-select" value={affiliateId} onChange={(event) => setAffiliateId(event.target.value)}>
                <option value="">Qualquer</option>
                {affiliates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Nota</span>
              <input
                className="admin-input"
                value={note}
                maxLength={300}
                placeholder="conjunto, criativo…"
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>
          <div className="admin-inline-actions">
            <button type="submit" className="primary-button" disabled={busy || !ready}>
              {busy ? "Salvando…" : "Lançar"}
            </button>
            {message ? <AdminFormMessage tone={message.tone}>{message.text}</AdminFormMessage> : null}
          </div>
        </form>
      )}
      {bulk && message ? <AdminFormMessage tone={message.tone}>{message.text}</AdminFormMessage> : null}

      {rows.length ? (
        <div className="admin-table-wrap spend-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Fonte</th>
                <th>Campanha</th>
                <th>Afiliado</th>
                <th>Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Dia">{row.day}</td>
                  <td data-label="Fonte">
                    {row.source}
                    {row.note ? <small className="spend-note"> {row.note}</small> : null}
                  </td>
                  <td data-label="Campanha">
                    {row.campaignId ? (campaignById.get(row.campaignId)?.label ?? "Campanha removida") : "Toda a operação"}
                  </td>
                  <td data-label="Afiliado">
                    {row.affiliateId ? (affiliateById.get(row.affiliateId)?.label ?? "Removido") : "—"}
                  </td>
                  <td data-label="Valor" className="admin-metric">
                    {formatMoney(row.amount, row.currency)}
                  </td>
                  <td data-label="">
                    <button
                      type="button"
                      className="admin-icon-button is-small"
                      aria-label="Apagar lançamento"
                      disabled={busy}
                      onClick={() => void remove(row.id)}
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > visibleRows.length ? (
            <button type="button" className="dash-text-link spend-more" onClick={() => setShowAll(true)}>
              Ver todos os {rows.length} lançamentos
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
