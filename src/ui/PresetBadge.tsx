import { useChartStore } from "../app/chartStore";
import { PRESETS, activePresetId } from "./presets";

export function PresetBadge() {
  const components = useChartStore((s) => s.components);
  const seed = useChartStore((s) => s.seed);

  const pid = activePresetId(components);
  const label = pid === "custom" ? "Custom" : PRESETS[pid].label;

  return (
    <div className="preset-badge" title={`Active Market Preset: ${label} · Seed ${seed}`}>
      <span className="preset-dot" />
      <span className="preset-name">{label}</span>
      <span className="preset-seed">seed {seed}</span>
    </div>
  );
}
