"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LivePlace } from "@/lib/live";
import { landDots } from "@/components/admin/world-land";

const TILT = (18 * Math.PI) / 180;
const DEG = Math.PI / 180;
const SPIN_DEG_PER_MS = 0.0025; // one turn every ~2.4 minutes

let dotsCache: Float32Array | null = null;
function dots() {
  if (!dotsCache) dotsCache = landDots(2);
  return dotsCache;
}

function cssVar(element: HTMLElement, name: string, fallback: string) {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
}

/** "#rrggbb" or "rgb(r, g, b)" with an alpha; canvas cannot parse color-mix(). */
function withAlpha(color: string, alpha: number, fallback = "21, 32, 51") {
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
    const [r, g, b] = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgb = color.match(/^rgba?\(([^)]+)\)$/i)?.[1];
  if (rgb) {
    const [r, g, b] = rgb.split(/[\s,/]+/).filter(Boolean);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(${fallback}, ${alpha})`;
}

/** Circular mean of the marker longitudes, weighted by visitors. */
function centerLongitude(places: LivePlace[], fallback: number) {
  let x = 0;
  let y = 0;
  for (const place of places) {
    const weight = Math.max(1, place.visitors + place.checkouts);
    x += Math.cos(place.longitude * DEG) * weight;
    y += Math.sin(place.longitude * DEG) * weight;
  }
  if (!x && !y) return fallback;
  return Math.atan2(y, x) / DEG;
}

function regionName(code: string, locale = "pt-BR") {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Regional-indicator flag; systems without flag emoji show the letters. */
export function flagEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

/** One heartbeat is 20s. A shorter stay means the tab closed before the next ping. */
export function formatVisitStay(ms: number) {
  if (ms < 20_000) return "menos de 20 s";
  return formatStay(ms);
}

export function formatStay(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest} min` : `${hours}h`;
}

export function placeLabel(place: Pick<LivePlace, "country" | "city">) {
  const country = regionName(place.country);
  return place.city ? `${place.city}, ${country}` : country;
}

/**
 * Dotted globe with the visitors of the last 30 minutes pulsing where they
 * are. Canvas only, no map library: the coastlines ship with the panel.
 * Drag to turn it; it turns by itself unless the person prefers less motion.
 */
