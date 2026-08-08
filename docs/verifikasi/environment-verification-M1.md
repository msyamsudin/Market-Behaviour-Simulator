# Environment Verification — M1

Tanggal: 2026-08-03

Hasil verifikasi toolchain sebelum scaffolding Tauri app (langkah M1.1).

## Rust Toolchain

| Komponen | Status | Versi |
|---|---|---|
| rustup | OK | 1.29.0 (28d1352db 2026-03-05) |
| rustc | OK | 1.96.1 (31fca3adb 2026-06-26) |
| cargo | OK | 1.96.1 (356927216 2026-06-26) |

## Node / Package Manager

| Komponen | Status | Versi |
|---|---|---|
| node | OK | v24.18.0 |
| npm | OK (via `npm.cmd`) | — |

Catatan: `npm` tidak bisa dipanggil langsung dari PowerShell karena execution policy
menonaktifkan script (`npm.ps1`). Workaround: gunakan `npm.cmd` di semua command shell.
Tidak perlu instalasi tambahan.

## Build Tools (MSVC)

| Komponen | Status | Keterangan |
|---|---|---|
| Visual Studio 2022 Community | OK | `C:\Program Files\Microsoft Visual Studio\2022\Community` |
| MSVC C++ workload (`VC.Tools.x86.x64`) | OK | MSVC 14.44.35207 |
| link.exe (linker x64) | OK | `...\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\link.exe` |

Tidak perlu instalasi VS Build Tools tambahan — workload C++ sudah terpasang.

## WebView2 Runtime

| Komponen | Status | Versi |
|---|---|---|
| WebView2 Runtime | OK | 150.0.4078.105 |

## Catatan Restore `docs/`

Scaffolding `create-tauri-app` (dengan `--force` ke direktori non-kosong) menghapus
folder `docs/` dari repo. Kedua dokumen sumber (`Market-Behaviour-Simulator.md` dan
`Market-Behaviour-Simulator-MS.md`) dipulihkan verbatim dari isi yang dibaca sebelum
scaffolding (jumlah baris terverifikasi: 730 dan 53). Dokumen ini dibuat setelah
restore.

## Kesimpulan

Semua komponen yang dibutuhkan Tauri sudah terpasang. Tidak ada instalasi tambahan
yang dilakukan. Scaffolding dilanjutkan tanpa perubahan environment.
