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


## 9. Update — 25 November 2026: Production reservation and picking

Delivered on the internal feature branch:
- Added Sales Order state `awaiting_material` / label `Menunggu Material`.
- A production-ready transition creates a frozen material requirement snapshot from HPP and reserves stock after other active projects' reservations.
- Snapshot is persisted in `Sales_Orders.MaterialRequirementsJSON`, validated against HPP by Apps Script, and immutable after reservation. Rework after QC reuses the frozen snapshot.
- Active reservations are derived for `ready_production` and `in_production`; QC releases unissued balance; rework reactivates reservation.
- Inventory page shows reserved/free stock and a project/material picking list. Picking opens a prefilled issue form.
- Server and client prevent over-issue beyond reservation, return beyond net issued, unreserved projects consuming reserved stock, and adjustment-out below reservations.
- Sales Order and inventory writes are validated and serialized under a ScriptLock in `sync_all`.
- No new reservation sheet was created; Sales Order snapshot plus the append-only inventory ledger is the single source of truth.

Verified on latest branch head before docs update:
- CSK Security Tests run 830: PASS.
- CSK business source regression checks run 721: PASS.
- Includes mapping, RBAC, Sales Order workflow/backend, inventory workflow/backend, PO receiving, HPP conversion, and reservation/picking regression coverage.

Release boundary:
- Public Astro website repository untouched.
- No Apps Script production deployment, live sheet migration, merge to main, or production release performed.
- Next phase: actual-versus-estimated HPP, material consumption variance, labor/machine time capture, and project margin reconciliation.


## 9. Update — 25 November 2026: printable warehouse picking list

- Added a branded A4 PDF generated per active production project from the current picking list.
- Includes project/SO references, HPP requirement, net issue, outstanding quantity, unit, physical check box, and warehouse handover signatures.
- PDF generation is read-only. It never creates an Inventory transaction or changes stock; warehouse must record the actual issue separately.
- CI passed after adding PDF generation and UI integration tests. Browser download/save still needs a manual check on iPhone Safari and desktop.


## 10. Update — 25 November 2026: project material usage report

- Sales Order detail now offers a branded, multi-page A4 PDF comparing HPP plan quantities with net project issues (issue less return), variance, and remaining HPP.
- The report labels whether it uses the frozen production snapshot or current unfrozen HPP.
- This is a quantity report only. Do not present net issued quantity as proven consumed quantity or as actual cost.
- Actual material cost comparison is now available using Moving Weighted Average and frozen HPP cost snapshots. Supplier invoice matching, landed-cost allocation, and complete project profit remain future work.
- CI: CSK Security Tests run 900 PASS; CSK business source regression checks run 773 PASS.


## 11. Update — 25 November 2026: Actual material cost valuation

Delivered on the internal feature branch:
- Inventory_Transactions mapping now appends immutable unitCost, totalCost, costSource, and costingMethod fields without moving existing columns.
- WAC inventory valuation replays the append-only ledger. Opening balances and manual receipts capture unit cost; PO receipts use the linked PO line price; issues and stock-out adjustments use the current weighted average.
- Project returns reverse the weighted-average cost of the project's net issued material. A later supplier receipt cannot change the cost assigned to an earlier project issue.
- Sales Order reservation snapshots freeze estimated HPP material quantities and estimated material costs. Sales Order detail shows estimated material cost, actual net issue cost, and cost variance.
- Historical rows without unit-cost snapshots can be valued using Master Material price as a fallback, visibly marked as estimated. No historical costs are fabricated or written back to the ledger.
- Actual material cost is not total HPP or project profit; labor, service, overhead, machine time, and scrap remain outside this phase.

Verification on latest observed PR head: CSK Security Tests PASS and CSK business source regression checks PASS. See PR #26 for current commit and checks.

Release boundary:
- No merge to main, Apps Script production deployment, live Google Sheets migration, or public website deployment.
- Before production use, Owner must verify opening stock unit costs, supplier PO line prices, manual receipt costs, and schema migration in a controlled copy.


## 12. Update — 25 November 2026: chronological valuation guard

- Client and Apps Script now reject a new stock movement dated earlier than the latest recorded movement for that material. This prevents a backdated receipt or issue from silently rewriting moving-average costs already assigned to other transactions and projects.
- Apps Script sorts multiple incoming new movements chronologically before validation so offline batches are checked in a deterministic order.
- CI covers both client and backend rejection of backdated movements.


## 9. Update — 25 November 2026: Material cost reconciliation PDF

Delivered on `feature/hpp-material-conversion-20261120`:
- Added Owner-only Sales Order action to download an actual-versus-estimated material cost report.
- New PDF API: `CSKPDF.normalizeMaterialCostReport`, `materialCostFilename`, `generateMaterialCostPdf`, and `downloadMaterialCostReport`.
- Uses landscape A4, branded project/SO header, HPP estimate, actual net issue cost, cost variance, per-material breakdown, valuation status, explanatory notes, and signature fields.
- Missing cost estimates remain null; incomplete actual valuation suppresses variance. Legacy Master fallback is visibly estimated.
- Report is provisional until delivery/closure and return reconciliation; it is not full project profitability.
- Tests cover normalization, unknown values, landscape page dimensions, pagination, and the Sales Order download action.

Release boundary remains unchanged: no merge to main, no live Apps Script deployment, no Google Sheets migration, and no public website change.


### Cost variance safety rule
The project-level cost variance is only computed when each HPP material has an issue/return movement, actual valuation is complete, every HPP cost estimate is known, and there are no unplanned actual material issues. Materials not yet issued show no per-line variance; incomplete costs do not become zero. The report remains provisional until order closure and return reconciliation.
