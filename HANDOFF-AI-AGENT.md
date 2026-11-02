# HANDOFF — CSK Business OS (untuk AI Agent berikutnya)

> Dokumen ini ditulis 9 Okt 2026 oleh agen yang mengerjakan sesi fix bug besar.
> Tujuan: agen berikutnya langsung paham arsitektur & jangan merusak yang sudah dibetulin.

---

## 1. Apa ini

**Advertising Business OS** — aplikasi manajemen bisnis untuk **The Scales / CSK
(Cahaya Selatan Kreasindo)**, vendor booth pameran / POSM / signage / akrilik display.

Tiga bagian:

| Bagian | Teknologi | Lokasi |
|---|---|---|
| Frontend (UI) | 1 file HTML + Tailwind CDN + Chart.js | `index.html` (repo, auto-deploy GitHub Pages) |
| Backend (API) | Google Apps Script | `google_apps_script.js` → deploy ke Apps Script |
| Database | Google Sheets (6 tab) | spreadsheet "Database CSK Business OS" |

**Repo GitHub:** `cahayaselatankreasindo-dev/advertising-business-os` (branch `main`)
**Folder kerja:** `E:\THE SCALES ADVERTISING\advertising-business-os`
**Folder lead-gen:** `C:\Users\<user>\CSK-Scraper\` (scripts/ + data/)

---

## 2. ARSITEKTUR KRITIS — WAJIB DIBACA SEBELUM UBAH APA PUN

### 2.1 Backend = Google Apps Script, BUKAN file yang di-serve

`google_apps_script.js` di repo **bukan** yang jalan di server. Yang jalan adalah
salinan di editor Apps Script Google. Dua file itu harus disamakan.

**Cara deploy (SUDAH di-setup, jangan pakai paste manual lagi):**
```powershell
cd "E:\THE SCALES ADVERTISING\advertising-business-os"
.\deploy-backend.ps1
```
Script ini: copy `google_apps_script.js` → `apps-script/Code.gs`, `clasp push`, `clasp deploy`.

Prasyarat (sekali): `clasp login` sudah pernah dijalankan sebagai
`<email-akun-csk>`. Kredensial di `~/.clasprc.json` (jangan commit).

**Script ID & Deployment ID:** lihat `apps-script/.clasp.json` (jangan disebar ke luar).

### 2.2 ⚠️ BUG YANG SUDAH DIFIX — JANGAN DIKEMBALIKAN

**Masalah lama (fatal):** app auto-sync pakai `action: sync_all` yang memanggil
`overwriteSheet()` = **HAPUS semua baris, tulis ulang**. Karena app push seluruh isi
`localStorage` (yang isinya data demo), **setiap kali app menyimpan, Sheets ke-reset**.
Ini yang menghapus 247 lead IndoBuildTech user.

**Fix (commit `f6eb4bf`):**
- Backend: `sync_all` → `mergeSheet()` (MERGE/UPSERT by ID, **tidak pernah hapus**)
- Frontend: `pullAndMerge()` saat app buka → gabung cloud+lokal, bukan replace
- `delete` action baru (`c9108b8`) → tombol hapus app kini sinkron ke Sheets

**JANGAN** kembalikan `overwriteSheet` ke jalur `sync_all`. Test `mapping.test.js`
akan gagal kalau dikembalikan (itu memang sengaja).

### 2.3 Skema Sheet = FIELD_MAP (single source of truth)

`FIELD_MAP` di `google_apps_script.js` memetakan header Sheet ↔ field HTML (camelCase).
**Header-aware** — dipetakan by NAMA kolom, bukan posisi (tahan beda huruf besar/kecil).

Tab `Leads` sekarang 15 kolom (8 lama + 7 B2B baru di kanan):
```
ID, Tanggal, Nama, WhatsApp, Sumber, EstimasiNilai, Status, Catatan   ← lama (posisi TIDAK berubah)
Email, Website, Industri, PIC, JabatanPIC, LinkedIn, SkorPrioritas    ← B2B (ditambah di kanan)
```

Fungsi penting di backend:
- `ensureAllHeaders()` — tambah kolom kurang (case-insensitive)
- `dedupeHeaders()` — hapus kolom duplikat (mis. "TANGGAL" & "Tanggal")
- `mergeSheet()` — upsert by ID, header-aware
- `rowToRecord(sheet, row, headerRow)` — baca by nama kolom

### 2.4 Dua folder yang sering ketuker

| Folder | Status |
|---|---|
| `E:\THE SCALES ADVERTISING\advertising-business-os` | ✅ **AKTIF** (connect GitHub Pages) |
| `C:\Users\<user>\Owner Console CSK` | ❌ LAMA — jangan dipakai (bentrok) |

---

## 3. Kondisi Data Sekarang (per 9 Okt 2026)

Google Sheets (verified langsung 2 Nov 2026, read-only):
```
Leads:    284  (247 IndoBuildTech 2026 + 24 Apollo + 10 Prospecting B2B + 3 sumber lain)
Clients:  2
Projects: 3
Finance:  4
Memory:   1
Marketing_Spend: 1
```
Tidak ditemukan ID kosong atau duplikat ID pada enam tab. Jangan mengubah baris aktual tanpa rekonsiliasi dan persetujuan Owner.

Lead lokal (arsip mentah): `C:\Users\<user>\CSK-Scraper\data\`
- `b2b\test_batch_10_csk.xlsx` — 10 perusahaan B2B
- `indobuildtech\leads_csk_20261008.xlsx` — 247 exhibitor

---

## 4. Testing

```powershell
cd "E:\THE SCALES ADVERTISING\advertising-business-os"
node mapping.test.js    # 71 test, harus 0 gagal
```

Test ini memuat `google_apps_script.js` ke sandbox Node dengan stub SpreadsheetApp.
**Selalu jalankan sebelum & sesudah ubah backend.**

---

## 5. Isu & Status (per 9 Okt 2026, sesi lanjutan)

### 5.1 🔐 Keamanan API — PHASE 1 DI BRANCH `fix/phase-1-access-control`

Perubahan yang sedang disiapkan pada branch:
- Token terpisah `OWNER_API_TOKEN` dan `TEAM_API_TOKEN` di Script Properties.
- Tidak ada token valid = semua request ditolak (fail-closed).
- Token Tim hanya dapat membaca/menulis Leads, Clients, Projects.
- Finance, Memory, Marketing_Spend, dan cold email hanya untuk Owner.
- Role ditentukan server dari token, bukan nilai dropdown browser.
- Jalankan `setupApiTokens()` hanya setelah backend baru di-deploy; salin token sesuai role.
- Token tidak boleh disimpan di repository atau dibagikan antar-role.

**Status:** perubahan branch belum aktif di Apps Script produksi sampai PR ditinjau, digabung, dan backend dideploy. Jangan jalankan setup token sebelum backend baru terpasang.

### 5.2 🟢 Lead tidak muncul — SUDAH DIFIX

`sw.js` cache-first bikin app nyangkut di `index.html` versi lama.
Fix: **network-first** untuk HTML + bump cache `v2.4` (commit `466a419`).

### 5.3 🟢 `deploy-backend.ps1` — 2 bug difix

- `$PSScriptRoot` salah hitung → file tidak ketemu
- regex ambil deployment `@HEAD` (read-only) → kini ambil yang berversi (`@N`)
- Deploy terakhir berhasil: `@12`

### 5.4 ⚪ Apollo PIC enrichment

Apollo API key di env masih placeholder (`key-lu`), belum valid. Belum dikerjakan.

---

## 6. Test

```powershell
cd "E:\THE SCALES ADVERTISING\advertising-business-os"
node mapping.test.js    # jalankan suite; jumlah test mengikuti revisi terakhir
```

---

## 7. Catatan Jujur

- **Finance:** otomasi Deal Menang tidak boleh mencatat nominal proyek sebagai pendapatan. Catat DP/pelunasan hanya setelah pembayaran diterima dan diverifikasi.
- **Duplikasi:** konversi Lead menghasilkan Client/Project dengan ID stabil dan token [LEAD-{id}]. Jangan menghapus proyek/finance lama tanpa rekonsiliasi.
- **Database aktif per 2 Nov 2026:** lihat ringkasan pada bagian 3; jangan push ulang dataset demo.

- **Vault Obsidian:** vault CSK ADA di **`G:\My Drive\CSK-Vault`** (31 note).
  BUKAN `E:\Document\Obsidian Vault` (itu vault kosong milik orang lain).
- **Jangan asumsi** file/fitur ada tanpa verifikasi. Selalu cek dulu.
- **Jangan push ke Sheets** tanpa menampilkan list ke user dulu (user pernah marah
  karena 247 lead di-push tanpa konfirmasi).
