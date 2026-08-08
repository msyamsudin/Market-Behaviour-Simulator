# Milestone Log

Catatan verifikasi per milestone terhadap kriteria "Selesai kalau" dari
`Market-Behaviour-Simulator-MS.md`.

## M1 — Shell Aplikasi (selesai)

- Verifikasi environment → `docs/verifikasi/environment-verification-M1.md`.
- Scaffold Tauri + React + TS + Vite (npm), deps: zustand, lightweight-charts.
- Struktur folder `src/` sesuai arsitektur.
- `chartStore` + komponen `Chart` (lightweight-charts) dengan data dummy statis.
- Placeholder loader file dummy.
- **Bukti**: `tauri-app.exe` jalan dengan window "Market Behaviour Simulator"
  (Responding=true), dev server melayani `/` dan `/dummy-ticks.csv` (HTTP 200),
  `tsc`/vite build bersih.

## M2 — Tick → Candle Pipeline (selesai)

- Tipe inti: `types/tick.ts`, `types/candle.ts`, `types/tick-source.ts`.
- `utils/csv.ts` parser `time,price,volume`; `engine/candle/aggregator.ts`.
- `CSVTickSource` implementasi `TickSource`.
- `public/dummy-ticks.csv` (1500 baris).
- State flow: `loadTickFile()` → parse → aggregate → render full history.
- **Bukti**: 16 unit test hijau, termasuk fixture manual (referensi spreadsheet)
  dan integritas file penuh (1500/1500 tick, total volume tidak hilang, 25 candle).
  Referensi pembanding: `docs/verifikasi/m2-candles-reference.csv` (`npm run export:reference`).
  Validasi manual: `docs/verifikasi/M2-reference-validation.md`.

## M3 — Playback Engine (selesai)

- `engine/playback/event-dispatcher.ts` (pub/sub).
- `engine/playback/playback-engine.ts` (state + kontrol di main thread).
- `worker/playback.worker.ts`: tick diproses di worker, **batch candle** via
  `postMessage` (bukan 1 pesan/tick), aggregator inkremental di worker
  (`engine/candle/incremental-aggregator.ts`), update chart per batch.
- Pacing wall-clock self-correcting (`engine/playback/pacing.ts`) → menjamin
  semua tick diproses tepat sekali di semua speed.
- UI: Play/Pause/Stop/Step, speed 1x/2x/5x/10x, progress bar index/total.
- **Bukti**: test `pacing.test.ts` (simulasi 1500 tick @10x → tepat 1500 advance,
  tidak ada lompatan) dan `incremental-aggregator.test.ts` (output identik dengan
  `aggregateTicks`). Build bersih, app berjalan.

## M4 — Multi-timeframe (selesai)

- `engine/candle/timeframes.ts`: daftar 1s/5s/15s/30s/1m/5m.
- Store `candlesByTimeframe` (cache per timeframe) — re-agregasi dari raw tick,
  bukan dari candle timeframe lain.
- Dropdown HTF; detail: `docs/M4` tidak terpisah — bukti di `tests/timeframes.test.ts`.
- **Bukti**: jumlah candle per timeframe benar (1s=1500, 5s=300, 15s=100, 30s=50,
  1m=25, 5m=5), total volume konsisten antar timeframe, agregasi deterministik.

## M5 — HTF/LTF Sync (selesai)

- `chart/SyncCharts.tsx`: 2 chart bertumpuk (HTF atas, LTF bawah).
- Shared crosshair: `subscribeCrosshairMove` → `setCrosshairPosition` di chart lain.
- Shared time: `subscribeVisibleLogicalRangeChange` → `setVisibleLogicalRange`.
- Guard anti feedback loop; playback tetap 1 sumber tick (worker mengagregasi
  HTF + LTF + renko dari stream yang sama).
- **Bukti**: build bersih, app berjalan (sync via guard diuji manual lewat HMR).

## M6 — Indicator Engine (ATR) (selesai)

