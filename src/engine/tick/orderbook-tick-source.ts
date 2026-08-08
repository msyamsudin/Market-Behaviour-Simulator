import type { OrderBookSnapshot } from "../../types/orderbook";
import type { Tick } from "../../types/tick";
import type { TickSource } from "../../types/tick-source";
import {
  generateOrderbookTicks,
  type OrderBookTickGeneratorParams,
  type OrderBookGenerationResult,
} from "../orderbook/orderbook-tick-generator";

/**
 * Sumber tick order-driven. `fetchTicks()` mengembalikan trade (tick) hasil
 * matching orderbook; snapshot orderbook paralel diambil lewat `snapshots()`
 * untuk panel ladder. Mengimplementasikan `TickSource` yang sama sehingga
 * pipeline playback/aggregator/chart tidak berubah.
 */
export class OrderBookTickSource implements TickSource {
  readonly id = "orderbook";
  readonly name: string;
  private readonly params: OrderBookTickGeneratorParams;
  private result: OrderBookGenerationResult | null = null;

  constructor(params: OrderBookTickGeneratorParams, name = "Orderbook") {
    this.params = params;
    this.name = name;
  }

  async fetchTicks(): Promise<Tick[]> {
    this.result = generateOrderbookTicks(this.params);
    return this.result.ticks;
  }

  /**
   * Snapshot orderbook paralel dengan ticks. Harus dipanggil SETELAH
   * `fetchTicks()` — melempar error eksplisit jika dipanggil lebih awal
   * (daripada diam-diam mengembalikan array kosong).
   */
  snapshots(): OrderBookSnapshot[] {
    if (!this.result) throw new Error("fetchTicks() must be called before snapshots()");
    return this.result.snapshots;
  }
}
