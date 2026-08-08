import { readFileSync, writeFileSync } from "node:fs";
import { aggregateTicks } from "../src/engine/candle/aggregator";
import { parseCSVTicks } from "../src/utils/csv";

/**
 * Ekspor hasil agregasi file dummy ke docs/ sebagai referensi pembanding
 * spreadsheet (kriteria selesai M2: "candle hasil agregasi cocok dengan data
 * referensi / validasi manual lewat spreadsheet").
 *
 * Jalankan: `npm run export:reference`
 */
const csv = readFileSync("public/dummy-ticks.csv", "utf8");
const ticks = parseCSVTicks(csv);
const candles = aggregateTicks(ticks, 60);

const lines = ["time,open,high,low,close,volume"];
for (const c of candles) {
  lines.push(`${c.time},${c.open},${c.high},${c.low},${c.close},${c.volume}`);
}
const out = "docs/verifikasi/m2-candles-reference.csv";
writeFileSync(out, lines.join("\n") + "\n");
console.log(`exported ${candles.length} candles (from ${ticks.length} ticks) to ${out}`);
