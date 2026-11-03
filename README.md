# CSK Business OS — Operasional Cahaya Selatan Kreasindo

Aplikasi PWA untuk mencatat prospek, klien, proyek produksi, transaksi kas, aktivitas pemasaran, dan catatan operasional CSK.

> **STATUS RILIS (3 November 2026):** Penggabungan proyek di **Draft PR #4** masih **STAGING**. Backend dan frontend di branch ini belum ter-deploy ke Google Apps Script atau Google Sheets produksi. Walaupun pengujian otomatis lulus, tetap perlu endpoint LAB terisolasi, uji HTTP/CORS, backup/restore, dan uji multi-perangkat sebelum mergerilis.

## Modul operasional

| Modul | Kegunaan |
| --- | --- |
| Leads CRM | Prospek B2B, sumber lead, tahapan follow-up, estimasi proyek, WhatsApp |
| Projects | Daftar pekerjaan, PIC, tenggat, status, dan checklist produksi |
| Clients | Kontak klien, catatan kerja sama, rating dan review |
| Finance | **Kas masuk/keluar yang benar-benar dicatat**; deal tidak otomatis menjadi DP |
| Marketing Spend | Anggaran dan pengeluaran iklan; CPL dari biaya dan jumlah lead yang tercatat |
| Business Memory | Catatan SOP, bahan, harga acuan, dan pembelajaran tim |
| Commercial Engine | Kalkulasi HPP produksi hybrid, quotation, persetujuan, dan konfirmasi PO/SPK |
| Project Cost Ledger | Biaya proyek aktual internal/vendor, estimasi vs realisasi |
| Kalkulator HPP Lokal | Estimator produksi perangkat lokal, terpisah dari quotation cloud |
| Operations Suite | Modul SOP dan operasional tambahan (staging, sebagian lokal) |
| Email Marketing | Draft outbound dan segmentasi yang ditinjau Owner; tidak ada pengiriman otomatis |

**Jangan menyamakan nilai deal, invoice, dan uang masuk.** Versi staging tidak menciptakan jurnal DP otomatis saat Lead berstatus Deal Menang. Proyek draft dapat dibuat lewat UI, sedangkan pembuatan proyek otomatis di backend baru berjalan jika Script Properties `AUTO_PROJECT_FROM_WON=true` diaktifkan dengan sadar. **ROAS** belum layak dihitung tanpa pendapatan yang benar-benar diatribusikan ke kampanye; selisih pemasukan dan pengeluaran bukan laba bersih akuntansi.

## Penggunaan dan akses

Aplikasi memiliki tampilan responsif untuk ponsel dan desktop, navigasi bawah seluler, form lead/proyek/transaksi, indikator status sinkronisasi persisten, dan opsi ekspor/impor backup lokal. Tambahan UX staging: halaman mendukung zoom, fokus keyboard lebih terlihat, elemen form memiliki label, modal memakai semantik dialog, dan status cloud membedakan **lokal**, **menunggu**, **gagal/konflik**, serta **terverifikasi**.

Backend staging kini menggunakan token **OWNER_API_TOKEN** dan **TEAM_API_TOKEN** terpisah. Server membatasi akses Tim ke Leads, Clients dan Projects; Finance, Marketing, Memory, Costings dan Project_Costs hanya untuk Owner. Dropdown di frontend **bukan login multi-user**. Kredensial bearer token yang disimpan browser masih dapat diekstrak dari perangkat itu, sehingga jangan gunakan perangkat bersama untuk data rahasia. Perubahan role dan pembatasan sinkronisasi harus diverifikasi pada staging sebelum produksi.

### Prinsip sinkronisasi staging

- Instalasi baru mulai **kosong dan terputus dari cloud**. Data browser yang sudah ada tetap dipertahankan saat upgrade.
- Setiap perubahan disimpan lokal dan dimasukkan ke antrean per-record, bukan dianggap langsung berhasil di Google Sheets.
- POST Apps Script yang bersifat opaque **bukan bukti tersimpan**; harus diikuti GET readback yang berhasil.
- Tarik manual dari cloud **diblokir saat ada perubahan lokal yang belum terverifikasi** agar tidak menghilangkan pekerjaan.
- Backup JSON yang diunduh **tidak menyertakan token dan URL API**, tetapi tetap berisi informasi bisnis sensitif; simpan privat.
- Pemulihan file backup **hanya lokal** dan memutus konfigurasi cloud untuk mencegah histori lama tersinkron kembali tanpa pemeriksaan.
- Setiap peran memakai token berbeda yang diverifikasi server. Token disimpan pada browser per perangkat dan belum memakai login per-pengguna; pembocoran token tetap berisiko.
- Backend staging sudah memakai `LockService` dan compare-and-set fingerprint (`expectedRecords` dan `expectedFingerprint`) untuk menolak perubahan stale. Keandalan HTTP dan konflik pada **Apps Script LAB aktif** tetap belum diverifikasi.

## Pengujian dan pengembangan

Pada branch integrasi PR #4, workflow `Check Business OS safe sync` menguji:
```bash
node --check sync-safe.js
node --check sync-safe.test.js
node sync-safe.test.js
node sync-backend-integration.test.js
node mapping.test.js
node commercial-costing.test.js
node commercial-invoice.test.js
```

Integrasi backend pada workflow memakai **emulator SpreadsheetApp, bukan Web App live**. Simulasi Android V2 6/6 dan smoke test internal Spreadsheet LAB tidak membuktikan otentikasi/CORS HTTP di browser terhadap Apps Script yang di-deploy.

Referensi teknis: [Safe Sync rollout](docs/safe-sync-rollout.md), [LAB API guard](docs/lab-api-guard.md), [UX/accessibility QA & release gate](docs/ux-access-security-qa.md).

### Batasan sebelum rilis produksi

1. Cadangan produksi diverifikasi dan skenario pemulihan disimulasikan pada database dummy.
2. Pasang `LabRequestGuard.gs`, `LabHandlerVerification.gs`, dan panggilan guard pada **Apps Script LAB saja**; periksa output `LAB_HANDLER_GUARD_PASS`. Jangan mengubah database produksi.
3. Gunakan endpoint/staging terpisah untuk verifikasi browser → Apps Script → Google Sheets melalui HTTP nyata; cek CORS, token, retry, offline dan dua browser berbeda.
4. Verifikasi live di LAB bahwa mekanisme atomik `expectedRecords` / `expectedFingerprint` + `LockService` benar-benar menolak stale client dan race antardua perangkat.
5. Uji backend role Owner/Team pada LAB dengan data dummy, termasuk penolakan akses lintas modul. Token browser belum menjadi autentikasi per-pengguna; pertimbangkan provider identitas sebelum akses multi-user produksi.
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


## Status integrasi 3 November 2026

- Branch integrasi: `integration/secure-safe-sync-20261103` ([Draft PR #4](https://github.com/cahayaselatankreasindo-dev/advertising-business-os/pull/4)).
- Origin fitur: Draft PR #2 (safe sync, operations, email, estimator HPP lokal), Draft PR #3 (commercial HPP, project ledger, invoice, role), disatukan secara selektif tanpa merge ke `main`.
- Dua domain HPP berbeda: `page-hpp` untuk estimator **lokal** dan `page-costings` untuk quotation terkait proyek yang ikut delta sync.
- Akun Team hanya memiliki akses server ke Leads, Clients dan Projects; pembatasan yang benar-benar aman untuk data lokal memerlukan perangkat/profile browser terpisah.
- **Belum production-ready.** Lihat [Integration QA & release gate](docs/integration-release-gate-20261103.md).
