"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Re-reads the current page from the server. The installed app on a phone has
 * no browser reload button, so the shell always offers one.
 */
export function AdminRefreshButton({ label = "Atualizar" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={`admin-icon-button${pending ? " is-busy" : ""}`}
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw size={18} aria-hidden />
    </button>
  );
}
