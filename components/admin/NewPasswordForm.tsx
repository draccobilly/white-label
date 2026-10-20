"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function NewPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (password !== confirm) {
      setMessage("As duas senhas não são iguais.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar a senha.");
      const supabase = createClient();
      await supabase.auth.refreshSession();
      window.location.assign("/admin");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível atualizar a senha.");
      setLoading(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        Nova senha
        <input
          className="admin-input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />
      </label>
      <label>
        Confirmar senha
        <input
          className="admin-input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          minLength={8}
          required
        />
      </label>
      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? "Salvando…" : "Salvar e entrar"}
      </button>
      {message ? <p className="form-message">{message}</p> : null}
    </form>
  );
}
