import type { Candle } from "../../types/candle";
import type { Tick } from "../../types/tick";
import { IncrementalCandleAggregator } from "../candle/incremental-aggregator";
import { mulberry32 } from "../../utils/rng";
import type { ActiveComponent } from "./component-tick-generator";

const MAX_HISTORY = 200;

/**
 * Harness bersama untuk menjalankan komponen perilaku sepanjang deretan tick.
 *
 * Memegang: stream rng (deterministik terhadap seed), aggregator candle untuk
 * riwayat yang dilihat komponen, dan `lastTotalDelta` (shock antar tick).
 * `biasAt(price, time)` menghitung jumlah delta komponen aktif pada harga &
 * waktu tick tertentu; `push(tick)` mencatat tick ke riwayat. Dipakai bersama
 * oleh generator tick komponen (harga = jumlah delta) dan generator orderbook
 * (harga = hasil matching), sehingga kontrak konteks `TickComponent` tidak
 * berduplikasi di dua tempat.
 */
export class ComponentTickHarness {
  readonly rng: () => number;
  private readonly aggregator: IncrementalCandleAggregator;
  private components: ActiveComponent[];
  private history: Candle[] = [];
  private lastTotalDelta = 0;

  constructor(seed: number, tfSeconds: number | undefined, components: ActiveComponent[]) {
    this.rng = mulberry32(seed);
    this.aggregator = new IncrementalCandleAggregator(tfSeconds ?? 60);
    this.components = components;
  }

  /**
   * Ganti set komponen aktif (untuk simulasi multi-fase). Stream rng, riwayat
   * candle, dan lastTotalDelta tetap kontinu — state komponen yang bertahan
   * (variance GARCH, tracker likuiditas) ikut terbawa ke fase berikutnya.
   */
  setComponents(components: ActiveComponent[]): void {
    this.components = components;
  }

  /** Total delta semua komponen aktif pada harga & waktu tick tertentu. */
  biasAt(price: number, _tickTime: number): number {
    const ctx: {
      price: number;
      rng: () => number;
      history: Candle[];
      lastTotalDelta: number;
    } = {
      price,
      rng: this.rng,
      history: this.history,
      lastTotalDelta: this.lastTotalDelta,
    };
    let bias = 0;
    for (const ac of this.components) {
      if (ac.enabled) bias += ac.component.next(ctx);
    }
    this.lastTotalDelta = bias;
    return bias;
  }

  /** Catat tick ke riwayat candle (dibaca komponen MeanRev/Liquidity). */
  push(tick: Tick): void {
    for (const c of this.aggregator.add(tick)) this.history.push(c);
    if (this.history.length > MAX_HISTORY) this.history.splice(0, this.history.length - MAX_HISTORY);
  }
}
