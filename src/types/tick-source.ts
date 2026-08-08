import type { Tick } from "./tick";

/**
 * Garansi "interchangeable" antar sumber tick. Pipeline playback/aggregator
 * hanya bergantung pada interface ini, bukan pada implementasi konkret — jadi
 * format data bisa diganti (SQLite/Parquet) atau data sintetis dipakai tanpa
 * mengubah pipeline.
 */
export interface TickSource {
  readonly id: string;
  readonly name: string;
  fetchTicks(): Promise<Tick[]>;
}
