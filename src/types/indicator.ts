import type { Candle } from "./candle";

/**
 * Indikator pluggable. Dipanggil per candle; `index` dan `candles` diberikan
 * agar indikator bisa menghitung dari seluruh baris yang sudah ada. Return
 * `null` saat nilai belum tersedia (misal warm-up ATR).
 */
export interface IIndicator {
  readonly id: string;
  readonly name: string;
  onCandle(c: Candle, index: number, candles: Candle[]): number | null;
}
