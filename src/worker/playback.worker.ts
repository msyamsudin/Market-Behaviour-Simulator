/// <reference lib="webworker" />
import { IncrementalCandleAggregator } from "../engine/candle/incremental-aggregator";
import { estimateTicksPerSecond, ticksToAdvance } from "../engine/playback/pacing";
import { FixedRenko, createRenkoState } from "../engine/renko/fixed-renko";
import type { Candle } from "../types/candle";
import type { Brick, RenkoState } from "../types/renko";
import type { Tick } from "../types/tick";

declare const self: DedicatedWorkerGlobalScope;

interface WorkerTimeframe {
  id: string;
  seconds: number;
}

type MainMessage =
  | { type: "load"; ticks: Tick[]; timeframes: WorkerTimeframe[]; renkoBrickSize: number }
  | { type: "play"; speed: number }
  | { type: "pause" }
  | { type: "stop" }
  | { type: "step" }
  | { type: "setSpeed"; speed: number }
  | { type: "setLoop"; loop: boolean };

type WorkerMessage =
  | { type: "candles"; candlesByTimeframe: Record<string, (Candle | Brick)[]>; index: number; total: number }
  | { type: "reset" }
  | { type: "finished"; index: number; total: number }
  | { type: "error"; message: string };

let ticks: Tick[] = [];
let ticksPerSecond = 1;
let timeframes: WorkerTimeframe[] = [];
const aggregators = new Map<string, IncrementalCandleAggregator>();
let renko: FixedRenko = new FixedRenko(1);
let renkoState: RenkoState = createRenkoState();
let cursor = 0;
let running = false;
let loop = false;
let speed = 1;
let timerId: number | null = null;
let startWall = 0;

function post(msg: WorkerMessage): void {
  self.postMessage(msg);
}

function stopTimer(): void {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer(): void {
  stopTimer();
  startWall = performance.now();
  timerId = setInterval(onInterval, 50);
}

function processRange(from: number, to: number): Record<string, (Candle | Brick)[]> {
  const byTf: Record<string, (Candle | Brick)[]> = {};
  const renkoBricks: Brick[] = [];
  for (const tf of timeframes) byTf[tf.id] = [];
  for (let i = from; i < to; i++) {
    const t = ticks[i];
    if (t === undefined) continue;
    for (const tf of timeframes) {
      const agg = aggregators.get(tf.id);
      if (!agg) continue;
      const done = agg.add(t);
      if (done.length > 0) byTf[tf.id].push(...done);
    }
    renkoBricks.push(...renko.add(t, renkoState));
  }
  if (renkoBricks.length > 0) byTf["renko"] = renkoBricks;
  for (const tf of timeframes) {
    const agg = aggregators.get(tf.id);
    if (!agg) continue;
    const current = agg.peek();
    if (current) byTf[tf.id].push({ ...current });
  }
  return byTf;
}

function flushAll(): Record<string, Candle[]> {
  const byTf: Record<string, Candle[]> = {};
  for (const tf of timeframes) {
    const agg = aggregators.get(tf.id);
    if (!agg) continue;
    const done = agg.flush();
    if (done.length > 0) byTf[tf.id] = done;
  }
  return byTf;
}

function onInterval(): void {
  if (!running) return;
  try {
    const elapsed = performance.now() - startWall;
    const n = ticksToAdvance(elapsed, speed, ticksPerSecond, cursor, ticks.length);
    if (n > 0) {
      const byTf = processRange(cursor, cursor + n);
      cursor += n;
      post({ type: "candles", candlesByTimeframe: byTf, index: cursor, total: ticks.length });
    }
    if (cursor >= ticks.length) finish();
  } catch (err) {
    stopTimer();
    running = false;
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
}

function finish(): void {
  stopTimer();
  if (loop && ticks.length > 0) {
    cursor = 0;
    for (const agg of aggregators.values()) agg.reset();
    renkoState = createRenkoState();
    post({ type: "reset" });
    startTimer();
  } else {
    running = false;
    const byTf = flushAll();
    post({ type: "candles", candlesByTimeframe: byTf, index: ticks.length, total: ticks.length });
    post({ type: "finished", index: ticks.length, total: ticks.length });
  }
}

self.onerror = (e: ErrorEvent) => {
  stopTimer();
  running = false;
  post({ type: "error", message: e.message || "worker error" });
};

self.onmessage = (e: MessageEvent<MainMessage>) => {
  const msg = e.data;
  switch (msg.type) {
    case "load": {
      stopTimer();
      running = false;
      ticks = msg.ticks;
      timeframes = msg.timeframes;
      aggregators.clear();
      for (const tf of timeframes) {
        aggregators.set(tf.id, new IncrementalCandleAggregator(tf.seconds));
      }
      renko = new FixedRenko(msg.renkoBrickSize);
      renkoState = createRenkoState();
      ticksPerSecond = estimateTicksPerSecond(ticks);
      cursor = 0;
      post({ type: "reset" });
      break;
    }
    case "play": {
      speed = msg.speed;
      if (cursor >= ticks.length) {
        cursor = 0;
        for (const agg of aggregators.values()) agg.reset();
        renkoState = createRenkoState();
        post({ type: "reset" });
      }
      running = true;
      startTimer();
      break;
    }
    case "pause": {
      stopTimer();
      running = false;
      break;
    }
    case "stop": {
      stopTimer();
      running = false;
      cursor = 0;
      for (const agg of aggregators.values()) agg.reset();
      renkoState = createRenkoState();
      post({ type: "reset" });
      break;
    }
    case "step": {
      if (cursor < ticks.length) {
        const byTf = processRange(cursor, cursor + 1);
        cursor += 1;
        post({ type: "candles", candlesByTimeframe: byTf, index: cursor, total: ticks.length });
        if (cursor >= ticks.length) {
          const byTf2 = flushAll();
          post({ type: "candles", candlesByTimeframe: byTf2, index: cursor, total: ticks.length });
          post({ type: "finished", index: cursor, total: ticks.length });
        }
      }
      break;
    }
    case "setSpeed": {
      speed = msg.speed;
      startWall = performance.now();
      break;
    }
    case "setLoop": {
      loop = msg.loop;
      break;
    }
  }
};
