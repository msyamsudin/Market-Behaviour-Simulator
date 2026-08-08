import { useState } from "react";
import { useChartStore } from "../app/chartStore";
import type { OrderBookLevel, OrderBookSnapshot } from "../types/orderbook";

function maxSize(snapshot: OrderBookSnapshot | null): number {
  if (!snapshot) return 1;
  let m = 1;
  for (const l of snapshot.asks) m = Math.max(m, l.size);
  for (const l of snapshot.bids) m = Math.max(m, l.size);
  return m;
}

/** Ukuran kumulatif per level (running sum), selaras dengan urutan input. */
function cumSizes(levels: OrderBookLevel[]): number[] {
  const out: number[] = [];
  let cum = 0;
  for (const l of levels) {
    cum += l.size;
    out.push(cum);
  }
  return out;
}

/**
 * Tangga likuiditas kumulatif untuk satu sisi. Mengembalikan titik poligon
 * (harga, kumulatif) yang membentuk "staircase" dari best price ke luar.
 */
function stairsFor(
  levels: OrderBookLevel[],
  fromBest: boolean,
): { points: [number, number][]; total: number } {
  const ordered = fromBest ? levels : levels.slice().reverse();
  if (ordered.length === 0) return { points: [], total: 0 };
  const pts: [number, number][] = [];
  const first = ordered[0].price;
  pts.push([first, 0]); // baseline di best price
  let cum = 0;
  let prevP = first;
  let total = 0;
  for (const l of ordered) {
    const p = l.price;
    const prevCum = cum;
    cum += l.size;
    total = cum;
    if (pts.length > 1) {
      pts.push([prevP, prevCum]); // horizontal
      pts.push([p, prevCum]);
    }
    pts.push([p, cum]); // vertical naik
    prevP = p;
  }
  pts.push([prevP, 0]); // baseline di level terjauh
  return { points: pts, total };
}

