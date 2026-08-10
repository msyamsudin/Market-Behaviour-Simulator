import { useRef, useState } from "react";
import { useChartStore, cloneComponents } from "../app/chartStore";
import { PRESETS, activePresetId } from "./presets";
import "../styles/component-panel.css";

interface Meta {
  title: string;
  desc: string;
  icon: string;
  paramsMeta: Record<string, { label: string; min: number; max: number; step: number }>;
}

const METADATA: Record<string, Meta> = {
  noise: {
    title: "Noise / Random Walk",
    desc: "Baseline stochastic tick price movement",
    icon: "🎲",
    paramsMeta: {
      noiseLevel: { label: "Noise Level", min: 0, max: 0.5, step: 0.01 },
    },
  },
  trend: {
    title: "Directional Trend",
    desc: "Constant drift bias driving price direction",
    icon: "📈",
    paramsMeta: {
      trendStrength: { label: "Strength", min: 0, max: 0.05, step: 0.002 },
      trendBias: { label: "Bias (-1 to +1)", min: -1, max: 1, step: 0.1 },
    },
  },
  volatility: {
    title: "Volatility Clustering (GARCH)",
    desc: "Dynamic variance evolution with volatility shocks",
    icon: "⚡",
    paramsMeta: {
      omega: { label: "Base Variance (ω)", min: 0.0001, max: 0.002, step: 0.0001 },
      alpha: { label: "Shock Alpha (α)", min: 0.01, max: 0.3, step: 0.01 },
      beta: { label: "Memory Beta (β)", min: 0.5, max: 0.95, step: 0.01 },
      scale: { label: "Vol Scale", min: 0.1, max: 3, step: 0.1 },
    },
  },
  "mean-reversion": {
    title: "Mean Reversion",
    desc: "Gravitational pull towards recent average price",
    icon: "🔄",
    paramsMeta: {
      strength: { label: "Pull Strength", min: 0, max: 0.1, step: 0.005 },
      window: { label: "Window (ticks)", min: 5, max: 100, step: 5 },
    },
  },
  liquidity: {
    title: "Liquidity Sweeps & Stop Hunts",
    desc: "Triggers breakout/sweep behavior near key levels",
    icon: "🎯",
    paramsMeta: {
      sweepProbability: { label: "Sweep Prob.", min: 0, max: 0.5, step: 0.05 },
      proximity: { label: "Proximity Range", min: 0.1, max: 2, step: 0.1 },
      pushScale: { label: "Push Scale", min: 0.05, max: 0.5, step: 0.05 },
    },
  },
};

