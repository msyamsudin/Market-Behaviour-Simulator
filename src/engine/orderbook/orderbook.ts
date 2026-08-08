import type { OrderBookLevel, OrderBookSnapshot, OrderSide, Trade } from "../../types/orderbook";

const round2 = (p: number): number => Math.round(p * 100) / 100;

/**
 * Mesin limit order book persisten (L1..Ln) untuk simulasi order-driven yang
 * realistis.
 *
 * Berbeda dengan versi awal yang *membangun ulang* book tiap tick, mesin ini
 * mempertahankan antrian lintas tick seperti pasar nyata:
 *  - level yang terisi sebagian tetap tersisa di harga yang sama;
 *  - level yang terkuras habis dihapus dan best price bergeser ke level berikutnya;
 *  - likuiditas di-refill kontinu lewat `maintain()` (mirip market maker);
 *  - level yang terlalu jauh dari mid dipangkas agar memori terbatas.
 */
export class OrderBookEngine {
  private bids = new Map<number, number>();
  private asks = new Map<number, number>();
  /** Harga tengah terakhir yang diketahui — fallback saat kedua sisi kosong. */
  private lastMid = 100;

  /** Versi mutasi — invalidasi cache best price hanya saat Map berubah. */
  private version = 0;
  private bidCache: number | null = null;
  private bidVersion = -1;
  private askCache: number | null = null;
  private askVersion = -1;

  private invalidate(): void {
    this.version++;
  }

  private nextSize(depthSize: number, rng: () => number): number {
    return Math.max(1, Math.round(depthSize * (0.3 + rng() * 0.7)));
  }

  /** Seed awal: isi likuiditas resting di sekitar `mid` dengan `depth` level per sisi. */
  seed(mid: number, step: number, depth: number, depthSize: number, rng: () => number): void {
    this.invalidate();
    this.bids.clear();
    this.asks.clear();
    this.lastMid = mid;
    const half = step / 2;
    for (let k = 0; k < depth; k++) {
      this.bids.set(round2(mid - half - step * k), this.nextSize(depthSize, rng));
      this.asks.set(round2(mid + half + step * k), this.nextSize(depthSize, rng));
    }
  }

  /**
   * Tambah limit order pasif (order arrival). Menggabung ke level yang sudah ada.
   * Order yang crossing (akan langsung eksekusi) ditolak — hanya order resting.
   */
  addLimit(side: OrderSide, price: number, size: number): void {
    if (size <= 0) return;
    const p = round2(price);
    if (side === "bid") {
      const a = this.bestAsk();
      if (a !== null && p >= a) return;
      this.bids.set(p, (this.bids.get(p) ?? 0) + size);
    } else {
      const b = this.bestBid();
      if (b !== null && p <= b) return;
      this.asks.set(p, (this.asks.get(p) ?? 0) + size);
    }
    this.invalidate();
  }

  /** Kurangi sebagian level acak (cancel); hapus bila mencapai ≤ 0. */
  cancelRandom(side: OrderSide, rng: () => number, fraction: number): void {
    const map = side === "bid" ? this.bids : this.asks;
    const keys = [...map.keys()];
    if (keys.length === 0) return;
    const price = keys[Math.floor(rng() * keys.length)];
    const cur = map.get(price) ?? 0;
    const cut = Math.floor(cur * fraction * (0.2 + rng() * 0.8));
    const left = cur - cut;
    if (left <= 0) map.delete(price);
    else map.set(price, left);
    this.invalidate();
  }

