"use client";

import { useEffect, useState } from "react";
import { getAdminPushRegistration, registerAdminWorker } from "@/lib/admin-sw";
import { playSaleChime, unlockSaleChime } from "@/lib/sale-chime";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function explainPushError(error: unknown) {
  const message = error instanceof Error ? error.message : "Não foi possível ligar os alertas.";
  if (/Scope URL|not under the max scope|Service-Worker-Allowed/i.test(message)) {
    return "O Safari recusou o serviço de alertas. Feche o app, abra de novo pelo ícone e tente outra vez.";
  }
  if (/not allowed|denied|não foram permitidas/i.test(message)) {
    return "As notificações não foram permitidas.";
  }
  return message;
}

export function AdminPushSettings() {
  const [configured, setConfigured] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"ok" | "error">("ok");

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
    setIos(isIosDevice());
    void refresh();
  }, []);

  async function refresh() {
    const status = await fetch("/api/admin/push").then((res) => res.json()).catch(() => null);
    setConfigured(Boolean(status?.configured));
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const registration = await getAdminPushRegistration();
    const current = await registration?.pushManager.getSubscription();
    setSubscribed(Boolean(current));
  }

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      if (ios && !isStandaloneDisplay()) {
        throw new Error("Abra o atalho da Tela de Início e ative os alertas por lá.");
      }
      const status = await fetch("/api/admin/push").then((res) => res.json());
      if (!status?.configured || !status.publicKey) {
        throw new Error("Push is not configured on the server yet.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notifications were not allowed.");
      unlockSaleChime();
      const registration = await registerAdminWorker();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(status.publicKey as string),
      });
      const body = subscription.toJSON();
      const response = await fetch("/api/admin/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: body.endpoint,
          keys: body.keys,
          userAgent: navigator.userAgent,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save this device");
      setSubscribed(true);
      setMessageKind("ok");
      setMessage("Alertas ligados neste iPhone.");
    } catch (error) {
      setMessageKind("error");
      setMessage(explainPushError(error));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await getAdminPushRegistration();
      const current = await registration?.pushManager.getSubscription();
      if (current) {
        await fetch("/api/admin/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: current.endpoint }),
        });
        await current.unsubscribe();
      }
      setSubscribed(false);
      setMessageKind("ok");
      setMessage("Alertas desligados neste aparelho.");
    } catch (error) {
      setMessageKind("error");
      setMessage(explainPushError(error));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/push/test", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to send a test");
      unlockSaleChime();
      playSaleChime();
      setMessageKind("ok");
      setMessage("Teste enviado.");
    } catch (error) {
      setMessageKind("error");
      setMessage(explainPushError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-form">
      {ios && !standalone ? (
        <p className="admin-copy">Abra o ícone da Tela de Início para ligar os alertas.</p>
      ) : null}
      <div className="admin-inline-actions">
        {subscribed ? (
          <button type="button" className="secondary-button" disabled={busy} onClick={() => void disable()}>
            Desligar alertas
          </button>
        ) : (
          <button type="button" className="primary-button" disabled={busy || !configured} onClick={() => void enable()}>
            {busy ? "Ativando…" : "Ativar alertas"}
          </button>
        )}
        <button
          type="button"
          className="secondary-button"
          disabled={busy || !subscribed}
          onClick={() => void sendTest()}
        >
          Testar
        </button>
      </div>
      {message ? <p className={messageKind === "error" ? "form-error" : "form-message"}>{message}</p> : null}
    </div>
  );
}
