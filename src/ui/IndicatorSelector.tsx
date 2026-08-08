import { useChartStore } from "../app/chartStore";
import { indicatorRegistry } from "../engine/indicator/registry";

export function IndicatorSelector() {
  const { indicatorId, setIndicator } = useChartStore();
  const indicators = indicatorRegistry.list();

  return (
    <div className="topbar-select-wrapper">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <select
        id="indicator"
        className="topbar-select"
        value={indicatorId ?? ""}
        onChange={(e) => setIndicator(e.target.value === "" ? null : e.target.value)}
        title="Select Indicator"
      >
        <option value="">No Indicator</option>
        {indicators.map((ind) => (
          <option key={ind.id} value={ind.id}>
            {ind.name}
          </option>
        ))}
      </select>
    </div>
  );
}
