# CSK Business OS — Operasional Cahaya Selatan Kreasindo

Aplikasi PWA untuk mencatat prospek, klien, proyek produksi, transaksi kas, aktivitas pemasaran, dan catatan operasional CSK.

> **STATUS RILIS:** Branch `main` adalah aplikasi yang telah terpublikasi sebelumnya. Pengembangan Safe Sync, perbaikan keamanan, dan aksesibilitas di PR **#2** masih **DRAFT / STAGING**. Jangan mengarahkan data klien asli ke preview, menganggap aplikasi siap multi-user, atau merge sebelum seluruh release gate terpenuhi.

## Modul operasional

| Modul | Kegunaan |
| --- | --- |
| Leads CRM | Prospek B2B, sumber lead, tahapan follow-up, estimasi proyek, WhatsApp |
| Projects | Daftar pekerjaan, PIC, tenggat, status, dan checklist produksi |
| Clients | Kontak klien, catatan kerja sama, rating dan review |
| Finance | **Kas masuk/keluar yang benar-benar dicatat**; deal tidak otomatis menjadi DP |
| Marketing Spend | Anggaran dan pengeluaran iklan; CPL dari biaya dan jumlah lead yang tercatat |
| Business Memory | Catatan SOP, bahan, harga acuan, dan pembelajaran tim |

**Jangan menyamakan nilai deal, invoice, dan uang masuk.** Versi staging tidak menciptakan jurnal DP otomatis saat Lead berstatus Deal Menang. Proyek draft dapat dibuat lewat UI, sedangkan pembuatan proyek otomatis di backend baru berjalan jika Script Properties `AUTO_PROJECT_FROM_WON=true` diaktifkan dengan sadar. **ROAS** belum layak dihitung tanpa pendapatan yang benar-benar diatribusikan ke kampanye; selisih pemasukan dan pengeluaran bukan laba bersih akuntansi.

## Penggunaan dan akses

Aplikasi memiliki tampilan responsif untuk ponsel dan desktop, navigasi bawah seluler, form lead/proyek/transaksi, indikator status sinkronisasi persisten, dan opsi ekspor/impor backup lokal. Tambahan UX staging: halaman mendukung zoom, fokus keyboard lebih terlihat, elemen form memiliki label, modal memakai semantik dialog, dan status cloud membedakan **lokal**, **menunggu**, **gagal/konflik**, serta **terverifikasi**.

Pilihan “Owner / Tim” hanya mengatur tampilan menu di perangkat ini. **Bukan autentikasi atau otorisasi.** Menyembunyikan menu Keuangan tidak mengamankan data dari pengguna yang mengakses browser atau Google Sheets. Jangan membagikan URL aplikasi/endpoint atau token sebagai pengganti kontrol akses server. Aplikasi statis di GitHub Pages sendiri tidak menyediakan login server.

### Prinsip sinkronisasi staging

- Instalasi baru mulai **kosong dan terputus dari cloud**. Data browser yang sudah ada tetap dipertahankan saat upgrade.
- Setiap perubahan disimpan lokal dan dimasukkan ke antrean per-record, bukan dianggap langsung berhasil di Google Sheets.
- POST Apps Script yang bersifat opaque **bukan bukti tersimpan**; harus diikuti GET readback yang berhasil.
- Tarik manual dari cloud **diblokir saat ada perubahan lokal yang belum terverifikasi** agar tidak menghilangkan pekerjaan.
- Backup JSON yang diunduh **tidak menyertakan token dan URL API**, tetapi tetap berisi informasi bisnis sensitif; simpan privat.
- Pemulihan file backup **hanya lokal** dan memutus konfigurasi cloud untuk mencegah histori lama tersinkron kembali tanpa pemeriksaan.
- Satu token panjang dari Apps Script dibutuhkan di UI staging, tetapi browser bearer token **bukan keamanan multi-user**. Token di URL GET bisa muncul di log/riwayat dan bukan desain produksi ideal.
- Engine masih memakai preflight GET diikuti POST `sync_all`/delete **tanpa revisi atomik/LockService**. Dua perangkat dapat berlomba menimpa record pada interval GET–POST. **Belum aman untuk deployment produksi multi-perangkat.**

## Pengujian dan pengembangan

Di branch PR #2, workflow `Check Business OS safe sync` menguji:
```bash
node --check sync-safe.js
node --check sync-safe.test.js
node sync-safe.test.js
node sync-backend-integration.test.js
node mapping.test.js
```

Integrasi backend pada workflow memakai **emulator SpreadsheetApp, bukan Web App live**. Simulasi Android V2 6/6 dan smoke test internal Spreadsheet LAB tidak membuktikan otentikasi/CORS HTTP di browser terhadap Apps Script yang di-deploy.

Referensi teknis: [Safe Sync rollout](docs/safe-sync-rollout.md), [LAB API guard](docs/lab-api-guard.md), [UX/accessibility QA & release gate](docs/ux-access-security-qa.md).

### Batasan sebelum rilis produksi

1. Cadangan produksi diverifikasi dan skenario pemulihan disimulasikan pada database dummy.
2. Pasang `LabRequestGuard.gs`, `LabHandlerVerification.gs`, dan panggilan guard pada **Apps Script LAB saja**; periksa output `LAB_HANDLER_GUARD_PASS`. Jangan mengubah database produksi.
3. Gunakan endpoint/staging terpisah untuk verifikasi browser → Apps Script → Google Sheets melalui HTTP nyata; cek CORS, token, retry, offline dan dua browser berbeda.
4. Desain serta uji transaksi backend **expectedVersion + LockService** untuk konflik atomik, termasuk permintaan dari versi aplikasi lama yang masih terbuka.
5. Implementasikan autentikasi/otorisasi *server-side* yang dapat membatasi data Keuangan per pengguna. Dropdown role UI tidak cukup.
6. Audit dan harden frontend terhadap injeksi konten saat menampilkan data pengguna; backup dan restore diuji di perangkat seluler.
7. Hanya sesudah semua gate lolos, review perubahan PR, rollout terkontrol, dan verifikasi pascarilis.

**Jangan mengikuti instruksi lama yang menganjurkan “Anyone” tanpa pengamanan backend, menghapus isi project Apps Script produksi, atau menjalankan `setupSheet` pada database aktif.** Versi staging kode GitHub belum identik dengan Apps Script produksi yang berjalan.

## Sumber kode

- Frontend PWA: `index.html`
- Antrean dan pembacaan ulang Safe Sync: `sync-safe.js`
- Service worker cache: `sw.js`
- Manifest instalasi: `manifest.json`
- Contoh kode backend (bukan otomatis ter-deploy): `google_apps_script.js`
- Hanya LAB: `apps-script/LabSelfTest.gs`, `apps-script/LabRequestGuard.gs`, `apps-script/LabHandlerVerification.gs`

Gunakan data dummy untuk pengujian. Jangan menyimpan API token, password, email klien, atau export database produksi ke source control.
