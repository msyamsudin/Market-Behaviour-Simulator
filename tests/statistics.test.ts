import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCSVTicks } from "../src/utils/csv";
import {
  autocorrelationSquaredReturns,
  computeReturns,
  kurtosis,
  mean,
  skewness,
  std,
  summarizeTicks,
} from "../src/engine/statistics/metrics";
import { compareTicks } from "../src/engine/statistics/compare";

describe("metrics dasar (M10)", () => {
  it("mean/std/skew/kurtosis konsisten", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(mean(xs)).toBe(3);
    // std = sample std (pembagi n-1): variance 10/4 = 2.5.
    expect(std(xs)).toBeCloseTo(Math.sqrt(2.5), 10);
    expect(skewness([1, 1, 1, 1, 10, 1, 1, 1, 1])).toBeGreaterThan(0);
    // Data ~uniform → excess kurtosis negatif (~-1.2) dengan sample std.
    expect(kurtosis([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBeCloseTo(-1.2, 1);
  });

  it("computeReturns menghasilkan n-1 return", () => {
    const ticks = [
      { time: 1, price: 100, volume: 1 },
      { time: 2, price: 110, volume: 1 },
      { time: 3, price: 121, volume: 1 },
    ];
    const returns = computeReturns(ticks);
    expect(returns).toHaveLength(2);
    expect(returns[0]).toBeCloseTo(0.1, 10);
    expect(returns[1]).toBeCloseTo(0.1, 10);
  });

  it("autocorrelationSquaredReturns berada dalam [-1,1]", () => {
    const returns = [0.1, -0.2, 0.05, 0.3, -0.1, 0.02, 0.15, -0.05, 0.07, 0.2, -0.12, 0.09];
    const acf = autocorrelationSquaredReturns(returns, 3);
    expect(acf).toHaveLength(3);
    for (const v of acf) {
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });

  it("summarizeTicks pada file dummy menghasilkan angka yang masuk akal", () => {
    const csv = readFileSync("public/dummy-ticks.csv", "utf8");
    const ticks = parseCSVTicks(csv);
    const stats = summarizeTicks(ticks, 60);
    expect(stats.density.tickCount).toBe(1500);
    expect(stats.density.candleCount).toBe(25);
    expect(stats.density.ticksPerSecond).toBeCloseTo(1, 2);
    expect(stats.density.avgCandleRange).toBeGreaterThan(0);
    expect(stats.returns.count).toBe(1499);
    expect(Number.isFinite(stats.returns.mean)).toBe(true);
    expect(stats.returns.std).toBeGreaterThan(0);
    expect(Number.isFinite(stats.returns.skewness)).toBe(true);
    expect(Number.isFinite(stats.returns.kurtosis)).toBe(true);
    expect(stats.clustering.acfSqReturns).toHaveLength(5);
  });
});

describe("compareTicks (M10)", () => {
  it("menghasilkan perbandingan numerik historical vs synthetic", async () => {
    const csv = readFileSync("public/dummy-ticks.csv", "utf8");
    const hist = parseCSVTicks(csv);
    const synth = parseCSVTicks(
      "time,price,volume\n0,100,1\n1,100.5,2\n2,101,1\n3,99.5,3\n",
    );
    const rows = compareTicks(hist, synth);
    expect(rows.length).toBeGreaterThan(5);
    const names = rows.map((r) => r.metric);
    expect(names).toContain("return mean");
    expect(names).toContain("return std");
    expect(names).toContain("ACF sq. return lag 1");
    expect(names).toContain("tick density (ticks/sec)");
    for (const row of rows) {
      expect(Number.isFinite(row.historical)).toBe(true);
      expect(Number.isFinite(row.synthetic)).toBe(true);
    }
  });
});
