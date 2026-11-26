# CSK Business OS — Panduan Admin Instalasi & Upgrade

**Status dokumen:** 26 November 2026  
**Status aplikasi:** internal development / TEST ONLY  
**Versi PWA pada baseline saat ini:** 3.2.32  
**Branch integrasi:** `feature/csk-inventory-bridge-fix-20261124`

Panduan ini mengatur penyiapan paket, instalasi uji, upgrade, dan pemeriksaan Admin. Panduan ini **bukan persetujuan untuk merilis aplikasi ke produksi**.

## 1. Batas yang wajib dijaga

- CSK Business OS adalah aplikasi internal yang terpisah dari website publik Cahaya Selatan Kreasindo.
- Jangan mengubah repository, hosting, DNS, atau deployment website publik.
- Jangan menggabungkan branch integrasi ke `main` untuk pekerjaan pengujian ini.
- Jangan menghubungkan paket development ke Google Sheets produksi.
- Jangan menjalankan `setupSheet()` pada database produksi tanpa backup, pemeriksaan skema, dan persetujuan Owner.
- Jangan menaruh PIN, token, `.clasprc.json`, atau kredensial Google di GitHub, paket ZIP, maupun percakapan.

## 2. Arsitektur aplikasi

| Lapisan | Implementasi |
|---|---|
| Frontend | HTML, CSS, JavaScript, PWA |
| Backend | Google Apps Script Web App |
| Database | Google Sheets sebagai satu sumber data |
| Login | Email + PIN, sesi dan RBAC diverifikasi di backend |
| Dokumen | Quotation, Invoice, Sales Order, PDF |
| Perangkat | Browser desktop, iPhone Safari, Android Chrome |

Tidak ada database kedua yang ditambahkan dalam fase ini. Supabase tidak menjadi dependensi aplikasi.

## 3. Membuat paket instalasi

Paket ZIP dibuat dari branch development yang bersih. Script menjalankan pemeriksaan versi, kesamaan dua salinan Apps Script, syntax check, dan seluruh regression test sebelum membuat arsip.

Persyaratan:
- Windows PowerShell 5.1 atau PowerShell 7.
- Git.
- Node.js 20 atau lebih baru.
- Working tree Git bersih.

Jalankan dari root repository:

```powershell
git checkout feature/csk-inventory-bridge-fix-20261124
git status --short
.\tools\csk-release-preflight.ps1
```

Script menolak branch `main`, working tree yang belum bersih, versi Service Worker/manifest yang berbeda, dan source Apps Script yang tidak identik. Paket dibuat di folder sementara Windows:

`%TEMP%\CSK-Business-OS-Releases`

Paket memuat frontend, backend source, katalog, dokumen operasional, dan manifest checksum SHA-256. Paket tidak memuat file `.clasp.json` aktual, backup, test files, atau kredensial. File konfigurasi contoh tersedia sebagai:

`apps-script/clasp-config.example.json`

Alternatifnya, ambil artifact `csk-business-os-development-package` dari workflow **CSK Release Package** pada GitHub Actions. Artifact adalah paket TEST, bukan paket produksi.

## 4. Menyiapkan lingkungan TEST

### 4.1 Google Sheets

1. Buat salinan spreadsheet database CSK dengan nama yang jelas, misalnya `Database CSK Business OS TEST`.
2. Pastikan salinan tersebut benar-benar terpisah dari spreadsheet produksi.
3. Simpan backup awal salinan TEST.
4. Jangan mengubah atau menghapus baris data untuk sekadar menyesuaikan hasil audit.

### 4.2 Apps Script TEST

1. Buka spreadsheet TEST dan buat/buka Apps Script yang terikat hanya pada spreadsheet TEST.
2. Gunakan source dari `apps-script/Code.gs` atau `google_apps_script.js`.
3. Salin `apps-script/clasp-config.example.json` menjadi `apps-script/.clasp.json` pada working copy lokal.
4. Isi `scriptId` dengan Script ID proyek Apps Script TEST, bukan Script ID produksi.
5. Jalankan `clasp login` dengan akun Owner yang berwenang.
6. Ambil Deployment ID dari URL Web App TEST yang berakhiran `/exec`.
7. Setelah identitas project dan deployment TEST dipastikan, jalankan:

