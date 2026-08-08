import { describe, expect, it } from "vitest";
import { createComponent } from "../src/engine/tick/components";
import { generateComponentTicks } from "../src/engine/tick/component-tick-generator";
import { SESSIONS, sessionAt } from "../src/engine/market/session";
import { computeReturns, std } from "../src/engine/statistics/metrics";

const DAY = Date.UTC(2026, 0, 2) / 1000;

function hourUtc(h: number): number {
  return Date.UTC(2026, 0, 2, h, 0, 0) / 1000;
}

describe("Session Engine (M12)", () => {
  it("sessionAt memetakan jam UTC ke sesi yang benar", () => {
    expect(sessionAt(hourUtc(2)).id).toBe("asia");
    expect(sessionAt(hourUtc(8)).id).toBe("london");
    expect(sessionAt(hourUtc(14)).id).toBe("overlap");
    expect(sessionAt(hourUtc(17)).id).toBe("newyork");
    expect(sessionAt(hourUtc(23)).id).toBe("offpeak");
  });

  it("jadwal menutup 24 jam tanpa celah", () => {
    let total = 0;
    for (const s of SESSIONS) {
      total += s.toHour - s.fromHour;
    }
    expect(total).toBe(24);
  });

  it("multiplier overlap > asia (sesuai desain)", () => {
    const asia = SESSIONS.find((s) => s.id === "asia")!;
    const overlap = SESSIONS.find((s) => s.id === "overlap")!;
    expect(overlap.multipliers.volatility).toBeGreaterThan(asia.multipliers.volatility);
    expect(overlap.multipliers.noise).toBeGreaterThan(asia.multipliers.noise);
  });
});

describe("Statistik M10 berbeda per sesi (M12)", () => {
  function genInSession(seed: number, startHour: number): number[] {
    const ticks = generateComponentTicks({
      seed,
      count: 3600,
      startPrice: 100,
      startTime: hourUtc(startHour),
      tickIntervalSeconds: 1,
      baseVolume: 10,
      components: [{ component: createComponent("noise", { noiseLevel: 0.5 }), enabled: true }],
    });
    return computeReturns(ticks);
  }

  it("volatilitas (std return) overlap lebih tinggi dari Asia sesuai multiplier noise", () => {
    const asia = std(genInSession(5, 2));
    const overlap = std(genInSession(5, 14));
    expect(overlap).toBeGreaterThan(asia * 1.7);
  });

  it("agregat sepanjang hari: std return per sesi berbeda sesuai desain", () => {
    const ticks = generateComponentTicks({
      seed: 7,
      count: 86400,
      startPrice: 100,
      startTime: DAY,
      tickIntervalSeconds: 1,
      baseVolume: 10,
      components: [
        { component: createComponent("noise", { noiseLevel: 0.1 }), enabled: true },
        { component: createComponent("volatility"), enabled: true },
        { component: createComponent("mean-reversion", { strength: 0.02, window: 20 }), enabled: true },
      ],
    });

    const returnsBySession: Record<string, number[]> = {};
    for (let i = 1; i < ticks.length; i++) {
      const r = (ticks[i].price - ticks[i - 1].price) / ticks[i - 1].price;
      const id = sessionAt(ticks[i].time).id;
      (returnsBySession[id] ??= []).push(r);
    }

    const stdBy = (id: string): number => std(returnsBySession[id] ?? []);
    const overlap = stdBy("overlap");
    const asia = stdBy("asia");
    const ny = stdBy("newyork");
    expect(overlap).toBeGreaterThan(asia * 1.3);
    expect(ny).toBeGreaterThan(asia);
    expect(returnsBySession["london"].length).toBeGreaterThan(0);
  });
});