  /**
   * Jaga book sehat & realistis:
   *  - selalu ada ≥1 level per sisi (market maker "masuk" saat sisi kosong);
   *  - spread tidak melebar tak terbatas (tighten dari sisi dalam);
   *  - depth minimum per sisi di-refill ke arah luar;
   *  - level yang terlalu jauh dari mid dipangkas (batasi memori).
   */
  maintain(step: number, depth: number, depthSize: number, rng: () => number): void {
    let b = this.bestBid();
    let a = this.bestAsk();
    if (a === null && b !== null) {
      this.asks.set(round2(b + step), this.nextSize(depthSize, rng));
      this.invalidate();
    }
    if (b === null && a !== null) {
      this.bids.set(round2(a - step), this.nextSize(depthSize, rng));
      this.invalidate();
    }
    if (b === null && a === null) {
      this.bids.set(round2(this.lastMid - step / 2), this.nextSize(depthSize, rng));
      this.asks.set(round2(this.lastMid + step / 2), this.nextSize(depthSize, rng));
      this.invalidate();
    }

    // Tighten spread bila melebar > 2.5× tick: market maker pasang di sisi dalam.
    const bb = this.bestBid()!;
    const ba = this.bestAsk()!;
    if (ba - bb > step * 2.5) {
      const na = round2(bb + step / 2);
      if (na < ba) {
        this.asks.set(na, this.nextSize(depthSize, rng));
        this.invalidate();
      } else {
        const nb = round2(ba - step / 2);
        if (nb > bb) {
          this.bids.set(nb, this.nextSize(depthSize, rng));
          this.invalidate();
        }
      }
    }

    // Refill depth ke arah luar bila sisi lebih tipis dari target. Lewati harga
    // yang sudah ada (bisa saja buku punya level berurutan), sehingga ukuran
    // selalu bertambah — mencegah loop tak berujung.
    while (this.bids.size < depth) {
      const cur = this.bestBid()!;
      let p = round2(cur - step);
      let guard = 0;
      while (this.bids.has(p) && guard++ < 100) p = round2(p - step);
      this.bids.set(p, this.nextSize(depthSize, rng));
      this.invalidate();
    }
    while (this.asks.size < depth) {
      const cur = this.bestAsk()!;
      let p = round2(cur + step);
      let guard = 0;
      while (this.asks.has(p) && guard++ < 100) p = round2(p + step);
      this.asks.set(p, this.nextSize(depthSize, rng));
      this.invalidate();
    }

    // Prune level yang terlalu jauh dari mid agar Map tetap terbatas.
    const mid = this.mid() ?? this.lastMid;
    const limit = step * depth * 4;
    let pruned = false;
    for (const p of [...this.bids.keys()]) {
      if (mid - p > limit) {
        this.bids.delete(p);
        pruned = true;
      }
    }
    for (const p of [...this.asks.keys()]) {
      if (p - mid > limit) {
        this.asks.delete(p);
        pruned = true;
      }
    }
    if (pruned) this.invalidate();
  }

  /** Harga terbaik di sisi tertentu. */
  bestBid(): number | null {
    if (this.bidVersion !== this.version) {
      this.bidCache = this.topKey(this.bids, true);
      this.bidVersion = this.version;
    }
    return this.bidCache;
  }

  bestAsk(): number | null {
    if (this.askVersion !== this.version) {
      this.askCache = this.topKey(this.asks, false);
      this.askVersion = this.version;
    }
    return this.askCache;
  }

  mid(): number | null {
    const b = this.bestBid();
    const a = this.bestAsk();
    const m = b !== null && a !== null ? (b + a) / 2 : b ?? a ?? null;
    if (m !== null) this.lastMid = m;
    return m;
  }

  spread(): number {
    const b = this.bestBid();
    const a = this.bestAsk();
    if (b === null || a === null) return 0;
    return a - b;
  }

  /**
   * Eksekusi market order: konsumsi level dari sisi lawan (buy → asks,
   * sell → bids) sesuai ukuran. Level yang terisi sebagian tetap tersisa;
   * yang terisi penuh dihapus. Mengembalikan trade eksekusi.
   */
  market(side: OrderSide, size: number): Trade[] {
    const source = side === "bid" ? this.asks : this.bids;
    const descending = side === "bid";
    const keys = [...source.keys()].sort((x, y) => (descending ? x - y : y - x));
    const trades: Trade[] = [];
    let remaining = size;
    for (const price of keys) {
      if (remaining <= 0) break;
      const available = source.get(price) ?? 0;
      if (available <= 0) continue;
      const filled = Math.min(available, remaining);
      trades.push({ price, size: filled });
      remaining -= filled;
      const left = available - filled;
      if (left <= 0) source.delete(price);
      else source.set(price, left);
    }
    this.invalidate();
    return trades;
  }

  /** Snapshot `depth` level teratas per sisi. */
  snapshot(
    time: number,
    depth: number,
    lastTradePrice: number | null,
    lastSide: "buy" | "sell" | null,
    trades: Trade[] = [],
  ): OrderBookSnapshot {
    const bids = this.levels(this.bids, true, depth);
    const asks = this.levels(this.asks, false, depth);
    const bestBid = bids.length > 0 ? bids[0].price : null;
    const bestAsk = asks.length > 0 ? asks[0].price : null;
    const mid = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : bestBid ?? bestAsk ?? 0;
    return {
      time,
      bids,
      asks,
      bestBid,
      bestAsk,
      mid,
      spread: bestBid !== null && bestAsk !== null ? bestAsk - bestBid : 0,
      lastTradePrice,
      lastSide,
      trades,
    };
  }

  private levels(map: Map<number, number>, descending: boolean, depth: number): OrderBookLevel[] {
    const out: OrderBookLevel[] = [];
    const keys = [...map.keys()].sort((a, b) => (descending ? b - a : a - b));
    for (const price of keys) {
      if (out.length >= depth) break;
      const size = map.get(price) ?? 0;
      if (size > 0) out.push({ price, size });
    }
    return out;
  }

  private topKey(map: Map<number, number>, highest: boolean): number | null {
    let best: number | null = null;
    for (const price of map.keys()) {
      if (best === null || (highest ? price > best : price < best)) best = price;
    }
    return best;
  }
}