- `types/indicator.ts`: `IIndicator` pluggable.
- `engine/indicator/atr.ts`: ATR Wilder (14), `null` saat warm-up.
- `engine/indicator/registry.ts` + dropdown indicator.
- Overlay line series (price scale terpisah) di chart HTF.
- **Bukti**: `tests/atr.test.ts` — fixture manual period 2
  `[null, null, 3, 3, 4]` cocok, warm-up 14 benar, registry memuat ATR.

## M7 — Renko Engine (fixed brick) (selesai)

- `types/renko.ts`: `Brick`, `RenkoState`, `IRenko`.
- `engine/renko/fixed-renko.ts`: classic, multi-brick saat tren kuat.
- Bottom pane bisa dialihkan ke Renko (`PaneSelector`), brick size bisa diatur;
  stream renko ikut playback (dari worker, sumber tick sama).
- **Bukti**: `tests/renko.test.ts` — simulasi manual brickSize 2 →
  arah `[up,up,down,down,up,up]` (6 brick), close `[12,14,12,10,12,14]`,
  multi-brick, waktu monoton.

## Checkpoint v0.1 (selesai)

- `npm run tauri build` penuh → release exe + installer bundle
  (`target/release/bundle/nsis/*-setup.exe`, `bundle/msi/*.msi`).
- README.md ditulis; aplikasi usable sebagai replay tool historis.

## M8 — Tick Generator (selesai)

- `utils/rng.ts` (mulberry32), `engine/tick/tick-generator.ts` (Noise+Trend),
  `engine/tick/synthetic-tick-source.ts` (implementasi `TickSource`).
- Store refactor ke pipeline source-agnostic (`loadSource`); dropdown Data Source.
- **Bukti**: `tests/synthetic.test.ts` — deterministik per seed, output synthetic
  melewati pipeline Track A (aggregateTicks/buildRenko) tanpa modifikasi.
- **Catatan (M9/Track C)**: `tick-generator.ts` superseded oleh
  `component-tick-generator.ts` dan dihapus; blok test M8 yang mengujinya ikut
  dihapus. Determinisme kini diuji pada pipeline komponen.

## M9 — Volatility + Mean Reversion (selesai)

- Pola `TickComponent` (on/off + params); `engine/tick/components.ts`.
- Volatility = GARCH(1,1) (stasioner, menghasilkan clustering); MR tarik ke mean.
- `engine/tick/component-tick-generator.ts`: `nextTick = sum(komponen aktif)`;
  riwayat candle + recentDeltas dikelola inkremental.
- Panel komponen (toggle + param) di UI.
- **Bukti**: `tests/components.test.ts` — off-noise → jalur mulus; off-MR → range
  melebar; off-trend → drift hilang; volatility on → ACF return kuadrat lebih
  tinggi (clustering).

## M10 — Validasi statistik dasar (selesai)

- `engine/statistics/metrics.ts` + `compare.ts`; panel Statistics.
- **Bukti**: `tests/statistics.test.ts` + `docs/verifikasi/M10-statistics-validation.md`
  berisi angka perbandingan numeric (distribusi return, ACF, density).

## M11 — Liquidity Engine minimal (selesai)

- `engine/market/liquidity.ts`: LiquidityTracker (previous/equal high-low window
  30 candle) + LiquidityComponent (dorong harga melewati level dekat level).
  Komponen memakai stream rng internal → A/B seed sama bersih (jalur noise identik).
- Panel: komponen ke-5 (default off).
- **Bukti**: `tests/liquidity.test.ts` — A/B seed sama (1,2,3): level break &
  sweep lebih sering dengan engine (mis. seed 1: breaks 5→46, sweeps 5→17).

## M12 — Session Engine (selesai)

- `engine/market/session.ts`: 5 sesi (Asia/London/Overlap/NY/Off-peak), multiplier
  volatility/liquidity/noise; generator meneruskan `ctx.session` ke komponen.
- UI: badge sesi saat playback.
- **Bukti**: `tests/session.test.ts` + `docs/verifikasi/M12-session-engine.md` — std return
  overlap > asia sesuai desain multiplier; jadwal 24 jam tanpa celah.

## Track D (M13–M14) & Backlog

Belum dikerjakan — riset terpisah (M13: market structure state-machine; M14:
liquidity penuh + News regime). Backlog menunggu Track C stabil.
