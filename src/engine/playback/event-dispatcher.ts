export type EngineEvent = "tick" | "candle" | "brick" | "stats" | "error";

export interface EventDispatcher {
  on(type: EngineEvent, cb: (data: unknown) => void): () => void;
  emit(type: EngineEvent, data: unknown): void;
}

export class SimpleEventDispatcher implements EventDispatcher {
  private readonly listeners = new Map<EngineEvent, Set<(data: unknown) => void>>();

  on(type: EngineEvent, cb: (data: unknown) => void): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  }

  emit(type: EngineEvent, data: unknown): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const cb of [...set]) {
      cb(data);
    }
  }
}
