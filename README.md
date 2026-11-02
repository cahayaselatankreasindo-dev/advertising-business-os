# CSK Business OS — Commercial & Operations (v3)

Operating System Manajemen Bisnis & Pencatatan Terpadu — **The Scales Advertising / CSK**

> **Versi 3.0 (pengembangan)** — lima pilar operasional ditambah Commercial Engine HPP & Quotation. Model operasi CSK: produksi hybrid (internal + vendor), owner-led, dan pemasaran hemat biaya (di bawah Rp1 juta/bulan).

---

## 📱 Fitur Utama Aplikasi

### Commercial Engine — HPP & Quotation
- Kalkulasi biaya material, tenaga internal, mesin, vendor, finishing, transportasi, dan instalasi.
- Pemisahan sumber biaya internal dan vendor partner untuk model produksi hybrid.
- Overhead, cadangan risiko, HPP, margin dari harga jual, dan pembulatan harga penawaran.
- Pipeline quotation: Draft → Dikirim → Disetujui → PO/SPK dikonfirmasi, atau Ditolak.
- Nomor quotation otomatis, masa berlaku, estimasi pengerjaan, ruang lingkup, syarat pembayaran, dan riwayat revisi.
- Cetak quotation melalui browser ke PDF. Harga internal, HPP, dan margin tidak ditampilkan kepada pelanggan.
- Persetujuan quotation tidak otomatis membuat proyek atau mencatat pendapatan; proyek baru dibuat/ditautkan setelah PO/SPK dikonfirmasi.
- Data Costings disimpan di tab Google Sheets `Costings` dan hanya dapat diakses token Owner.

### Project Cost Ledger
- Biaya aktual per proyek disimpan di tab `Project_Costs`.
- Catatan meliputi kategori, sumber internal/vendor, vendor, kuantitas, harga satuan, nominal, status pembayaran, referensi bukti, dan catatan.
- Dashboard membandingkan HPP estimasi dengan biaya aktual tercatat. Varians biaya bukan otomatis laba bersih; pembayaran dan pendapatan harus direkonsiliasi di Finance.
- Data hanya dapat diakses dan diubah oleh Owner.

### Project Cost Ledger
- Biaya aktual per proyek disimpan pada tab `Project_Costs` dan hanya dapat diakses Owner.
- Catatan mencakup kategori, sumber internal/vendor, vendor, kuantitas, harga satuan, nominal, status pembayaran, referensi bukti, dan catatan.
- Varians HPP terhadap biaya aktual adalah kontrol biaya, bukan laba bersih. Pendapatan, piutang, dan pembayaran harus direkonsiliasi terpisah di Finance.

### Pilar 1 — Leads CRM
- Pencatatan calon klien dari WhatsApp, Instagram Ads, TikTok, dan Referensi
- Tombol **Direct WhatsApp Chat** dan konversi 1-klik menjadi Klien + Proyek
- Status: Baru → Dihubungi → Negosiasi → **Deal Menang** → Batal

### Pilar 2 — Financial Journal
- Pencatatan DP Proyek, Pelunasan, Retainer Iklan, Expense, dll
- Pencatatan DP, termin, pelunasan, dan pengeluaran hanya berdasarkan transaksi aktual yang sudah diterima/dibayarkan.

### Pilar 3 — Production Projects
- Pelacakan deadline, status Brief/Pengerjaan/Review/Selesai
- **SOP Checklist interaktif** per proyek: Brief → Produksi → Review → Revisi → Delivery
- **Auto-trigger**: saat lead Deal Menang, baris antrean kerja baru dibuat otomatis di tab Projects (status *plan*, deadline +14 hari)

### Pilar 4 — Product-Market Fit (Clients)
- Database klien tetap dengan riwayat kerja sama & LTV
- **Rating bintang (1–5)** dan **review teks** per klien
- Indikator PMF melalui repeat order dan kepuasan

### Model Operasi CSK
- **Produksi:** hybrid — biaya internal dan vendor dicatat terpisah pada setiap HPP.
- **Tim:** owner-led — CRM menampilkan follow-up dan pipeline untuk membantu Owner mengelola proses penjualan.
- **Marketing:** anggaran di bawah Rp1 juta/bulan — prioritaskan SEO lokal, Google Business Profile, konten portofolio, referral, dan outbound terarah; iklan berbayar harus dibatasi dan diukur.

### Pilar 5 — Marketing Spend
- Catatan biaya iklan per platform (Meta Ads, TikTok, Google, LinkedIn)
- Kalkulasi **CPL** (Cost Per Lead) dan **ROAS** per platform secara real-time
- Ringkasan performa campaign langsung di dashboard

---

## 🔐 Hak Akses Berjenjang

| Role | Akses |
|------|-------|
| **Owner** | Semua modul dan seluruh operasi database |
| **Tim Kreatif / Admin** | Leads, Clients, Projects; Finance, Memory, Marketing, dan cold email ditolak oleh backend |

Hak akses ditentukan server berdasarkan token yang diverifikasi, bukan hanya dropdown browser. Dropdown hanya mengubah mode tampilan setelah server mengenali role.

---

## ⚡ Otomasi Intelligente (Auto-Trigger)

Ketika status Lead diubah menjadi **Deal Menang**, sistem akan secara otomatis:

1. ✅ Membuat entri Client jika belum ada.
2. ✅ Membuat antrean Project (status: plan, deadline +14 hari) dengan referensi Lead yang stabil; satu proyek manual yang cocok dengan klien dan nilai Lead akan ditautkan, bukan diduplikasi.
3. ✅ Mencegah duplikasi Client/Project ketika sinkronisasi atau trigger berjalan berulang kali.

