# Code Review — Market Behaviour Simulator

> Audit per: 2026-08-08 · Semua file `src/` diperiksa manual.

---

## Ringkasan Eksekutif

Codebase berada pada kondisi **baik secara keseluruhan** — arsitektur modular, pipeline deterministik, unit test cukup, dan dokumentasi milestone lengkap. Temuan di bawah bukan blocker kritis, tapi masing-masing berpotensi menyebabkan bug halus atau penumpukan technical debt saat Track D (M13–M14) dikerjakan.

---

## 1. Bug / Logika Berpotensi Salah

### 1.1 `playback-engine.ts` — `play()` selalu reset `index = 0` di state lokal

**File:** [`playback-engine.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/engine/playback/playback-engine.ts#L58-L62)  
**Severity:** ⚠️ Major

```ts
// L60 — state.index direset ke 0 saat play(), tapi worker sudah melanjutkan dari cursor saat ini
play(): void {
  if (!this.started) return;
  this.state = { ...this.state, status: "playing", index: 0 };  // ← selalu 0!
  this.worker.postMessage({ type: "play", speed: this.state.speed });
}
```

**Masalah:** Worker akan melanjutkan dari `cursor` saat ini (bisa di tengah), tapi `PlaybackEngine.state.index` direset ke 0. Ini menyebabkan **mismatch antara state engine dan worker** — progress bar akan mulai dari 0 sebelum batch pertama tiba, bukan dari posisi lanjutan.

**Saran:** Hapus `index: 0` dari `play()`. Biarkan worker yang menentukan `index` lewat event `candles`. Atau hanya reset jika `freshStart` (kondisi ini sudah dikelola di `chartStore.ts` L337–346, tapi di level engine justru selalu reset).

---

### 1.2 `orderbook.ts` — Fallback hardcoded `100` di `maintain()`

**File:** [`orderbook.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/engine/orderbook/orderbook.ts#L78-L81)  
**Severity:** ⚠️ Major

```ts
if (b === null && a === null) {
  this.bids.set(round2(100 - step / 2), this.nextSize(depthSize, rng));
  this.asks.set(round2(100 + step / 2), this.nextSize(depthSize, rng));
}
```

**Masalah:** Jika kedua sisi kosong (kondisi edge yang bisa terjadi setelah cancel agresif), harga di-hardcode ke `100`. Ini akan menyebabkan **price jump besar** jika `startPrice` bukan 100 (misal instrumen dengan harga 50, 200, atau forex pair).

**Saran:** Simpan referensi `mid` terakhir di `OrderBookEngine` sebagai properti private, gunakan sebagai fallback:

```ts
private lastMid = 100;
// ...update setiap kali mid() dipanggil...
if (b === null && a === null) {
  this.bids.set(round2(this.lastMid - step / 2), ...);
  this.asks.set(round2(this.lastMid + step / 2), ...);
}
```

---

### 1.3 `ComponentPanel.tsx` — `setSeed` dipanggil dengan `parseFloat` bukan `parseInt`

**File:** [`ComponentPanel.tsx`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/ui/ComponentPanel.tsx#L252)  
**Severity:** 🔵 Minor

```tsx
onChange={(e) => setSeed(parseFloat(e.target.value))}
```

**Masalah:** `parseFloat("3.7")` menghasilkan `3.7`, tapi `setSeed` di store memvalidasi `Number.isInteger(seed)` — sehingga nilai desimal akan **diam-diam diabaikan** tanpa feedback ke user.

**Saran:** Ganti ke `parseInt(e.target.value, 10)` atau tambahkan notifikasi jika nilai non-integer dimasukkan.

---

### 1.4 `statistics/metrics.ts` — `std()` menggunakan population std, bukan sample std

**File:** [`metrics.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/engine/statistics/metrics.ts#L44-L49)  
**Severity:** 🔵 Minor (konteks statistik)

```ts
const variance = xs.reduce((s, v) => s + (v - m) * (v - m), 0) / xs.length;
```

**Masalah:** Pembagi `xs.length` menghasilkan **population std** (σ). Namun `skewness` dan `kurtosis` di file yang sama menggunakan **sample correction** (`n-1`, `n-2`, `n-3`). Inkonsistensi ini akan menghasilkan std yang sedikit lebih kecil dari yang dipakai dalam formula skewness/kurtosis — menyebabkan bias kecil dalam perbandingan statistik.

**Saran:** Gunakan `xs.length - 1` di `std()` untuk konsistensi dengan corrected moments, atau dokumentasikan eksplisit bahwa `std` = σ (population).

---

### 1.5 `renko/fixed-renko.ts` — Tidak ada validasi reversal direction

**File:** [`fixed-renko.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/engine/renko/fixed-renko.ts#L30-L56)  
**Severity:** 🔵 Minor

**Masalah:** Implementasi Renko classic seharusnya mensyaratkan harga bergerak **satu brick penuh melawan arah** untuk reversal. Kode saat ini menghitung `count = Math.floor(Math.abs(diff) / brickSize)` tanpa memperhitungkan apakah ini merupakan reversal yang membutuhkan threshold lebih besar (`2× brickSize` dari level terakhir). Ini menyebabkan reversal terlalu mudah — tidak sesuai spesifikasi di docstring.

**Saran:** Simpan `direction` di state, dan untuk reversal arah berlawanan, harga perlu melewati `lastLevel ± 2 × brickSize`. Ini sesuai perilaku Renko classic yang sesungguhnya.

---

## 2. Inkonsistensi Antar Modul

### 2.1 Naming: `loop` property di `PlaybackState` vs store

**File:** [`playback-engine.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/engine/playback/playback-engine.ts#L13) vs [`chartStore.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/app/chartStore.ts#L39-L44)

```ts
// playback-engine.ts — PlaybackState interface PUNYA loop:
export interface PlaybackState { loop: boolean; ... }

// chartStore.ts — PlaybackState interface TIDAK punya loop:
interface PlaybackState { status, index, total, speed }
```

**Masalah:** Ada dua interface `PlaybackState` berbeda — satu di engine (dengan `loop`) dan satu di store (tanpa `loop`). `setLoop()` di engine tersedia tapi tidak terhubung ke store. UI tidak bisa mengaktifkan fitur loop.

**Saran:** Unifikasi interface, atau ekspor `PlaybackState` dari engine dan re-use di store. Tambahkan `loop: boolean` ke store state dan action `setLoop`.

---

### 2.2 `chartStore.ts` — `setHtf()` tidak memuat renko ulang setelah ganti timeframe

**File:** [`chartStore.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/app/chartStore.ts#L292-L307)

```ts
setHtf: (id) => {
  // ...
  playbackEngine.loadTicks(ticks, workerTimeframes(id), get().brickSize);
  set({ htfId: id, htfCandles: htf, fullHtfCandles: htf, indicatorValues: ... });
  // ← TIDAK ada renkoBricks/fullRenkoBricks di set()!
```

**Masalah:** Saat HTF berubah, renko bricks di state tidak diperbarui. Perubahan yang dimaksud hanyalah workerTimeframes (`htf + ltf`), tapi state `renkoBricks` tetap dari timeframe lama. Tidak ada efek bug nyata karena renko tidak bergantung timeframe, tapi ini membingungkan dan mengindikasikan state yang tidak konsisten.

**Saran:** Dokumentasikan eksplisit bahwa renko tidak bergantung HTF, atau hapus reset `playback.index = 0` yang tidak perlu di `setHtf()`.

---

### 2.3 `OrderBookPanel.tsx` — `askCum` dan `bidCum` adalah variabel render-time, bukan state

**File:** [`OrderBookPanel.tsx`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/ui/OrderBookPanel.tsx#L357-L358)

```tsx
let askCum = 0;
let bidCum = 0;
// ...digunakan dalam render JSX dengan side effect (askCum +=, bidCum +=)
```

**Masalah:** Menggunakan variabel mutable dengan side effect di dalam render JSX adalah anti-pattern React. Ini rentan bug jika React me-render ulang bagian tertentu (Strict Mode renders komponen dua kali di dev).

**Saran:** Hitung kumulatif di luar JSX sebagai array pre-computed sebelum `return`:

```ts
const bidCums = bids.map((_, i) => bids.slice(0, i + 1).reduce((s, l) => s + l.size, 0));
```

---

## 3. Potensi Masalah Performa

### 3.1 `orderbook.ts` — `topKey()` adalah O(n) linear scan

**File:** [`orderbook.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/engine/orderbook/orderbook.ts#L210-L215)

```ts
private topKey(map: Map<number, number>, highest: boolean): number | null {
  let best: number | null = null;
  for (const price of map.keys()) { ... }  // ← O(n) setiap kali
  return best;
}
```

**Masalah:** `bestBid()` dan `bestAsk()` dipanggil berkali-kali per tick (dalam `addLimit`, `maintain`, `market`, `snapshot`). Dengan `depth=12` dan 7500 tick, ini masih cepat, tapi akan menjadi bottleneck saat depth besar.

**Saran:** Cache `bestBid` dan `bestAsk` sebagai private properti, invalidasi hanya saat Map berubah. Atau gunakan sorted structure (SortedMap / min-heap).

---

### 3.2 `Chart.tsx` — Sorting data di setiap render

**File:** [`Chart.tsx`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/chart/Chart.tsx#L36)

```ts
const sorted = [...candles].sort((a, b) => a.time - b.time);
```

**Masalah:** `toSeriesData()` melakukan sort defensif setiap kali `data` berubah. Selama playback aktif, ini dipanggil per batch (setiap 50ms). Dengan ribuan candle, sort O(n log n) per batch membuang CPU.

**Saran:** Pastikan pipeline upstream selalu mengembalikan data terurut (sudah ada `mergeByTime` di store yang menjaga urutan). Hapus sort atau jadikan opsional dengan prop `sorted?: boolean`.

---

### 3.3 `liquidity.ts` — `update()` dipanggil per tick, scan window 30 candle

**File:** [`liquidity.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/engine/market/liquidity.ts#L29-L47)

```ts
update(candles: Candle[], proximity = 0.5): void {
  for (let i = start; i < end; i++) { ... }  // scan 30 candle per tick
}
```

**Masalah:** `LiquidityComponent.next()` memanggil `this.tracker.update(ctx.history, ...)` setiap tick. Dengan 7500 tick, ini 7500 × 30 = 225.000 iterasi hanya untuk liquidity tracker.

**Saran:** Cache hasil `update()` — hanya perbarui level ketika `history.length` berubah (candle baru selesai), bukan setiap tick.

---

## 4. Code Smell / Anti-Pattern

### 4.1 `chartStore.ts` — Global mutable `loadGeneration` di module scope

**File:** [`chartStore.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/app/chartStore.ts#L148)

```ts
let loadGeneration = 0;  // ← global mutable state di luar store
```

**Masalah:** Variabel ini berada di module scope, bukan di dalam store Zustand. Ini berarti tidak bisa di-reset saat testing atau HMR tanpa full module reload. Potensi stale closure jika modul di-cache.

**Saran:** Pindahkan `loadGeneration` sebagai properti private store:

```ts
// Dalam create<ChartStore>:
_loadGeneration: 0,
```

---

### 4.2 `ComponentPanel.tsx` — Preset konfigurasi duplikat dengan `DEFAULT_COMPONENTS` di store

**File:** [`ComponentPanel.tsx`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/ui/ComponentPanel.tsx#L62-L70) vs [`chartStore.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/app/chartStore.ts#L31-L37)

**Masalah:** Preset "Balanced Market" di `ComponentPanel.tsx` L64-70 identik dengan `DEFAULT_COMPONENTS` di `chartStore.ts` L31-37. Dua sumber kebenaran untuk konfigurasi yang sama — jika salah satu berubah, yang lain tidak otomatis terupdate.

**Saran:** Impor `DEFAULT_COMPONENTS` dari `chartStore.ts` dan gunakan langsung di preset `default`:

```ts
import { DEFAULT_COMPONENTS } from "../app/chartStore";
const PRESETS = {
  default: { config: DEFAULT_COMPONENTS, ... },
  ...
};
```

---

### 4.3 `App.tsx` — Calling `useChartStore.getState()` di dalam `useEffect`

**File:** [`App.tsx`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/App.tsx#L23-L27)

```tsx
useEffect(() => {
  const offBridge = initPlaybackBridge();
  useChartStore.getState().loadSynthetic();  // ← getState() di dalam effect
  return offBridge;
}, []);
```

**Masalah:** `useChartStore.getState().loadSynthetic()` tidak perlu memanggil `getState()` — `loadSynthetic` bisa diakses langsung melalui destructuring karena tidak ada reactive dependency. Pola ini bisa membingungkan pembaca yang tidak familiar dengan Zustand.

**Saran:** Konsisten — gunakan hook di atas komponen atau pattern subscribe yang jelas:

```tsx
const loadSynthetic = useChartStore((s) => s.loadSynthetic);
// dalam effect:
void loadSynthetic();
```

---

### 4.4 `playback.worker.ts` — Tidak ada error handling di `processRange`

**File:** [`playback.worker.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/worker/playback.worker.ts#L60-L82)

**Masalah:** Jika `ticks[i]` adalah undefined (misal karena race condition dengan `load`), atau jika aggregator melempar error, worker akan crash diam-diam tanpa notifikasi ke main thread.

**Saran:** Tambahkan `try/catch` di `onInterval` dan kirim pesan error ke main thread:

```ts
self.onerror = (e) => {
  post({ type: "error", message: String(e.message) });
};
```

---

## 5. Fitur Belum Selesai / Missing

### 5.1 `engine/tick/tick-generator.ts` — File redundan (superseded oleh component generator)

**File:** [`tick-generator.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/engine/tick/tick-generator.ts)  
**Severity:** 🔵 Minor (housekeeping)

**Masalah:** File `tick-generator.ts` berisi generator `NoiseComponent + TrendComponent` awal yang kemudian digantikan oleh `component-tick-generator.ts` + `components.ts`. Dari milestone log M8, arsitektur sudah berubah tapi file lama tampaknya masih ada.

**Saran:** Verifikasi apakah `tick-generator.ts` masih diimpor di mana pun. Jika tidak, hapus untuk mengurangi kebingungan.

**Resolusi (2026-08-09):** ✅ Selesai. `tick-generator.ts` hanya diimpor oleh `tests/synthetic.test.ts` (blok "Tick Generator M8") — tidak ada kode produksi yang memakainya. File dan blok test M8 dihapus; catatan ditambahkan di `docs/milestone-log.md`.

---

### 5.2 Fitur `loop` belum terhubung ke UI

**File:** [`playback-engine.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/engine/playback/playback-engine.ts#L89-L92), [`playback.worker.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/worker/playback.worker.ts#L38)

**Masalah:** `setLoop()` di engine dan handler `setLoop` di worker sudah diimplementasi penuh, tapi tidak ada tombol Loop di UI, tidak ada action `setLoop` di store, dan tidak ada state `loop` di store.

**Saran:** Implementasi minimal: tambahkan toggle Loop di `PlaybackControls.tsx` dan wiring ke store → engine.

---

### 5.3 `compare.ts` — `compareStatistics()` dan `compareTicks()` tidak digunakan di UI

**File:** [`compare.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/engine/statistics/compare.ts)

**Masalah:** Fungsi perbandingan statistik synthetic vs historical dibangun di M10, namun `StatisticsPanel.tsx` hanya menampilkan statistik synthetic tanpa mode perbandingan.

**Saran:** Tambahkan panel perbandingan di Statistics jika fitur "load historical data" di-implementasi (backlog). Atau tambahkan komentar `// TODO: digunakan saat M13 file comparison` untuk clarity.

---

### 5.4 `utils/csv.ts` — CSV loader tersisa dari M2 tapi tidak digunakan di UI

**File:** [`csv.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/utils/csv.ts)

**Masalah:** Setelah refactor ke synthetic/orderbook source, UI tidak lagi menyediakan cara untuk load file CSV eksternal (fitur historis M2). Kode CSV parser masih ada tapi unreachable dari UI.

**Saran:** Dokumentasikan bahwa CSV loader adalah foundation untuk M13 (market structure dari data historis), atau jadikan sebagai fitur eksplisit jika direncanakan di Track D.

---

## 6. Missing Error Handling

### 6.1 `App.tsx` — `loadSynthetic()` error tidak ditampilkan di level App

**File:** [`App.tsx`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/App.tsx#L23-L27)

```tsx
useChartStore.getState().loadSynthetic();  // ← Promise tidak ditangani di App
```

**Masalah:** Error dari `loadSynthetic()` disimpan di `store.error`, tapi `App.tsx` tidak me-render error state. Hanya `ComponentPanel.tsx` yang menampilkan `store.error`. Jika komponen panel tidak terbuka, user tidak tahu bahwa data gagal dibuat.

**Saran:** Tambahkan error banner global di `App.tsx` atau `TopBar.tsx` yang muncul saat `store.error !== null`.

---

### 6.2 `orderbook-tick-source.ts` — `snapshots()` bisa return `[]` jika `fetchTicks()` belum dipanggil

**File:** [`orderbook-tick-source.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/engine/tick/orderbook-tick-source.ts#L32-L34)

```ts
snapshots(): OrderBookSnapshot[] {
  return this.result?.snapshots ?? [];  // ← silent empty jika fetchTicks belum dipanggil
}
```

**Masalah:** Memanggil `snapshots()` sebelum `fetchTicks()` mengembalikan array kosong tanpa error. Ini bisa menyebabkan OrderBook panel tampak kosong tanpa pesan jelas.

**Saran:** Tambahkan guard atau throw jika result null:

```ts
snapshots(): OrderBookSnapshot[] {
  if (!this.result) throw new Error("fetchTicks() must be called before snapshots()");
  return this.result.snapshots;
}
```

---

## 7. Inkonsistensi Dokumentasi vs Implementasi

### 7.1 Milestone log M3 menyebut "speed 1x/10x" — tapi implementasi memiliki 1x/2x/5x/10x

**File:** [`docs/milestone-log.md`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/docs/milestone-log.md#L37) vs [`PlaybackControls.tsx`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/ui/PlaybackControls.tsx#L3)

```md
<!-- milestone-log.md L37 -->
UI: Play/Pause/Stop/Step, speed 1x/10x, progress bar index/total.

// PlaybackControls.tsx L3
const SPEEDS = [1, 2, 5, 10];
```

**Saran:** Update milestone-log untuk mencerminkan 4 kecepatan yang sebenarnya ada.

---

### 7.2 `ATRIndicator` — nama hardcoded sebagai "ATR (14)" meski period bisa dikonfigurasi

**File:** [`atr.ts`](file:///d:/04_SOFTWARE/Script/06_GITHUB/Focus/Market-Behaviour-Simulator/src/engine/indicator/atr.ts#L41-L42)

```ts
export class ATRIndicator implements IIndicator {
  readonly name = "ATR (14)";  // ← hardcoded!
```

**Masalah:** Period dikonfigurasi lewat constructor, tapi `name` hardcoded "(14)". Jika ATR periode lain di-register, nama akan salah.

**Saran:**

```ts
constructor(period = 14) {
  this.period = period;
  this.name = `ATR (${period})`;  // ← dinamis
}
```

---

## 8. Hal Positif yang Perlu Dipertahankan

- ✅ **Determinisme PRNG** — `mulberry32` + seed konsisten dipakai di seluruh pipeline
- ✅ **Worker isolation** — agregasi berjalan di worker, main thread bebas
- ✅ **mergeByTime guard** — mencegah duplikasi candle dari batch playback lama
- ✅ **stasioneritas GARCH** — alpha + beta constraint mencegah divergen
- ✅ **LiquidityComponent rng terpisah** — A/B test bersih
- ✅ **Incremental aggregator identik dengan aggregateTicks** — dijamin lewat test
- ✅ **Session engine** — coverage 24 jam tanpa celah

---

## Prioritas Perbaikan

| # | Item | Severity | Effort |
|---|------|----------|--------|
| 1 | Bug `play()` selalu reset `index = 0` | ⚠️ Major | Kecil |
| 2 | Fallback hardcoded `100` di `maintain()` | ⚠️ Major | Kecil |
| 3 | Interface `PlaybackState` ganda (loop tidak terhubung) | ⚠️ Major | Sedang |
| 4 | `askCum/bidCum` side effect di render JSX | ⚠️ Major | Kecil |
| 5 | `setSeed` dipanggil dengan `parseFloat` bukan `parseInt` | 🔵 Minor | Trivial |
| 6 | `std()` population vs sample inconsistency | 🔵 Minor | Kecil |
| 7 | Renko reversal logic tidak sesuai spesifikasi | 🔵 Minor | Sedang |
| 8 | ATR name hardcoded | 🔵 Minor | Trivial |
| 9 | Preset default duplikat `DEFAULT_COMPONENTS` | 🔵 Minor | Trivial |
| 10 | Error banner global tidak ada | 🔵 Minor | Kecil |
| 11 | Sort di `Chart.tsx` per render saat playback | 🔵 Minor | Kecil |
| 12 | `LiquidityTracker.update()` dipanggil setiap tick | 🔵 Minor | Sedang |
