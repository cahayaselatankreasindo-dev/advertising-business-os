# Advertising Business OS — 5 Pilar Terpadu (v2)

> **STATUS 26 NOVEMBER 2026 — INTERNAL DEVELOPMENT / TEST ONLY.** The integrated candidate is based on `feature/csk-inventory-bridge-fix-20261124`. PR #56 adds the validated supplier-price importer for PWA 3.2.32; PR #55 prepares a combined TEST-only package on `feature/csk-release-package-20261126`. Automated regression checks pass, while the refreshed v3.2.32 package, real-device QA, and isolated Apps Script/Google Sheets acceptance remain pending. Do not merge this candidate to `main`, connect it to production data, or modify the public CSK marketing website. Use the [Admin Install & Upgrade Guide](docs/CSK-ADMIN-INSTALL-UPGRADE.md) for the controlled TEST procedure.

Operating System Manajemen Bisnis & Pencatatan Terpadu — **The Scales Advertising / CSK**

> **Versi 2.0** — Arsitektur 5 Pilar Bisnis Terpadu dengan otomasi antar-tab dan UI berjenjang hak akses.

---

## 📱 Fitur Utama Aplikasi

### Pilar 1 — Leads CRM
- Pencatatan calon klien dari WhatsApp, Instagram Ads, TikTok, dan Referensi
- Pencarian Lead berdasarkan nama, WhatsApp, email, PIC, industri, dan catatan
- Jadwal follow-up, catatan tindak lanjut, tanggal kontak terakhir, serta antrean follow-up terlambat/hari ini
- Tombol **Direct WhatsApp Chat** dan konversi 1-klik menjadi Klien + Proyek
- Status: Baru → Dihubungi → Negosiasi → **Deal Menang** → Batal

### Pilar 2 — Financial Journal
- Pencatatan DP Proyek, Pelunasan, Retainer Iklan, Expense, dll
- **Pencatatan kas berbasis penerimaan aktual**: DP, cicilan, dan pelunasan dicatat ke Finance hanya setelah pembayaran benar-benar diterima dan dikonfirmasi melalui Invoice Payment Ledger. Status Deal Menang hanya membuat antrean proyek; tidak membuat pendapatan Finance.

### Pilar 3 — Production Projects
- Pelacakan deadline, status Brief/Pengerjaan/Review/Selesai, PIC, dan pencarian proyek
- Filter status serta deadline; indikator proyek terlambat dan persentase penyelesaian SOP
- **SOP Checklist interaktif** per proyek: Brief → Produksi → Review → Revisi → Delivery
- **Auto-trigger**: saat lead Deal Menang, baris antrean kerja baru dibuat otomatis di tab Projects (status *plan*, deadline +14 hari)

### Pilar 4 — Product-Market Fit (Clients)
- Database klien tetap dengan riwayat kerja sama & LTV
- **Rating bintang (1–5)** dan **review teks** per klien
- Indikator PMF melalui repeat order dan kepuasan

### Pilar 5 — Marketing Spend
- Catatan biaya iklan per platform (Meta Ads, TikTok, Google, LinkedIn)
- Kalkulasi **CPL** (Cost Per Lead) dan **ROAS** per platform secara real-time
- Ringkasan performa campaign langsung di dashboard

---

## Commercial Document Center

