import { DEFAULT_COMPONENTS, type ComponentConfig } from "../app/chartStore";

export interface PresetDef {
  label: string;
  desc: string;
  config: Record<string, ComponentConfig>;
}

/**
 * Definisi market preset. Dipakai bersama oleh panel kontrol (untuk memilih
 * preset) dan top bar (untuk menampilkan preset aktif saat ini).
 */
export const PRESETS: Record<string, PresetDef> = {
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

function configEquals(a: ComponentConfig | undefined, b: ComponentConfig | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.enabled !== b.enabled) return false;
  const ap = a.params ?? {};
  const bp = b.params ?? {};
  const aKeys = Object.keys(ap);
  const bKeys = Object.keys(bp);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => ap[k] === bp[k]);
}

/**
 * Tentukan preset aktif dari konfigurasi komponen saat ini. Jika tidak cocok
 * dengan preset mana pun (karena diedit manual), kembali ke "custom".
 */
export function activePresetId(components: Record<string, ComponentConfig>): string | "custom" {
  for (const [key, preset] of Object.entries(PRESETS)) {
    const presetIds = Object.keys(preset.config);
    const matches = presetIds.every((id) => configEquals(components[id], preset.config[id]));
    if (matches) return key;
  }
  return "custom";
}
