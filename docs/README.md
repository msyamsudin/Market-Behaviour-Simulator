# Dokumentasi — Market Behaviour Simulator

Indeks semua dokumen di folder `docs/`. Dokumen perencanaan & verifikasi milestone
disusun per fase: perencanaan → status milestone → verifikasi per milestone.

## Perencanaan

| File | Isi |
|---|---|
| [`Market-Behaviour-Simulator.md`](Market-Behaviour-Simulator.md) | Visi, arsitektur, technology stack, dan implementation plan. |
| [`Market-Behaviour-Simulator-MS.md`](Market-Behaviour-Simulator-MS.md) | Pemecahan milestone (M1–M14) dengan kriteria "selesai" per tahap. |

## Status

| File | Isi |
|---|---|
| [`milestone-log.md`](milestone-log.md) | Verifikasi per milestone terhadap kriteria "Selesai kalau" (M1–M12 selesai; Track D backlog). |
| [`code-review-claude.md`](code-review-claude.md) | Audit code review seluruh `src/` (2026-08-08) beserta resolusi temuan. |

## Verifikasi per Milestone

Dokumen verifikasi disimpan di subfolder [`verifikasi/`](verifikasi/).

| File | Milestone | Isi |
|---|---|---|
| [`environment-verification-M1.md`](verifikasi/environment-verification-M1.md) | M1 | Verifikasi toolchain (Rust, Node, MSVC, WebView2). |
| [`M2-reference-validation.md`](verifikasi/M2-reference-validation.md) | M2 | Validasi referensi agregasi tick → candle (fixture manual + file dummy). |
| [`m2-candles-reference.csv`](verifikasi/m2-candles-reference.csv) | M2 | Output `npm run export:reference` — pembanding spreadsheet hasil agregasi. |
| [`M10-statistics-validation.md`](verifikasi/M10-statistics-validation.md) | M10 | Validasi statistik output sintetis (distribusi return, ACF, density). |
| [`M12-session-engine.md`](verifikasi/M12-session-engine.md) | M12 | Validasi engine sesi (multiplier per sesi, jadwal 24 jam). |
