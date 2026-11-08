# Advertising Business OS — 5 Pilar Terpadu (v2)

Operating System Manajemen Bisnis & Pencatatan Terpadu — **The Scales Advertising / CSK**

> **Versi 2.0** — Arsitektur 5 Pilar Bisnis Terpadu dengan otomasi antar-tab dan UI berjenjang hak akses.

---

## 📱 Fitur Utama Aplikasi

### Pilar 1 — Leads CRM
- Pencatatan calon klien dari WhatsApp, Instagram Ads, TikTok, dan Referensi
- Tombol **Direct WhatsApp Chat** dan konversi 1-klik menjadi Klien + Proyek
- Status: Baru → Dihubungi → Negosiasi → **Deal Menang** → Batal

### Pilar 2 — Financial Journal
- Pencatatan DP Proyek, Pelunasan, Retainer Iklan, Expense, dll
- **Auto-trigger**: saat lead berubah jadi Deal Menang, skrip otomatis membuat baris pendapatan di tab Finance (kategori *DP Proyek*)

### Pilar 3 — Production Projects
- Pelacakan deadline, status Brief/Pengerjaan/Review/Selesai
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

## 🔐 Autentikasi dan Hak Akses

Aplikasi menggunakan login email + PIN. Peran ditentukan dan diverifikasi oleh backend Apps Script; pilihan role pada antarmuka bukan mekanisme keamanan.

- **Owner** dapat mengakses seluruh modul dan data.
- **Tim** hanya dapat mengakses Leads, Clients, dan Projects untuk operasional.
- **Tim dapat membuat dan memperbarui** data bersama tersebut, tetapi **tidak dapat menghapus** Leads, Clients, atau Projects. Penghapusan hanya dapat dilakukan Owner dan diverifikasi ulang dari Google Sheets.
- Finance, Memory, Marketing, HPP, Purchase Orders, Quotations, dan pengaturan backend hanya tersedia untuk Owner.
- PIN disimpan sebagai hash bersalt di Script Properties. Lima kegagalan login memicu pembatasan sementara selama 15 menit.
- Sesi berlaku maksimal 30 menit sejak aktivitas terakhir. PIN dan session ID tidak disimpan di localStorage.
- Cold email otomatis maupun manual dinonaktifkan. Tidak ada email yang dikirim oleh fitur tersebut.

Google Apps Script Web App harus dapat menerima request publik agar halaman login dapat menghubungi backend. Data tetap dilindungi oleh verifikasi email, PIN, sesi, dan RBAC di server. Jangan membagikan PIN Owner atau URL pengelolaan Apps Script.

---

## ⚡ Otomasi Intelligente (Auto-Trigger)

Ketika status Lead diubah menjadi **Deal Menang**, sistem akan secara otomatis:

1. ✅ Menulis baris **Pendapatan** ke tab Finance (kategori: DP Proyek)
2. ✅ Menulis baris **Antrean Proyek** ke tab Projects (status: plan, deadline +14 hari)
3. ✅ Menciptakan entri Klien baru jika belum ada

**Mekanisme idempoten**: token `[LEAD-{id}]` mencegah duplikasi baris meskipun trigger berjalan berulang kali.

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
7. Pilih **CSK Security → Setup PIN Owner & Tim**. Masukkan dua PIN berbeda (masing-masing 8–12 digit). **Jangan jalankan fungsi dialog ini melalui tombol Run di Apps Script Editor** karena dialog Spreadsheet memerlukan konteks UI.
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
| **Leads CRM** | Leads | ID, Tanggal, Nama, WA, Sumber, EstimasiNilai, Status, Catatan |
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