```powershell
.\deploy-backend.ps1 -DeploymentId "<DEPLOYMENT_ID_TEST>"
```

Script deployment melakukan push dan memperbarui deployment yang ditentukan. Karena itu, jangan jalankan perintah tersebut sebelum memastikan `.clasp.json` dan Deployment ID benar-benar menunjuk ke lingkungan TEST.

Atur PIN Owner dan Team melalui menu keamanan yang tersedia pada spreadsheet TEST. Jangan menyalin PIN produksi ke lingkungan uji.

## 5. Pemeriksaan skema database

Urutan yang benar:

1. Jalankan `auditCSKSchemaReadOnly()` pada spreadsheet TEST.
2. Tinjau tab yang ada, jumlah baris, header yang hilang/duplikat, dan tab tambahan.
3. Bandingkan laporan dengan kontrak skema pada source.
4. Jika migrasi diperlukan, pastikan backup TEST tersedia dan Owner menyetujui perubahan.
5. Jalankan `setupSheet()` hanya pada spreadsheet TEST yang telah disetujui.
6. Jalankan audit read-only lagi dan pastikan hasilnya sesuai.

Sinkronisasi biasa bersifat data-only. Jika tab atau header wajib belum tersedia, backend harus menolak dengan `SCHEMA_SETUP_REQUIRED`; jangan mengatasinya dengan mengulang tombol Sync.

## 6. Konfigurasi frontend

1. Sajikan isi paket frontend melalui hosting internal/staging yang menggunakan HTTPS.
2. Jangan mengunggahnya ke website pemasaran publik.
3. Buka aplikasi dan masukkan URL Web App TEST pada layar konfigurasi/login.
4. Login sebagai Owner dan verifikasi seluruh modul yang diizinkan.
5. Login sebagai Team dan pastikan hanya Leads, Clients, dan Projects yang dapat diakses.
6. Pastikan akun Team tidak dapat membaca atau menulis modul Owner melalui pemanggilan backend langsung.

## 7. Data master bahan, produk, dan jasa

Baseline katalog saat ini memuat:
- 53 keluarga bahan baku untuk kertas, sticker, kayu/panel, akrilik, plastik/komposit, media roll, logam, elektrikal, dan consumables.
- 41 keluarga produk/jasa, termasuk 20 jenis jasa dan 21 template produk.
- 101 baris awal Master Material yang berstatus Draft/Template.

**Harga supplier belum diisi dan tidak boleh dianggap sebagai harga transaksi.** Sebelum SKU diaktifkan, Owner harus memverifikasi supplier, merek/grade, spesifikasi, ketebalan, dimensi, warna/finishing, satuan beli, satuan pakai, faktor konversi, harga beli, sumber harga, tanggal harga, dan waste allowance.

Jangan mengaktifkan template yang belum memiliki bukti harga. Untuk jasa, masukkan harga jual dan biaya dasar yang sesuai dengan tarif aktual. Jasa dengan biaya dasar nol tidak boleh dipakai sebagai dasar HPP.

## 8. Uji alur bisnis wajib

Gunakan data uji yang tidak berisi informasi pelanggan produksi.

