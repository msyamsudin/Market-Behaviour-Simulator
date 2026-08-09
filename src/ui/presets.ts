import { DEFAULT_COMPONENTS, cloneComponents, type ComponentConfig } from "../app/chartStore";

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
    // Sumber kebenaran tunggal: DEFAULT_COMPONENTS di chartStore (disalin agar
    // referensi preset tidak sama dengan objek yang dipegang store).
    config: cloneComponents(DEFAULT_COMPONENTS),
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
  bearTrend: {
    label: "Bear Trend Sell-off",
    desc: "Persistent downward drift with heavy selling pressure",
    // Cermin dari strongTrend, namun lebih landai (strength 0.012 vs 0.025):
    // drift -0.0072/tick menjaga harga tidak menyentuh floor 0.01 dalam
    // 7500 tick (cermin simetris mustahil karena floor clamp di generator).
    config: {
      noise: { enabled: true, params: { noiseLevel: 0.08 } },
      trend: { enabled: true, params: { trendStrength: 0.012, trendBias: -0.6 } },
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
  rangeFakeouts: {
    label: "Ranging with Fakeouts",
    desc: "Tight horizontal channel with frequent sweeps at the edges",
    // Channel kuat (MR tinggi, tanpa tren) + dorongan likuiditas di tepi level.
    config: {
      noise: { enabled: true, params: { noiseLevel: 0.1 } },
      trend: { enabled: false, params: { trendStrength: 0, trendBias: 0 } },
      volatility: { enabled: true, params: { omega: 0.0004, alpha: 0.06, beta: 0.85, scale: 1 } },
      "mean-reversion": { enabled: true, params: { strength: 0.03, window: 25 } },
      liquidity: { enabled: true, params: { sweepProbability: 0.35, proximity: 1, pushScale: 0.25 } },
    },
  },
  quiet: {
    label: "Quiet / Low Volatility",
    desc: "Minimal noise and variance — flat, low-activity market",
    config: {
      noise: { enabled: true, params: { noiseLevel: 0.03 } },
      trend: { enabled: false, params: { trendStrength: 0.005, trendBias: 0 } },
      volatility: { enabled: true, params: { omega: 0.0002, alpha: 0.05, beta: 0.85, scale: 0.4 } },
      "mean-reversion": { enabled: true, params: { strength: 0.01, window: 30 } },
      liquidity: { enabled: false, params: { sweepProbability: 0.1, proximity: 0.5, pushScale: 0.1 } },
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
 *
 * Pencocokan dua arah: key set harus identik (bukan hanya preset ⊆ komponen),
 * sehingga komponen tambahan di state membuat status "custom", bukan preset.
 */
export function activePresetId(components: Record<string, ComponentConfig>): string | "custom" {
  const currentIds = Object.keys(components);
  for (const [key, preset] of Object.entries(PRESETS)) {
    const presetIds = Object.keys(preset.config);
    if (presetIds.length !== currentIds.length) continue;
    const matches = presetIds.every((id) => configEquals(components[id], preset.config[id]));
    if (matches) return key;
  }
  return "custom";
}