function CumulativeDepthChart({ snapshot }: { snapshot: OrderBookSnapshot }) {
  const { bids, asks, bestBid, bestAsk, lastTradePrice } = snapshot;
  const bid = stairsFor(bids, true);
  const ask = stairsFor(asks, false);
  if (bid.points.length === 0 && ask.points.length === 0) {
    return <div className="ob-empty">tidak ada likuiditas</div>;
  }

  const allPrices = [...bids.map((b) => b.price), ...asks.map((a) => a.price)];
  let xMin = Math.min(...allPrices);
  let xMax = Math.max(...allPrices);
  if (xMax === xMin) xMax = xMin + 0.01;
  const yMax = Math.max(bid.total, ask.total, 1);

  const W = 400;
  const H = 200;
  const pad = 28;
  const xOf = (p: number): number => pad + ((p - xMin) / (xMax - xMin)) * (W - pad * 2);
  const yOf = (v: number): number => H - pad - (v / yMax) * (H - pad * 2);
  const toPath = (pts: [number, number][]): string =>
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${xOf(x).toFixed(1)},${yOf(y).toFixed(1)}`).join(" ") + " Z";

  const midX = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : bestBid ?? bestAsk ?? 0;

  return (
    <svg
      className="ob-depth-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Cumulative depth chart"
    >
      <line className="ob-cd-axis" x1={xOf(midX)} y1={pad} x2={xOf(midX)} y2={H - pad} />
      {lastTradePrice !== null && (
        <line className="ob-cd-last" x1={xOf(lastTradePrice)} y1={pad} x2={xOf(lastTradePrice)} y2={H - pad} />
      )}
      {bid.points.length > 0 && <path className="ob-cd-bid" d={toPath(bid.points)} />}
      {ask.points.length > 0 && <path className="ob-cd-ask" d={toPath(ask.points)} />}

      {bestBid !== null && (
        <text className="ob-cd-label bid" x={xOf(bestBid)} y={H - 4} textAnchor="middle">
          {bestBid.toFixed(2)}
        </text>
      )}
      {bestAsk !== null && (
        <text className="ob-cd-label ask" x={xOf(bestAsk)} y={H - 4} textAnchor="middle">
          {bestAsk.toFixed(2)}
        </text>
      )}
      <text className="ob-cd-label" x={pad} y={pad - 8} textAnchor="start">
        bids {bid.total}
      </text>
      <text className="ob-cd-label" x={W - pad} y={pad - 8} textAnchor="end">
        asks {ask.total}
      </text>
    </svg>
  );
}

interface LadderRowProps {
  level: OrderBookLevel;
  max: number;
  cum: number;
  total: number;
  isBest: boolean;
  side: "bid" | "ask";
  consumed?: number;
  lastSide: "buy" | "sell" | null;
}

function LadderRow({ level, max, cum, total, isBest, side, consumed, lastSide }: LadderRowProps) {
  const pct = (level.size / max) * 100;
  const cumPct = total > 0 ? (cum / total) * 100 : 0;
  const consumedNow = (consumed ?? 0) > 0;
  const ringClass = consumedNow ? (lastSide === "buy" ? "buy-ring" : lastSide === "sell" ? "sell-ring" : "") : "";
  return (
    <div className={`ob-row ${side} ${isBest ? "is-best" : ""} ${ringClass}`}>
      <div className="ob-depth-cum" style={{ width: `${cumPct}%` }} />
      <div className="ob-depth" style={{ width: `${pct}%` }} />
      <span className="ob-price">
        {level.price.toFixed(2)}
        {isBest && <span className="ob-best-tag">best</span>}
      </span>
      <span className="ob-size">
        {level.size}
        {consumedNow && <span className="ob-consumed">−{consumed}</span>}
      </span>
    </div>
  );
}

function fmtPrice(p: number | null): string {
  return p === null ? "—" : p.toFixed(2);
}

function SplitView({
  snapshot,
  max,
  consumedByPrice,
}: {
  snapshot: OrderBookSnapshot;
  max: number;
  consumedByPrice: Map<number, number>;
}) {
  const { bids, asks } = snapshot;
  const totalBid = bids.reduce((s, l) => s + l.size, 0);
  const totalAsk = asks.reduce((s, l) => s + l.size, 0);
  const lastTrade = snapshot.trades.length > 0 ? snapshot.trades[snapshot.trades.length - 1] : null;

  // Kumulatif dihitung di luar render (bukan side effect di JSX).
  const asksRev = [...asks].reverse();
  const askCums = cumSizes(asksRev);
  const bidCums = cumSizes(bids);

  return (
    <div className="ob-split-container">
      <div className="ob-split-col">
        <div className="ob-col-header">
          <div className="ob-col-title bid">Bids</div>
          <div className="ob-col-labels">
            <span>Price</span>
            <span>Size</span>
          </div>
        </div>
        <div className="ob-rows-scroll">
          {bids.map((l, i) => (
            <LadderRow
              key={`b-${l.price}`}
              level={l}
              max={max}
              cum={bidCums[i]}
              total={totalBid}
              isBest={l.price === snapshot.bestBid}
              side="bid"
              consumed={consumedByPrice.get(l.price)}
              lastSide={snapshot.lastSide}
            />
          ))}
        </div>
      </div>

      <div className="ob-split-divider">
        <div className="ob-split-mid">
          <div className="ob-mid-box">
            <span className="ob-mid-label">Best Bid</span>
            <span className="ob-mid-price bid">{fmtPrice(snapshot.bestBid)}</span>
          </div>
          <div className="ob-mid-box">
            <span className="ob-mid-label">Mid</span>
            <span className="ob-mid-price mid">{fmtPrice(snapshot.mid)}</span>
          </div>
          <div className="ob-mid-box">
            <span className="ob-mid-label">Best Ask</span>
            <span className="ob-mid-price ask">{fmtPrice(snapshot.bestAsk)}</span>
          </div>
          <div className="ob-mid-box">
            <span className="ob-mid-label">Spread</span>
            <span className="ob-mid-val">{snapshot.spread.toFixed(2)}</span>
          </div>
          {lastTrade && (
            <div className="ob-mid-box">
              <span className="ob-mid-label">Last</span>
              <span className={`ob-trade-val ${snapshot.lastSide ?? ""}`}>
                {lastTrade.price.toFixed(2)} × {lastTrade.size}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="ob-split-col">
        <div className="ob-col-header">
          <div className="ob-col-title ask">Asks</div>
          <div className="ob-col-labels">
            <span>Price</span>
            <span>Size</span>
          </div>
        </div>
        <div className="ob-rows-scroll">
          {asksRev.map((l, i) => (
            <LadderRow
              key={`a-${l.price}`}
              level={l}
              max={max}
              cum={askCums[i]}
              total={totalAsk}
              isBest={l.price === snapshot.bestAsk}
              side="ask"
              consumed={consumedByPrice.get(l.price)}
              lastSide={snapshot.lastSide}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GridView({
  snapshot,
  max,
  countByPrice,
}: {
  snapshot: OrderBookSnapshot;
  max: number;
  countByPrice: Map<number, number>;
}) {
  const { bids, asks } = snapshot;
  const totalBid = bids.reduce((s, l) => s + l.size, 0);
  const totalAsk = asks.reduce((s, l) => s + l.size, 0);
  const rows = Math.max(bids.length, asks.length);
  const imbalance = totalBid + totalAsk;
  const bidPct = imbalance > 0 ? (totalBid / imbalance) * 100 : 50;
  const askPct = imbalance > 0 ? (totalAsk / imbalance) * 100 : 50;

  return (
    <div className="ob-grid-container">
      <div className="ob-grid-table">
        <div className="ob-grid-header">
          <span className="ob-grid-th bid-freq">Freq</span>
          <span className="ob-grid-th bid-lot">Bid Lot</span>
          <span className="ob-grid-th bid-price">Bid</span>
          <span className="ob-grid-th ask-price">Ask</span>
          <span className="ob-grid-th ask-lot">Ask Lot</span>
          <span className="ob-grid-th ask-freq">Freq</span>
        </div>

        <div className="ob-grid-body">
          {Array.from({ length: rows }).map((_, i) => {
            const bid = bids[i];
            const ask = asks[i];
            const isBest = i === 0 && (bid || ask);
            return (
              <div key={i} className={`ob-grid-row ${isBest ? "is-best" : ""}`}>
                <div className="ob-grid-td bid-freq">{bid ? (countByPrice.get(bid.price) ?? 0) : ""}</div>
                <div className="ob-grid-td bid-lot">
                  {bid ? bid.size : ""}
                  {bid && <div className="ob-grid-depth bid" style={{ width: `${(bid.size / max) * 100}%` }} />}
                </div>
                <div className="ob-grid-td bid-price">{bid ? bid.price.toFixed(2) : ""}</div>
                <div className="ob-grid-td ask-price">{ask ? ask.price.toFixed(2) : ""}</div>
                <div className="ob-grid-td ask-lot">
                  {ask ? ask.size : ""}
                  {ask && <div className="ob-grid-depth ask" style={{ width: `${(ask.size / max) * 100}%` }} />}
                </div>
                <div className="ob-grid-td ask-freq">{ask ? (countByPrice.get(ask.price) ?? 0) : ""}</div>
              </div>
            );
          })}
        </div>

        <div className="ob-grid-footer">
          <span className="ob-grid-ft bid-freq">−</span>
          <span className="ob-grid-ft bid-lot">{totalBid}</span>
          <div className="ob-grid-ft imbalance">
            <div className="ob-grid-imbalance-bar">
              <div className="ob-grid-imbalance-fill bid" style={{ width: `${bidPct}%` }} />
              <div className="ob-grid-imbalance-fill ask" style={{ width: `${askPct}%` }} />
            </div>
          </div>
          <span className="ob-grid-ft ask-lot">{totalAsk}</span>
          <span className="ob-grid-ft ask-freq">−</span>
        </div>
      </div>
    </div>
  );
}

export function OrderBookPanel() {
  const snapshots = useChartStore((s) => s.orderbookSnapshots);
  const index = useChartStore((s) => s.playback.index);
  const source = useChartStore((s) => s.source);
  const setSource = useChartStore((s) => s.setSource);
  const setOrderbookParam = useChartStore((s) => s.setOrderbookParam);
  const obSpread = useChartStore((s) => s.obSpread);
  const obDepth = useChartStore((s) => s.obDepth);
  const obDepthSize = useChartStore((s) => s.obDepthSize);
  const dirty = useChartStore((s) => s.dirty);
  const loadSynthetic = useChartStore((s) => s.loadSynthetic);
  const isLoading = useChartStore((s) => s.isLoading);
  const [view, setView] = useState<"ladder" | "depth" | "split" | "grid">("ladder");

  const snapshot = snapshots.length > 0 ? snapshots[Math.min(index, snapshots.length - 1)] : null;
  const max = maxSize(snapshot);

  const consumedByPrice = new Map<number, number>();
  if (snapshot) {
    for (const t of snapshot.trades) {
      consumedByPrice.set(t.price, (consumedByPrice.get(t.price) ?? 0) + t.size);
    }
  }
  const lastTrade = snapshot && snapshot.trades.length > 0 ? snapshot.trades[snapshot.trades.length - 1] : null;

  const countByPrice = new Map<number, number>();
  if (snapshot) {
    for (const t of snapshot.trades) {
      countByPrice.set(t.price, (countByPrice.get(t.price) ?? 0) + 1);
    }
  }

  // asks ascending (best ask dulu), bids descending (best bid dulu).
  const asks = snapshot ? snapshot.asks : [];
  const bids = snapshot ? snapshot.bids : [];
  const totalAsk = asks.reduce((s, l) => s + l.size, 0);
  const totalBid = bids.reduce((s, l) => s + l.size, 0);
  const imbalanceTotal = totalBid + totalAsk;
  const bidPct = imbalanceTotal > 0 ? (totalBid / imbalanceTotal) * 100 : 50;
  const askPct = imbalanceTotal > 0 ? (totalAsk / imbalanceTotal) * 100 : 50;

  // Kumulatif dihitung di luar render (bukan side effect di JSX).
  const asksRev = [...asks].reverse();
  const askCums = cumSizes(asksRev);
  const bidCums = cumSizes(bids);

  return (
    <div className="ob-panel">
      <div className="ob-header">
        <div className="ob-title">Orderbook</div>
        <div className="ob-actions">
          <div className="ob-layout-toggle" role="tablist" aria-label="Orderbook view">
            <button className={`ob-layout-btn ${view === "ladder" ? "active" : ""}`} onClick={() => setView("ladder")}>
              Ladder
            </button>
            <button className={`ob-layout-btn ${view === "split" ? "active" : ""}`} onClick={() => setView("split")}>
              Split
            </button>
            <button className={`ob-layout-btn ${view === "grid" ? "active" : ""}`} onClick={() => setView("grid")}>
              Grid
            </button>
            <button className={`ob-layout-btn ${view === "depth" ? "active" : ""}`} onClick={() => setView("depth")}>
              Depth
            </button>
          </div>
          <div className="ob-source-toggle">
            <button
              className={`ob-source-btn ${source === "orderbook" ? "active" : ""}`}
              onClick={() => setSource("orderbook")}
            >
              Order-driven
            </button>
            <button
              className={`ob-source-btn ${source === "component" ? "active" : ""}`}
              onClick={() => setSource("component")}
            >
              Component
            </button>
          </div>
        </div>
      </div>

      {source === "orderbook" && (
        <div className="ob-params">
          <label className="ob-param">
            Spread
            <input
              type="number"
              min={0.005}
              step={0.005}
              value={obSpread}
              onChange={(e) => setOrderbookParam("obSpread", parseFloat(e.target.value) || 0.02)}
            />
          </label>
          <label className="ob-param">
            Depth
            <input
              type="number"
              min={2}
              max={50}
              step={1}
              value={obDepth}
              onChange={(e) => setOrderbookParam("obDepth", Math.floor(parseFloat(e.target.value) || 12))}
            />
          </label>
          <label className="ob-param">
            Level Size
            <input
              type="number"
              min={1}
              step={1}
              value={obDepthSize}
              onChange={(e) => setOrderbookParam("obDepthSize", Math.floor(parseFloat(e.target.value) || 20))}
            />
          </label>
        </div>
      )}

      {snapshot ? (
        <div className="ob-ladder">
          {view === "depth" ? (
            <CumulativeDepthChart snapshot={snapshot} />
          ) : view === "split" ? (
            <SplitView snapshot={snapshot} max={max} consumedByPrice={consumedByPrice} />
          ) : view === "grid" ? (
            <GridView snapshot={snapshot} max={max} countByPrice={countByPrice} />
          ) : (
            <>
              <div className="ob-imbalance-bar" role="img" aria-label={`Imbalance ${bidPct.toFixed(0)}% bid vs ${askPct.toFixed(0)}% ask`}>
                <div className="ob-imbalance-fill bid" style={{ width: `${bidPct}%` }}>
                  {bidPct >= 18 ? `B ${totalBid}` : ""}
                </div>
                <div className="ob-imbalance-fill ask" style={{ width: `${askPct}%` }}>
                  {askPct >= 18 ? `A ${totalAsk}` : ""}
                </div>
              </div>

              <div className="ob-side asks">
                <div className="ob-side-label">Asks</div>
                <div className="ob-side-rows">
                  {asksRev.map((l, i) => (
                    <LadderRow
                      key={`a-${l.price}`}
                      level={l}
                      max={max}
                      cum={askCums[i]}
                      total={totalAsk}
                      isBest={l.price === snapshot.bestAsk}
                      side="ask"
                      consumed={consumedByPrice.get(l.price)}
                      lastSide={snapshot.lastSide}
                    />
                  ))}
                </div>
              </div>

              <div className="ob-mid">
                <span className="ob-mid-price bid">{fmtPrice(snapshot.bestBid)}</span>
                <span className="ob-mid-spread">spread {snapshot.spread.toFixed(2)}</span>
                <span className="ob-mid-price ask">{fmtPrice(snapshot.bestAsk)}</span>
              </div>

              <div className="ob-side bids">
                <div className="ob-side-label">Bids</div>
                <div className="ob-side-rows">
                  {bids.map((l, i) => (
                    <LadderRow
                      key={`b-${l.price}`}
                      level={l}
                      max={max}
                      cum={bidCums[i]}
                      total={totalBid}
                      isBest={l.price === snapshot.bestBid}
                      side="bid"
                      consumed={consumedByPrice.get(l.price)}
                      lastSide={snapshot.lastSide}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="ob-foot">
            <span
              className={
                snapshot.lastSide === "buy" ? "ob-trade buy" : snapshot.lastSide === "sell" ? "ob-trade sell" : "ob-trade"
              }
            >
              {lastTrade
                ? `trade ${lastTrade.price.toFixed(2)} × ${lastTrade.size} ${snapshot.lastSide ?? ""}`
                : "no trade yet"}
            </span>
            <span>mid {fmtPrice(snapshot.mid)}</span>
            <span>{index.toLocaleString()} / {snapshots.length.toLocaleString()}</span>
          </div>
        </div>
      ) : (
        <div className="ob-empty">
          {source === "orderbook" ? (
            <>
              <p>Belum ada data orderbook. Klik "Re-generate" untuk membuat data order-driven.</p>
              <button className="cp-reload-btn" onClick={() => void loadSynthetic()} disabled={isLoading}>
                {isLoading ? "Generating..." : "Re-generate (Orderbook, 7,500)"}
              </button>
            </>
          ) : (
            <p>
              Source saat ini "Component" (harga dijumlah langsung). Ganti ke "Order-driven" untuk
              melihat harga terbentuk dari orderbook.
              {dirty && " — konfigurasi berubah, klik Re-generate."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
