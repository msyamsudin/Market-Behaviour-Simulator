# Market Behaviour Simulator

Aplikasi desktop untuk mempelajari bagaimana harga terbentuk dari tick hingga menghasilkan berbagai jenis chart. Dibangun dengan **Tauri + React + TypeScript + Vite**, chart memakai **TradingView Lightweight Charts**, state dengan **Zustand**, threading lewat **Web Worker**.

Dokumen perencanaan: `docs/Market-Behaviour-Simulator.md` (visi/arsitektur) dan `docs/Market-Behaviour-Simulator-MS.md` (milestone). Status per milestone: `docs/milestone-log.md`. Indeks lengkap: [`docs/README.md`](docs/README.md).

## Status — Track A + B + C selesai (M1–M12)

Aplikasi berfungsi sebagai **replay tool historis**:

- Load file tick CSV (1500 baris dummy) → agregasi OHLC.
- Playback di Web Worker (batch `postMessage`, aggregator di worker, update chart per batch) — Play/Pause/Stop/Step, speed 1x/10x, progress bar.
- Multi-timeframe: 1s, 5s, 15s, 30s, 1m, 5m — re-agregasi dari raw tick.
- HTF/LTF sync: dua chart bertumpuk (HTF atas, LTF bawah), shared crosshair & shared time axis.
- Indicator Engine pluggable: ATR Wilder (14) sebagai overlay line.
- Renko Engine fixed brick (classic, multi-brick): bottom pane bisa dialihkan ke Renko, brick size bisa diatur.
- **Market Behavior Engine (Track C)**: generator tick sintetis berbasis komponen
  (Noise, Trend, Volatility=GARCH, Mean Reversion, Liquidity) — masing-masing
  bisa on/off + parameter sendiri; Session Engine (Asia/London/NY) menerapkan
  multiplier per sesi; panel Statistics membandingkan metrik numerik synthetic
  vs historical.

## Development

Prasyarat: Rust toolchain, VS Build Tools (MSVC), WebView2, Node 18+. (Verifikasi: `docs/verifikasi/environment-verification-M1.md`.)

```sh
npm install
npm run tauri dev      # dev app
npm run test           # unit test (vitest)
npm run build          # tsc + vite build
npm run tauri build    # release installer
npm run export:reference  # export candle referensi M2 ke docs/verifikasi/
```

Catatan Windows: `npm` di PowerShell terblokir execution policy → gunakan `npm.cmd`.

## Struktur

```
src/
  app/          # Zustand store (chartStore, playback bridge)
  ui/           # komponen kontrol (playback, timeframe, indikator, pane)
  chart/        # adapter Lightweight Charts (Chart, SyncCharts)
  engine/
    playback/   # PlaybackEngine + EventDispatcher + pacing
    tick/       # TickSource (CSV) — sintetis menyusul di Track C
    candle/     # aggregateTicks, IncrementalCandleAggregator, timeframes
    renko/      # FixedRenko (classic)
    indicator/  # ATR + registry pluggable
    market/     # (Track C)
    statistics/ # (Track C)
  worker/       # playback.worker.ts (tick → candle/renko, batch)
  types/        # Tick, Candle, Brick, TickSource, IIndicator, IRenko
  utils/        # csv parser, rng, pacing
```

Arsitektur: semua modul engine independen; chart hanya membaca hasil; tidak ada perhitungan di layer UI.

## Roadmap

- **Track A** (selesai): M1–M4.
- **Track B** (selesai): M5–M7.
- **Checkpoint v0.1** (selesai): build release + dokumen.
- **Track C** (selesai): M8–M12 (Market Behavior Engine — generator tick sintetis).
- **Track D**: M13–M14 (riset terpisah, belum dikerjakan).
- Backlog: AI Mode, Plugin System, Replay Challenge, Workspace, indikator lain, Renko ATR/Percentage, Parquet, dll.
