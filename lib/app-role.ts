export const COMPANY_COOKIE = "arc_company_id";

export type AppRole = "all" | "admin" | "public";

export function getAppRole(): AppRole {
  const role = process.env.APP_ROLE?.trim().toLowerCase();
  if (role === "admin" || role === "public") return role;
  return "all";
}

export function hostnameFromHost(host: string | null | undefined) {
  const raw = (host ?? "localhost").split(",")[0]?.trim().toLowerCase() ?? "localhost";
  return raw.replace(/:\d+$/, "");
}

export function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".localhost")
  );
}