export function ComponentPanel() {
  const {
    components,
    phases,
    setComponentEnabled,
    setComponentParam,
    setPhases,
    isLoading,
    dirty,
    error,
    tickCount,
    seed,
    playback,
  } = useChartStore();
  const ids = Object.keys(components);

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    // Preset = set penuh: salin seluruh config preset, sehingga preset benar-benar
    // sumber kebenaran dan badge preset selalu aktif setelah diterapkan.
    useChartStore.getState().setComponents(cloneComponents(preset.config));
    useChartStore.getState().setPhases(null);
  };

  const addPhase = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    const next = [...(phases ?? []), { components: cloneComponents(preset.config), count: 2500 }];
    setPhases(next);
  };

  const removePhase = (index: number) => {
    const next = [...(phases ?? [])];
    next.splice(index, 1);
    setPhases(next.length > 0 ? next : null);
  };

  const setPhaseCount = (index: number, value: number) => {
    const count = Number.isFinite(value) ? Math.max(100, Math.round(value)) : 2500;
    const next = [...(phases ?? [])];
    next[index] = { ...next[index], count };
    setPhases(next);
  };

  // Drag berbasis pointer (bukan HTML5 DnD): kompatibel dengan WebView2/Tauri.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const reorderPhase = (from: number, to: number) => {
    if (from === to) return;
    const current = useChartStore.getState().phases;
    if (!current) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    useChartStore.getState().setPhases(next);
  };

  const activeKey = activePresetId(components);
  const activeDesc =
    activeKey === "custom" ? "Konfigurasi komponen diedit manual, tidak sesuai preset mana pun." : PRESETS[activeKey].desc;

  let phaseAcc = 0;
  const phaseBounds = (phases ?? []).map((p) => (phaseAcc += p.count));
  // Index playback = jumlah tick yang sudah diproses; fase ke-i aktif selama
  // batas kumulatif sebelumnya < index <= batas kumulatif fase ke-i.
  const activePhase =
    playback.index > 0 ? phaseBounds.findIndex((bound) => playback.index <= bound) : -1;

  return (
    <div className="component-panel-container">
      <div className="cp-presets-section">
        <div className="cp-section-title">Market Presets</div>
        <div className="cp-presets-grid">
          {Object.entries(PRESETS).map(([key, p]) => {
            const active = activeKey === key;
            return (
              <button
                key={key}
                className={`cp-preset-chip ${active ? "is-active" : ""}`}
                title={p.desc}
                onClick={() => applyPreset(key)}
                disabled={isLoading}
                aria-pressed={active}
              >
                <span className="cp-preset-label">{p.label}</span>
                {active && (
                  <span className="cp-preset-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="cp-preset-desc">{activeDesc}</div>
      </div>

      <div className="cp-phases-section">
        <div className="cp-section-title">Simulation Phases</div>
        <div className="cp-phases-add-row">
          {Object.entries(PRESETS).map(([key, p]) => (
            <button
              key={key}
              className="cp-phase-add"
              onClick={() => addPhase(key)}
              disabled={isLoading}
              title={`Append "${p.label}" as a phase`}
            >
              + {p.label}
            </button>
          ))}
        </div>
        {phases && phases.length > 0 ? (
          <>
            <div className="cp-phases-list">
              {phases.map((ph, i) => {
                const pid = activePresetId(ph.components);
                const label = pid === "custom" ? "Custom" : PRESETS[pid].label;
                const active = i === activePhase;
                const isDragging = dragIndex === i;
                return (
                  <div
                    key={i}
                    data-index={i}
                    className={`cp-phase-row ${active ? "is-active" : ""} ${isDragging ? "is-dragging" : ""}`}
                  >
                    <span
                      className="cp-phase-drag"
                      onPointerDown={(e) => {
                        if (isLoading) return;
                        e.preventDefault();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        dragIndexRef.current = i;
                        setDragIndex(i);
                      }}
                      onPointerMove={(e) => {
                        const from = dragIndexRef.current;
                        if (from === null) return;
                        e.preventDefault();
                        const row = document
                          .elementFromPoint(e.clientX, e.clientY)
                          ?.closest(".cp-phase-row");
                        if (!row) return;
                        const to = Number(row.getAttribute("data-index"));
                        if (Number.isFinite(to) && to !== from) {
                          reorderPhase(from, to);
                          dragIndexRef.current = to;
                          setDragIndex(to);
                        }
                      }}
                      onPointerUp={() => {
                        dragIndexRef.current = null;
                        setDragIndex(null);
                      }}
                      onPointerCancel={() => {
                        dragIndexRef.current = null;
                        setDragIndex(null);
                      }}
                      title={isLoading ? undefined : "Drag untuk mengubah urutan"}
                      aria-label={`Reorder phase ${i + 1}`}
                    >
                      ⋮⋮
                    </span>
                    <span className="cp-phase-index">{i + 1}.</span>
                    <span className="cp-phase-label">
                      {label}
                      {active && (
                        <span className="cp-phase-live" title="Fase yang sedang berlangsung" aria-hidden="true" />
                      )}
                    </span>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={ph.count}
                      onChange={(e) => setPhaseCount(i, parseFloat(e.target.value))}
                      disabled={isLoading}
                      className="cp-phase-count"
                      aria-label={`Ticks for phase ${i + 1}`}
                    />
                    <button
                      className="cp-phase-remove"
                      onClick={() => removePhase(i)}
                      disabled={isLoading}
                      aria-label={`Remove phase ${i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="cp-phases-footer">
              <span className="cp-phases-total">
                Total: {phases.reduce((s, p) => s + p.count, 0).toLocaleString()} ticks
              </span>
              <button className="cp-phases-clear" onClick={() => setPhases(null)} disabled={isLoading}>
                Clear phases
              </button>
            </div>
          </>
        ) : (
          <div className="cp-phases-empty">
            Susun urutan rezim (mis. Balanced → Bear → Bull). State engine kontinu melintasi batas fase.
          </div>
        )}
      </div>

      <div className="cp-cards-list">
        {ids.map((id) => {
          const cfg = components[id];
          const meta = METADATA[id] ?? {
            title: id,
            desc: "Custom component",
            icon: "⚙️",
            paramsMeta: {},
          };
          const paramKeys = Object.keys(cfg.params);

          return (
            <div key={id} className={`cp-card ${cfg.enabled ? "is-active" : "is-disabled"}`}>
              <div className="cp-card-header">
                <div className="cp-card-title-group">
                  <span className="cp-card-icon">{meta.icon}</span>
                  <div>
                    <div className="cp-card-title">{meta.title}</div>
                    <div className="cp-card-desc">{meta.desc}</div>
                  </div>
                </div>

                <label className="cp-switch" title={cfg.enabled ? "Disable component" : "Enable component"}>
                  <input
                    type="checkbox"
                    checked={cfg.enabled}
                    onChange={(e) => setComponentEnabled(id, e.target.checked)}
                  />
                  <span className="cp-slider" />
                </label>
              </div>

              {cfg.enabled && paramKeys.length > 0 && (
                <div className="cp-card-params">
                  {paramKeys.map((key) => {
                    const pMeta = meta.paramsMeta[key] ?? {
                      label: key,
                      min: 0,
                      max: 10,
                      step: 0.1,
                    };
                    const val = cfg.params[key];

                    return (
                      <div key={key} className="cp-param-row">
                        <div className="cp-param-info">
                          <span className="cp-param-label">{pMeta.label}</span>
                          <span className="cp-param-value">{val}</span>
                        </div>
                        <div className="cp-param-controls">
                          <input
                            type="range"
                            min={pMeta.min}
                            max={pMeta.max}
                            step={pMeta.step}
                            value={val}
                            onChange={(e) => setComponentParam(id, key, parseFloat(e.target.value))}
                            className="cp-range-slider"
                          />
                          <input
                            type="number"
                            step={pMeta.step}
                            value={val}
                            onChange={(e) => setComponentParam(id, key, parseFloat(e.target.value) || 0)}
                            className="cp-number-input"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="cp-footer-actions">
        {seed === 0 && (
          <div className="cp-status cp-status-warn" role="status">
            Seed 0 menghasilkan pergerakan yang sangat monoton (bukan variasi).
          </div>
        )}

        {error && (
          <div className="cp-status cp-status-error" role="alert">
            Gagal membuat data: {error}
          </div>
        )}

        {dirty && !isLoading && (
          <div className="cp-status cp-status-dirty" role="status">
            <span className="cp-status-dot" />
            Konfigurasi berubah — klik "Re-generate" di header untuk menerapkan ke chart.
          </div>
        )}

        {!isLoading && tickCount > 0 && (
          <div className="cp-ready-note">
            Data siap: {tickCount.toLocaleString()} tick (seed {seed}).
          </div>
        )}
      </div>
    </div>
  );
}