1. Buat Lead, konversikan menjadi Client dan Project, lalu ulangi konversi untuk memastikan tidak terjadi duplikasi.
2. Buat SKU material Draft; pastikan belum dapat dipakai untuk transaksi sebelum data harga dan supplier lengkap.
3. Aktifkan satu SKU uji dengan bukti harga yang disetujui.
4. Buat HPP dengan material dan jasa; uji satuan, konversi, waste, dan snapshot.
5. Buat Quotation dari HPP dan periksa PDF pelanggan agar tidak menampilkan HPP/margin internal.
6. Setujui Quotation dan buat satu Sales Order.
7. Catat pembayaran uji melalui Invoice Payment Ledger; pastikan DP yang belum terverifikasi tidak melepas produksi.
8. Lepas produksi dan pastikan reservasi stok bersifat atomik.
9. Uji pengeluaran material sebagian dan retur yang merujuk ke Sales Order serta reservasi yang sama.
10. Buat Draft PO dari kekurangan, terbitkan secara manual setelah diperiksa, lalu uji penerimaan barang dan konversi satuan.
11. Uji pengiriman, pelepasan reservasi tersisa, pelunasan, dan penutupan Sales Order.
12. Periksa Finance reconciliation dan Profitabilitas Proyek.

## 9. Uji PDF pada perangkat

| Perangkat | Langkah penerimaan |
|---|---|
| Desktop Chrome/Edge | Generate PDF, unduh, buka ulang, periksa halaman dan cetak |
| iPhone/iPad Safari | Generate PDF, buka pratinjau, pilih Bagikan → Simpan ke File, lalu buka ulang file |
| Android Chrome | Generate PDF, unduh, buka dari Downloads, periksa halaman |

Pada iPhone/iPad, alur saat ini membuka pratinjau PDF. Pengguna perlu memilih **Bagikan → Simpan ke File**; sistem tidak menyimpan file diam-diam ke perangkat. Library jsPDF dimuat dari CDN, sehingga koneksi internet diperlukan saat library belum tersedia. Jika library gagal dimuat, gunakan alur Cetak → Simpan sebagai PDF sebagai fallback.

Periksa dokumen satu halaman dan multi-halaman, nama pelanggan panjang, tabel panjang, angka besar, diskon, pajak, DP, ketentuan, dan footer.

## 10. Prosedur upgrade

1. Simpan backup spreadsheet TEST dan catat versi paket sebelumnya.
2. Unduh paket development terbaru dari workflow yang sudah lulus.
3. Cocokkan branch, commit, versi PWA, dan checksum pada `RELEASE-MANIFEST.json`.
4. Jalankan preflight dan regression test sebelum mengganti file.
5. Perbarui frontend pada hosting TEST.
6. Perbarui Apps Script TEST melalui deployment yang sama setelah target diverifikasi.
7. Jalankan audit skema read-only; lakukan `setupSheet()` hanya bila dibutuhkan dan disetujui.
8. Ulangi alur bisnis dan QA perangkat.
9. Simpan paket sebelumnya dan catat hasil pengujian sebagai bahan rollback.

Jangan menganggap upgrade frontend otomatis memperbarui Apps Script. Keduanya merupakan proses terpisah.

## 11. Batas fungsional yang masih harus dipahami

- Katalog referensi bukan daftar harga supplier yang sudah diverifikasi.
- Nilai profitabilitas yang memakai arsip biaya tercatat diberi label indikatif. Biaya material aktual tidak boleh disimpulkan dari saldo stok karena ledger saat ini belum memiliki snapshot valuasi historis yang memadai.
- Pelacakan offcut, lot/batch, dan valuasi stok yang lengkap masih memerlukan fase lanjutan.
- Lulus regression test tidak menggantikan pengujian browser nyata dan verifikasi data pada spreadsheet TEST.

## 12. Gerbang produksi

Produksi baru dapat dipertimbangkan setelah seluruh hal berikut selesai:
- Regression test lulus pada commit final.
- QA desktop, iPhone, dan Android ditandatangani.
- Owner memeriksa backup, audit skema, kolom/tab yang akan ditambahkan, dan diff Apps Script.
- Owner menyetujui secara eksplisit spreadsheet serta Apps Script produksi yang menjadi target.
- Deployment dan migrasi dilakukan dengan prosedur terpisah, terkontrol, dan dapat di-rollback.

Sampai persetujuan tersebut diberikan, seluruh paket, hosting, spreadsheet, dan Apps Script tetap berada di lingkungan development/TEST.
