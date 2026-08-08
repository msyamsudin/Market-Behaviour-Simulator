import { useChartStore } from "../app/chartStore";
import { sessionAt } from "../engine/market/session";

export function SessionBadge() {
  const { ticks, playback } = useChartStore();

  if (ticks.length === 0) return null;
  const idx = Math.min(Math.max(0, playback.index), ticks.length - 1);
  const s = sessionAt(ticks[idx].time);

  return (
    <div className="session-badge" title={`Current Trading Session: ${s.label}`}>
      <span className="session-dot" />
      <span className="session-name">{s.label}</span>
    </div>
  );
}
