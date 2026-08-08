# M2 — Validasi Referensi Agregasi Tick → Candle

Tanggal: 2026-08-03

Kriteria selesai M2: *candle hasil agregasi cocok dengan data referensi
(validasi manual/spreadsheet).*

## Referensi Manual (fixture unit test)

Referensi dihitung manual di `tests/aggregator.test.ts` — 8 tick, timeframe 60 detik:

| time | price | volume | bucket |
|---|---|---|---|
| 0 | 10 | 5 | 0 |
| 1 | 11 | 2 | 0 |
| 2 | 9 | 3 | 0 |
| 59 | 12 | 4 | 0 |
| 60 | 8 | 1 | 60 |
| 61 | 13 | 2 | 60 |
| 119 | 14 | 6 | 60 |
| 120 | 7 | 3 | 120 |

Perhitungan manual OHLC 1 menit:

| bucket | open | high | low | close | volume |
|---|---|---|---|---|---|
| 0 | 10 | 12 | 9 | 12 | 14 |
| 60 | 8 | 14 | 8 | 14 | 9 |
| 120 | 7 | 7 | 7 | 7 | 3 |

Hasil `aggregateTicks` == nilai di atas (terverifikasi otomatis via vitest).

## Validasi File Dummy (1500 tick)

`public/dummy-ticks.csv` (1500 baris, 1 tick/detik mulai 2026-01-02 00:00:00 UTC)
diproses lewat pipeline penuh: `CSVTickSource.fetchTicks()` → `aggregateTicks(ticks, 60)`.

Hasil (terverifikasi di `tests/dummy-file.test.ts`):

- Jumlah tick ter-parse: **1500/1500** (tidak ada baris drop).
- Jumlah candle 1 menit: **25** (1500 tick ÷ 60 detik).
- Total volume candle == total volume tick (tidak ada tick terbuang).

## Pembanding Spreadsheet

`m2-candles-reference.csv` berisi hasil agregasi file dummy ke 1 menit
(`time,open,high,low,close,volume`), dihasilkan oleh `npm run export:reference`
dari modul pipeline yang sama. Untuk validasi manual:

1. Buka `public/dummy-ticks.csv` dan `m2-candles-reference.csv` di spreadsheet.
2. Gunakan pivot/filter per menit pada file tick, lalu bandingkan OHLCV tiap bucket
   dengan baris yang bersesuaian di file referensi.
3. Atau hitung manual satu bucket (misal menit pertama, tick ke-0..59) dan bandingkan
   dengan baris pertama referensi.