- Quotation dan Invoice dapat dibuat mandiri tanpa proyek.
- Nama, WhatsApp, email, dan PIC dapat dipanggil dari Lead; informasi lain dapat diedit manual.
- Material/Jasa dapat dipilih dari master atau ditambahkan manual; kuantitas, satuan, deskripsi, dan harga dapat diedit.
- Tanggal, jatuh tempo, diskon, pajak, DP, ketentuan pembayaran, syarat, dan catatan dapat diubah.
- Quotation berstatus Disetujui dapat dikonversi menjadi Invoice. Quotation yang belum disetujui tidak dapat menjadi sumber Invoice atau proyek. Quotation maupun Invoice dapat membuat atau menghubungkan proyek tanpa duplikasi.
- Saat aksi **Buat / Hubungkan Proyek** dijalankan ulang, judul, klien, nilai kontrak, dan tenggat proyek diperbarui dari dokumen sumber tanpa mengubah status pengerjaan atau progres SOP. Jika Quotation dan Invoice terhubung pada proyek yang sama, Invoice aktif menjadi sumber nilai komersial utama.
- Masa berlaku Quotation, jatuh tempo Invoice, dan deadline penyelesaian proyek disimpan terpisah. Default masa berlaku penawaran 14 hari dan jatuh tempo Invoice 7 hari; keduanya dapat diedit. Deadline proyek bersifat opsional dan hanya diperbarui dari kolom khusus tersebut.
- Nomor Quotation dan Invoice divalidasi unik di backend, bukan hanya di browser.
- Percobaan pembayaran yang belum terverifikasi mempertahankan ID dan payload sementara pada sesi tab agar retry memakai transaksi yang sama; data sementara dihapus setelah verifikasi berhasil.
- Invoice tidak otomatis dicatat sebagai kas masuk; Finance hanya mencatat pembayaran yang benar-benar diterima.
- Backend menolak perubahan nilai total atau pembatalan Invoice yang sudah memiliki pembayaran, serta melindungi jurnal Finance terkait dari penghapusan generik.
- HPP proyek tersimpan di tab `Cost_Sheets`; arsip quotation HPP lama tetap berada di tab `Quotations`. HPP proyek dapat diimpor ke editor Quotation komersial melalui proyek terkait. Import mempertahankan material, jasa, kuantitas, satuan, metode kalkulasi, serta referensi snapshot HPP; alokasi harga jual mengikuti margin HPP dan direkonsiliasi ke total penawaran.
- Invoice hasil konversi mempertahankan snapshot baris Quotation, termasuk referensi HPP. Dokumen komersial tetap disimpan terpisah di `Commercial_Quotations` dan `Invoices`.
- Dokumen komersial dibatasi untuk Owner di antarmuka dan backend.
- Quotation dapat menghubungkan proyek dan mengimpor snapshot HPP tersimpan. Rincian material/jasa, tenaga kerja, dan biaya lain dipertahankan, harga dialokasikan proporsional sesuai biaya, serta totalnya direkonsiliasi dengan harga jual HPP.
- Kuantitas dan satuan pemakaian HPP tetap terlihat pada quotation. Quotation menyimpan referensi ID/waktu dan snapshot HPP lengkap, termasuk kuantitas, satuan, harga, metode costing, serta asumsi konversi material. Invoice hasil konversi mempertahankan referensi HPP pada setiap baris; perubahan HPP berikutnya tidak mengubah dokumen yang sudah dibuat.
- Sales Order menyalin snapshot HPP dari quotation yang disetujui. Perencanaan kebutuhan material dan Draft PO memakai snapshot tersebut, bukan HPP proyek terbaru. Faktor konversi historis dipakai selama satuan dasar stok tidak berubah; perubahan satuan stok di Master Material akan memblokir perhitungan sampai ditinjau ulang.
- Snapshot HPP disimpan pada kolom JSON tambahan di Commercial_Quotations dan Sales_Orders. Fungsi setupSheet menambahkan kolom yang belum ada di sisi kanan tanpa menghapus kolom/data lama.
- Ringkasan metode custom costing (misalnya potong lembar/roll, potong profil, konversi kemasan, luas, panjang, atau volume) ikut terbaca pada deskripsi quotation; detail kalkulasi lengkap tetap tersimpan pada snapshot HPP sumber.


## Inventory, Sales Order, dan Pengadaan

