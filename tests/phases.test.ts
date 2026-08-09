import { describe, expect, it } from "vitest";
import { createComponent } from "../src/engine/tick/components";
import { generateComponentTicks } from "../src/engine/tick/component-tick-generator";
import { generateOrderbookTicks } from "../src/engine/orderbook/orderbook-tick-generator";
import type { ActiveComponent, ComponentPhase } from "../src/engine/tick/component-tick-generator";

// Mulai 10:00 UTC (sesi London, multiplier 1.0) agar pengujian komponen
// tidak terganggu scaling sesi.
const startTime = Math.floor(Date.UTC(2026, 0, 2, 10, 0, 0) / 1000);

function bull(): ActiveComponent[] {
  return [
    { component: createComponent("noise", { noiseLevel: 0.05 }), enabled: true },
    { component: createComponent("trend", { trendStrength: 0.02, trendBias: 1 }), enabled: true },
  ];
}

function bear(): ActiveComponent[] {
  return [
    { component: createComponent("noise", { noiseLevel: 0.05 }), enabled: true },
    { component: createComponent("trend", { trendStrength: 0.02, trendBias: -1 }), enabled: true },
  ];
}

describe("Simulasi multi-fase", () => {
  it("jumlah tick = total count semua fase, waktu kontinu tanpa lompatan", () => {
    const phases: ComponentPhase[] = [
      { count: 1000, components: bull() },
      { count: 500, components: bear() },
      { count: 250, components: bull() },
    ];
    const ticks = generateComponentTicks({
      seed: 99,
      count: 99999,
      startPrice: 100,
      startTime,
      tickIntervalSeconds: 1,
      baseVolume: 10,
      components: bull(),
      phases,
    });
    expect(ticks).toHaveLength(1750);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].time - ticks[i - 1].time).toBe(1);
    }
  });

  it("harga kontinu di batas fase (tidak reset ke startPrice)", () => {
    const phases: ComponentPhase[] = [
      { count: 2000, components: bull() },
      { count: 2000, components: bear() },
    ];
    const ticks = generateComponentTicks({
      seed: 99,
      count: 0,
      startPrice: 100,
      startTime,
      tickIntervalSeconds: 1,
      baseVolume: 10,
      components: bull(),
      phases,
    });
    let maxJump = 0;
    for (let i = 1; i < ticks.length; i++) {
      maxJump = Math.max(maxJump, Math.abs(ticks[i].price - ticks[i - 1].price));
    }
    // Delta per tick terbatas (noise 0.05 + drift 0.02) — jika harga di-reset,
    // lompatan di batas fase akan jauh lebih besar.
    expect(maxJump).toBeLessThan(1);
    expect(ticks[1999].price).toBeGreaterThan(110);
    // Fase kedua melanjutkan dari harga fase pertama, lalu turun.
    expect(ticks[2000].price).toBeGreaterThan(ticks[1999].price - 0.5);
    expect(ticks[3999].price).toBeLessThan(ticks[1999].price);
  });

  it("perilaku berubah di batas fase: paruh pertama naik, paruh kedua turun", () => {
    const phases: ComponentPhase[] = [
      { count: 2500, components: bull() },
      { count: 2500, components: bear() },
    ];
    const ticks = generateComponentTicks({
      seed: 7,
      count: 0,
      startPrice: 100,
      startTime,
      tickIntervalSeconds: 1,
      baseVolume: 10,
      components: bull(),
      phases,
    });
    const first = ticks.slice(0, 2500);
    const second = ticks.slice(2500);
    const drift = (xs: { price: number }[]) => xs[xs.length - 1].price - xs[0].price;
    expect(drift(first)).toBeGreaterThan(20);
    expect(drift(second)).toBeLessThan(-20);
  });

  it("deterministik: seed + fase sama menghasilkan seri identik", () => {
    const phases: ComponentPhase[] = [
      { count: 800, components: bull() },
      { count: 400, components: bear() },
    ];
    const run = () =>
      generateComponentTicks({
        seed: 42,
        count: 0,
        startPrice: 100,
        startTime,
        tickIntervalSeconds: 1,
        baseVolume: 10,
        components: bull(),
        phases,
      });
    expect(run()).toEqual(run());
  });

  it("tanpa phases → setara dengan perilaku lama (count + components tunggal)", () => {
    const single = generateComponentTicks({
      seed: 7,
      count: 500,
      startPrice: 100,
      startTime,
      tickIntervalSeconds: 1,
      baseVolume: 10,
      components: bull(),
    });
    const phased = generateComponentTicks({
      seed: 7,
      count: 500,
      startPrice: 100,
      startTime,
      tickIntervalSeconds: 1,
      baseVolume: 10,
      components: bull(),
      phases: [{ count: 500, components: bull() }],
    });
    expect(phased).toEqual(single);
  });

  it("orderbook: tick & snapshot = total fase, book kontinu", () => {
    const phases: ComponentPhase[] = [
      { count: 300, components: bull() },
      { count: 200, components: bear() },
    ];
    const res = generateOrderbookTicks({
      seed: 99,
      count: 0,
      startPrice: 100,
      startTime,
      tickIntervalSeconds: 1,
      baseVolume: 10,
      spread: 0.02,
      depth: 6,
      depthSize: 10,
      components: bull(),
      phases,
    });
    expect(res.ticks).toHaveLength(500);
    expect(res.snapshots).toHaveLength(500);
    const drift = res.ticks[res.ticks.length - 1].price - res.ticks[0].price;
    // 300 tick bull + 200 tick bear → netto tetap naik karena fase bull lebih
    // panjang (drift efektif terkompresi normalisasi agresivitas); yang penting
    // harga berlanjut dari fase pertama, tidak reset ke 100.
    expect(res.ticks[299].price).toBeGreaterThan(100);
    expect(res.ticks[300].price).toBeGreaterThan(99.5);
    expect(drift).toBeGreaterThan(0);
  });
});
