export const ADMIN_SERVICE_WORKER_URL = "/sw.js";

function scriptUrlOf(registration: ServiceWorkerRegistration) {
  return (
    registration.active?.scriptURL ||
    registration.waiting?.scriptURL ||
    registration.installing?.scriptURL ||
    ""
  );
}

function isRootWorker(registration: ServiceWorkerRegistration) {
  try {
    return new URL(scriptUrlOf(registration)).pathname === "/sw.js";
  } catch {
    return false;
  }
}

export async function getAdminPushRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  const registrations = await navigator.serviceWorker.getRegistrations();
  return registrations.find(isRootWorker) ?? null;
}

async function waitForActivation(registration: ServiceWorkerRegistration) {
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker || worker.state === "activated") return registration;
  await new Promise<void>((resolve) => {
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated" || worker.state === "redundant") resolve();
    });
  });
  return registration;
}

export async function registerAdminWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This phone cannot register alerts.");
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  let current: ServiceWorkerRegistration | null = null;
  for (const registration of registrations) {
    if (isRootWorker(registration)) {
      current = registration;
      continue;
    }
    await registration.unregister();
  }

  if (current) {
    await current.update().catch(() => undefined);
    return waitForActivation(current);
  }

  // No custom scope: default of /sw.js is `/`. Do not send Service-Worker-Allowed
  // more than once — WebKit maps a duplicate header to the same scope error.
  const registration = await navigator.serviceWorker.register(ADMIN_SERVICE_WORKER_URL, {
    updateViaCache: "none",
  });
  return waitForActivation(registration);
}