export function LiveGlobe({
  places,
  homeLongitude = -60,
  size = 340,
}: {
  places: LivePlace[];
  /** Where the globe faces when nobody is on the site. */
  homeLongitude?: number;
  /** Maximum width in CSS pixels; shrinks with the container. */
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const placesRef = useRef(places);
  const spin = useRef({ lon: centerLongitude(places, homeLongitude), dragging: false, lastX: 0, idleUntil: 0 });
  const [width, setWidth] = useState(size);
  const [hover, setHover] = useState<LivePlace | null>(null);
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  // Face the visitors when the globe is idle and the crowd moves elsewhere.
  useEffect(() => {
    if (!places.length || spin.current.dragging) return;
    const target = centerLongitude(places, homeLongitude);
    const delta = ((target - spin.current.lon + 540) % 360) - 180;
    if (Math.abs(delta) > 60 && Date.now() > spin.current.idleUntil) spin.current.lon = target;
  }, [places, homeLongitude]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setWidth(Math.max(200, Math.min(size, Math.floor(box.width))));
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(width * dpr);
    const accent = cssVar(canvas, "--admin-accent", "#2563eb");
    const ink = cssVar(canvas, "--admin-ink", "#152033");
    const ocean = cssVar(canvas, "--admin-surface-2", "#f4f5f7");
    const success = cssVar(canvas, "--admin-success", "#0f7b4b");
    const land = dots();
    const radius = (width / 2) * 0.92;
    const cx = width / 2;
    const cy = width / 2;
    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);
    let frame = 0;
    let last = performance.now();
    let visible = true;

    const project = (lat: number, lng: number, lon0: number) => {
      const phi = lat * DEG;
      const lam = (lng - lon0) * DEG;
      const cosPhi = Math.cos(phi);
      const x = cosPhi * Math.sin(lam);
      const y = Math.sin(phi);
      const z = cosPhi * Math.cos(lam);
      const yy = y * cosT - z * sinT;
      const zz = z * cosT + y * sinT;
      return { x: cx + x * radius, y: cy - yy * radius, depth: zz };
    };

    const draw = (now: number) => {
      const elapsed = Math.min(100, now - last);
      last = now;
      const state = spin.current;
      if (!reduceMotion && !state.dragging && now > state.idleUntil) {
        state.lon = (state.lon + elapsed * SPIN_DEG_PER_MS + 180) % 360 - 180;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, width);

      // Ocean disc with a soft rim.
      const glow = context.createRadialGradient(cx - radius * 0.3, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
      glow.addColorStop(0, "#ffffff");
      glow.addColorStop(1, ocean);
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.fillStyle = glow;
      context.fill();
      context.lineWidth = 1;
      context.strokeStyle = withAlpha(ink, 0.14);
      context.stroke();

      // Land dots, dimmer toward the edge.
      const dotRadius = Math.max(0.9, radius / 150);
      for (let i = 0; i < land.length; i += 2) {
        const point = project(land[i], land[i + 1], state.lon);
        if (point.depth <= 0.02) continue;
        const alpha = 0.25 + point.depth * 0.6;
        context.globalAlpha = alpha;
        context.fillStyle = accent;
        context.beginPath();
        context.arc(point.x, point.y, dotRadius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      // Visitors: a pulse ring and a solid core, bigger with more people.
      const list = placesRef.current;
      for (let index = 0; index < list.length; index += 1) {
        const place = list[index];
        const point = project(place.latitude, place.longitude, state.lon);
        if (point.depth <= 0.04) continue;
        const weight = place.visitors + place.checkouts;
        const core = Math.min(9, 3 + Math.sqrt(weight) * 1.6);
        const color = place.checkouts > 0 ? success : accent;
        if (!reduceMotion) {
          const phase = ((now / 1800 + index * 0.37) % 1 + 1) % 1;
          context.beginPath();
          context.arc(point.x, point.y, core + phase * core * 2.4, 0, Math.PI * 2);
          context.strokeStyle = color;
          context.globalAlpha = (1 - phase) * 0.55 * point.depth;
          context.lineWidth = 1.5;
          context.stroke();
        }
        context.globalAlpha = 0.9;
        context.beginPath();
        context.arc(point.x, point.y, core, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
        context.globalAlpha = 1;
        context.beginPath();
        context.arc(point.x, point.y, Math.max(1.2, core * 0.35), 0, Math.PI * 2);
        context.fillStyle = "#ffffff";
        context.fill();
      }
      context.globalAlpha = 1;
      // Clear the finished frame id first. The Analytics globe mounts below
      // the fold, so the first paint often runs while it is off-screen and
      // must be allowed to start again when it scrolls into view.
      frame = 0;
      if (visible && (!reduceMotion || list.length)) frame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) start();
    });
    io.observe(canvas);
    start();

    const nearest = (clientX: number, clientY: number) => {
      const box = canvas.getBoundingClientRect();
      const x = ((clientX - box.left) / box.width) * width;
      const y = ((clientY - box.top) / box.height) * width;
      let best: LivePlace | null = null;
      let bestDistance = 14;
      for (const place of placesRef.current) {
        const point = project(place.latitude, place.longitude, spin.current.lon);
        if (point.depth <= 0.04) continue;
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = place;
        }
      }
      return best;
    };

    const onDown = (event: PointerEvent) => {
      spin.current.dragging = true;
      spin.current.lastX = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (spin.current.dragging) {
        const dx = event.clientX - spin.current.lastX;
        spin.current.lastX = event.clientX;
        spin.current.lon = (spin.current.lon + dx * (180 / width) + 180) % 360 - 180;
        start();
      } else {
        setHover(nearest(event.clientX, event.clientY));
      }
    };
    const onUp = (event: PointerEvent) => {
      spin.current.dragging = false;
      spin.current.idleUntil = Date.now() + 6000;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Already released.
      }
      start();
    };
    const onLeave = () => setHover(null);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      visible = false;
      if (frame) cancelAnimationFrame(frame);
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [width, reduceMotion]);

  const summary = places.length
    ? `${places.length} lugares com visitantes agora: ${places
        .slice(0, 5)
        .map((place) => `${placeLabel(place)} (${place.visitors})`)
        .join(", ")}`
    : "Nenhum visitante localizado nos últimos 30 minutos";

  return (
    <div className="live-globe" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="live-globe-canvas"
        style={{ width, height: width }}
        role="img"
        aria-label={summary}
      />
      {hover ? (
        <div className="live-globe-tip" role="status">
          <strong>{placeLabel(hover)}</strong>
          <span>
            {hover.visitors} {hover.visitors === 1 ? "aberta" : "abertas"}
            {hover.openForMs ? ` há ${formatStay(hover.openForMs)}` : ""}
            {hover.checkouts ? `, ${hover.checkouts} já doou` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
