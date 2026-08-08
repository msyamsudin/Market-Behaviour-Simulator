# M12 — Session Engine

Tanggal: 2026-08-03

Kriteria selesai M12: *statistik M10 berbeda signifikan antar sesi sesuai desain.*

## Jadwal (UTC)

| Sesi | Jam | Volatility | Liquidity | Noise |
|---|---|---|---|---|
| Asia | 00–08 | 0.6 | 0.7 | 0.7 |
| London | 08–13 | 1.0 | 1.0 | 1.0 |
| London/NY Overlap | 13–16 | 1.5 | 1.4 | 1.4 |
| New York | 16–21 | 1.2 | 1.2 | 1.2 |
| Off-peak | 21–24 | 0.8 | 0.7 | 0.8 |

`engine/market/session.ts` memetakan waktu simulasi (unix detik) ke sesi;
generator meneruskan multiplier sesi ke komponen melalui `ctx.session`
(noise/volatility/liquidity diskalakan; trend & mean-reversion tidak).

## Bukti (tests/session.test.ts)

- `sessionAt` memetakan jam UTC dengan benar; jadwal menutup 24 jam tanpa celah.
- **Volatilitas per sesi** (std return): overlap > asia × 1.7 pada noise-only
  (multiplier noise 1.4 vs 0.7 → rasio ~2).
- **Agregat sepanjang hari** (86.400 tick, noise+volatility+MR): std return
  overlap > asia × 1.3 dan newyork > asia — sesuai desain multiplier.

Hasil konkret dari test (seed 7, 24 jam):

| Sesi | std return |
|---|---|
| Asia | terendah (sesuai multiplier 0.6/0.7) |
| London | menengah |
| Overlap | tertinggi (multiplier 1.5/1.4) |
| New York | di atas Asia |

## Catatan

Dengan sesi aktif, synthetic default (mulai 00:00 UTC, 25 menit) seluruhnya di
sesi Asia → volatilitas lebih rendah dari sebelum M12. Ini sesuai desain
(Asia = volatilitas rendah) dan menegaskan bahwa multiplier sesi benar-benar
mengubah karakter output.
