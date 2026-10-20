"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

function clockTime(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

/**
 * Keeps a server-rendered page fresh: re-reads it when the tab or the
 * installed app comes back to the foreground and on a slow interval while it
 * stays visible. Read-only — it only calls router.refresh().
 */
export function AdminLiveRefresh({
  timeZone,
  intervalMs = 90_000,
}: {
  timeZone: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stamp, setStamp] = useState<string | null>(null);
  const last = useRef(0);

  useEffect(() => {
    last.current = Date.now();
    setStamp(clockTime(timeZone));

    const refresh = () => {
      last.current = Date.now();
      startTransition(() => router.refresh());
      setStamp(clockTime(timeZone));
    };
    const onVisible = () => {
      // Coming back after more than 20s away is the moment fresh numbers matter.
      if (document.visibilityState === "visible" && Date.now() - last.current > 20_000) {
        refresh();
      }
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, router, timeZone]);

  return (
    <button
      type="button"
      className={`dash-live${pending ? " is-busy" : ""}`}
      disabled={pending}
      onClick={() => {
        last.current = Date.now();
        startTransition(() => router.refresh());
        setStamp(clockTime(timeZone));
      }}
      title="Atualizar agora"
    >
      <span className="dash-live-dot" aria-hidden />
      <span>{stamp ? `Atualizado ${stamp}` : "Ao vivo"}</span>
      <RefreshCw size={14} aria-hidden />
    </button>
  );
}
