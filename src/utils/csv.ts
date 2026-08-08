import type { Tick } from "../types/tick";

/**
 * Parser CSV tick sederhana, format: `time,price,volume` (satu baris per tick).
 * Baris header `time,price,volume` dilewati; baris kosong/malformed di-skip.
 * Dipakai oleh script ekspor & fixture test untuk membangun array `Tick`.
 *
 * TODO(M13): loader file historical untuk Track D (market structure dari data
 * historis) — parser ini menjadi fondasinya.
 */
export function parseCSVTicks(text: string): Tick[] {
  const ticks: Tick[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && line.startsWith("time")) continue;
    const parts = line.split(",");
    if (parts.length < 3) continue;
    const time = Number(parts[0]);
    const price = Number(parts[1]);
    const volume = Number(parts[2]);
    if (!Number.isFinite(time) || !Number.isFinite(price) || !Number.isFinite(volume)) continue;
    ticks.push({ time, price, volume });
  }
  return ticks;
}
