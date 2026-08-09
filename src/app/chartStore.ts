import { create } from "zustand";
import type { Candle } from "../types/candle";
import type { OrderBookSnapshot } from "../types/orderbook";
import type { Brick } from "../types/renko";
import type { Tick } from "../types/tick";
import { aggregateTicks } from "../engine/candle/aggregator";
import { SyntheticTickSource } from "../engine/tick/synthetic-tick-source";
import { OrderBookTickSource } from "../engine/tick/orderbook-tick-source";
import { createComponent } from "../engine/tick/components";
import type { ActiveComponent } from "../engine/tick/component-tick-generator";
import { getTimeframe, TIMEFRAMES } from "../engine/candle/timeframes";
import { indicatorRegistry } from "../engine/indicator/registry";
import { buildRenko } from "../engine/renko/fixed-renko";
import { playbackEngine, type CandleBatch, type PlaybackState } from "../engine/playback/playback-engine";
import { summarizeTicks, type TickStatistics } from "../engine/statistics/metrics";

export const LTF_ID = "1s";
export const DEFAULT_HTF_ID = "5m";
export const DEFAULT_BRICK_SIZE = 0.5;
export const SYNTHETIC_START_TIME = Math.floor(Date.UTC(2026, 0, 2) / 1000);

export type BottomPane = "candle" | "renko" | "orderbook";

export type TickSourceMode = "component" | "orderbook";

export interface ComponentConfig {
  enabled: boolean;
  params: Record<string, number>;
}

/** Satu fase simulasi: konfigurasi komponen (ter-resolve dari preset) + jumlah tick. */
export interface PhaseEntry {
  components: Record<string, ComponentConfig>;
  count: number;
}

export const DEFAULT_COMPONENTS: Record<string, ComponentConfig> = {
  noise: { enabled: true, params: { noiseLevel: 0.1 } },
  trend: { enabled: true, params: { trendStrength: 0.01, trendBias: 0.3 } },
  volatility: { enabled: true, params: { omega: 0.0004, alpha: 0.1, beta: 0.85, scale: 1 } },
  "mean-reversion": { enabled: true, params: { strength: 0.02, window: 20 } },
  liquidity: { enabled: false, params: { sweepProbability: 0.15, proximity: 0.5, pushScale: 0.15 } },
};

/** Salin config komponen (params hanya berisi number, salin dangkal cukup). */
export function cloneComponentConfig(cfg: ComponentConfig): ComponentConfig {
  return { enabled: cfg.enabled, params: { ...cfg.params } };
}

/** Salin seluruh set komponen agar tidak ada referensi bersama antar pemakai. */
export function cloneComponents(components: Record<string, ComponentConfig>): Record<string, ComponentConfig> {
  return Object.fromEntries(Object.entries(components).map(([id, cfg]) => [id, cloneComponentConfig(cfg)]));
}

// PlaybackState diekspor dari engine dan dipakai ulang di store agar tidak ada
// dua definisi interface yang menyimpang (mis. `loop` hanya ada di engine).

