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

## 🔐 Mode Tampilan dan Batas Keamanan

Dropdown Owner/Tim saat ini hanya mengatur tampilan menu di frontend. Dropdown tersebut **belum menjadi autentikasi atau pembatas hak akses di server**.

Backend mewajibkan satu API token global yang disimpan di Script Properties. Simpan token tersebut hanya pada perangkat Owner dan jangan membagikannya kepada Tim. Pemisahan token Owner/Tim dan verifikasi identitas email harus diselesaikan sebelum akses Tim dianggap aman.

Pengiriman cold email otomatis maupun manual dinonaktifkan sementara sampai kontrol akses Owner/Tim dan persetujuan server-side tersedia. Trigger cold outreach lama yang masih terpasang menjadi no-op setelah backend diperbarui.

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
5. Jalankan fungsi **`setupSheet`** sekali dan berikan izin yang diminta.
6. Jalankan fungsi **`setupCSKPinCredentialsFromPrompt`** sekali. Buat PIN Owner dan PIN Tim yang berbeda (masing-masing 8–12 digit). PIN disimpan sebagai hash di Script Properties, bukan di Spreadsheet.
7. Klik **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (akses data tetap membutuhkan sesi email + PIN yang diverifikasi server).
8. Deploy dan salin URL Web App yang berakhiran `/exec`.
9. Buka aplikasi. Masukkan URL Web App, email terdaftar, dan PIN pada layar login.
10. Opsional: jalankan **`installAutoTrigger`** sekali untuk otomasi Deal Menang.

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
