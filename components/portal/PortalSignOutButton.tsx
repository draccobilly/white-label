"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PortalSignOutButton({ label, redirectTo }: { label: string; redirectTo: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="portal-link-button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/portal/logout", { method: "POST" }).catch(() => null);
        router.push(redirectTo);
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