- Sales Order hanya dapat dibuat dari Quotation yang sudah disetujui dan menyimpan snapshot HPP yang digunakan saat penawaran dibuat.
- Sales Order dengan DP wajib menunggu pembayaran DP yang sudah diverifikasi sebelum status produksi dapat dilepas.
- Kebutuhan material dihitung dari snapshot HPP Sales Order, bukan dari HPP proyek terbaru yang mungkin sudah berubah.
- Stok dicatat melalui ledger pergerakan: saldo awal, penerimaan, pengeluaran proyek, retur, dan penyesuaian. Saldo tidak diedit langsung.
- Reservasi material mengurangi stok tersedia. Pengeluaran dan retur yang terkait Sales Order harus menunjuk reservasi yang sama dan tidak boleh melebihi sisa reservasi atau jumlah yang telah dikeluarkan.
- Penerimaan barang yang terhubung ke Purchase Order divalidasi terhadap material, satuan, faktor konversi, dan sisa kuantitas PO.
- Master Material menyediakan batas minimum stok (*reorder point*) per SKU. Inventory menampilkan rekomendasi pengadaan berdasarkan stok fisik dikurangi komitmen Sales Order aktif.
- Rekomendasi reorder bersifat informatif. Sistem tidak membuat atau mengirim PO otomatis; Owner harus memeriksa stok fisik dan PO yang masih berjalan sebelum membuat pembelian.
- Material dari seed awal tetap berstatus Draft/Template dan harga pembelian maupun HPP bernilai nol sampai diverifikasi. Jangan mengaktifkan SKU atau memakai harga asumsi sebagai harga transaksi.

## 🔐 Autentikasi dan Hak Akses

Aplikasi menggunakan login email + PIN. Peran ditentukan dan diverifikasi oleh backend Apps Script; pilihan role pada antarmuka bukan mekanisme keamanan.

- **Owner** dapat mengakses seluruh modul dan data.
- **Tim** hanya dapat mengakses Leads, Clients, dan Projects untuk operasional.
- **Tim dapat membuat dan memperbarui** data bersama tersebut, tetapi **tidak dapat menghapus** Leads, Clients, atau Projects. Backend menolak penghapusan Tim; penghapusan hanya dapat dilakukan Owner dan diverifikasi ulang dari Google Sheets.
- Finance, Memory, Marketing, HPP, Purchase Orders, Quotations, Invoices, dan pengaturan backend hanya tersedia untuk Owner.
- Status Lead **Deal Won** hanya membuat antrean proyek; tidak mencatat pemasukan Finance. Pemasukan Finance dicatat setelah pembayaran benar-benar diterima dan dikonfirmasi.
- PIN disimpan sebagai hash bersalt di Script Properties. Lima kegagalan login memicu pembatasan sementara selama 15 menit.
- Sesi berlaku maksimal 30 menit sejak aktivitas terakhir. PIN dan session ID tidak disimpan di localStorage.
- Cold email otomatis maupun manual dinonaktifkan. Tidak ada email yang dikirim oleh fitur tersebut.

Google Apps Script Web App harus dapat menerima request publik agar halaman login dapat menghubungi backend. Data tetap dilindungi oleh verifikasi email, PIN, sesi, dan RBAC di server. Jangan membagikan PIN Owner atau URL pengelolaan Apps Script.

---

## ⚡ Otomasi Intelligente (Auto-Trigger)

Ketika status Lead diubah menjadi **Deal Menang**, sistem akan secara otomatis:

1. Memastikan satu entri Klien tersedia dan memperbarui jumlah serta total nilai proyek.
2. Membuat satu antrean Proyek (status `plan`, deadline awal +14 hari) jika belum ada.
3. Menggunakan ID stabil dan token `[LEAD-{id}]` agar pengulangan trigger tidak membuat duplikasi.

**Penting:** Deal Won bukan bukti uang diterima. Sistem tidak mencatat pendapatan Finance dari nilai kontrak. Catat DP, cicilan, atau pelunasan hanya melalui konfirmasi pembayaran Invoice setelah dana benar-benar diterima.

