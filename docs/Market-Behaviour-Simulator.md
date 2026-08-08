# Market Behavior Simulator
## Implementation Plan

---

# 1. Tujuan

Membangun aplikasi desktop untuk mempelajari bagaimana harga terbentuk dari tick hingga menghasilkan berbagai jenis chart.

Target utama bukan sekadar replay chart, melainkan membangun **Market Behavior Engine** yang mampu menghasilkan simulasi harga menyerupai kondisi pasar nyata.

---

# 2. Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Zustand

## Desktop

- Tauri

## Chart

- TradingView Lightweight Charts

## Threading

- Web Worker

## Data Storage

- SQLite
- Parquet (future)

---

# 3. Architecture

```
                  Playback Engine
                         │
                         ▼
                  Tick Generator
                         │
                Event Dispatcher
                         │
 ┌───────────────┬──────────────┬──────────────┐
 ▼               ▼              ▼              ▼
Time Engine   Renko Engine   ATR Engine   Statistics
 │
 ▼
HTF Aggregator
 │
 ▼
Chart Renderer
```

Semua modul bersifat independen.

Chart hanya membaca hasil.

Tidak ada perhitungan dilakukan pada layer UI.

---

# 4. Project Structure

```
src/

    app/

    ui/

    chart/

    engine/

        playback/

        tick/

        candle/

        renko/

        indicator/

        market/

        statistics/

    worker/

    types/

    utils/
```

---

# 5. Development Roadmap

---

## Phase 1

### Basic Application

Target:

- React
- Tauri
- Lightweight Charts

Feature

- Single Chart
- Zoom
- Pan
- Crosshair

---

## Phase 2

### Playback Engine

Target

Playback historis.

Feature

- Play
- Pause
- Stop
- Step
- Replay Speed
- Loop

Playback Speed

```
0.25x

0.5x

1x

2x

5x

10x

100x
```

---

## Phase 3

### Tick Engine

Input

Historical Tick

Output

Tick Event

```
Tick

↓

Event

↓

Subscribers
```

---

## Phase 4

### Candle Engine

Input

Tick

Output

OHLC

Support

- 1 Second
- 5 Second
- 15 Second
- 30 Second
- 1 Minute
- 5 Minute

Future

Unlimited timeframe.

---

## Phase 5

### HTF / LTF Synchronization

Layout

```
+----------------------+

5 Minute

+----------------------+

1 Second

+----------------------+
```

Feature

- Shared Crosshair
- Shared Time
- Shared Playback

---

## Phase 6

### Indicator Engine

Implement

- ATR

Future

- EMA
- SMA
- RSI
- MACD
- Supertrend

Architecture

```
Completed Candle

↓

Indicator

↓

Line Series
```

---

## Phase 7

### Renko Engine

Input

Tick

Output

Brick

Support

- Fixed Brick

Future

- ATR Brick
- Percentage Brick

---

## Phase 8

### Market Behavior Engine

Ini merupakan inti aplikasi.

---

# 6. Market Behavior Engine

Market Engine menghasilkan Tick.

Bukan Candle.

```
Tick Generator

↓

Tick Stream

↓

Chart
```

---

## Engine Composition

```
Trend

+

Noise

+

Volatility

+

Liquidity

+

Mean Reversion

=

Next Tick
```

Setiap komponen dapat diaktifkan atau dimatikan.

---

# 7. Market Regime

Support

## Trending

Karakteristik

- Higher High
- Higher Low

Parameter

```
Trend Strength

Noise

Pullback Depth
```

---

## Range

Karakteristik

- Mean Reversion

Parameter

```
Range Width

Bounce Probability
```

---

## Expansion

Karakteristik

- ATR meningkat

Parameter

```
Volatility Multiplier
```

---

## Compression

Karakteristik

- ATR kecil

Parameter

```
Low Volatility
```

---

## News

Karakteristik

- Spike
- Gap
- Whipsaw

Parameter

```
Spike Size

Duration

Recovery
```

---

# 8. Liquidity Engine

Support

- Previous High
- Previous Low
- Equal High
- Equal Low

Future

- Fair Value Gap
- Order Block
- Liquidity Pool

Behavior

Misalnya

```
Harga

↓

Mendekati Equal High

↓

Naikkan probabilitas

Sweep

atau

Breakout
```

---

# 9. Market Structure Engine

Engine dapat menghasilkan struktur tertentu.

Misalnya

```
Higher High

↓

Pullback

↓

Higher Low

↓

Continuation
```

atau

```
Range

↓

False Break

↓

Trend
```

Engine tidak menghasilkan Tick secara acak.

Engine memiliki target struktur.

---

# 10. Tick Generator

Contoh

```
Target

Higher High

↓

Generate Tick

↓

Sampai Target

↓

Generate Pullback

↓

Generate Tick
```

Dengan cara ini Tick terlihat lebih alami.

---

# 11. Simulation Parameters

General

```
Replay Speed

Seed

Timeframe

Session
```

Trend

```
Trend Strength

Trend Bias

Pullback Size
```

Noise

```
Noise Level
```

Volatility

```
ATR Multiplier
```

Liquidity

```
Sweep Probability

Breakout Probability
```

---

# 12. Session Engine

Support

Asia

London

New York

Parameter

```
Volatility

Liquidity

Noise
```

Setiap sesi mempunyai karakteristik berbeda.

---

# 13. Statistics Engine

Realtime

- Tick Count
- Candle Count
- ATR
- Volatility
- Average Range

Future

- Distribution
- Win Rate
- Monte Carlo

---

# 14. Future Features

## Replay Recorder

Save simulation.

---

## Workspace

Save

- Layout
- Indicator
- Zoom
- Position

---

## Drawing Tools

- Trendline
- Rectangle
- Arrow

---

## Replay Challenge

Hide future candles.

User melakukan analisis.

Kemudian membuka candle berikutnya.

---

## AI Mode

Engine menggunakan AI untuk menghasilkan perilaku harga.

Misalnya

```
Trend Day

Range Day

Accumulation

Distribution
```

---

## Plugin System

```
IBehavior

IRenko

IIndicator

IStructure
```

Developer dapat menambahkan engine baru.

---

# 15. Long-term Vision

Aplikasi berkembang menjadi laboratorium simulasi perilaku pasar.

Bukan hanya chart replay.

Tetapi platform untuk:

- memahami pembentukan candle
- memahami pembentukan Renko
- mempelajari market structure
- menguji indikator
- menguji strategi
- menghasilkan simulasi kondisi pasar yang realistis
- mengevaluasi berbagai model perilaku harga
