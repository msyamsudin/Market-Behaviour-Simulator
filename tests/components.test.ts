import { describe, expect, it } from "vitest";
import { createComponent } from "../src/engine/tick/components";
import { generateComponentTicks } from "../src/engine/tick/component-tick-generator";
import type { ActiveComponent } from "../src/engine/tick/component-tick-generator";

// Mulai 10:00 UTC (sesi London, multiplier 1.0) agar pengujian komponen
// tidak terganggu scaling sesi.
const startTime = Math.floor(Date.UTC(2026, 0, 2, 10, 0, 0) / 1000);

function run(count: number, components: ActiveComponent[]): { prices: number[]; deltas: number[] } {
  const ticks = generateComponentTicks({
    seed: 99,
    count,
    startPrice: 100,
    startTime,
    tickIntervalSeconds: 1,
    baseVolume: 10,
    components,
  });
  const prices = ticks.map((t) => t.price);
  const deltas: number[] = [];
  for (let i = 1; i < prices.length; i++) deltas.push(prices[i] - prices[i - 1]);
  return { prices, deltas };
}

function std(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  const variance = xs.reduce((s, v) => s + (v - mean) * (v - mean), 0) / xs.length;
  return Math.sqrt(variance);
}

function priceRange(prices: number[]): number {
  return Math.max(...prices) - Math.min(...prices);
}

function acfLag1(xs: number[]): number {
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  let num = 0;
  let den = 0;
  for (let i = 1; i < xs.length; i++) {
    num += (xs[i] - mean) * (xs[i - 1] - mean);
  }
  for (let i = 0; i < xs.length; i++) {
    den += (xs[i] - mean) * (xs[i] - mean);
  }
  return den === 0 ? 0 : num / den;
}

describe("Komponen bukan dekoratif (M9)", () => {
  it("off noise → jalur mulus (std delta jauh lebih kecil)", () => {
    const noiseOn = run(2000, [
      { component: createComponent("noise", { noiseLevel: 1 }), enabled: true },
      { component: createComponent("trend", { trendStrength: 0.05, trendBias: 0.5 }), enabled: true },
    ]);
    const noiseOff = run(2000, [
      { component: createComponent("noise", { noiseLevel: 1 }), enabled: false },
      { component: createComponent("trend", { trendStrength: 0.05, trendBias: 0.5 }), enabled: true },
    ]);
    expect(std(noiseOff.deltas)).toBeLessThan(0.01);
    expect(std(noiseOn.deltas)).toBeGreaterThan(0.5);
  });

  it("off mean-reversion → range melebar (random walk, tidak tertarik ke mean)", () => {
    const mrOn = run(3000, [
      { component: createComponent("noise", { noiseLevel: 0.5 }), enabled: true },
      { component: createComponent("mean-reversion", { strength: 0.1, window: 20 }), enabled: true },
    ]);
    const mrOff = run(3000, [
      { component: createComponent("noise", { noiseLevel: 0.5 }), enabled: true },
      { component: createComponent("mean-reversion", { strength: 0.1, window: 20 }), enabled: false },
    ]);
    expect(priceRange(mrOff.prices)).toBeGreaterThan(priceRange(mrOn.prices) * 3);
  });

  it("off trend → drift hilang (perubahan rata-rata mendekati nol)", () => {
    const trendOn = run(3000, [
      { component: createComponent("noise", { noiseLevel: 0.05 }), enabled: true },
      { component: createComponent("trend", { trendStrength: 0.05, trendBias: 1 }), enabled: true },
    ]);
    const trendOff = run(3000, [
      { component: createComponent("noise", { noiseLevel: 0.05 }), enabled: true },
      { component: createComponent("trend", { trendStrength: 0.05, trendBias: 1 }), enabled: false },
    ]);
    const driftOn = trendOn.prices[trendOn.prices.length - 1] - trendOn.prices[0];
    const driftOff = Math.abs(trendOff.prices[trendOff.prices.length - 1] - trendOff.prices[0]);
    expect(driftOn).toBeGreaterThan(50);
    expect(driftOff).toBeLessThan(10);
  });

  it("volatility on → clustering volatilitas (autokorelasi return kuadrat lebih tinggi)", () => {
    const volOn = run(5000, [
      { component: createComponent("noise", { noiseLevel: 0.05 }), enabled: true },
      { component: createComponent("volatility"), enabled: true },
    ]);
    const volOff = run(5000, [
      { component: createComponent("noise", { noiseLevel: 0.05 }), enabled: true },
      { component: createComponent("volatility"), enabled: false },
    ]);
    const sqOn = volOn.deltas.map((d) => d * d);
    const sqOff = volOff.deltas.map((d) => d * d);
    expect(acfLag1(sqOn)).toBeGreaterThan(acfLag1(sqOff) + 0.05);
    expect(acfLag1(sqOn)).toBeGreaterThan(0);
  });
});
