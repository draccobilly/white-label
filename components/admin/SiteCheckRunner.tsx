"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Runs a site check when the health screen opens (if the last one is old)
 * and again every minute while the tab stays visible, then refreshes the
 * numbers. The server does the probing; this only asks for it.
 */
export function SiteCheckRunner({
  lastCheckedAt,
  intervalMs = 60_000,
}: {
  lastCheckedAt: string | null;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  async function run() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/health/check", { method: "POST" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao verificar");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    const stale = !lastCheckedAt || Date.now() - new Date(lastCheckedAt).getTime() > 5 * 60_000;
    if (stale) void run();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void run();
    }, intervalMs);
    return () => window.clearInterval(timer);
    // Only on mount: later refreshes come from the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="admin-inline-actions">
      <button
        type="button"
        className={`secondary-button${busy || pending ? " is-busy" : ""}`}
        disabled={busy}
        onClick={() => void run()}
      >
        <RefreshCw size={15} aria-hidden />
        {busy ? "Verificando…" : "Verificar agora"}
      </button>
      {error ? <small className="admin-help">{error}</small> : null}
    </div>
  );
}
