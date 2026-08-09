import { useChartStore, DEFAULT_COMPONENTS, type ComponentConfig } from "../app/chartStore";

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

const PRESETS: Record<string, { label: string; desc: string; config: Record<string, ComponentConfig> }> = {
  default: {
    label: "Balanced Market",
    desc: "Standard market simulation with moderate trend and volatility",
    // Sumber kebenaran tunggal: DEFAULT_COMPONENTS di chartStore.
    config: DEFAULT_COMPONENTS,
  },
  strongTrend: {
    label: "Bull Trend Rally",
    desc: "High directional drift with persistent momentum",
    config: {
      noise: { enabled: true, params: { noiseLevel: 0.08 } },
      trend: { enabled: true, params: { trendStrength: 0.025, trendBias: 0.8 } },
      volatility: { enabled: true, params: { omega: 0.0003, alpha: 0.08, beta: 0.88, scale: 1 } },
      "mean-reversion": { enabled: false, params: { strength: 0.01, window: 30 } },
      liquidity: { enabled: false, params: { sweepProbability: 0.1, proximity: 0.5, pushScale: 0.1 } },
    },
  },
  highVolatility: {
    label: "Volatile Shocks",
    desc: "High variance clustering and sharp price spikes",
    config: {
      noise: { enabled: true, params: { noiseLevel: 0.15 } },
      trend: { enabled: false, params: { trendStrength: 0.005, trendBias: 0 } },
      volatility: { enabled: true, params: { omega: 0.0008, alpha: 0.22, beta: 0.75, scale: 1.8 } },
      "mean-reversion": { enabled: true, params: { strength: 0.015, window: 15 } },
      liquidity: { enabled: true, params: { sweepProbability: 0.25, proximity: 0.8, pushScale: 0.25 } },
    },
  },
  rangeBound: {
    label: "Ranging / Mean Reverting",
    desc: "Oscillating market stuck in tight horizontal channel",
    config: {
      noise: { enabled: true, params: { noiseLevel: 0.1 } },
      trend: { enabled: false, params: { trendStrength: 0, trendBias: 0 } },
      volatility: { enabled: true, params: { omega: 0.0003, alpha: 0.05, beta: 0.85, scale: 0.8 } },
      "mean-reversion": { enabled: true, params: { strength: 0.045, window: 25 } },
      liquidity: { enabled: false, params: { sweepProbability: 0.1, proximity: 0.5, pushScale: 0.1 } },
    },
  },
  liquiditySweeps: {
    label: "Stop Hunt / Sweep Mode",
    desc: "Frequent fakeouts and liquidity level sweeps",
    config: {
      noise: { enabled: true, params: { noiseLevel: 0.09 } },
      trend: { enabled: true, params: { trendStrength: 0.005, trendBias: 0.1 } },
      volatility: { enabled: true, params: { omega: 0.0004, alpha: 0.12, beta: 0.82, scale: 1.2 } },
      "mean-reversion": { enabled: true, params: { strength: 0.02, window: 20 } },
      liquidity: { enabled: true, params: { sweepProbability: 0.35, proximity: 0.7, pushScale: 0.3 } },
    },
  },
};

export function ComponentPanel() {
  const {
    components,
    setComponentEnabled,
    setComponentParam,
    isLoading,
    dirty,
    error,
    tickCount,
    seed,
  } = useChartStore();
  const ids = Object.keys(components);

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    const current = useChartStore.getState().components;
    const next: Record<string, ComponentConfig> = { ...current };
    for (const [id, cfg] of Object.entries(preset.config)) {
      next[id] = { enabled: cfg.enabled, params: { ...cfg.params } };
    }
    useChartStore.getState().setComponents(next);
  };

  return (
    <div className="component-panel-container">
      <div className="cp-presets-section">
        <div className="cp-section-title">Market Presets</div>
        <div className="cp-presets-grid">
          {Object.entries(PRESETS).map(([key, p]) => (
            <button
              key={key}
              className="cp-preset-chip"
              title={p.desc}
              onClick={() => applyPreset(key)}
              disabled={isLoading}
            >
              {p.label}
            </button>
          ))}
        </div>
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
