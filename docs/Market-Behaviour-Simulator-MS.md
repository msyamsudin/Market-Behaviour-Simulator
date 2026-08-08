Berikut pemecahan jadi milestone kecil, dengan kriteria "selesai" yang jelas per tahap, dan bagian riset berisiko tinggi dipisah dari jalur utama.

**Track A — Fondasi (harus jalan dulu sebelum apa pun lain)**

- **M1 — Shell aplikasi**: Tauri + React + Vite jalan, satu chart Lightweight Charts nampilkan data statis. Zoom/pan/crosshair jalan.
  *Selesai kalau*: bisa load 1 file data dummy dan chart interaktif.

- **M2 — Tick → Candle pipeline (offline dulu, non-realtime)**: definisikan tipe `Tick` dan `TickSource` interface. Ambil satu file historical tick, agregasi jadi OHLC 1 timeframe saja (misal 1 menit), render ke chart. Belum ada playback, langsung render full history.
  *Selesai kalau*: candle hasil agregasi cocok dengan data referensi (validasi manual/spreadsheet).

- **M3 — Playback Engine (replay dasar)**: play/pause/stop/step di atas pipeline M2. Speed 1x dan 10x dulu (bukan 7 level sekaligus).
  *Selesai kalau*: replay historical tick terlihat natural di 1x, tidak drop tick di 10x.

- **M4 — Multi-timeframe candle**: dukung beberapa timeframe (1s–5m) dari sumber tick yang sama, tanpa HTF/LTF sync view dulu (cukup dropdown ganti timeframe).
  *Selesai kalau*: pindah timeframe re-agregasi benar dari raw tick, bukan dari candle timeframe lain.

**Track B — Multi-chart & indikator**

- **M5 — HTF/LTF sync**: 2 chart bertumpuk, shared crosshair & shared time. Playback tetap 1 sumber.
  *Selesai kalau*: scroll/crosshair di 1 chart reflect ke chart lain tanpa lag terasa.

- **M6 — Indicator Engine (ATR saja)**: baca completed candle, hasilkan line series. Arsitektur pluggable disiapkan tapi baru diisi 1 indikator.
  *Selesai kalau*: nilai ATR cocok dengan referensi (TradingView/perhitungan manual).

- **M7 — Renko Engine (fixed brick)**: tick → brick, render sebagai chart terpisah dari candle.
  *Selesai kalau*: brick count & arah cocok dengan simulasi manual sederhana.

**Checkpoint sebelum lanjut ke Track C**: di titik ini aplikasi sudah *usable* sebagai replay tool historis biasa — ini layak jadi rilis v0.1 tersendiri, terlepas dari nasib Market Behavior Engine.

**Track C — Market Behavior Engine (generative, mulai dari yang paling sederhana)**

- **M8 — Tick Generator paling dasar**: cuma Noise + Trend (2 komponen saja dulu, bukan 5 sekaligus), tanpa regime, tanpa target struktur. Random walk dengan bias.
  *Selesai kalau*: output tick bisa di-render lewat pipeline Track A tanpa modifikasi (buktikan interface `TickSource` benar-benar interchangeable dengan data historis).

- **M9 — Tambah Volatility + Mean Reversion**: 4 dari 5 komponen aktif, masing-masing bisa on/off dan punya parameter sendiri.
  *Selesai kalau*: mematikan 1 komponen mengubah karakter output secara terlihat (bukti komponen benar-benar berpengaruh, bukan dekoratif).

- **M10 — Validasi statistik dasar**: bandingkan distribusi return, volatility clustering sederhana antara tick sintetis vs tick historis. Ini yang tadinya "future" di Statistics Engine — naikkan ke sini karena tanpa ini M8-M9 tidak bisa diklaim "realistis".
  *Selesai kalau*: ada metrik terukur (bukan "kelihatan mirip") yang dibandingkan.

- **M11 — Liquidity Engine minimal**: previous high/low, equal high/low, dan efeknya menaikkan probabilitas sweep/breakout di generator.
  *Selesai kalau*: bisa didemokan skenario "harga dekati equal high → sweep terjadi lebih sering" secara statistik, bukan cuma sekali kebetulan.

- **M12 — Session Engine**: parameter volatility/liquidity/noise berbeda per sesi (Asia/London/NY), jadwal berbasis waktu simulasi.
  *Selesai kalau*: statistik M10 berbeda signifikan antar sesi sesuai desain.

**Track D — Riset terpisah, jangan dicampur timeline dengan Track C**

- **M13 — Market Structure Engine (riset)**: mulai dari 1 pola saja (misal HH→pullback→HL) sebagai proof of concept dengan pendekatan state-machine sederhana, bukan langsung general-purpose. Anggap ini eksperimen yang boleh gagal/dibuang, bukan komitmen fitur.
- **M14 — Komponen 5 (Liquidity terintegrasi penuh) + interaksi dengan News regime**: baru setelah M13 punya pendekatan yang jalan, definisikan siapa "menang" saat target structure vs event News bentrok.
- **AI Mode, Plugin System, Replay Challenge, Workspace**: taruh di backlog, jangan dikasih nomor milestone dulu sampai Track C selesai — ini semua bergantung pada fondasi generatif yang stabil.

Prinsip pemecahannya: tiap milestone punya *satu* variabel baru yang diuji, dan Track A selalu menghasilkan sesuatu yang dipakai (bukan cuma disiapkan) — jadi kalau proyek berhenti di tengah jalan, tetap ada aplikasi replay yang berfungsi, bukan tumpukan engine setengah jadi.
