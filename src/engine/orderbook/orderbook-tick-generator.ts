import type { OrderBookSnapshot, Trade } from "../../types/orderbook";
import type { Tick } from "../../types/tick";
import { ComponentTickHarness } from "../tick/component-harness";
import { OrderBookEngine } from "./orderbook";
import type { ActiveComponent } from "../tick/component-tick-generator";

export interface OrderBookTickGeneratorParams {
  seed: number;
  count: number;
  startPrice: number;
  startTime: number;
  tickIntervalSeconds: number;
  baseVolume: number;
  /** Spread awal (satuan harga) — menentukan "tick size" orderbook. */
  spread: number;
  /** Jumlah level likuiditas resting per sisi. */
  depth: number;
  /** Ukuran resting per level. */
  depthSize: number;
  /** Timeframe candle (detik) untuk riwayat yang dilihat komponen. */
  tfSeconds?: number;
  components: ActiveComponent[];
}

export interface OrderBookGenerationResult {
  ticks: Tick[];
  snapshots: OrderBookSnapshot[];
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function tradePrice(trades: Trade[]): { price: number; volume: number } {
  let vwsum = 0;
  let volume = 0;
  for (const t of trades) {
    vwsum += t.price * t.size;
    volume += t.size;
  }
  return { price: volume > 0 ? vwsum / volume : 0, volume };
}

/**
 * Generator tick **order-driven**: harga tidak dijumlah langsung dari delta
 * komponen, melainkan *muncul* dari matching orderbook.
 *
 * Per tick:
 *  1. book dibangun ulang di sekitar mid (liquidity resting deterministik);
 *  2. bias = jumlah delta komponen perilaku (Noise/Trend/Volatility/...);
 *  3. bias dinormalisasi menjadi agresivitas & ukuran market order;
 *  4. market order di-match terhadap book → trade → harga tick = VWAP trade;
 *  5. snapshot orderbook direkam paralel dengan tick.
 *
 * Komponen perilaku tetap menjadi "penyebab" arah (bukan harga), sehingga
 * arsitektur komponen yang sudah ada (A/B seed) tetap berlaku.
 */
export function generateOrderbookTicks(params: OrderBookTickGeneratorParams): OrderBookGenerationResult {
  const harness = new ComponentTickHarness(params.seed, params.tfSeconds, params.components);
  const rng = harness.rng;
  const book = new OrderBookEngine();
  const step = Math.max(params.spread, 1e-6);
  const depth = Math.max(1, Math.floor(params.depth));
  book.seed(params.startPrice, step, depth, params.depthSize, rng);
  let mid = params.startPrice;
  let lastPrice: number | null = null;
  let lastSide: "buy" | "sell" | null = null;
  const ticks: Tick[] = [];
  const snapshots: OrderBookSnapshot[] = [];

  for (let i = 0; i < params.count; i++) {
    const tickTime = params.startTime + i * params.tickIntervalSeconds;

    // Order arrival (passive flow): limit order masuk di sekitar harga terbaik,
    // ukuran acak. Menggabung ke antrian yang sudah ada, bukan merombak.
    const arrivalCount = 1 + (rng() < 0.5 ? 1 : 0);
    for (let k = 0; k < arrivalCount; k++) {
      const side: "bid" | "ask" = rng() < 0.5 ? "bid" : "ask";
      const offset = 1 + Math.floor(rng() * 3);
      const size = 1 + Math.floor(rng() * params.depthSize);
      const anchor = side === "bid" ? book.bestAsk() : book.bestBid();
      book.addLimit(side, (anchor ?? mid) + (side === "bid" ? -1 : 1) * step * offset, size);
    }

    // Order cancellation: sesekali kurangi sebagian antrian acak.
    if (rng() < 0.25) {
      book.cancelRandom(rng() < 0.5 ? "bid" : "ask", rng, 0.3);
    }

    const bias = harness.biasAt(mid, tickTime);
    const spread = book.spread() || step;
    const aggress = clamp(bias / (2 * spread), -1, 1);

    let mktSide: "bid" | "ask";
    let mktSize: number;
    if (Math.abs(aggress) < 0.05) {
      // Bias netral → agresor acak dua arah (noise / sideways).
      mktSide = rng() < 0.5 ? "bid" : "ask";
      mktSize = 1 + Math.floor(rng() * params.baseVolume);
    } else {
      mktSide = aggress > 0 ? "bid" : "ask";
      const scale = 0.4 + Math.abs(aggress) * 1.6;
      mktSize = 1 + Math.floor(params.baseVolume * scale * (0.5 + rng()));
    }

    // Jaga book tetap sehat sebelum matching (tidak boleh kosong).
    book.maintain(step, depth, params.depthSize, rng);

    const trades = book.market(mktSide, mktSize);
    const { price: tradePx, volume } = tradePrice(trades);

    let price = mid;
    let vol = 1;
    if (volume > 0) {
      price = tradePx;
      vol = Math.max(1, Math.round(volume));
      lastSide = mktSide === "bid" ? "buy" : "sell";
      lastPrice = Math.round(price * 100) / 100;
    }

    const tick: Tick = {
      time: tickTime,
      price: Math.round(price * 100) / 100,
      volume: vol,
      side: mktSide === "bid" ? "buy" : "sell",
    };
    ticks.push(tick);

    // Refill depth setelah konsumsi (market maker menambah likuiditas).
    book.maintain(step, depth, params.depthSize, rng);

    snapshots.push(book.snapshot(tickTime, 12, lastPrice, lastSide, trades));

    mid = book.mid() ?? tick.price;

    harness.push(tick);
  }

  return { ticks, snapshots };
}
