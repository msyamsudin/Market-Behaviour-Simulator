import type { Candle } from "./candle";

/**
 * Komponen perilaku tick. Setiap komponen mengembalikan delta harga untuk satu
 * tick; generator menjumlahkan delta semua komponen yang aktif. Bisa on/off
 * dan punya parameter sendiri (bukti komponen benar-benar berpengaruh).
 */
export interface TickComponent {
  readonly id: string;
  readonly params: Record<string, number>;
  next(ctx: {
    price: number;
    rng: () => number;
    history: Candle[];
    /** Total delta harga semua komponen pada tick sebelumnya. */
    lastTotalDelta: number;
  }): number;
}
