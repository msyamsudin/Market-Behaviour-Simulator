import { describe, expect, it } from "vitest";
import { createComponent } from "../src/engine/tick/components";
import { generateComponentTicks } from "../src/engine/tick/component-tick-generator";
import { LiquidityTracker, countLevelBreaks, countSweeps } from "../src/engine/market/liquidity";
import type { Candle } from "../src/types/candle";

const start = Math.floor(Date.UTC(2026, 0, 2) / 1000);

function run(seed: number, withLiquidity: boolean) {
  return generateComponentTicks({
    seed,
    count: 10000,
    startPrice: 100,
    startTime: start,
    tickIntervalSeconds: 1,
    baseVolume: 10,
    components: [
      { component: createComponent("noise", { noiseLevel: 0.08 }), enabled: true },
      { component: createComponent("mean-reversion", { strength: 0.05, window: 20 }), enabled: true },
      {
        component: createComponent("liquidity", { sweepProbability: 0.4, proximity: 1.5, pushScale: 0.3 }),
        enabled: withLiquidity,
      },
    ],
  });
}

describe("LiquidityTracker (M11)", () => {
  it("melacak previous high/low dari candle selesai (mengabaikan candle berjalan)", () => {
    const tracker = new LiquidityTracker();
    const completed: Candle[] = [
      { time: 0, open: 100, high: 101, low: 99, close: 100, volume: 1 },
      { time: 60, open: 100, high: 102, low: 98, close: 99, volume: 1 },
    ];
    const forming: Candle = { time: 120, open: 99, high: 105, low: 97, close: 100, volume: 1 };
    tracker.update([...completed, forming], 0.5);
    expect(tracker.prevHigh).toBe(102);
    expect(tracker.prevLow).toBe(98);
  });
});

describe("A/B demo — liquidity engine (M11)", () => {
  it("harga mendekati equal high → level break & sweep lebih sering dengan engine (seed sama)", () => {
    for (const seed of [1, 2, 3]) {
      const off = run(seed, false);
      const on = run(seed, true);
      const breaksOff = countLevelBreaks(off, 60);
      const breaksOn = countLevelBreaks(on, 60);
      const sweepsOff = countSweeps(off, 60, 5);
      const sweepsOn = countSweeps(on, 60, 5);
      expect(breaksOn, `breaks seed ${seed}`).toBeGreaterThan(breaksOff);
      expect(sweepsOn, `sweeps seed ${seed}`).toBeGreaterThan(sweepsOff);
    }
  });
});