**Penting untuk akurasi keuangan:** Deal Menang atau quotation disetujui bukan bukti pembayaran. Sistem tidak membuat pendapatan otomatis. Owner mencatat DP/termin/pelunasan di Finance setelah dana benar-benar diterima dan diverifikasi.

### Cara Mengaktifkan Auto-Trigger (Sekali Setup)

1. Buka [Google Apps Script Editor](https://script.google.com) → Spreadsheet Anda
2. Pilih fungsi **`installAutoTrigger`** di dropdown atas → klik **Run**
3. Berikan izin akses Google Account Anda
4. Selesai! Otomasi akan berjalan otomatis setiap kali Anda mengedit tab Leads, maupun terjadwal per jam

---

## 🔄 Sinkronisasi Dua Arah

Aplikasi kini mendukung **tarik-tambah** data antara HP dan PC:

- **Kirim (Push)**: setiap perubahan di aplikasi otomatis tersinkron ke Google Sheets (sync_all)
- **Tarik (Pull)**: tombol **"Tarik Data"** di Dashboard mengambil data terbaru dari cloud dan menimpa penyimpanan lokal
- **Catatan**: Pull bersifat *server overwrites local* — pastikan perubahan lokal sudah disinkronkan terlebih dahulu

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

1. Buat **Google Spreadsheet baru** → beri nama `Database CSK Business OS`
2. Klik menu **Extensions** → **Apps Script**
3. Hapus semua kode bawaan, lalu **PASTE** seluruh isi file [`google_apps_script.js`](google_apps_script.js)
4. Simpan (Ctrl+S)
5. Pilih fungsi **`setupSheet`** → klik **Run** (berikan izin jika diminta)
6. Klik **Deploy** (kanan atas) → **New deployment** → pilih **Web app**
7. Konfigurasi:
   - Description: `CSK OS API v2`
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Klik **Deploy** → salin URL Web App yang berakhiran `/exec`
9. Setelah backend baru di-deploy, jalankan fungsi **`setupApiTokens`** di Apps Script Editor. Salin token Owner dan Tim dari Execution log dan simpan secara rahasia.
10. Buka aplikasi → **Pengaturan & Cloud** → masukkan URL dan token sesuai peran → **Simpan URL**, lalu **Tarik Data** untuk memverifikasi role.
11. Jalankan fungsi **`installAutoTrigger`** sekali jika otomasi edit langsung di Google Sheets memang diperlukan. Tanpa token valid, semua request API ditolak.

---

## 📂 Struktur Database (8 tab operasional + ledger penghapusan)

| Pilar | Tab Google Sheets | Kolom Kunci |
|-------|-------------------|-------------|
| **Leads CRM** | Leads | ID, Tanggal, Nama, WA, Sumber, EstimasiNilai, Status, Catatan |
| **Financial Journal** | Finance | ID, Tanggal, Tipe, Kategori, Nominal, Keterangan |
| **Production Projects** | Projects | ID, NamaProyek, Klien, Nilai, Status, Deadline, Catatan, **SOP_Checklist** |
| **Product-Market Fit** | Clients | ID, NamaKlien, WA, TotalProyek, TotalBelanja, Catatan, **Rating_Review** |
| **Marketing Spend** | Marketing_Spend *(baru)* | ID, Tanggal, Platform, Kampanye, Budget, Terpakai, LeadsDihasilkan, Catatan |

---

## 🔧 Changelog v3.0 — branch pengembangan

- Commercial Engine HPP & Quotation dengan margin berbasis harga jual.
- Metadata quotation, versi revisi, masa berlaku, ruang lingkup, syarat pembayaran, dan cetak customer-facing.
- Persetujuan quotation dipisahkan dari konfirmasi PO/SPK.
- Project Cost Ledger untuk biaya aktual internal dan vendor.
- Costings dan Project_Costs dibatasi server untuk Owner.

## 🔧 Changelog v2.0

- ✅ Tab **Marketing_Spend** baru ditambahkan
- ✅ Kolom **SOP_Checklist** otomatis ditambahkan ke tab Projects
- ✅ Kolom **Rating_Review** otomatis ditambahkan ke tab Clients
- ✅ Fungsi **autoTriggerPillars()** — idempoten via token `[LEAD-{id}]`
- ✅ Fungsi **installAutoTrigger()** — pasang onEdit + time-driven trigger
- ✅ doPost mendukung aksi: `sync_all`, `insert`, `update_status`
- ✅ doGet membatasi data sesuai role server; Finance/Memory/Marketing hanya untuk Owner
- ✅ API fail-closed saat token belum dikonfigurasi
- ✅ Tombstone ledger `_CSK_Deleted` mencegah data terhapus muncul kembali setelah stale sync
- ✅ POST no-cors memakai Content-Type text/plain agar tidak memicu preflight
- ✅ Tampilan tidak mengklaim push/email berhasil hanya dari respons no-cors
- ✅ UI 5 pilar terpadu dengan badge penanda pilar
- ✅ Token API terpisah Owner/Tim dan otorisasi server-side
- ✅ **SOP Checklist interaktif** per proyek (Brief → Delivery)
- ✅ **Rating bintang & review** per klien
- ✅ View **Marketing Spend** baru dengan kalkulasi CPL & ROAS
- ✅ Tombol **"Tarik Data"** (pull server overwrites local) di dashboard
- ✅ Versi PWA bumped ke **v2.0.0** (service worker cache baru)
