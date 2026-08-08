import type { Tick } from "../../types/tick";

/**
 * Pacing playback berbasis wall-clock: menentukan berapa banyak tick yang
 * harus diproses *sekarang* (increment) agar kecepatan (tick/detik) terjaga,
 * sambil tetap menjamin tidak ada tick yang terlewat meskipun interval timer
 * terlambat.
 *
 * `elapsedMs` bersifat kumulatif sejak mulai, sehingga `target` adalah jumlah
 * kumulatif tick yang seharusnya sudah diproses. `Math.floor` bertindak sebagai
 * akumulator fraksional (sisa < 1 tick tidak hilang). Nilai yang dikembalikan
 * adalah SELISIH antara `target` dan tick yang sudah diproses (`processed`),
 * bukan `target` itu sendiri — ini mencegah penghitungan ganda (tick diproses
 * lebih dari sekali tiap interval timer). Dengan begitu 1× = real-time: tick
 * berjarak `1/ticksPerSecond` detik dimainkan satu per satu sesuai durasinya.
 */
export function ticksToAdvance(
  elapsedMs: number,
  speed: number,
  ticksPerSecond: number,
  processed: number,
  total: number,
): number {
  const target = Math.floor((elapsedMs / 1000) * speed * ticksPerSecond);
  const next = Math.min(target, total);
  return Math.max(0, next - processed);
}

/**
 * Estimasi laju tick (tick/detik) dari data aktual, memakai median jarak antar
 * tick berturut-turut. Median tahan terhadap outlier dan urutan yang tidak
 * seragam, tidak seperti tebakan dari dua tick pertama. Kunci agar 1× benar-benar
 * real-time: data berjarak 1 detik → 1 tick/detik; data berjarak 5 detik →
 * 0,2 tick/detik (1 tick tiap 5 detik real).
 */
export function estimateTicksPerSecond(ticks: Tick[]): number {
  if (ticks.length < 2) return 1;
  const deltas: number[] = [];
  for (let i = 1; i < ticks.length; i++) {
    const d = ticks[i].time - ticks[i - 1].time;
    if (d > 0) deltas.push(d);
  }
  if (deltas.length === 0) return 1;
  deltas.sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  const median = deltas.length % 2 ? deltas[mid] : (deltas[mid - 1] + deltas[mid]) / 2;
  return 1 / median;
}
