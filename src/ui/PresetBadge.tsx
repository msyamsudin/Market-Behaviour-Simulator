import { useChartStore } from "../app/chartStore";
import { PRESETS, activePresetId } from "./presets";

export function PresetBadge() {
  const components = useChartStore((s) => s.components);
  const phases = useChartStore((s) => s.phases);
  const seed = useChartStore((s) => s.seed);

  const label = phases
    ? phases
        .map((p) => {
          const pid = activePresetId(p.components);
          return pid === "custom" ? "Custom" : PRESETS[pid].label;
        })
        .join(" → ")
    : (() => {
        const pid = activePresetId(components);
        return pid === "custom" ? "Custom" : PRESETS[pid].label;
      })();

  return (
    <div className="preset-badge" title={`Active Market Preset: ${label} · Seed ${seed}`}>
      <span className="preset-dot" />
      <span className="preset-name">{label}</span>
      <span className="preset-seed">seed {seed}</span>
    </div>
  );
}
