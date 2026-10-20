"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Pencil,
  Trash2,
  Vault,
} from "lucide-react";
import { AdminChip } from "@/components/admin/AdminChip";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminFormMessage } from "@/components/admin/AdminFormMessage";
import type { VaultItemSummary } from "@/lib/vault";

const REVEAL_WINDOW_MS = 45_000;

type Revealed = { value: string; expiresAt: number };

type Draft = {
  category: string;
  label: string;
  value: string;
  notes: string;
};

const EMPTY_DRAFT: Draft = { category: "", label: "", value: "", notes: "" };

function categoryKey(value: string) {
  return value.trim().toLowerCase();
}

function formatWhen(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function readJson(response: Response) {
  const raw = await response.text();
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function VaultManager({
  initialItems,
  unlocked,
  lockReason,
}: {
  initialItems: VaultItemSummary[];
  unlocked: boolean;
  lockReason: "missing" | "invalid" | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(
    null,
  );
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState<Record<string, Revealed>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, number>>({});

  // Revealed values never outlive the component or their window.
  useEffect(() => {
    const current = timers.current;
    return () => {
      Object.values(current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const item of items) {
      const key = categoryKey(item.category);
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { label: item.category, count: 1 });
    }
    return [...map.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && categoryKey(item.category) !== filter) return false;
      if (!term) return true;
      return (
        item.label.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        (item.notes ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, filter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: VaultItemSummary[] }>();
    for (const item of visible) {
      const key = categoryKey(item.category);
      const group = map.get(key) ?? { label: item.category, items: [] };
      group.items.push(item);
      map.set(key, group);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [visible]);

  function hide(id: string) {
    window.clearTimeout(timers.current[id]);
    delete timers.current[id];
    setRevealed((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!unlocked || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: draft.category,
          label: draft.label,
          value: draft.value,
          notes: draft.notes,
        }),
      });
      const result = (await readJson(response)) as { item?: VaultItemSummary; error?: string };
      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Unable to store the item");
      }
      const item = result.item;
      setItems((current) => [...current, item]);
      setDraft((current) => ({ ...EMPTY_DRAFT, category: current.category }));
      setShowValue(false);
      setMessage({ tone: "success", text: `“${item.label}” guardado em ${item.category}.` });
    } catch (cause) {
      setMessage({
        tone: "error",
        text: cause instanceof Error ? cause.message : "Unable to store the item",
      });
    } finally {
      setSaving(false);
    }
  }

  async function reveal(item: VaultItemSummary) {
    if (!unlocked || busyId) return;
    setBusyId(item.id);
    setRowMessage((current) => ({ ...current, [item.id]: "" }));
    try {
      const response = await fetch(`/api/admin/vault/${item.id}/reveal`, { method: "POST" });
      const result = (await readJson(response)) as {
        value?: string;
        revealedAt?: string;
        error?: string;
      };
      if (!response.ok || typeof result.value !== "string") {
        throw new Error(result.error ?? "Unable to reveal the item");
      }
      const value = result.value;
      const expiresAt = Date.now() + REVEAL_WINDOW_MS;
      setRevealed((current) => ({ ...current, [item.id]: { value, expiresAt } }));
      window.clearTimeout(timers.current[item.id]);
      timers.current[item.id] = window.setTimeout(() => hide(item.id), REVEAL_WINDOW_MS);
      const revealedAt = result.revealedAt ?? new Date().toISOString();
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, lastRevealedAt: revealedAt } : row)),
      );
    } catch (cause) {
      setRowMessage((current) => ({
        ...current,
        [item.id]: cause instanceof Error ? cause.message : "Unable to reveal the item",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function copy(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1400);
    } catch {
      setRowMessage((current) => ({ ...current, [id]: "Clipboard unavailable — copy from the box." }));
    }
  }

  function startEdit(item: VaultItemSummary) {
    setEditingId(item.id);
    setEditDraft({
      category: item.category,
      label: item.label,
      value: "",
      notes: item.notes ?? "",
    });
    setRowMessage((current) => ({ ...current, [item.id]: "" }));
  }

  async function saveEdit(item: VaultItemSummary) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      const payload: Record<string, string> = {
        category: editDraft.category,
        label: editDraft.label,
        notes: editDraft.notes,
      };
      if (editDraft.value) payload.value = editDraft.value;
      const response = await fetch(`/api/admin/vault/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await readJson(response)) as { item?: VaultItemSummary; error?: string };
      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Unable to update the item");
      }
      const updated = result.item;
      setItems((current) => current.map((row) => (row.id === item.id ? updated : row)));
      if (editDraft.value) hide(item.id);
      setEditingId(null);
      setEditDraft(EMPTY_DRAFT);
      setRowMessage((current) => ({ ...current, [item.id]: "Saved." }));
    } catch (cause) {
      setRowMessage((current) => ({
        ...current,
        [item.id]: cause instanceof Error ? cause.message : "Unable to update the item",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: VaultItemSummary) {
    if (busyId) return;
    if (
      !window.confirm(
        `Apagar “${item.label}” (${item.category})?\n\nO valor cifrado é removido e não pode ser recuperado.`,
      )
    ) {
      return;
    }
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/admin/vault/${item.id}`, { method: "DELETE" });
      const result = (await readJson(response)) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to delete the item");
      hide(item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      if (editingId === item.id) setEditingId(null);
    } catch (cause) {
      setRowMessage((current) => ({
        ...current,
        [item.id]: cause instanceof Error ? cause.message : "Unable to delete the item",
      }));
    } finally {
      setBusyId(null);
    }
  }

  const lockedCopy =
    lockReason === "invalid"
      ? "VAULT_ENCRYPTION_KEY existe, mas não é uma chave de 32 bytes em base64 ou hex."
      : "A variável VAULT_ENCRYPTION_KEY não está definida neste servidor.";

  return (
    <div className="vault-layout">
      <div>
        {!unlocked ? (
          <div className="vault-locked" role="status">
            <div className="vault-locked-head">
              <span>
                <LockKeyhole size={18} aria-hidden />
              </span>
              <h2>Cofre trancado</h2>
            </div>
            <p>{lockedCopy}</p>
            <p>
              Gere uma chave de 32 bytes (por exemplo{" "}
              <code>openssl rand -base64 32</code>), grave em <code>.env</code> como{" "}
              <code>VAULT_ENCRYPTION_KEY</code> e reinicie o app. Enquanto a chave não
              existir, nada é gravado — nem em texto puro.
            </p>
            {items.length ? (
              <p>
                {items.length} {items.length === 1 ? "item continua" : "itens continuam"} guardado
                {items.length === 1 ? "" : "s"} cifrado{items.length === 1 ? "" : "s"}; revelar
                volta a funcionar com a mesma chave usada ao gravar.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="vault-filters">
          <div className="dash-chips" role="group" aria-label="Categoria">
            <button
              type="button"
              className={filter === "all" ? "is-active" : undefined}
              onClick={() => setFilter("all")}
            >
              Todas · {items.length}
            </button>
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                className={filter === category.key ? "is-active" : undefined}
                onClick={() => setFilter(category.key)}
              >
                {category.label} · {category.count}
              </button>
            ))}
          </div>
          <label className="dash-search">
            <span className="sr-only">Buscar no cofre</span>
            <input
              type="search"
              value={search}
              placeholder="Buscar rótulo, categoria ou nota"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        {grouped.length ? (
          grouped.map((group) => (
            <section key={group.label} className="vault-group">
              <header className="vault-group-head">
                <h3>{group.label}</h3>
                <span>
                  {group.items.length} {group.items.length === 1 ? "item" : "itens"}
                </span>
              </header>
              {group.items.map((item) => {
                const open = revealed[item.id];
                const editing = editingId === item.id;
                const note = rowMessage[item.id];
                const lastRevealed = formatWhen(item.lastRevealedAt);
                return (
                  <article key={item.id} className="vault-item">
                    <div className="vault-item-row">
                      <div className="vault-item-copy">
                        <strong>{item.label}</strong>
                        <small>
                          <span className="vault-preview">{item.preview}</span>
                          {" · "}
                          atualizado {formatWhen(item.updatedAt)}
                          {lastRevealed ? ` · revelado ${lastRevealed}` : ""}
                        </small>
                      </div>
                      <div className="vault-item-actions">
                        {open ? (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => hide(item.id)}
                          >
                            <EyeOff size={14} aria-hidden />
                            Ocultar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="primary-button"
                            disabled={!unlocked || busyId === item.id}
                            title={!unlocked ? "Cofre trancado" : undefined}
                            onClick={() => void reveal(item)}
                          >
                            <Eye size={14} aria-hidden />
                            {busyId === item.id ? "Abrindo…" : "Revelar"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={busyId === item.id}
                          onClick={() => (editing ? setEditingId(null) : startEdit(item))}
                        >
                          <Pencil size={14} aria-hidden />
                          {editing ? "Cancelar" : "Editar"}
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          disabled={busyId === item.id}
                          onClick={() => void remove(item)}
                        >
                          <Trash2 size={14} aria-hidden />
                          Apagar
                        </button>
                      </div>
                    </div>
                    {item.notes ? <p className="vault-item-notes">{item.notes}</p> : null}
                    {open ? (
                      <div className="vault-reveal" role="region" aria-label={`${item.label} revelado`}>
                        <code>{open.value}</code>
                        <div className="vault-reveal-actions">
                          <button type="button" onClick={() => void copy(item.id, open.value)}>
                            {copiedId === item.id ? (
                              <Check size={14} aria-hidden />
                            ) : (
                              <Copy size={14} aria-hidden />
                            )}
                            {copiedId === item.id ? "Copiado" : "Copiar"}
                          </button>
                          <button type="button" onClick={() => hide(item.id)}>
                            <EyeOff size={14} aria-hidden />
                            Ocultar
                          </button>
                        </div>
                        <small>Some da tela em {Math.round(REVEAL_WINDOW_MS / 1000)}s ou ao ocultar.</small>
                      </div>
                    ) : null}
                    {editing ? (
                      <form
                        className="vault-inline-edit"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveEdit(item);
                        }}
                      >
                        <div className="studio-grid-2">
                          <label>
                            Categoria
                            <input
                              className="admin-input"
                              list="vault-categories"
                              required
                              maxLength={60}
                              value={editDraft.category}
                              onChange={(event) =>
                                setEditDraft((current) => ({ ...current, category: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            Rótulo
                            <input
                              className="admin-input"
                              required
                              maxLength={120}
                              value={editDraft.label}
                              onChange={(event) =>
                                setEditDraft((current) => ({ ...current, label: event.target.value }))
                              }
                            />
                          </label>
                        </div>
                        <label>
                          Novo valor (opcional)
                          <input
                            className="admin-input"
                            type="password"
                            autoComplete="off"
                            disabled={!unlocked}
                            placeholder={unlocked ? "Deixe vazio para manter o valor atual" : "Cofre trancado"}
                            value={editDraft.value}
                            onChange={(event) =>
                              setEditDraft((current) => ({ ...current, value: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Notas
                          <textarea
                            className="admin-textarea"
                            style={{ minHeight: 72 }}
                            maxLength={2000}
                            value={editDraft.notes}
                            onChange={(event) =>
                              setEditDraft((current) => ({ ...current, notes: event.target.value }))
                            }
                          />
                        </label>
                        <div className="admin-inline-actions">
                          <button type="submit" className="primary-button" disabled={busyId === item.id}>
                            {busyId === item.id ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setEditingId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {note ? (
                      <AdminFormMessage tone={note === "Saved." ? "success" : "error"}>
                        {note}
                      </AdminFormMessage>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ))
        ) : (
          <div className="admin-list">
            <AdminEmptyState
              icon={<Vault size={20} />}
              title={items.length ? "Nada com esse filtro" : "O cofre está vazio"}
              body={
                items.length
                  ? "Limpe a busca ou escolha outra categoria."
                  : unlocked
                    ? "Guarde a primeira credencial pelo formulário ao lado. Cada item pede uma categoria — gateway, e-mail, domínio, o que fizer sentido para a operação."
                    : "Defina VAULT_ENCRYPTION_KEY para começar a guardar credenciais."
              }
            />
          </div>
        )}
      </div>

      <section className="admin-card vault-form-card" aria-labelledby="vault-form-title">
        <div className="admin-card-head">
          <h2 id="vault-form-title">
            <KeyRound size={16} aria-hidden style={{ verticalAlign: "-3px", marginRight: 8 }} />
            Guardar credencial
          </h2>
        </div>
        <form className="admin-form" onSubmit={(event) => void create(event)}>
          <label>
            Categoria
            <input
              className="admin-input"
              list="vault-categories"
              required
              maxLength={60}
              disabled={!unlocked}
              placeholder="gateway, e-mail, domínio…"
              value={draft.category}
              onChange={(event) =>
                setDraft((current) => ({ ...current, category: event.target.value }))
              }
            />
            <span className="admin-field-hint">
              Obrigatória. Escreva a sua; as já usadas aparecem como sugestão.
            </span>
          </label>
          <datalist id="vault-categories">
            {categories.map((category) => (
              <option key={category.key} value={category.label} />
            ))}
          </datalist>
          <label>
            Rótulo
            <input
              className="admin-input"
              required
              maxLength={120}
              disabled={!unlocked}
              placeholder="Stripe · chave restrita de leitura"
              value={draft.label}
              onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
            />
          </label>
          <label>
            Valor
            <div className="admin-media-row">
              <input
                className="admin-input"
                type={showValue ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                required
                maxLength={10000}
                disabled={!unlocked}
                placeholder={unlocked ? "Cole o segredo" : "Cofre trancado"}
                value={draft.value}
                onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
              />
              <button
                type="button"
                className="admin-ghost-btn"
                style={{ minHeight: 44, padding: "0 12px", borderRadius: 12 }}
                disabled={!unlocked}
                aria-pressed={showValue}
                onClick={() => setShowValue((current) => !current)}
              >
                {showValue ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
                {showValue ? "Esconder" : "Mostrar"}
              </button>
            </div>
            <span className="admin-field-hint">
              Cifrado com AES-256-GCM antes de ir ao banco. A listagem mostra só uma prévia mascarada.
            </span>
          </label>
          <label>
            Notas (opcional)
            <textarea
              className="admin-textarea"
              style={{ minHeight: 80 }}
              maxLength={2000}
              disabled={!unlocked}
              placeholder="Onde é usado, quem pediu, data de troca…"
              value={draft.notes}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          <button type="submit" className="primary-button" disabled={!unlocked || saving}>
            {saving ? "Guardando…" : "Guardar no cofre"}
          </button>
          {message ? <AdminFormMessage tone={message.tone}>{message.text}</AdminFormMessage> : null}
        </form>
      </section>
    </div>
  );
}
