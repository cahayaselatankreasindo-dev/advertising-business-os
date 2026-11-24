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

Google Sheets (verified):
```
Leads:    258  (247 IndoBuildTech + 10 B2B + 1 lama)
Clients:  1
Projects: 2
Finance:  3
```

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

### 5.1 🔐 Status keamanan API

- Backend menggunakan autentikasi fail-closed: API_TOKEN wajib valid 64 karakter hex. Request tanpa token ditolak.
- Dropdown Owner/Tim di frontend masih merupakan mode tampilan, bukan otorisasi server-side.
- API_TOKEN masih satu token global. Jangan bagikan token Owner kepada Tim.
- Pemisahan token Owner/Tim dan verifikasi identitas email belum selesai.
- Cold outreach otomatis dan manual dinonaktifkan sampai kontrol akses serta persetujuan server-side diterapkan.
- Trigger cold outreach lama yang masih terpasang menjadi no-op setelah backend diperbarui.

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
node mapping.test.js    # 81 test, harus 0 gagal
```

---

## 7. Catatan Jujur

- **Vault Obsidian:** vault CSK ADA di **`G:\My Drive\CSK-Vault`** (31 note).
  BUKAN `E:\Document\Obsidian Vault` (itu vault kosong milik orang lain).
- **Jangan asumsi** file/fitur ada tanpa verifikasi. Selalu cek dulu.
- **Jangan push ke Sheets** tanpa menampilkan list ke user dulu (user pernah marah
  karena 247 lead di-push tanpa konfirmasi).


---

## 6. Update — 20 November 2026: Custom costing and Sales Order workflow

Current feature branch: `feature/hpp-material-conversion-20261120` in `cahayaselatankreasindo-dev/advertising-business-os`.

Delivered in the feature branch:
- Custom material costing for sheet/roll cut lists, profile/bar cut lists, pack conversion, area, linear length, and volume. Calculated costs can be added to HPP with price snapshots and costing details.
- Reference material/product/service catalog and Owner-only activation controls.
- Commercial quotation/invoice PDF improvements.
- Owner-only Sales Order dashboard and approved quotation conversion.
- Server-side Sales Order validation: one SO per approved quotation, immutable quotation snapshots, status transition controls, DP release gate from verified Invoice_Payments, and full-settlement gate before closure.
- New `Sales_Orders` sheet schema; new data collection is Owner-only and excluded from Team payloads and responses.
- Added regression tests and CI checks for custom costing, Sales Order engine, backend validation, and RBAC.

Important boundaries:
- The public Astro website repository is not modified.
- No merge to main, production deployment, Apps Script deployment, or live Google Sheets schema migration has been performed.
- The Sales Order phase does not yet reserve inventory, generate material pick lists, auto-create purchase requisitions, record receiving, track offcuts, or reconcile actual HPP.
- Before production, run the Apps Script schema setup/migration with Owner approval and verify the new Sales_Orders tab plus one end-to-end test quotation and payment.

Next phase: Inventory ledger, stock reservation, material requirements from HPP, purchasing requisitions, purchase order receiving, and offcut traceability. Keep each change inside this internal Business OS repository and its feature branch.


## 7. Update — 20 November 2026: Inventory ledger and PO receiving

Delivered on `feature/hpp-material-conversion-20261120` in the internal `advertising-business-os` repository:
- Owner-only Inventory & Stok page with balances and movement history.
- Opening, receipt, project issue, project return, adjustment in, and adjustment out movements.
- Append-only inventory ledger with server-side validation; no negative stock, duplicate opening balance, invalid unit, invalid project, or direct insert/delete bypass.
- PO-linked receipts validate the material, unit, and total quantity received against ordered PO lines.
- Purchase Order cannot be marked Received until all ordered material quantities are recorded. PO cannot be cancelled after any receipt.
- Added `Inventory_Transactions` sheet schema and Owner-only sync/read-back verification.
- Added Inventory engine, backend validation, PO receipt, mapping, RBAC, and CI regression tests.

Important operational boundary:
- Stock uses the usage unit configured on Material Master. Do not assume the system has inferred current stock; enter verified opening balances.
- Purchase-unit conversion for full packs/rolls, stock reservation from HPP, pick lists, reorder suggestions, supplier invoice matching, stock valuation, and offcut tracking remain future work.
- No live schema migration, Apps Script deployment, merge to main, or production deployment has been performed.
- Public Astro website repository remains untouched.

Next phase: derive material demand from approved HPP, reserve stock when Sales Order is released to production, issue/pick lists, and recommend purchasing from shortages. Then implement supplier receiving and purchase-unit conversions for packs/rolls.


## 8. Update — 20 November 2026: HPP material planning and draft PO suggestions

Delivered on the internal feature branch:
- Sales Order page compares project HPP material lines with current physical stock from the Inventory ledger.
- Converts HPP line quantities into Material Master stock units using the usage unit or verified purchase-to-usage conversion factor. Missing/invalid conversions are surfaced rather than guessed.
- Displays required stock, physical stock, shortage, quantity already covered by Draft/Ordered POs, and remaining quantity to purchase.
- Owner can generate supplier-grouped Draft POs from uncovered shortages. Drafts use Master Material supplier, unit, and unit price, and remain Draft until reviewed and ordered.
- Existing Draft/Ordered POs are deducted from new purchase suggestions to reduce duplicate ordering.

Limitations:
- The shortage view uses physical stock and does not subtract stock reserved by other Sales Orders. Reservation and pick-list workflow remain the next phase.
- Supplier and unit-price master data must be complete and current; verify before issuing POs.
- Draft PO generation does not reserve stock, issue orders, or update physical stock.
- Public Astro website repository remains untouched; no production deployment, Apps Script deployment, live migration, or merge has occurred.


### Compatibility note — Purchase Orders
New POs created by the current app carry `inventoryControlVersion: 1` and must satisfy receipt-ledger completion before status Received. Historical POs without the version field are exempt from the new completion gate so they do not block the first sync after deployment. Existing legacy data is not auto-converted into stock; only verified inventory transactions affect balances.

## 9. Update — 24 November 2026: Visual refresh and modernization direction

Current UI development branch: `feature/csk-colorful-ui-20261124`, based on `feature/hpp-material-conversion-20261120`.

Delivered:
- Added `csk-visual-refresh.css` as a visual-only design layer.
- Loaded the stylesheet from `index.html` and changed the PWA theme colour to CSK orange.
- Added a colourful but professional palette: deep indigo shell, CSK orange brand accent, and distinct blue/emerald/cyan/violet/pink/amber module accents.
- Restyled the desktop sidebar, dashboard hero, five KPI cards, content cards, tables, form focus states, and mobile navigation.
- Added reduced-motion and keyboard-focus treatments.
- Added `csk-visual-refresh.test.cjs` and included it in `.github/workflows/csk-security-tests.yml`.
- Added `CSK-BUSINESS-OS-ROADMAP.md` documenting the product workflow, target architecture, data model, business invariants, UI direction, and staged migration plan.

Verification:
- GitHub Actions run 440 passed, including all existing regression suites and the new visual-system test.
- GitHub Actions run 441 passed after the roadmap was added.
- These are source/CI checks; a real browser visual review across desktop, Android, and iPhone is still required.

Architecture decision:
- Do not rebuild the current Business OS from scratch.
- Keep the existing HTML/JavaScript + Apps Script + Google Sheets implementation as the reference baseline while improving the UI and auditing its data contract.
- Supabase PostgreSQL + Auth + Storage + Edge Functions is the recommended target for a staged modernization, but no CSK Supabase project is currently provisioned in the connected account.
- Do not create a new Supabase project until the owner selects the organization and reviews any quoted cost.
- Do not dual-write transactions to Sheets and Supabase. Keep one authoritative source at a time and use an isolated migration rehearsal before cutover.

Safety boundary:
- This branch is isolated and has not been merged to `main`.
- No public CSK website, production Google Sheet, Apps Script deployment, Script Properties, or production database was modified.
- No Supabase project, schema migration, or production cutover was created/performed.



---

## 14. Update keputusan Owner — 24 November 2026

- Fokus aktif hanya **CSK Business OS**, bukan website publik CSK.
- Jangan gunakan Supabase untuk fase sekarang. Jangan membuat project, mengubah database, menambahkan autentikasi kedua, atau merencanakan cutover. Supabase ditunda sampai Owner meminta kembali.
- Arsitektur aktif tetap frontend HTML/JavaScript + Google Apps Script + Google Sheets.
- PIN login yang ditargetkan adalah 4 digit. PIN lama 8–12 digit masih kompatibel sampai Owner menjalankan rotasi setelah Apps Script versi baru di-deploy.
- UI harus colorful, modern, premium, nyaman dipakai lama, dan responsif di desktop/iPhone/Android.
- Prioritas pengembangan: konsistensi semua modul, integrasi alur HPP → quotation/invoice → pembayaran → Sales Order → produksi → inventory/PO, sinkronisasi Sheets, serta pengujian sebelum rilis.
- Jangan merge ke `main`, deploy Apps Script, mengubah Script Properties, atau menulis data produksi tanpa persetujuan Owner.

## 9. Update — 24 November 2026: Commercial validation and cross-Sales-Order stock commitments

Delivered on `feature/hpp-material-conversion-20261120`:
- Commercial quotation/invoice editor now validates positive quantities, non-negative numeric unit prices, non-negative discount, discount not exceeding subtotal, tax rate from 0–100%, and DP from 1–99% before save.
- Blank quantity or unit-price fields are not silently accepted as zero.
- Apps Script independently validates new/financially changed quotation and invoice rows, recalculates subtotal/tax/total, and rejects mismatched snapshots. Unchanged legacy financial snapshots are skipped for compatibility.
- `apps-script/Code.gs` and `google_apps_script.js` remain byte-for-byte identical.
- Inventory engine now aggregates material commitments across active Sales Orders (Ready Production, In Production, Quality Control, Ready Delivery), deduplicates projects, converts verified purchase units, and nets project issues/returns against outstanding HPP demand.
- Inventory page displays physical stock, active commitments, estimated free stock, and shortage. Projects with missing HPP or invalid conversion are shown as unresolved rather than treated as zero demand.
- Added regression coverage for commercial input validation, backend total validation, cross-project stock commitments, project deduplication, issue/return netting, and unresolved HPP.

Validation: GitHub Actions source-checks and test jobs PASS on the latest feature branch commits.

Operational boundary:
- Cross-Sales-Order commitments are monitoring estimates, not persisted or locked reservations. They use the latest saved HPP, so changing HPP can change the estimate.
- No reservation ledger, automatic material issue, pick list, purchase-unit receiving conversion, merge to main, production Apps Script deployment, live Google Sheets migration, or public website deployment has been performed.
- Public Astro website repository remains untouched.

Next phase: design server-enforced stock reservation at production release, with explicit handling for partial issue/return and reservation release. Then add material pick lists and purchase-unit conversion at receiving. Keep the implementation on this internal feature branch until Owner review and migration planning.
