"use client";

import { useEffect, useState, type CSSProperties } from "react";

const RING_RADIUS = 44;

export function ImpactProgressRing({
  percent,
  className,
  showYou = false,
}: {
  percent: number;
  className?: string;
  showYou?: boolean;
}) {
  const width = Math.min(100, Math.max(0, percent));
  const targetDeg = (width / 100) * 360;
  const [sweepDeg, setSweepDeg] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setSweepDeg(targetDeg * eased);
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [targetDeg]);

  return (
    <div
      className={["impact-ring", className].filter(Boolean).join(" ")}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      aria-label={`Progress: ${Math.round(width)}%`}
      style={{ "--impact-ring-sweep": `${sweepDeg}deg` } as CSSProperties}
    >
      <svg viewBox="0 0 100 100" aria-hidden className="impact-ring-svg">
        <circle
          className="impact-ring-track"
          cx="50"
          cy="50"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="12"
        />
      </svg>
      {width > 0 ? <span className="impact-ring-fill" aria-hidden /> : null}
      {showYou && width > 0 ? (
        <span
          className="impact-ring-you"
          style={{ transform: `rotate(${sweepDeg}deg)` }}
        >
          <span
            className="impact-ring-you-label"
            style={{ transform: `translate(-50%, -70%) rotate(-${sweepDeg}deg)` }}
          >
            you
          </span>
        </span>
      ) : null}
      <span className="impact-ring-label">
        {Math.round(width)}
        <sup>%</sup>
      </span>
    </div>
  );
}
