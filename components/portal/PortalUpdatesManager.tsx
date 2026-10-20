"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PortalStrings } from "@/lib/portal-copy";

type Copy = Pick<
  PortalStrings,
  | "updateTitle"
  | "updateBody"
  | "postUpdate"
  | "posting"
  | "updatePosted"
  | "deleteUpdate"
  | "editUpdate"
  | "saveUpdate"
  | "cancel"
  | "noUpdates"
  | "confirmDelete"
  | "genericError"
>;

export type PortalUpdate = { id: string; title: string | null; body: string; createdAt: string };

export function PortalUpdatesManager({
  campaignId,
  updates,
  copy,
  locale,
}: {
  campaignId: string;
  updates: PortalUpdate[];
  copy: Copy;
  locale: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string; body: string } | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function send(path: string, method: string, payload?: unknown) {
    const response = await fetch(path, {
      method,
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? copy.genericError);
    }
  }

  async function post(event: React.FormEvent) {
    event.preventDefault();
    setBusy("new");
    setMessage(null);
    try {
      await send(`/api/portal/campaigns/${campaignId}/updates`, "POST", { title, body });
      setTitle("");
      setBody("");
      setMessage({ tone: "success", text: copy.updatePosted });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : copy.genericError });
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(editing.id);
    setMessage(null);
    try {
      await send(`/api/portal/campaigns/${campaignId}/updates/${editing.id}`, "PATCH", {
        title: editing.title,
        body: editing.body,
      });
      setEditing(null);
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : copy.genericError });
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(copy.confirmDelete)) return;
    setBusy(id);
    setMessage(null);
    try {
      await send(`/api/portal/campaigns/${campaignId}/updates/${id}`, "DELETE");
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : copy.genericError });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="portal-updates">
      <form className="inst-form inst-form-wide portal-form" onSubmit={(event) => void post(event)}>
        <label>
          {copy.updateTitle}
          <input className="admin-input" maxLength={255} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          {copy.updateBody}
          <textarea
            className="admin-textarea"
            required
            minLength={1}
            maxLength={10_000}
            rows={6}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        {message ? <p className={message.tone === "success" ? "inst-form-thanks" : "form-message"}>{message.text}</p> : null}
        <div className="start-actions">
          <span />
          <button className="primary-button" type="submit" disabled={busy !== null || !body.trim()}>
            {busy === "new" ? copy.posting : copy.postUpdate}
          </button>
        </div>
      </form>

      {updates.length ? (
        <ul className="portal-update-list">
          {updates.map((update) => {
            const isEditing = editing?.id === update.id;
            return (
              <li key={update.id}>
                <time dateTime={update.createdAt}>
                  {new Date(update.createdAt).toLocaleDateString(locale, { dateStyle: "medium" })}
                </time>
                {isEditing && editing ? (
                  <div className="inst-form">
                    <input
                      className="admin-input"
                      maxLength={255}
                      value={editing.title}
                      onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                    />
                    <textarea
                      className="admin-textarea"
                      rows={6}
                      value={editing.body}
                      onChange={(event) => setEditing({ ...editing, body: event.target.value })}
                    />
                    <div className="portal-inline-actions">
                      <button type="button" className="primary-button" disabled={busy !== null} onClick={() => void saveEdit()}>
                        {copy.saveUpdate}
                      </button>
                      <button type="button" className="secondary-button" onClick={() => setEditing(null)}>
                        {copy.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {update.title ? <h3>{update.title}</h3> : null}
                    <p>{update.body}</p>
                    <div className="portal-inline-actions">
                      <button
                        type="button"
                        className="portal-link-button"
                        disabled={busy !== null}
                        onClick={() => setEditing({ id: update.id, title: update.title ?? "", body: update.body })}
                      >
                        {copy.editUpdate}
                      </button>
                      <button
                        type="button"
                        className="portal-link-button is-danger"
                        disabled={busy !== null}
                        onClick={() => void remove(update.id)}
                      >
                        {copy.deleteUpdate}
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="admin-help">{copy.noUpdates}</p>
      )}
    </div>
  );
}
