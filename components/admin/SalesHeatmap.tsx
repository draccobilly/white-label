import type { HourCell } from "@/lib/analytics";
import { formatMoney } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Hour of day × weekday. Colour follows paid gifts; the title of each cell
 * carries the exact numbers, so the picture and the data stay together.
 */
export function SalesHeatmap({ cells, currency }: { cells: HourCell[]; currency: string }) {
  const byKey = new Map(cells.map((cell) => [`${cell.weekday}-${cell.hour}`, cell]));
  const max = Math.max(1, ...cells.map((cell) => cell.gifts));
  const totalGifts = cells.reduce((sum, cell) => sum + cell.gifts, 0);
  if (!totalGifts) {
    return <p className="dash-empty">Sem doações no período para montar o mapa de horários.</p>;
  }
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="heatmap-wrap">
      <div className="heatmap" role="img" aria-label="Doações por hora do dia e dia da semana">
        <div className="heatmap-corner" />
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={`h-${hour}`} className="heatmap-hour">
            {hour % 3 === 0 ? `${hour}h` : ""}
          </div>
        ))}
        {order.map((weekday) => (
          <div key={`row-${weekday}`} className="heatmap-row">
            <div className="heatmap-day">{WEEKDAYS[weekday]}</div>
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = byKey.get(`${weekday}-${hour}`);
              const gifts = cell?.gifts ?? 0;
              const level = gifts === 0 ? 0 : Math.max(1, Math.ceil((gifts / max) * 5));
              const title = `${WEEKDAYS[weekday]} ${hour}h: ${gifts} doação${gifts === 1 ? "" : "s"}, ${formatMoney(
                cell?.revenue ?? 0,
                currency,
              )}, ${cell?.clicks ?? 0} cliques`;
              return <span key={`c-${weekday}-${hour}`} className={`heatmap-cell is-${level}`} title={title} />;
            })}
          </div>
        ))}
      </div>
      <p className="heatmap-legend" aria-hidden>
        <span>menos</span>
        <i className="is-1" />
        <i className="is-2" />
        <i className="is-3" />
        <i className="is-4" />
        <i className="is-5" />
        <span>mais doações</span>
      </p>
    </div>
  );
}
