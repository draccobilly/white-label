"use client";

type Props = {
  percent: number;
  label?: string;
  tone?: "sky" | "lime";
};

export function LivingProgressBar({
  percent,
  label,
  tone = "sky",
}: Props) {
  const width = Math.min(100, Math.max(0, percent));
  return (
    <div
      className={`living-progress living-progress--${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      aria-label={label ?? `Progress: ${width}%`}
    >
      <div className="living-progress-fill" style={{ width: `${width}%` }}>
        <span className="living-progress-sheen" aria-hidden />
        <span className="living-progress-live" aria-hidden />
      </div>
    </div>
  );
}
