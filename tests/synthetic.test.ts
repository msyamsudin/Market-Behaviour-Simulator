import { describe, expect, it } from "vitest";
import { aggregateTicks } from "../src/engine/candle/aggregator";
import { buildRenko } from "../src/engine/renko/fixed-renko";
import { createComponent } from "../src/engine/tick/components";
import { generateComponentTicks } from "../src/engine/tick/component-tick-generator";
import { SyntheticTickSource } from "../src/engine/tick/synthetic-tick-source";
import type { TickSource } from "../src/types/tick-source";

const startTime = Math.floor(Date.UTC(2026, 0, 2) / 1000);

const baseParams = {
  seed: 42,
  count: 1500,
  startPrice: 100,
  startTime,
  tickIntervalSeconds: 1,
  noiseLevel: 0.1,
  trendStrength: 0.01,
  trendBias: 0.3,
  baseVolume: 25,
};

const componentParams = {
  seed: 42,
  count: 1500,
  startPrice: 100,
  startTime,
  tickIntervalSeconds: 1,
  baseVolume: 25,
  components: [
    { component: createComponent("noise", { noiseLevel: baseParams.noiseLevel }), enabled: true },
    { component: createComponent("trend", { trendStrength: baseParams.trendStrength, trendBias: baseParams.trendBias }), enabled: true },
  ],
};

// Catatan: generator M8 lama (`generateTicks` di tick-generator.ts) telah
// dihapus — superseded oleh `generateComponentTicks`. Determinisme, jumlah
// tick, dan sifat dasar deret diuji pada pipeline komponen di bawah.

describe("SyntheticTickSource (interchangeable)", () => {
  it("memenuhi interface TickSource", async () => {
    const source: TickSource = new SyntheticTickSource(componentParams);
    expect(source.id).toBe("synthetic");
    const ticks = await source.fetchTicks();
    expect(ticks.length).toBe(componentParams.count);
  });

  it("output mengalir lewat pipeline Track A tanpa modifikasi (bukti interchangeable)", async () => {
    const source = new SyntheticTickSource(componentParams);
    const ticks = await source.fetchTicks();
    const candles = aggregateTicks(ticks, 60);
    expect(candles.length).toBe(25);
    expect(candles[0].open).toBe(ticks[0].price);
    const totalVolume = candles.reduce((s, c) => s + c.volume, 0);
    const tickVolume = ticks.reduce((s, t) => s + t.volume, 0);
    expect(totalVolume).toBe(tickVolume);
    const bricks = buildRenko(ticks, 0.5);
    expect(bricks.length).toBeGreaterThan(0);
  });

  it("generator komponen deterministik", () => {
    expect(generateComponentTicks(componentParams)).toEqual(generateComponentTicks(componentParams));
  });
});
