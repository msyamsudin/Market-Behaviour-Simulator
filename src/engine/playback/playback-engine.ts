import type { Candle } from "../../types/candle";
import type { Brick } from "../../types/renko";
import type { Tick } from "../../types/tick";
import { SimpleEventDispatcher, type EventDispatcher } from "./event-dispatcher";

export type PlaybackStatus = "stopped" | "playing" | "paused";

export interface PlaybackState {
  status: PlaybackStatus;
  index: number;
  total: number;
  speed: number;
  loop: boolean;
}

export interface CandleBatch {
  candlesByTimeframe: Record<string, (Candle | Brick)[]>;
  index: number;
  total: number;
}

type WorkerMessage =
  | { type: "candles"; candlesByTimeframe: Record<string, (Candle | Brick)[]>; index: number; total: number }
  | { type: "reset" }
  | { type: "finished"; index: number; total: number }
  | { type: "error"; message: string };

/**
 * Playback Engine — kontrol di main thread, eksekusi tick + agregasi di worker.
 *
 * Worker mengirim batch candle (bukan 1 pesan per tick); aggregator berjalan di
 * worker; update chart dilakukan per batch. Event di-publish lewat EventDispatcher
 * sehingga UI hanya membaca hasil (tidak ada perhitungan di layer UI).
 */
export class PlaybackEngine {
  readonly dispatcher: EventDispatcher = new SimpleEventDispatcher();

  private readonly worker: Worker;
  private state: PlaybackState = { status: "stopped", index: 0, total: 0, speed: 1, loop: false };
  private started = false;

  constructor() {
    this.worker = new Worker(new URL("../../worker/playback.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => this.onWorkerMessage(e.data);
  }

  getState(): PlaybackState {
    return { ...this.state };
  }

  loadTicks(ticks: Tick[], timeframes: { id: string; seconds: number }[], renkoBrickSize: number): void {
    this.started = true;
    this.state = { ...this.state, status: "stopped", index: 0, total: ticks.length };
    this.worker.postMessage({ type: "load", ticks, timeframes, renkoBrickSize });
  }

  play(): void {
    if (!this.started) return;
    // index TIDAK direset di sini: worker melanjutkan dari cursor saat ini.
    // Index sebenarnya datang dari event `candles` (batch) atau `reset` worker.
    this.state = { ...this.state, status: "playing" };
    this.worker.postMessage({ type: "play", speed: this.state.speed });
  }

  pause(): void {
    if (!this.started) return;
    this.state = { ...this.state, status: "paused" };
    this.worker.postMessage({ type: "pause" });
  }

  stop(): void {
    if (!this.started) return;
    this.state = { ...this.state, status: "stopped", index: 0 };
    this.worker.postMessage({ type: "stop" });
  }

  step(): void {
    if (!this.started) return;
    if (this.state.status === "stopped") {
      this.state = { ...this.state, status: "paused" };
    }
    this.worker.postMessage({ type: "step" });
  }

  setSpeed(speed: number): void {
    this.state = { ...this.state, speed };
    this.worker.postMessage({ type: "setSpeed", speed });
  }

  setLoop(loop: boolean): void {
    this.state = { ...this.state, loop };
    this.worker.postMessage({ type: "setLoop", loop });
  }

  on(type: "tick" | "candle" | "brick" | "stats" | "error", cb: (data: unknown) => void): () => void {
    return this.dispatcher.on(type, cb);
  }

  dispose(): void {
    this.worker.terminate();
  }

  private onWorkerMessage(msg: WorkerMessage): void {
    switch (msg.type) {
      case "candles": {
        this.state = { ...this.state, index: msg.index, total: msg.total };
        const batch: CandleBatch = {
          candlesByTimeframe: msg.candlesByTimeframe,
          index: msg.index,
          total: msg.total,
        };
        this.dispatcher.emit("candle", batch);
        this.dispatcher.emit("tick", batch);
        break;
      }
      case "reset": {
        this.state = { ...this.state, index: 0 };
        this.dispatcher.emit("candle", { candlesByTimeframe: {}, index: 0, total: this.state.total });
        break;
      }
      case "finished": {
        this.state = { ...this.state, status: "paused", index: msg.index, total: msg.total };
        this.dispatcher.emit("stats", { type: "finished", index: msg.index, total: msg.total });
        break;
      }
      case "error": {
        this.state = { ...this.state, status: "paused" };
        this.dispatcher.emit("error", { message: msg.message });
        break;
      }
    }
  }
}

export const playbackEngine = new PlaybackEngine();
