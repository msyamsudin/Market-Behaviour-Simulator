import { describe, expect, it } from "vitest";
import { OrderBookEngine } from "../src/engine/orderbook/orderbook";
import { generateOrderbookTicks } from "../src/engine/orderbook/orderbook-tick-generator";
import { createComponent } from "../src/engine/tick/components";
import type { ActiveComponent } from "../src/engine/tick/component-tick-generator";

const startTime = Math.floor(Date.UTC(2026, 0, 2, 10, 0, 0) / 1000);

function run(count: number, components: ActiveComponent[], extra: Partial<Record<string, number>> = {}) {
  return generateOrderbookTicks({
    seed: 7,
    count,
    startPrice: 100,
    startTime,
    tickIntervalSeconds: 1,
    baseVolume: 15,
    spread: 0.02,
    depth: 12,
    depthSize: 20,
    components,
    ...extra,
  });
}

const BASE: ActiveComponent[] = [
  { component: createComponent("noise", { noiseLevel: 0.2 }), enabled: true },
  { component: createComponent("trend", { trendStrength: 0.02, trendBias: 0.5 }), enabled: true },
];

describe("OrderBookEngine", () => {
  it("seed → book terisi simetris dengan spread rapat", () => {
    const rng = () => 0.5;
    const book = new OrderBookEngine();
    book.seed(100, 0.02, 12, 20, rng);
    expect(book.spread()).toBeCloseTo(0.02);
    expect(book.bestBid()).toBeCloseTo(99.99);
    expect(book.bestAsk()).toBeCloseTo(100.01);
  });

  it("market bid mengkonsumsi ask terendah dan mengembalikan trade", () => {
    const rng = () => 0.5;
    const book = new OrderBookEngine();
    book.seed(100, 0.02, 12, 20, rng);
    const topAsk = book.bestAsk()!;
    const topSize = book.snapshot(0, 1, null, null).asks[0].size;
    const trades = book.market("bid", topSize);
    expect(trades.length).toBeGreaterThan(0);
    expect(trades[0].price).toBe(topAsk);
    expect(trades[0].size).toBe(topSize);
    // Setelah ask teratas terisi habis, best ask naik satu level → harga naik.
    expect(book.bestAsk()).toBeGreaterThan(topAsk);
    // Snapshot merekam eksekusi untuk menandai level yang terserap.
    const snap = book.snapshot(0, 12, topAsk, "buy", trades);
    expect(snap.trades).toEqual(trades);
    expect(snap.trades[0].price).toBe(topAsk);
  });

  it("fill parsial → sisa antrian tetap di harga yang sama (persisten)", () => {
    const rng = () => 0.5;
    const book = new OrderBookEngine();
    book.seed(100, 0.02, 12, 20, rng);
    const topAsk = book.bestAsk()!;
    const topSize = book.snapshot(0, 1, null, null).asks[0].size;
    const fill = Math.max(1, Math.floor(topSize / 2));
    const trades = book.market("bid", fill);
    expect(trades[0].price).toBe(topAsk);
    expect(trades[0].size).toBe(fill);
    // Harga best ask TIDAK bergeser karena antrian masih tersisa di level itu.
    expect(book.bestAsk()).toBe(topAsk);
    expect(book.snapshot(0, 1, null, null).asks[0].size).toBe(topSize - fill);
  });

  it("market order besar menghabiskan beberapa level", () => {
    const rng = () => 0.5;
    const book = new OrderBookEngine();
    book.seed(100, 0.02, 12, 20, rng);
    const perLevel = book.snapshot(0, 1, null, null).asks[0].size;
    const trades = book.market("bid", perLevel * 2 + 5);
    expect(trades.reduce((s, t) => s + t.size, 0)).toBe(perLevel * 2 + 5);
    expect(trades.length).toBe(3); // perLevel + perLevel + sisa
  });

  it("snapshot membatasi depth level per sisi", () => {
    const rng = () => 0.5;
    const book = new OrderBookEngine();
    book.seed(100, 0.02, 12, 20, rng);
    const snap = book.snapshot(0, 5, 100.01, "buy");
    expect(snap.asks.length).toBe(5);
    expect(snap.bids.length).toBe(5);
    expect(snap.asks[0].price).toBeLessThan(snap.asks[1].price);
    expect(snap.bids[0].price).toBeGreaterThan(snap.bids[1].price);
  });
});

describe("generateOrderbookTicks (order-driven)", () => {
  it("menghasilkan tick + snapshot yang sejajar (jumlah sama)", () => {
    const { ticks, snapshots } = run(1000, BASE);
    expect(ticks.length).toBe(1000);
    expect(snapshots.length).toBe(ticks.length);
  });

  it("setiap tick adalah hasil trade (volume ≥ 1, harga masuk akal)", () => {
    const { ticks } = run(1000, BASE);
    for (const t of ticks) {
      expect(t.volume).toBeGreaterThanOrEqual(1);
      expect(t.price).toBeGreaterThan(0);
      expect(t.side).toBeDefined();
    }
  });

  it("snapshot memiliki best bid < best ask (book tidak crossed)", () => {
    const { snapshots } = run(2000, BASE);
    for (const s of snapshots) {
      if (s.bestBid !== null && s.bestAsk !== null) {
        expect(s.bestBid).toBeLessThan(s.bestAsk);
      }
      expect(s.spread).toBeGreaterThan(0);
    }
  });

  it("deterministik terhadap seed", () => {
    const a = run(500, BASE);
    const b = run(500, BASE);
    expect(a.ticks).toEqual(b.ticks);
    expect(a.snapshots).toEqual(b.snapshots);
  });

  it("trend bias kuat → drift harga positif (harga terbentuk dari aliran order)", () => {
    const { ticks } = run(4000, [
      { component: createComponent("trend", { trendStrength: 0.05, trendBias: 1 }), enabled: true },
    ]);
    const drift = ticks[ticks.length - 1].price - ticks[0].price;
    expect(drift).toBeGreaterThan(0);
  });
});