### Cara Mengaktifkan Auto-Trigger (Sekali Setup)

1. Buka [Google Apps Script Editor](https://script.google.com) → Spreadsheet Anda
2. Pilih fungsi **`installAutoTrigger`** di dropdown atas → klik **Run**
3. Berikan izin akses Google Account Anda
4. Selesai! Otomasi akan berjalan otomatis setiap kali Anda mengedit tab Leads, maupun terjadwal per jam

---

## 🔄 Sinkronisasi Dua Arah

Aplikasi kini mendukung **tarik-tambah** data antara HP dan PC:

- **Kirim (Push)**: setiap perubahan di aplikasi otomatis tersinkron ke Google Sheets (sync_all)
- **Tarik (Pull)**: tombol **"Tarik Data"** menggabungkan data cloud dan lokal berdasarkan ID.
- **Catatan**: sinkronisasi memakai merge/upsert. Data lama yang tidak dikirim tidak dihapus.

---

## 🚀 Cara Membuka di HP (via GitHub Pages — Gratis)

1. Buka repositori ini di browser: https://github.com/cahayaselatankreasindo-dev/advertising-business-os
2. Klik tab **Settings** → bilah sisi kiri klik **Pages**
3. Source: **Deploy from a branch** → Branch: **main**, folder: **/ (root)** → Save
4. Tunggu 1–2 menit → link publik: 👉 `https://cahayaselatankreasindo-dev.github.io/advertising-business-os/`
5. **Pasang sebagai app di HP:**
   - **Android (Chrome)**: titik tiga kanan atas → **"Tambahkan ke Layar Utama"**
   - **iPhone (Safari)**: tombol Share → **"Tambahkan ke Layar Utama"**

---

## 📊 Cara Menghubungkan ke Google Sheets (Database Gratis)

1. Gunakan Google Spreadsheet database CSK yang sudah ada. **Jangan buat spreadsheet baru jika database lama masih dipakai.** Jika belum ada, buat spreadsheet bernama `Database CSK Business OS`.
2. Buka **Extensions → Apps Script**.
3. Ganti kode editor dengan seluruh isi file [`apps-script/Code.gs`](apps-script/Code.gs) atau [`google_apps_script.js`](google_apps_script.js).
4. Simpan kode.
5. Jalankan fungsi **`setupSheet`** sekali dan berikan izin yang diminta. Fungsi ini memvalidasi header dan menambahkan tab/kolom yang belum ada tanpa menghapus data lama. Cadangkan Spreadsheet sebelum perubahan skema.
6. Kembali ke Google Spreadsheet dan muat ulang halaman agar menu **CSK Security** muncul.
7. Pilih **CSK Security → Setup PIN Owner & Tim**. Masukkan dua PIN berbeda (masing-masing tepat 4 digit). **Jangan jalankan fungsi dialog ini melalui tombol Run di Apps Script Editor** karena dialog Spreadsheet memerlukan konteks UI.
8. Klik **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (data tetap memerlukan email + PIN dan sesi yang diverifikasi backend).
9. Deploy dan salin URL Web App yang berakhiran `/exec`.
10. Buka aplikasi. Masukkan URL Web App, email terdaftar, dan PIN pada layar login.
11. Opsional: jalankan **`installAutoTrigger`** sekali untuk otomasi Deal Menang.

**Pemisahan deployment:** GitHub Pages menerbitkan frontend dari branch `main`. Perubahan file Apps Script di GitHub tidak otomatis memperbarui deployment Web App. Setelah backend diperbarui di Apps Script Editor, buka **Deploy → Manage deployments → Edit → New version → Deploy**. URL `/exec` yang sudah digunakan aplikasi biasanya tetap sama saat deployment yang sama diperbarui.

**Tidak memerlukan Google Cloud OAuth, domain, hosting berbayar, atau API token bersama.** Jangan bagikan PIN Owner. Untuk mengganti PIN yang sudah terpasang, gunakan `rotateCSKPinCredentialsFromPrompt`. Data Owner tidak disimpan permanen di browser; Google Sheets menjadi sumber data utama. Pastikan sinkronisasi berhasil sebelum keluar dari aplikasi.

---

## 📂 Struktur Database (5 Pilar)

| Pilar | Tab Google Sheets | Kolom Kunci |
|-------|-------------------|-------------|
| **Leads CRM** | Leads | ID, Tanggal, Nama, WA, Sumber, EstimasiNilai, Status, Catatan, NextFollowUp, LastContactAt, FollowUpNote |
| **Financial Journal** | Finance | ID, Tanggal, Tipe, Kategori, Nominal, Keterangan |
| **Production Projects** | Projects | ID, NamaProyek, Klien, Nilai, Status, Deadline, Catatan, **SOP_Checklist** |
| **Product-Market Fit** | Clients | ID, NamaKlien, WA, TotalProyek, TotalBelanja, Catatan, **Rating_Review** |
| **Marketing Spend** | Marketing_Spend *(baru)* | ID, Tanggal, Platform, Kampanye, Budget, Terpakai, LeadsDihasilkan, Catatan |

---

## 🔧 Changelog v2.0

- ✅ Tab **Marketing_Spend** baru ditambahkan
- ✅ Kolom **SOP_Checklist** otomatis ditambahkan ke tab Projects
- ✅ Kolom **Rating_Review** otomatis ditambahkan ke tab Clients
- ✅ Fungsi **autoTriggerPillars()** — idempoten via token `[LEAD-{id}]`
- ✅ Fungsi **installAutoTrigger()** — pasang onEdit + time-driven trigger
- ✅ doPost mendukung aksi: `sync_all`, `insert`, `update_status`
- ✅ doGet mengembalikan semua tab termasuk Marketing_Spend & lastSynced
- ✅ UI 5 pilar terpadu dengan badge penanda pilar
- ✅ Dropdown **Hak Akses** (Owner / Tim Kreatif)
- ✅ **SOP Checklist interaktif** per proyek (Brief → Delivery)
- ✅ **Rating bintang & review** per klien
- ✅ View **Marketing Spend** baru dengan kalkulasi CPL & ROAS
- ✅ Tombol **"Tarik Data"** (pull server overwrites local) di dashboard
- ✅ Versi PWA bumped ke **v2.0.0** (service worker cache baru)


### Invoice Payment Ledger

- Pembayaran Invoice dicatat melalui endpoint Owner-only yang menulis satu baris ke `Invoice_Payments` dan satu pemasukan ke `Finance`.
- Jenis pembayaran: DP, cicilan, dan pelunasan. Nominal harus sesuai sisa tagihan; pelunasan wajib sama dengan saldo terutang.
- ID pembayaran menjadi kunci idempotensi. Pengiriman ulang ID yang sama tidak menggandakan jurnal; jika penulisan Finance gagal setelah ledger tersimpan, retry akan memperbaiki jurnal.
- `Invoice_Payments` dibaca oleh Owner dan tidak dapat ditulis melalui `sync_all` atau endpoint CRUD generik.
- Jurnal Finance dengan ID `FIN-PAY-*` divalidasi terhadap ledger; sinkronisasi umum tidak boleh mengubah tanggal, kategori, nominal, atau deskripsinya. Pemulihan jurnal yang hilang hanya diizinkan jika cocok dengan ledger.
- Invoice dan Quotation komersial hanya dibuat melalui jalur sinkronisasi tervalidasi; endpoint insert generik ditolak. Quotation yang sudah menjadi sumber Invoice tidak dapat dihapus.
- Setelah Invoice menerima pembayaran, nomor dokumen, identitas pelanggan, rincian item, nilai, dan ketentuan pembayaran dikunci. Jatuh tempo, deadline proyek, dan catatan operasional tetap dapat diperbarui.


### Pusat Tindakan CRM

- Dashboard menampilkan jumlah follow-up terlambat, follow-up hari ini, Lead tanpa jadwal, dan proyek terlambat.
- Lead, Klien, dan Proyek dapat dicari serta difilter tanpa menghapus data dari sumber.
- Perubahan follow-up, kontak terakhir, dan PIC proyek disimpan melalui sinkronisasi terverifikasi.
- Nilai proyek pada profil Klien adalah nilai kontrak/proyek, bukan kas yang sudah diterima.


## Deployment Backend yang Aman (Windows)

Backend dikirim melalui `clasp` dan deployment Web App yang sudah ada diperbarui tanpa mengganti URL. Gunakan folder repo aktif, bukan folder lama.

1. Checkout branch fitur yang sudah lolos CI dan pastikan perubahan lokal sudah disimpan.
2. Pastikan `clasp login` pernah dijalankan dengan akun Google pemilik Apps Script.
3. Jalankan dari PowerShell di root repo:

```powershell
.\deploy-backend.ps1 -DeploymentId "<ID dari URL /exec>"
```

Script memeriksa login PIN/RBAC, lalu memastikan Deployment ID yang diberikan memang terdaftar pada Script ID di `apps-script/.clasp.json` **sebelum** melakukan push. Jika project atau Deployment ID tidak cocok, proses berhenti tanpa mengirim kode. Setelah push, script meminta konfirmasi `PIN-READY` dan hanya memperbarui deployment yang ditentukan; tidak membuat deployment baru dan tidak menyentuh data Google Sheets.

Jangan menaruh file `.clasprc.json`, PIN, session ID, atau kredensial Google ke repository.


### Read-only spreadsheet schema audit

Run `auditCSKSchemaReadOnly()` from the Apps Script editor or the **CSK Security → Audit Struktur (Read-only)** menu. The report includes mapped-tab presence, row counts, missing/duplicate/extra headers, legacy read-only tabs, and unclassified auxiliary tabs. It returns metadata only and never creates tabs, appends headers, or changes business records.

## Schema Migration Safety

- Normal application sync is data-only. It must not create missing tabs or append missing columns.
- Before a normal Owner sync, the backend validates every mapped sheet included in its collections plus the Leads, Clients, and Projects dependencies used by automatic Deal Won conversion, inventory, and commercial validators. Finance sync requires the Invoice Payments ledger, while Invoice sync requires Cost Sheets for HPP snapshot validation. Team sync validates the Leads, Clients, and Projects contracts. A failed preflight blocks the entire sync before any record is written.
- Missing sheets or required headers return an explicit `SCHEMA_SETUP_REQUIRED` error. Do not try to repair this by repeatedly clicking Sync.
- `setupSheet()` is the explicit schema-migration operation. Run it only on an approved TEST spreadsheet after backup and header preflight. Review any proposed tabs and appended columns before production approval.
- Keep `google_apps_script.js` and `apps-script/Code.gs` byte-identical. No schema setup, deployment, or production write is performed by CI.

## Sales Order & Production Workflow

- Approved quotations can be converted into one linked Sales Order; duplicate orders from the same quotation are blocked.
- Sales Orders retain a commercial snapshot of the approved quotation and linked project.
- Production release is blocked until the agreed DP is recorded in the verified invoice payment ledger.
- Workflow: Awaiting DP → Ready Production → In Production → Quality Control → Ready Delivery → Delivered → Closed. QC can send work back to production for rework.
- Closing is blocked until all linked invoices are fully paid.
- Sales Orders are Owner-only. Team accounts do not receive the Sales Order collection.
- Inventory commitment monitoring, material demand calculation, locked Sales Order reservations, material picking, partial issue/return, supplier-grouped Draft PO creation, and PO-linked goods receiving are implemented in the development branch. Reorder suggestions, offcut tracking, and stock valuation remain future phases.


## Inventory & Stock Ledger

- Owner-only inventory balance, locked Sales Order reservations, picking list, and append-only transaction history by material.
- Movements: opening balance, receipt, project issue, project return, adjustment in/out. Opening stock is never assumed.
- Material issue from a reserved Sales Order must reference the same Sales Order and reservation. Partial issue reduces the remaining reserved quantity; partial return is linked to the original reservation and restores its available balance.
- Reservation state is reconciled from the persisted Sales Order and transaction ledger. Cancelled, delivered, or closed Sales Orders release unused reservations while preserving released rows for audit history.
- Stock is measured in the Material Master usage unit. Purchase-unit conversion is applied only when a verified conversion factor exists.
- The ledger is append-only. Corrections require a documented adjustment; stock cannot go negative.
- PO-linked receipts are checked against ordered materials, units, conversion factors, and cumulative PO quantities. New POs can only be marked Received when all ordered quantities have been recorded in Inventory; cancellation is blocked after a receipt.
- Physical stock, active reservations, and free stock are shown separately. Reorder suggestions, offcut tracking, and stock valuation remain future phases.


## HPP Material Planning & Draft Purchasing

- Sales Orders compare their immutable HPP material snapshot with physical stock and locked reservations. New Sales Orders copy the approved quotation snapshot; older orders without a snapshot retain a clearly labelled legacy fallback to the current project HPP.
- HPP purchase-unit quantities convert to stock units only when a verified Material Master conversion factor exists.
- The shortage view includes physical stock, existing Draft/Ordered PO coverage, active reservations, and remaining purchase quantity.
- Owner can create supplier-grouped Draft POs from uncovered shortages. Drafts are not issued automatically and require review.
- Production release requires the agreed DP to be verified and stock to be reserved atomically. Competing Sales Orders cannot reserve the same available balance.

## Commercial Document Validation & Inventory Commitments — 24 November 2026

- Quotation and invoice saves reject invalid quantities, blank/negative prices, invalid discounts, discount above subtotal, tax outside 0–100%, and DP outside 1–99%.
- Apps Script independently recalculates and validates new/financially changed commercial document totals before accepting writes. Unchanged legacy financial snapshots remain compatible.
- Inventory now shows physical stock separately from estimated free stock after active Sales Order material commitments.
- Active commitments include Ready Production, In Production, Quality Control, and Ready Delivery. Project HPP requirements are aggregated once per project; project issues and returns reduce or restore outstanding demand.
- Missing HPP or invalid unit conversions are surfaced as unresolved. Production release requires verified DP and atomic stock reservation; competing orders cannot reserve the same available balance.
- GitHub Actions source-checks and tests pass on the internal feature branch.

Next: complete isolated TEST spreadsheet and Apps Script acceptance, real-device browser/PDF QA, and Owner-reviewed schema migration. No live deployment, production migration, or merge to main has been performed.


## Admin Install & Upgrade — Internal TEST

- Baca `docs/CSK-ADMIN-INSTALL-UPGRADE.md` sebelum menyiapkan aplikasi atau Apps Script.
- Paket ZIP dibuat melalui `tools/csk-release-preflight.ps1` dari branch `feature/csk-*` yang bersih. Script menjalankan regression tests, memeriksa kesamaan source Apps Script dan versi PWA, lalu membuat paket TEST dengan checksum.
- Artifact GitHub Actions bernama `csk-business-os-development-package` juga tersedia setelah workflow **CSK Release Package** lulus.
- Paket tidak menyertakan `.clasp.json` aktual dan tidak menjalankan deployment, migrasi skema, atau penulisan Google Sheets.
- Paket kandidat saat ini menggunakan PWA 3.2.32 dan mencakup impor harga supplier yang tervalidasi; gunakan hanya pada lingkungan TEST.
- Petunjuk GitHub Pages di bagian lama README ini bukan persetujuan untuk menerbitkan kandidat development saat ini.
