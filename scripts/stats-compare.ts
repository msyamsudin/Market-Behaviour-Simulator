import { readFileSync } from "node:fs";
import { parseCSVTicks } from "../src/utils/csv";
import { SyntheticTickSource } from "../src/engine/tick/synthetic-tick-source";
import { createComponent } from "../src/engine/tick/components";
import { summarizeTicks } from "../src/engine/statistics/metrics";
import { compareTicks } from "../src/engine/statistics/compare";

const START = Math.floor(Date.UTC(2026, 0, 2) / 1000);

const hist = parseCSVTicks(readFileSync("public/dummy-ticks.csv", "utf8"));

const source = new SyntheticTickSource({
  seed: 42,
  count: 1500,
  startPrice: 100,
  startTime: START,
  tickIntervalSeconds: 1,
  baseVolume: 25,
  components: [
    { component: createComponent("noise", { noiseLevel: 0.1 }), enabled: true },
    { component: createComponent("trend", { trendStrength: 0.01, trendBias: 0.3 }), enabled: true },
    { component: createComponent("volatility"), enabled: true },
    { component: createComponent("mean-reversion", { strength: 0.02, window: 20 }), enabled: true },
  ],
});

const synth = await source.fetchTicks();

const histStats = summarizeTicks(hist, 60);
const synthStats = summarizeTicks(synth, 60);

console.log("## Historical (dummy-ticks.csv)");
console.log("```json");
console.log(JSON.stringify(histStats, null, 2));
console.log("```");
console.log("## Synthetic (seed 42, 4 komponen)");
console.log("```json");
console.log(JSON.stringify(synthStats, null, 2));
console.log("```");
console.log("## Perbandingan");
for (const row of compareTicks(hist, synth)) {
  console.log(`| ${row.metric} | ${row.historical.toPrecision(5)} | ${row.synthetic.toPrecision(5)} | ${row.ratio === null ? "—" : row.ratio.toPrecision(5)} |`);
}
