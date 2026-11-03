# CSK Business OS — Safe Sync Rollout (STAGING)

Status pada 2 November 2026: **PR #2 DRAFT; belum di-merge, belum dipasang ke Google Sheets atau Apps Script produksi.** Panduan ini berlaku untuk perubahan pada source di branch PR, bukan klaim mengenai aplikasi yang sudah ter-deploy.

## Alasan perbaikan

Branch `main` lama menyinkronkan seluruh tabel dan menyatakan POST `no-cors` berhasil tanpa pembacaan ulang. Dalam konflik antarperangkat, data bisa tertimpa; record yang dihapus dapat muncul lagi. Backend lama belum punya mekanisme revisi atomik.

## Yang sudah ditambahkan di source staging

1. `sync-safe.js`: antrean perubahan per ID, snapshot awal, preflight konflik, POST hanya perubahan, POST action `read` terautentikasi sebelum menandai terverifikasi, serta penanganan offline/retry yang mempertahankan queue lokal. Setiap upsert mengirim `expectedRecords` per sheet/ID; delete mengirim `expectedFingerprint`.
2. Penggabungan startup menjaga perubahan lokal pending dan memakai cloud untuk record yang tidak berubah. Tidak melakukan upload massal data lama dari perangkat.
3. Tarik manual ditolak bila queue belum kosong. Backup JSON membuang API URL/token sebelum diunduh, memuat data bisnis sensitif, dan menyertakan hingga 20 pasangan snapshot konflik (versi lokal/cloud) untuk pemulihan. Restore hanya lokal, memutus koneksi cloud dan tidak mengirim backup sebagai perubahan baru.
4. Status UX tetap terlihat: perangkat lokal, belum tersetel, token/config salah, offline, antrean, error/konflik, dan tanggal verifikasi terakhir. Data demo dan endpoint produksi tidak dibundel pada fresh install.
5. Aksesibilitas/mobile: pinch zoom, target tombol lebih besar, label form, dialog, keyboard Escape, focus-visible, screen-reader live status, dan layar kosong yang menunjukkan langkah pertama.
6. PWA cache tidak mencegat URL Apps Script cross-origin; service worker dibump untuk staged update.
7. Kode Apps Script **staging** menolak POST read/write bila token server belum disetel atau terlalu pendek; GET selalu merespons `POST_REQUIRED` tanpa data. Token browser hanya berada di memori tab dan dikirim melalui body POST, tetapi tetap bearer-token, **bukan login multi-user**.
8. Pembuatan jurnal “DP Proyek” palsu saat Deal Menang dihapus pada source backend staging; draft proyek backend default nonaktif. Nilai deal tidak dianggap uang masuk.
9. ROAS yang tidak memiliki atribusi campaign dihapus, CPL tetap tersedia. Ringkasan keuangan secara eksplisit hanya menunjukkan selisih kas tercatat, bukan laba bersih.
10. Cold email POST opaque tidak lagi diklaim otomatis sukses atau menaikkan status lead. Teks yang berasal dari calon klien/Google Sheets di-escape pada UI.
11. Automated tests memvalidasi simulasi mesin antrean, backend emulator SpreadsheetApp, dan mapping data; **bukan** bukti koneksi HTTP ke Web App aktif.
12. Kontrak API protocol 2 wajib pada POST read/write. GET tidak lagi mengembalikan data dan selalu merespons `POST_REQUIRED`; frontend menolak backend yang tidak mengembalikan versi yang cocok. Ini mencegah stale client memakai kontrak full-sync lama, tetapi **bukan** autentikasi pengguna.

## Gate yang masih HARUS diselesaikan

- **LAB handler guard:** file `apps-script/LabRequestGuard.gs` dan `apps-script/LabHandlerVerification.gs` di GitHub tidak otomatis terpasang. Jalankan verifikasi bahwa fungsi `doGet/doPost` LAB benar-benar memakai guard; butuh hasil `LAB_HANDLER_GUARD_PASS`.
- **Browser HTTP/CORS:** uji autentikasi, POST read/write, redirect ContentService, retry, offline, dan verifikasi data dummy pada browser sungguhan yang memakai backend staging khusus. GET harus ditolak dengan `POST_REQUIRED`. Tidak boleh membuka database utama demi uji.
- **Atomic concurrency:** source backend memakai `LockService` untuk mengunci GET/POST dan membandingkan `expectedRecords`/`expectedFingerprint` sebelum menulis. Emulator menguji stale update/delete dan dua perangkat. UI kini menampilkan versi perangkat vs Google Sheets per record, menyediakan pilihan eksplisit memakai versi cloud atau mempertahankan versi perangkat, menyimpan pasangan versi sebagai recovery lokal, dan tetap memakai compare-and-set saat retry. Verifikasi multi-device pada endpoint staging yang benar-benar ter-deploy masih wajib.
- **Stale PWA:** source-level protocol gate sudah ditambahkan untuk menolak request versi lama; tetap perlu uji live pada endpoint staging untuk memastikan backend yang ter-deploy benar-benar menolak GET/POST tanpa protocol 2.
- **Server access control:** role Owner/Team tetap bearer credential; token tidak lagi disimpan permanen atau dikirim lewat URL, tetapi tetap dapat diekstrak selama sesi browser aktif. Ini bukan identitas per pengguna. Jangan buka akses multi-user luas tanpa autentikasi per pengguna dan pengujian server-side.
- **Backup/rollout:** backup produksi dan pemulihannya harus diuji, lalu uji perangkat Android/iPhone/desktop dan rencana rollback serta pengawasan pasca-rilis. Tidak ada hard-coded secret di repo.

## Validasi kode

Cek branch PR #2 dan workflow `Check Business OS safe sync` pada commit HEAD. Tes yang dipanggil dari terminal Node (pengujian emulator) adalah:

```bash
node --check sync-safe.js
node sync-safe.test.js
node sync-backend-integration.test.js
node mapping.test.js
```

Jangan menyamakan status PASS dari pengujian ini dengan akses aman di jaringan publik. Dokumen pendamping: [UX & Access QA](ux-access-security-qa.md) dan [LAB API guard](lab-api-guard.md).

## Kebijakan deployment

**Jangan deploy branch PR #2 ke produksi atau mengubah Apps Script live sekarang.** Kode baru akan memutus kompatibilitas bila backend masih versi lama atau token belum dikonfigurasi. Source-level concurrency sudah diuji di emulator, tetapi endpoint staging yang ter-deploy, autentikasi/otorisasi server, backup/restore, dan QA perangkat nyata belum tervalidasi. Rilis hanya setelah seluruh release gate dipenuhi dan disetujui.
