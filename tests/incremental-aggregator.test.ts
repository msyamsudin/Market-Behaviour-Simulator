import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aggregateTicks } from "../src/engine/candle/aggregator";
import { IncrementalCandleAggregator } from "../src/engine/candle/incremental-aggregator";
import { parseCSVTicks } from "../src/utils/csv";
import type { Tick } from "../src/types/tick";

const fixture: Tick[] = [
  { time: 0, price: 10, volume: 5 },
  { time: 1, price: 11, volume: 2 },
  { time: 2, price: 9, volume: 3 },
  { time: 59, price: 12, volume: 4 },
  { time: 60, price: 8, volume: 1 },
  { time: 61, price: 13, volume: 2 },
  { time: 119, price: 14, volume: 6 },
  { time: 120, price: 7, volume: 3 },
];

describe("IncrementalCandleAggregator", () => {
  it("sama dengan aggregateTicks pada fixture manual", () => {
    const agg = new IncrementalCandleAggregator(60);
    const out: ReturnType<typeof aggregateTicks> = [];
    for (const t of fixture) out.push(...agg.add(t));
    out.push(...agg.flush());
    expect(out).toEqual(aggregateTicks(fixture, 60));
  });

  it("sama dengan aggregateTicks pada file dummy penuh (1500 tick)", () => {
    const csv = readFileSync("public/dummy-ticks.csv", "utf8");
    const ticks = parseCSVTicks(csv);
    const agg = new IncrementalCandleAggregator(60);
    const out: ReturnType<typeof aggregateTicks> = [];
    for (const t of ticks) out.push(...agg.add(t));
    out.push(...agg.flush());
    expect(out).toEqual(aggregateTicks(ticks, 60));
    expect(out).toHaveLength(25);
  });

  it("flush + reset menghasilkan agregasi bersih untuk batch berikutnya", () => {
    const agg = new IncrementalCandleAggregator(60);
    for (const t of fixture.slice(0, 4)) agg.add(t);
    const first = agg.flush();
    agg.reset();
    for (const t of fixture.slice(4)) agg.add(t);
    const second = agg.flush();
    expect(first.length + second.length).toBeGreaterThan(0);
    expect(second[second.length - 1].time).toBe(120);
  });
});
