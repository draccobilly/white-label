"use client";

import { useEffect, useRef, useState } from "react";
import { LiveGlobe, flagEmoji, formatStay, formatVisitStay, placeLabel } from "@/components/admin/LiveGlobe";
import type { LiveSnapshot, VisitStory } from "@/lib/live";
import { formatMoney, formatRelativeTime } from "@/lib/utils";

const KIND_LABEL = { view: "visita", checkout: "checkout", paid: "pagamento" } as const;

function storyWho(row: VisitStory) {
  if (row.name) return row.name;
  if (!row.country) return "Local desconhecido";
  return placeLabel({ country: row.country, city: row.city });
}

function storyWhat(row: VisitStory, currency: string) {
  if (row.what === "donated" && row.amount !== null) {
    return `Doou ${formatMoney(row.amount, row.currency ?? currency)}`;
  }
  if (row.what === "open") return "Ainda na página";
  return "Saiu sem doar";
}

function storyWhy(row: VisitStory) {
  if (row.what === "donated" && row.donatedAfterMs !== null) {
    const stay = `Ficou ${formatVisitStay(row.stayedMs)} na página e doou depois de ${formatStay(row.donatedAfterMs)}.`;
    return row.stillOpen ? `${stay} A página continua aberta.` : stay;
  }
  if (row.what === "open") {
    return `A página está aberta há ${formatVisitStay(row.stayedMs)}. Ainda não há pagamento ligado a esta visita.`;
  }
  if (row.quick) {
    return "Fechou em menos de 20 segundos, antes do próximo aviso. Não houve pagamento ligado a esta visita.";
  }
  return `Ficou ${formatStay(row.stayedMs)} na página e saiu sem um pagamento ligado a esta visita.`;
}

/**
 * Live strip: who is on the public pages right now. Polls while the tab is
 * visible and stops when it is hidden, so an open phone does not hammer the
 * server. Read-only.
 */
