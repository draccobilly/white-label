"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerAdminWorker } from "@/lib/admin-sw";
import {
  isSaleChimeMessage,
  playSaleChime,
  unlockSaleChime,
} from "@/lib/sale-chime";

export function AdminPwa() {
  const router = useRouter();
  useEffect(() => {
    void registerAdminWorker().catch(() => undefined);
    const onMessage = (event: MessageEvent) => {
      if (isSaleChimeMessage(event.data)) playSaleChime();
      if (
        event.data &&
        typeof event.data === "object" &&
        event.data.type === "open-sales"
      ) {
        const next =
          typeof event.data.url === "string" ? event.data.url : "/admin/sales";
        if (window.location.pathname !== next) {
          router.push(next);
        }
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    const unlock = () => unlockSaleChime();
    window.addEventListener("pointerdown", unlock);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      window.removeEventListener("pointerdown", unlock);
    };
  }, [router]);

  return null;
}