interface ChartStore {
  ticks: Tick[];
  htfId: string;
  candlesByTimeframe: Record<string, Candle[]>;
  htfCandles: Candle[];
  ltfCandles: Candle[];
  fullHtfCandles: Candle[];
  fullLtfCandles: Candle[];
  indicatorId: string | null;
  indicatorValues: (number | null)[];
  brickSize: number;
  renkoBricks: Brick[];
  fullRenkoBricks: Brick[];
  bottomPane: BottomPane;
  components: Record<string, ComponentConfig>;
  /** Urutan fase simulasi (rezim bergantian). null = mode tunggal dari editor komponen. */
  phases: PhaseEntry[] | null;
  /** Seed PRNG untuk data sintetis. Seed sama + konfigurasi sama = seri identik. */
  seed: number;
  /** Mode generator tick: component (harga = jumlah delta) atau orderbook (harga = hasil matching LOB). */
  source: TickSourceMode;
  /** Params generator orderbook (hanya dipakai saat source === "orderbook"). */
  obSpread: number;
  obDepth: number;
  obDepthSize: number;
  /** Snapshot orderbook paralel dengan `ticks` (indeks ke-i = keadaan saat tick ke-i). */
  orderbookSnapshots: OrderBookSnapshot[];
  syntheticStats: TickStatistics | null;
  tickCount: number;
  loadedFile: string | null;
  isLoading: boolean;
  /** Konfigurasi komponen berubah tapi data belum dibuat ulang. */
  dirty: boolean;
  error: string | null;
  playback: PlaybackState;
  /** Penghitung generasi regenerasi (bukan reaktif, hanya state transien). */
  _loadGeneration: number;
  /** Revisi data penuh. Naik setiap regenerasi; dipakai chart agar tampil penuh. */
  dataRevision: number;
  loadSynthetic: () => Promise<void>;
  setSource: (source: TickSourceMode) => void;
  setOrderbookParam: (key: "obSpread" | "obDepth" | "obDepthSize", value: number) => void;
  setComponentEnabled: (id: string, enabled: boolean) => void;
  setComponentParam: (id: string, key: string, value: number) => void;
  setComponents: (components: Record<string, ComponentConfig>) => void;
  setPhases: (phases: PhaseEntry[] | null) => void;
  setSeed: (seed: number) => void;
  setHtf: (id: string) => void;
  setIndicator: (id: string | null) => void;
  setBottomPane: (pane: BottomPane) => void;
  setBrickSize: (size: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  step: () => void;
  setSpeed: (speed: number) => void;
  setLoop: (loop: boolean) => void;
}

function aggregateForTimeframes(ticks: Tick[]): Record<string, Candle[]> {
  const out: Record<string, Candle[]> = {};
  for (const tf of TIMEFRAMES) {
    out[tf.id] = aggregateTicks(ticks, tf.seconds);
  }
  return out;
}

function workerTimeframes(htfId: string): { id: string; seconds: number }[] {
  return [getTimeframe(htfId), getTimeframe(LTF_ID)].map((t) => ({ id: t.id, seconds: t.seconds }));
}

function indicatorSeries(candles: Candle[], id: string | null): (number | null)[] {
  if (!id || candles.length === 0) return [];
  const ind = indicatorRegistry.get(id);
  if (!ind) return [];
  return candles.map((c, i) => ind.onCandle(c, i, candles));
}

/**
 * Gabungkan candle baru ke array sebelumnya. Candle yang sedang berjalan
 * (forming) dikirim ulang di tiap batch, sehingga candle dengan `time` sama
 * dengan elemen terakhir diganti, bukan diduplikasi.
 */
function mergeByTime(prev: Candle[], added: Candle[]): Candle[] {
  if (added.length === 0) return prev;
  const out = [...prev];
  for (const c of added) {
    const last = out[out.length - 1];
    // Candle dengan waktu lebih lama dari elemen terakhir adalah data basi
    // (batch playback lama yang masih transit setelah reset/reload). Lewati
    // agar urutan waktu naik tetap terjaga (dibutuhkan lightweight-charts).
    if (last && c.time < last.time) continue;
    if (last && last.time === c.time) out[out.length - 1] = c;
    else out.push(c);
  }
  return out;
}

function buildComponents(components: Record<string, ComponentConfig>): ActiveComponent[] {
  return Object.entries(components).map(([id, cfg]) => ({
    component: createComponent(id, cfg.params),
    enabled: cfg.enabled,
  }));
}

/**
 * Penghitung generasi untuk `loadSynthetic` disimpan di state store sebagai
 * `_loadGeneration` (properti privat konvensi underscore). Setiap panggilan
 * menaikkan nilai; hasil request yang sudah kedaluwarsa (generasi lama)
 * diabaikan agar tidak menimpa konfigurasi terbaru saat regenerasi dipicu
 * bertumpuk. Berada di store (bukan module scope) supaya bisa di-reset saat
 * testing tanpa full module reload.
 */
export const useChartStore = create<ChartStore>((set, get) => ({
  ticks: [],
  htfId: DEFAULT_HTF_ID,
  candlesByTimeframe: {},
  htfCandles: [],
  ltfCandles: [],
  fullHtfCandles: [],
  fullLtfCandles: [],
  indicatorId: null,
  indicatorValues: [],
  brickSize: DEFAULT_BRICK_SIZE,
  renkoBricks: [],
  fullRenkoBricks: [],
  bottomPane: "candle",
  components: cloneComponents(DEFAULT_COMPONENTS),
  phases: null,
  seed: 42,
  source: "orderbook",
  obSpread: 0.02,
  obDepth: 12,
  obDepthSize: 20,
  orderbookSnapshots: [],
  syntheticStats: null,
  tickCount: 0,
  loadedFile: null,
  isLoading: false,
  dirty: false,
  error: null,
  playback: { status: "stopped", index: 0, total: 0, speed: 1, loop: false },
  _loadGeneration: 0,
  dataRevision: 0,

  loadSynthetic: async () => {
    const gen = get()._loadGeneration + 1;
    set({ _loadGeneration: gen, isLoading: true, error: null });
    playbackEngine.stop();
    const { components, source, phases } = get();
    // Fase lebih diutamakan dari komponen tunggal: stream rng, harga, riwayat
    // candle, variance GARCH, dan book LOB kontinu melewati batas fase.
    const phaseList = phases
      ? phases.map((p) => ({ count: p.count, components: buildComponents(p.components) }))
      : undefined;
    const base = {
      seed: get().seed,
      count: phaseList ? phaseList.reduce((s, p) => s + p.count, 0) : 7500,
      startPrice: 100,
      startTime: SYNTHETIC_START_TIME,
      tickIntervalSeconds: 0.2,
      components: buildComponents(components),
    };
    const isOrderbook = source === "orderbook";
    const enabledCount = Object.values(components).filter((c) => c.enabled).length;
    try {
      let ticks: Tick[];
      let orderbookSnapshots: OrderBookSnapshot[];
      if (isOrderbook) {
        const obSource = new OrderBookTickSource({
          ...base,
          baseVolume: 15,
          spread: get().obSpread,
          depth: get().obDepth,
          depthSize: get().obDepthSize,
          ...(phaseList ? { phases: phaseList } : {}),
        });
        ticks = await obSource.fetchTicks();
        orderbookSnapshots = obSource.snapshots();
      } else {
        const source = new SyntheticTickSource({
          ...base,
          baseVolume: 25,
          ...(phaseList ? { phases: phaseList } : {}),
        });
        ticks = await source.fetchTicks();
        orderbookSnapshots = [];
      }
      if (gen !== get()._loadGeneration) return;
      const byTimeframe = aggregateForTimeframes(ticks);
      const htfId = get().htfId;
      const htf = byTimeframe[htfId];
      const ltf = byTimeframe[LTF_ID];
      const brickSize = get().brickSize;
      const renkoBricks = buildRenko(ticks, brickSize);
      playbackEngine.loadTicks(ticks, workerTimeframes(htfId), brickSize);
      const fileTag = phaseList
        ? `${phaseList.length} fase`
        : `${enabledCount} komponen`;
      set({
        ticks,
        candlesByTimeframe: byTimeframe,
        htfCandles: htf,
        ltfCandles: ltf,
        fullHtfCandles: htf,
        fullLtfCandles: ltf,
        indicatorValues: indicatorSeries(htf, get().indicatorId),
        renkoBricks,
        fullRenkoBricks: renkoBricks,
        tickCount: ticks.length,
        loadedFile: isOrderbook
          ? `orderbook (${fileTag}, seed ${get().seed})`
          : `synthetic (${fileTag}, seed ${get().seed})`,
        orderbookSnapshots,
        syntheticStats: summarizeTicks(ticks),
        playback: { status: "stopped", index: 0, total: ticks.length, speed: 1, loop: get().playback.loop },
        dirty: false,
        isLoading: false,
        dataRevision: get().dataRevision + 1,
      });
    } catch (err) {
      if (gen !== get()._loadGeneration) return;
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  },

  setComponents: (components) => {
    const hasData = get().ticks.length > 0;
    set({ components, dirty: hasData });
  },

  setPhases: (phases) => {
    const hasData = get().ticks.length > 0;
    set({ phases, dirty: hasData });
  },

  setSource: (source) => {
    const hasData = get().ticks.length > 0;
    set({ source, dirty: hasData });
  },

  setOrderbookParam: (key, value) => {
    if (!Number.isFinite(value) || value <= 0) return;
    const hasData = get().ticks.length > 0;
    set({ [key]: value, dirty: hasData } as unknown as Partial<ChartStore>);
  },

  setSeed: (seed) => {
    if (!Number.isInteger(seed) || seed < 0) return;
    const hasData = get().ticks.length > 0;
    set({ seed, dirty: hasData });
  },

  setComponentEnabled: (id, enabled) => {
    const next = {
      ...get().components,
      [id]: { ...get().components[id], enabled },
    };
    const hasData = get().ticks.length > 0;
    set({ components: next, dirty: hasData });
  },

  setComponentParam: (id, key, value) => {
    if (!Number.isFinite(value)) return;
    const cfg = get().components[id];
    if (!cfg) return;
    const next = {
      ...get().components,
      [id]: { ...cfg, params: { ...cfg.params, [key]: value } },
    };
    const hasData = get().ticks.length > 0;
    set({ components: next, dirty: hasData });
  },

  setHtf: (id) => {
    const { ticks } = get();
    if (ticks.length === 0) {
      set({ htfId: id });
      return;
    }
    const htf = get().candlesByTimeframe[id];
    playbackEngine.loadTicks(ticks, workerTimeframes(id), get().brickSize);
    set({
      htfId: id,
      htfCandles: htf,
      fullHtfCandles: htf,
      indicatorValues: indicatorSeries(htf, get().indicatorId),
      playback: { status: "stopped", index: 0, total: ticks.length, speed: 1, loop: get().playback.loop },
    });
  },

  setIndicator: (id) => {
    set((s) => ({ indicatorId: id, indicatorValues: indicatorSeries(s.htfCandles, id) }));
  },

  setBottomPane: (pane) => {
    set({ bottomPane: pane });
  },

  setBrickSize: (size) => {
    if (!Number.isFinite(size) || size <= 0) return;
    const valid = Math.max(0.01, size);
    const { ticks } = get();
    if (ticks.length === 0) {
      set({ brickSize: valid });
      return;
    }
    const renkoBricks = buildRenko(ticks, valid);
    playbackEngine.loadTicks(ticks, workerTimeframes(get().htfId), valid);
    set({
      brickSize: valid,
      renkoBricks,
      fullRenkoBricks: renkoBricks,
      playback: { status: "stopped", index: 0, total: ticks.length, speed: 1, loop: get().playback.loop },
    });
  },

  play: () => {
    const { status, index, total } = get().playback;
    const freshStart = status === "stopped" || index >= total;
    playbackEngine.play();
    if (freshStart) {
      set((s) => ({
        playback: { ...s.playback, status: "playing", index: 0 },
        htfCandles: [],
        ltfCandles: [],
        renkoBricks: [],
        indicatorValues: [],
      }));
    } else {
      set((s) => ({ playback: { ...s.playback, status: "playing" } }));
    }
  },

  pause: () => {
    playbackEngine.pause();
    set((s) => ({ playback: { ...s.playback, status: "paused" } }));
  },

  stop: () => {
    playbackEngine.stop();
    set((s) => ({
      playback: { ...s.playback, status: "stopped", index: 0 },
      htfCandles: s.fullHtfCandles,
      ltfCandles: s.fullLtfCandles,
      renkoBricks: s.fullRenkoBricks,
      indicatorValues: indicatorSeries(s.fullHtfCandles, s.indicatorId),
    }));
  },

  step: () => {
    if (get().playback.status === "stopped") {
      set((s) => ({
        playback: { ...s.playback, status: "paused" },
        htfCandles: [],
        ltfCandles: [],
        renkoBricks: [],
        indicatorValues: [],
      }));
    }
    playbackEngine.step();
  },

  setSpeed: (speed) => {
    if (!Number.isFinite(speed) || speed <= 0) return;
    playbackEngine.setSpeed(speed);
    set((s) => ({ playback: { ...s.playback, speed } }));
  },

  setLoop: (loop) => {
    playbackEngine.setLoop(loop);
    set((s) => ({ playback: { ...s.playback, loop } }));
  },
}));

/**
 * Menghubungkan event engine (worker) ke store. Dipanggil sekali di App.
 */
export function initPlaybackBridge(): () => void {
  const offCandle = playbackEngine.on("candle", (data) => {
    const batch = data as CandleBatch;
    useChartStore.setState((s) => {
      const htfAdd = (batch.candlesByTimeframe[s.htfId] ?? []) as Candle[];
      const ltfAdd = (batch.candlesByTimeframe[LTF_ID] ?? []) as Candle[];
      const renkoAdd = (batch.candlesByTimeframe["renko"] ?? []) as Brick[];
      const hasReset = batch.index === 0 && Object.keys(batch.candlesByTimeframe).length === 0;
      // Reset worker hanya boleh mengosongkan tampilan jika chart sedang dalam
      // kondisi parsial (playback) atau playback loop sedang restart. Jika store
      // sudah mengisi data penuh (setelah load/regenerate/stop/setHtf/setBrickSize,
      // status "stopped"), reset tidak boleh menyembunyikan candle yang sengaja
      // ditampilkan utuh.
      const showingFull =
        s.htfCandles.length === s.fullHtfCandles.length &&
        s.htfCandles.every((c, i) => s.fullHtfCandles[i]?.time === c.time);
      const clearOnReset = hasReset && (s.playback.status === "playing" || !showingFull);
      const htfCandles = clearOnReset ? [] : hasReset ? s.htfCandles : mergeByTime(s.htfCandles, htfAdd);
      const ltfCandles = clearOnReset ? [] : hasReset ? s.ltfCandles : mergeByTime(s.ltfCandles, ltfAdd);
      const renkoBricks = clearOnReset
        ? []
        : hasReset
          ? s.renkoBricks
          : [...s.renkoBricks, ...renkoAdd];
      return {
        htfCandles,
        ltfCandles,
        renkoBricks,
        indicatorValues: indicatorSeries(htfCandles, s.indicatorId),
        playback: { ...s.playback, index: batch.index, total: batch.total },
      };
    });
  });
  const offStats = playbackEngine.on("stats", (data) => {
    const payload = data as { type: string; index: number; total: number };
    if (payload.type === "finished") {
      useChartStore.setState((s) => ({
        playback: { ...s.playback, status: "paused", index: payload.index, total: payload.total },
      }));
    }
  });
  const offError = playbackEngine.on("error", (data) => {
    const payload = data as { message: string };
    useChartStore.setState((s) => ({
      error: payload.message,
      playback: { ...s.playback, status: "paused" },
    }));
  });
  return () => {
    offCandle();
    offStats();
    offError();
  };
}
