# CSK Business OS — Handoff dan Status Peluncuran
**Pembaruan:** 2 November 2026 · **Status:** STAGING / DRAFT — tidak dipublikasikan.

## Produk dan tujuan
CSK Business OS adalah aplikasi internal Cahaya Selatan Kreasindo untuk CRM B2B, proyek & produksi advertising, keuangan, pemasaran, dan pengambilan keputusan. Produk CSK berupa **penjualan/produksi**, bukan penyewaan alat event.

## Hasil pekerjaan yang telah masuk branch staging
- Identitas visual konsisten dengan website CSK: Obsidian Black `#0B0B0B`, Warm White `#F8F7F4`, Warm Amber `#FF8A3D`, Slate Gray `#4B4B4B`; prioritas tipografi Montserrat.
- CSS aplikasi operasional di `index.html`, meta theme, `manifest.json` dan cache `sw.js` diperbarui.
- **Preview interaktif offline** di [preview/CSK-Business-OS-Brand-Preview.html](../preview/CSK-Business-OS-Brand-Preview.html). Data seluruhnya fiktif; halaman tidak terkoneksi ke API.
- Test preview: [preview/brand-preview.test.js](../preview/brand-preview.test.js) memastikan satu file tanpa external JS/API, brand, navigasi, dan sintaks inline script.
- Safe-sync delta queue: perubahan lokal per ID, GET readback setelah POST, deteksi konflik preflight, status sinkronisasi yang tidak mengaku 'tersimpan' sebelum terbukti, dan antrean offline.
- Akses private LAB diperiksa: GET tanpa login memerlukan login Google; GET login tapi tanpa token ditolak.
- Pengujian **backend LAB** yang dikonfirmasi owner: `LAB_TEST_PASS`, `LAB_GUARD_PASS` (12 request terlarang ditolak), `LAB_HANDLER_GUARD_PASS`.
- Pengujian browser frontend dummy: **6/6 PASS**, semua request dimock, tidak ada permintaan API luar.
- Workflow CI menjalankan test safe sync, integrasi backend emulator, mapping dan pemeriksaan brand preview.
- Jalur backend lama pengiriman cold email dan instalasi trigger otomatis sudah dinonaktifkan **hanya dalam source PR draft**, dilindungi tes regresi. Deployment yang sudah ada tidak berubah.

## Layanan penting dan pemisahan data
- **PRODUKSI**: GitHub Pages dari branch produksi + Google Sheets/database aktif + Apps Script utama. Jangan diubah tanpa backup dan release gate.
- **LAB**: Google Sheets dummy dengan ID `19le34ltpZCMIHmjw2n_JbEvrtZBWNTKd61U-xEAoR5Y` dan Apps Script project ID `1IushkEIqi-CsKxsdx83sxs08_G5wk8rbOQ9A_eM0UF1wOKszDfYJqzB4`; Web App saat terakhir diperiksa berakses **Only myself**.
- **Kode staging**: [Pull Request #2](https://github.com/cahayaselatankreasindo-dev/advertising-business-os/pull/2) tetap **Draft**, belum di-merge. Jangan memasukkan API token ke GitHub atau link publik.

## Syarat wajib sebelum produksi (belum terpenuhi)
1. **Tes live browser ↔ Google Apps Script LAB** belum selesai. `Only myself` memerlukan login Google, sementara frontend di GitHub Pages menggunakan origin lain dan tidak otomatis dapat akses/CORS. Jangan mengubah ke `Anyone` sebelum model autentikasi dan eksposur data disetujui.
2. **Proteksi konflik atomik sisi server** (misalnya LockService dan verifikasi revisi yang diharapkan) belum aktif. GET preflight client saja punya celah race condition.
3. Audit penyimpanan token frontend, akses pengguna, dan kontrol action backend. API token yang tersimpan di browser bukan otentikasi pengguna.
4. Audit migrasi record lama, ID duplikat, data localStorage, antrean pending, dan multi-device. Tidak boleh terjadi kehilangan data atau muncul kembali data yang telah dihapus.
5. Periksa logika Finance: nominal deal bukan otomatis DP diterima; ROAS, laba dan arus kas harus ditampilkan berdasarkan data yang benar.
6. Lakukan staging end-to-end: create/update/delete, offline→online, 2 browser mengedit record sama, request gagal, rollback, dan pemulihan dari backup.
7. Setelah semua gate lulus: backup produksi, catat SHA commit sebelum rilis, nonaktifkan versi client lama jika perlu, merge PR lewat review, deploy bertahap, lakukan smoke test hanya pada data dummy, dan siapkan rollback.

## Preview untuk owner
1. Buka file `preview/CSK-Business-OS-Brand-Preview.html` di branch staging GitHub.
2. Pilih **Download raw file**, lalu buka HTML menggunakan Chrome pada HP atau desktop.
3. Uji navigasi, pencarian prospek, dan tombol `Tambah Prospek`. Semua perubahan hanya berlaku selama halaman dibuka, tanpa koneksi Google.
4. Preview adalah rancangan UI interaktif, **bukan aplikasi operasional yang sudah terhubung ke produksi**.

## Cara melanjutkan pekerjaan
Mulai dari PR #2, baca `docs/safe-sync-rollout.md` dan dokumen ini, lihat hasil GitHub Actions terbaru. Jangan memodifikasi Apps Script produksi atau mengubah akses LAB ke publik hanya demi menampilkan preview. Prioritas terdekat: backend revisi atomik + desain autentikasi yang aman, lalu uji end-to-end sebelum produksi.
