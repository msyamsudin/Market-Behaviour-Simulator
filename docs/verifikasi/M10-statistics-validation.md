# M10 — Validasi Statistik Dasar (Synthetic vs Historical)

Tanggal: 2026-08-03

Kriteria selesai M10: *ada metrik terukur (numeric) yang dibandingkan dan terdokumentasi.*

Sumber: `engine/statistics/metrics.ts` + `engine/statistics/compare.ts`.
Referensi historical: `public/dummy-ticks.csv` (file yang sama dengan M2).
Synthetic: seed 42, 4 komponen aktif (Noise + Trend + Volatility + Mean Reversion),
mulai 00:00 UTC (sesi Asia aktif sejak M12).
Perbandingan ditampilkan di panel Statistics (UI) dan dihitung dari sumber yang sama.

> Catatan: sejak M12, generator sintetis menerapkan multiplier sesi. Data di bawah
> mencerminkan perilaku saat ini (synthetic 25 menit mulai 00:00 UTC → seluruhnya
> di sesi Asia yang volatilitasnya rendah).

## Hasil

### Distribusi return

| Metric | Historical | Synthetic | Ratio (s/h) |
|---|---|---|---|
| return mean | -1.5129e-5 | 1.0834e-5 | -0.71613 |
| return std | 5.9185e-4 | 7.7737e-4 | 1.3135 |
| return skewness | 0.011519 | 0.044361 | 3.8511 |
| return kurtosis | -1.2178 | -0.15609 | 0.12817 |

### Volatility clustering (ACF return kuadrat)

| Metric | Historical | Synthetic |
|---|---|---|
| ACF sq. return lag 1 | -0.0039849 | -0.047901 |
| ACF sq. return lag 2 | -0.038278 | -0.028417 |
| ACF sq. return lag 3 | -0.041774 | 0.036916 |
| ACF sq. return lag 4 | 0.018965 | -0.014915 |
| ACF sq. return lag 5 | -0.052912 | 0.021604 |

### Density tick / average range

| Metric | Historical | Synthetic | Ratio |
|---|---|---|---|
| tick density (ticks/sec) | 1.0007 | 1.0007 | 1.0000 |
| avg candle range (1m) | 0.67000 | 0.77160 | 1.1516 |

## Interpretasi

- **Volatilitas**: synthetic lebih volatile (return std 1.3x), dengan distribusi
  return lebih miring (skewness positif) dan kurtosis mendekati nol — sementara
  historical hampir seragam (kurtosis sangat negatif, artefak generator CSV step
  kecil). Perbedaan karakter ini terukur, bukan "kelihatan mirip".
- **Clustering**: dengan window 25 menit (satu sesi), ACF return kuadrat keduanya
  kecil; lihat `M12` untuk perbedaan antar sesi yang lebih tegas.
- **Density**: kedua sumber identik (1 tick/detik).

## Reproduksi

```sh
npm run test                 # unit test metrik (tests/statistics.test.ts)
npm.cmd exec vite-node scripts/stats-compare.ts   # mencetak angka di atas
```

Catatan: hasil adalah titik data pada seed 42. Karena ini perbandingan
statistik (bukan kepastian), angka dapat dianggap deterministik terhadap seed.
