import { prisma } from "@/lib/prisma";

export type CheckTarget = "app" | "page";

export type CheckResult = {
  target: CheckTarget;
  url: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
};

const TIMEOUT_MS = 8000;

/** Public base URL of this desk, from its domain. Null when none is set. */
export function publicBaseUrl(company: { domain: string | null }) {
  if (!company.domain) return null;
  return `https://${company.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
}

async function probe(target: CheckTarget, url: string): Promise<CheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "giving-admin-sitecheck/1" },
    });
    const latencyMs = Date.now() - started;
    // Read a little of the body so a half-dead upstream is caught too.
    await response.text().catch(() => "");
    return {
      target,
      url,
      ok: response.ok,
      statusCode: response.status,
      latencyMs,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `Sem resposta em ${TIMEOUT_MS / 1000}s`
        : error instanceof Error
          ? error.message
          : "Falha de rede";
    return { target, url, ok: false, statusCode: null, latencyMs, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** Probes the API and the public home of the desk, stores and returns both. */
export async function runSiteCheck(company: { id: string; domain: string | null }) {
  const base = publicBaseUrl(company);
  if (!base) return [] as CheckResult[];
  const results = await Promise.all([probe("app", `${base}/api/health`), probe("page", `${base}/`)]);
  try {
    await prisma.siteCheck.createMany({
      data: results.map((result) => ({
        companyId: company.id,
        target: result.target,
        url: result.url,
        ok: result.ok,
        statusCode: result.statusCode,
        latencyMs: result.latencyMs,
        error: result.error,
      })),
    });
  } catch (error) {
    // Table missing until the migration runs: the probe still answers.
    console.error("site check could not be stored", error instanceof Error ? error.message : error);
  }
  return results;
}

export type CheckRow = {
  target: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
  checkedAt: Date;
};

export type HealthSummary = {
  ready: boolean;
  last: CheckRow | null;
  lastPage: CheckRow | null;
  uptime24h: number | null;
  uptime7d: number | null;
  checks24h: number;
  checks7d: number;
  avgLatency24h: number | null;
  p95Latency7d: number | null;
  incidents: Array<{ from: Date; to: Date; count: number; error: string | null }>;
  series: Array<{ at: Date; ok: boolean; latencyMs: number }>;
};

export async function loadHealthSummary(companyId: string): Promise<HealthSummary> {
  const since = new Date(Date.now() - 7 * 24 * 3600_000);
  let rows: CheckRow[] = [];
  let ready = true;
  try {
    rows = await prisma.siteCheck.findMany({
      where: { companyId, checkedAt: { gte: since } },
      orderBy: { checkedAt: "desc" },
      take: 4000,
      select: { target: true, ok: true, statusCode: true, latencyMs: true, error: true, checkedAt: true },
    });
  } catch {
    ready = false;
  }
  const app = rows.filter((row) => row.target === "app");
  const dayAgo = Date.now() - 24 * 3600_000;
  const app24 = app.filter((row) => row.checkedAt.getTime() >= dayAgo);
  const okShare = (list: CheckRow[]) => (list.length ? list.filter((row) => row.ok).length / list.length : null);
  const latencies = [...app].map((row) => row.latencyMs).sort((a, b) => a - b);
  const p95 = latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : null;
  const incidents: HealthSummary["incidents"] = [];
  for (const row of [...app].reverse()) {
    if (row.ok) continue;
    const last = incidents[incidents.length - 1];
    if (last && row.checkedAt.getTime() - last.to.getTime() <= 20 * 60_000) {
      last.to = row.checkedAt;
      last.count += 1;
    } else {
      incidents.push({ from: row.checkedAt, to: row.checkedAt, count: 1, error: row.error });
    }
  }
  return {
    ready,
    last: app[0] ?? null,
    lastPage: rows.find((row) => row.target === "page") ?? null,
    uptime24h: okShare(app24),
    uptime7d: okShare(app),
    checks24h: app24.length,
    checks7d: app.length,
    avgLatency24h: app24.length ? Math.round(app24.reduce((sum, row) => sum + row.latencyMs, 0) / app24.length) : null,
    p95Latency7d: p95,
    incidents: incidents.reverse().slice(0, 6),
    series: [...app]
      .reverse()
      .slice(-96)
      .map((row) => ({ at: row.checkedAt, ok: row.ok, latencyMs: row.latencyMs })),
  };
}