export function LiveNow({
  variant = "compact",
  intervalMs = 20_000,
  initial = null,
  globe = false,
  homeLongitude = -75,
}: {
  variant?: "compact" | "full";
  intervalMs?: number;
  /** Snapshot computed on the server so the first paint already has numbers. */
  initial?: LiveSnapshot | null;
  /** Shows the globe with the tabs that are open right now. */
  globe?: boolean;
  /** Longitude the globe faces when nobody is on the site (the desk's region). */
  homeLongitude?: number;
}) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(initial);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/admin/live", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as LiveSnapshot;
        if (!cancelled) {
          setSnapshot(data);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    const schedule = () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = window.setInterval(() => {
        if (document.visibilityState === "visible") void load();
      }, intervalMs);
    };
    void load();
    schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    // Re-render the relative times once a minute.
    const clock = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => {
      cancelled = true;
      if (timer.current) window.clearInterval(timer.current);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  const max = Math.max(1, ...(snapshot?.perMinute ?? [0]));
  void tick;

  return (
    <section className={`live-now is-${variant}${globe ? " has-globe" : ""}`} aria-label="Ao vivo">
      <header className="live-head">
        <span className="live-dot" aria-hidden />
        <strong>Ao vivo</strong>
        {snapshot ? (
          <small>atualizado {formatRelativeTime(snapshot.at)}</small>
        ) : failed ? (
          <small>sem conexão</small>
        ) : (
          <small>carregando…</small>
        )}
      </header>
      <div className="live-stats">
        <div>
          <strong>{snapshot ? snapshot.visitors5m : "–"}</strong>
          <span>pessoas agora</span>
          <small>últimos 5 min</small>
        </div>
        <div>
          <strong>{snapshot ? snapshot.checkouts15m : "–"}</strong>
          <span>checkouts</span>
          <small>últimos 15 min</small>
        </div>
        <div>
          <strong>{snapshot ? snapshot.paid60m : "–"}</strong>
          <span>pagamentos</span>
          <small>{snapshot ? formatMoney(snapshot.revenue60m, snapshot.currency) : "última hora"} na última hora</small>
        </div>
      </div>
      <div className="live-spark" role="img" aria-label="Visitas por minuto na última hora">
        {(snapshot?.perMinute ?? new Array<number>(60).fill(0)).map((value, index) => (
          <i key={index} style={{ height: `${value ? Math.max(8, (value / max) * 100) : 4}%` }} />
        ))}
      </div>
      {globe ? (
        <div className="live-world">
          <div className="live-globe-wrap">
            <LiveGlobe places={snapshot?.places ?? []} homeLongitude={homeLongitude} size={variant === "full" ? 340 : 260} />
            <p className="live-globe-caption">
              {snapshot ? snapshot.located + snapshot.unlocated : "–"}{" "}
              {(snapshot?.located ?? 0) + (snapshot?.unlocated ?? 0) === 1
                ? "sessão aberta agora"
                : "sessões abertas agora"}
              {snapshot?.unlocated ? ` · ${snapshot.unlocated} sem local` : ""}
            </p>
          </div>
          <div className="live-places">
            <p className="live-places-head">
              <strong>
                {snapshot ? snapshot.flow.closed : "–"}{" "}
                {snapshot?.flow.closed === 1 ? "sessão encerrada" : "sessões encerradas"}
              </strong>
              <small>últimos 30 min · quem já saiu da página</small>
            </p>
            <ul>
              {(snapshot?.departed ?? []).slice(0, variant === "full" ? 8 : 5).map((row, index) => (
                <li key={`${row.leftAt}-${row.country}-${index}`}>
                  <span className="live-place-flag" aria-hidden title={row.country}>
                    {flagEmoji(row.country)}
                  </span>
                  <span className="live-place-name">{placeLabel(row)}</span>
                  <b>{row.amount === null ? formatVisitStay(row.stayedMs) : formatStay(row.stayedMs)}</b>
                  <small className={row.amount === null ? "is-quiet" : undefined}>
                    {row.donatedAfterMs !== null && row.amount !== null
                      ? `doou em ${formatStay(row.donatedAfterMs)} · ${formatMoney(row.amount, row.currency ?? snapshot?.currency ?? "USD")}`
                      : row.stayedMs < 20_000
                        ? "fechou a página sem doar"
                        : "ficou na página e saiu sem doar"}
                  </small>
                </li>
              ))}
            </ul>
            {snapshot && snapshot.geoReady && !snapshot.departed.length ? (
              <p className="live-places-note">Ninguém saiu nos últimos 30 minutos.</p>
            ) : null}
            {snapshot && !snapshot.geoReady ? (
              <p className="live-places-note">
                O globo começa a marcar as visitas depois da migration de localização ser aplicada neste banco.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {globe && variant === "full" && snapshot ? (
        <section className="live-story" aria-label="O que aconteceu nos últimos 30 minutos">
          <header className="live-story-head">
            <strong>O que aconteceu</strong>
            <small>últimos 30 minutos</small>
          </header>
          <div className="live-story-counts">
            <div>
              <b>{snapshot.flow.entered}</b>
              <span>entraram</span>
            </div>
            <div>
              <b>{snapshot.flow.donated}</b>
              <span>doaram</span>
            </div>
            <div>
              <b>{snapshot.flow.leftWithout}</b>
              <span>saíram sem doar</span>
            </div>
            <div>
              <b>{snapshot.flow.stillOpen}</b>
              <span>ainda na página</span>
            </div>
          </div>
          {snapshot.stories.length ? (
            <div className="live-story-table">
              <div className="live-story-row is-head">
                <span>Quem</span>
                <span>O que fez</span>
                <span>Quando</span>
                <span>Por quê</span>
              </div>
              {snapshot.stories.map((row, index) => (
                <div className="live-story-row" key={`${row.at}-${row.what}-${index}`}>
                  <span className="live-story-who">
                    {row.country ? (
                      <span className="live-place-flag" aria-hidden>
                        {flagEmoji(row.country)}
                      </span>
                    ) : null}
                    <span>
                      <strong>{storyWho(row)}</strong>
                      {row.name && row.country ? <small>{placeLabel({ country: row.country, city: row.city })}</small> : null}
                    </span>
                  </span>
                  <span className={`live-story-what is-${row.what}`}>{storyWhat(row, snapshot.currency)}</span>
                  <time dateTime={row.at}>{row.what === "open" ? "agora" : formatRelativeTime(row.at)}</time>
                  <span className="live-story-why">{storyWhy(row)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="live-places-note">Nenhuma visita medida nos últimos 30 minutos.</p>
          )}
          {snapshot.stories.length < snapshot.flow.entered ? (
            <p className="live-places-note">
              Mostrando {snapshot.stories.length} de {snapshot.flow.entered} visitas. Doações aparecem primeiro, depois quem ainda está na página, depois quem saiu.
            </p>
          ) : null}
          {snapshot.dwell.gifts > 0 ? (
            <p className="live-places-note">
              Tempo até doar
              {snapshot.dwell.buckets
                .filter((bucket) => bucket.gifts > 0)
                .map(
                  (bucket) =>
                    ` · ${bucket.label}: ${formatMoney(bucket.avgAmount, snapshot.currency)} (${bucket.gifts})`,
                )
                .join("")}
              {snapshot.dwell.gifts < 4 ? ". Amostra ainda curta." : "."}
            </p>
          ) : (
            <p className="live-places-note">
              O tempo até a doação passa a ser medido nas visitas que abrirem a página a partir de agora.
            </p>
          )}
        </section>
      ) : null}
      {variant === "full" ? (
        <ul className="live-feed">
          {(snapshot?.recent ?? []).map((event, index) => (
            <li key={`${event.at}-${index}`} className={`is-${event.kind}`}>
              <span className="live-kind">{KIND_LABEL[event.kind]}</span>
              <span className="live-label">
                <strong>{event.label}</strong>
                {event.tag ? <span className="sale-gateway-tag">{event.tag}</span> : null}
                {event.sub ? <small>{event.sub}</small> : null}
              </span>
              <span className="live-when">
                {event.amount !== undefined ? <b>{formatMoney(event.amount, event.currency ?? "USD")}</b> : null}
                <time dateTime={event.at}>{formatRelativeTime(event.at)}</time>
              </span>
            </li>
          ))}
          {snapshot && !snapshot.recent.length ? (
            <li className="is-empty">Ninguém nas páginas nos últimos minutos.</li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
