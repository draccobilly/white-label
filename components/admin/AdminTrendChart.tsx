type Point = {
  label: string;
  views: number;
  donations: number;
};

export function AdminTrendChart({ points }: { points: Point[] }) {
  const width = 640;
  const height = 220;
  const pad = 18;
  const max = Math.max(
    1,
    ...points.flatMap((point) => [point.views, point.donations]),
  );

  function line(key: "views" | "donations") {
    return points
      .map((point, index) => {
        const x =
          pad +
          (index / Math.max(1, points.length - 1)) * (width - pad * 2);
        const y = height - pad - (point[key] / max) * (height - pad * 2);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <div className="admin-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weekly views and donations">
        <path d={line("views")} fill="none" stroke="#8bb7ff" strokeWidth="4" strokeLinecap="round" />
        <path d={line("donations")} fill="none" stroke="#f4a574" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <div className="admin-chart-legend">
        <span>
          <i className="is-views" /> Views
        </span>
        <span>
          <i className="is-donations" /> Paid donations
        </span>
      </div>
      <div className="admin-chart-labels">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}
