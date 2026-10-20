"use client";

import { useEffect, useState } from "react";
import { ADMIN_CLOCK_FEE, type AdminDashboardClock } from "@/lib/admin-clock";

type ClockParts = {
  time: string;
  date: string;
  zone: string;
  iso: string;
};

function readClock(timeZone: string): ClockParts {
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(now);
  const zone =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  return {
    time,
    date,
    zone,
    iso: now.toISOString(),
  };
}

/**
 * Live operation clock. Renders a stable placeholder on the server and only
 * starts ticking on the client, so there is never a hydration mismatch.
 */
export function AdminOperationClock({
  label,
  timeZone,
  tag,
  detail,
  variant = "sidebar",
}: {
  label: string;
  timeZone: string;
  tag?: string;
  detail?: string;
  variant?: "sidebar" | "mobile";
}) {
  const [parts, setParts] = useState<ClockParts | null>(null);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setParts(readClock(timeZone));
      // Re-align to the next whole second so the display never drifts.
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [timeZone]);

  const caption = [tag, label, detail].filter(Boolean).join(", ");

  return (
    <div
      className={`admin-clock admin-clock--${variant}${tag ? " admin-clock--tagged" : ""}${detail ? " admin-clock--detail" : ""}`}
      role="timer"
      aria-live="off"
      aria-label={`Horário de operação, ${caption}`}
      title={[tag, label, detail, timeZone].filter(Boolean).join(" · ")}
    >
      {tag ? <span className="admin-clock-tag">{tag}</span> : null}
      <span className="admin-clock-dot" aria-hidden />
      <span className="admin-clock-label">{label}</span>
      {detail ? <span className="admin-clock-detail">{detail}</span> : null}
      <span className="admin-clock-date">{parts ? parts.date : ""}</span>
      <time className="admin-clock-time" dateTime={parts?.iso}>
        {parts ? parts.time : "--:--:--"}
      </time>
      <span className="admin-clock-zone">{parts ? parts.zone : ""}</span>
    </div>
  );
}

function FeeChip({
  pressed,
  onPress,
}: {
  pressed?: boolean;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <button
        type="button"
        className="admin-clock-fee"
        aria-expanded={pressed}
        onClick={onPress}
      >
        <span className="admin-clock-fee-label">{ADMIN_CLOCK_FEE.label}</span>
        <span className="admin-clock-fee-value">{ADMIN_CLOCK_FEE.value}</span>
      </button>
    );
  }
  return (
    <p className="admin-clock-fee">
      <span className="admin-clock-fee-label">{ADMIN_CLOCK_FEE.label}</span>
      <span className="admin-clock-fee-value">{ADMIN_CLOCK_FEE.value}</span>
    </p>
  );
}

export function AdminDashboardClocks({
  clocks,
  variant = "sidebar",
}: {
  clocks: readonly AdminDashboardClock[];
  variant?: "sidebar" | "mobile";
}) {
  const [open, setOpen] = useState(variant !== "mobile");
  const mobile = variant === "mobile";

  return (
    <div
      className={`admin-clock-stack admin-clock-stack--${variant}${mobile && open ? " is-open" : ""}`}
      role="group"
      aria-label="Relógios"
    >
      {mobile ? null : <FeeChip />}
      {clocks.map((clock) => (
        <AdminOperationClock
          key={`${clock.tag ?? ""}|${clock.label}|${clock.detail ?? ""}|${clock.timeZone}`}
          label={clock.label}
          timeZone={clock.timeZone}
          tag={clock.tag}
          detail={clock.detail}
          variant={variant}
        />
      ))}
      {mobile ? <FeeChip pressed={open} onPress={() => setOpen((value) => !value)} /> : null}
    </div>
  );
}
