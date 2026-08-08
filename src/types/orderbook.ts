export type OrderSide = "bid" | "ask";

/** Satu eksekusi (trade) hasil matching market order terhadap book. */
export interface Trade {
  price: number;
  size: number;
}

/** Satu level likuiditas (harga → ukuran) di satu sisi book. */
export interface OrderBookLevel {
  price: number;
  size: number;
  freq?: number;
}

/**
 * Snapshot keadaan orderbook pada satu momen. `bids` terurut harga menurun
 * (top dulu), `asks` terurut harga menaik. Digunakan sebagai dasar panel
 * orderbook (ladder) saat playback berjalan.
 */
export interface OrderBookSnapshot {
  time: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  mid: number;
  spread: number;
  /** Harga tick terakhir (hasil eksekusi), atau null di awal. */
  lastTradePrice: number | null;
  /** Sisi aggressor pada tick terakhir. */
  lastSide: "buy" | "sell" | null;
  /** Eksekusi (trade) pada tick terakhir — untuk menandai level yang terserap. */
  trades: Trade[];
}
