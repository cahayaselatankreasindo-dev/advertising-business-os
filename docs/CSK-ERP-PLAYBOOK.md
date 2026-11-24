# CSK ERP Playbook
## Standar Arsitektur, Analisis Bisnis, dan Pengembangan CSK Business OS

Dokumen ini menjadi pedoman kerja khusus untuk pengembangan Cahaya Selatan Kreasindo (CSK) Business OS. Pedoman ini menggabungkan disiplin ERP architecture, business analysis, manufacturing costing, inventory/procurement, sales operations, document automation, UI/UX, dan software quality assurance.

Dokumen ini bukan klaim bahwa sebuah plugin ERP eksternal telah terpasang. Ini adalah standar kerja proyek yang harus dipakai secara konsisten saat menganalisis, merancang, mengubah, dan menguji CSK Business OS.

## 1. Tujuan produk

CSK Business OS ditujukan menjadi sistem operasional terpadu untuk perusahaan advertising, printing, signage, display, dan custom fabrication.

Arah produk:
- Pengalaman sales document yang rapi dan mudah digunakan seperti platform invoicing modern (referensi alur Paper.id), tanpa menyalin merek atau antarmuka secara persis.
- Kalkulasi produk dan jasa yang bisa mengakomodasi pesanan custom.
- Master produk, material, jasa, supplier, dan satuan yang terstruktur.
- Alur quotation -> sales order -> produksi/pengadaan -> invoice -> pembayaran.
- Data transaksi dan dokumen saling terhubung sehingga input pelanggan/proyek tidak perlu diulang.
- Laporan biaya, penjualan, pembelian, stok, piutang, dan laba yang dapat ditelusuri.

Prinsip utama: sistem harus membantu owner mengambil keputusan dan menjalankan pekerjaan sehari-hari, bukan sekadar menambah menu.

## 2. Peran kerja lintas-disiplin

Setiap pekerjaan harus ditinjau menggunakan perspektif berikut:

1. ERP / Solution Architect
   - Menentukan modul, batas tanggung jawab, relasi data, alur transaksi, integrasi, dan migrasi.
2. Business Analyst
   - Memetakan proses nyata CSK, aktor, input, output, status, pengecualian, dan kebutuhan pengguna.
3. Manufacturing Cost Engineer
   - Menetapkan metode konversi satuan, formula material, waste, yield, proses mesin, tenaga kerja, overhead, dan margin.
4. Inventory & Procurement Specialist
   - Merancang SKU, supplier, satuan pembelian/pemakaian, penerimaan, pergerakan stok, sisa bahan, dan histori harga.
5. Sales Operations Specialist
   - Merancang pelanggan, katalog, quotation, revisi, persetujuan, sales order, invoice, termin, dan pembayaran.
6. Document Automation Engineer
   - Memastikan dokumen PDF konsisten, dapat diunduh/disimpan, dapat dicetak, dan memiliki nomor serta snapshot transaksi.
7. Full-stack Engineer
   - Menerapkan desain pada frontend, backend, Google Apps Script, Google Sheets, dan integrasi yang sudah digunakan proyek.
8. UI/UX Designer
   - Menyederhanakan alur input, membuat tampilan responsif, aksesibel, dan nyaman dipakai dari ponsel maupun desktop.
9. QA / Test Engineer
   - Menguji rumus, status transaksi, sinkronisasi, hak akses, ekspor PDF, regresi, dan skenario gagal.

## 3. Prinsip pengembangan yang tidak boleh dilanggar

- Audit kode dan struktur data sebelum mengubah implementasi.
- Jangan mengganti teknologi inti hanya karena teknologi baru terlihat lebih modern. Ajukan migrasi hanya jika ada alasan bisnis dan teknis yang terukur.
- Jangan menghapus, menimpa, atau mengubah arti data transaksi lama tanpa migrasi yang eksplisit dan dapat diuji.
- Simpan snapshot nama, spesifikasi, satuan, harga, diskon, pajak, dan total pada dokumen transaksi. Perubahan master harga tidak boleh mengubah dokumen historis.
- Jangan mengarang harga supplier atau menganggap harga indikatif sebagai harga beli aktual.
- Bedakan master data, transaksi, dan laporan.
- Gunakan ID stabil; jangan mengandalkan nama barang sebagai identitas.
- Validasi input di frontend dan backend.
- Semua nilai uang disimpan sebagai angka dengan aturan pembulatan yang konsisten; tampilkan dalam format Rupiah.
- Perhitungan harus memiliki unit yang jelas. Dilarang mengalikan kuantitas dengan harga jika satuan kuantitas dan satuan harga tidak cocok.
- Jangan menyatakan fitur selesai sebelum pengujian dan kriteria penerimaan lulus.
- Semua perubahan kode dilakukan pada branch pengembangan; jangan langsung mengubah main tanpa proses review.
- Hindari perubahan besar yang tidak terkait dalam satu commit.

## 4. Modul target dan batas tanggung jawab

### 4.1 CRM dan pelanggan
- Prospek/lead, pelanggan, kontak, alamat penagihan dan pengiriman.
- Riwayat komunikasi dan proyek.
- Satu pelanggan dapat memiliki banyak proyek dan dokumen.

### 4.2 Katalog produk dan jasa
- Produk jual standar.
- Produk rakitan atau hasil fabrikasi.
- Jasa desain, cetak, finishing, pengerjaan mesin, instalasi, pengiriman, dan jasa lain.
- Produk dapat memiliki bill of materials (BOM) atau resep material dan proses.
- Produk custom dapat dibuat melalui estimator tanpa harus membuat SKU permanen.

### 4.3 Master material
Data minimum per material:
- ID/SKU, nama, kategori, merek/grade, spesifikasi, warna/finishing.
- Ketebalan, lebar, panjang, diameter, ukuran lembar/batang/roll bila relevan.
- Satuan pembelian dan satuan pemakaian.
- Faktor konversi yang tervalidasi.
- Harga beli, supplier, tanggal berlaku, minimum order, dan sumber harga.
- Status aktif/nonaktif dan catatan.
- Dimensi dan atribut khusus menurut kategori.

### 4.4 Sales documents
- Quotation dengan versi/revisi dan masa berlaku.
- Sales order dari quotation yang disetujui.
- Invoice DP, invoice termin, dan invoice pelunasan.
- Bukti pembayaran dan status piutang.
- Nomor dokumen unik, tanggal, jatuh tempo, syarat, pajak, diskon, dan catatan.
- Dokumen yang diterbitkan menyimpan snapshot item dan harga.

### 4.5 Costing dan estimator
- Kalkulasi kebutuhan material berdasarkan ukuran dan metode produksi.
- Kalkulasi jasa dan proses.
- Waste/scrap, setup, minimum charge, dan pembulatan pembelian.
- Tenaga kerja, mesin, finishing, overhead, pengiriman, instalasi.
- Harga pokok, harga jual, laba nominal, dan margin.
- Simpan versi kalkulasi agar revisi estimasi dapat dibandingkan.

### 4.6 Procurement dan inventory
- Supplier dan price list supplier.
- Purchase request / purchase order.
- Penerimaan barang dan pemeriksaan kuantitas.
- Stok masuk, keluar, reservasi proyek, pemakaian produksi, retur, dan penyesuaian.
- Sisa potongan material dicatat sebagai offcut dengan ukuran dan kondisi; tidak otomatis dianggap dapat digunakan kembali sebelum dinilai.
- Histori biaya pembelian dan valuasi persediaan.

### 4.7 PDF dan document center
- Satu sumber data dokumen untuk tampilan layar, cetak, dan PDF.
- PDF harus bisa diunduh sebagai file, bukan hanya membuka dialog print.
- Tata letak A4, margin, page break, header/footer, nomor halaman, tabel multi-halaman, dan area tanda tangan diuji.
- Nama file terstruktur, misalnya QUO-CSK-2026-0001-NamaPelanggan.pdf.
- Dokumen yang sudah diterbitkan tidak berubah saat master data diperbarui.

### 4.8 Dashboard dan keuangan
- Penjualan, nilai quotation, conversion rate, order berjalan.
- HPP estimasi vs aktual jika data produksi tersedia.
- Piutang, pembayaran, pembelian, biaya, dan laba.
- Laporan harus menyatakan sumber data dan rentang tanggal.

## 5. Model satuan dan costing

Satuan dasar yang mungkin dipakai:
- Panjang: mm, cm, m.
- Luas: mm2, cm2, m2.
- Volume: cm3, m3, liter.
- Berat: g, kg.
- Hitungan: pcs, set, pack, box.
- Kemasan/bahan panjang: sheet/lembar, batang, roll, coil.

Setiap material harus memiliki satuan dasar pemakaian yang ditentukan. Konversi hanya boleh dilakukan antar-satuan yang kompatibel dan memiliki faktor yang jelas.

Contoh prinsip:
- Akrilik lembaran dapat dibeli per lembar dan dikonsumsi berdasarkan luas atau pola nesting/potong. Luas saja adalah estimasi; nesting lebih akurat karena memperhitungkan bentuk, arah, jarak potong, dan sisa.
- Multiplek/MDF dapat dibeli per lembar dan dikonsumsi melalui daftar potong. Jangan menganggap biaya luas terpakai selalu sama dengan biaya lembar yang harus dibeli.
- Hollow/profil dapat dibeli per batang dan dikonsumsi per meter atau berdasarkan cut list. Perhitungkan panjang batang standar, kerf, dan sisa.
- Sticker, flexi, dan media roll dapat dibeli per roll dan dipakai per meter lari atau luas sesuai lebar roll dan arah cetak.
- Baut/aksesori dapat dibeli per pack dan digunakan per pcs dengan faktor konversi pack-to-piece yang diketahui.
- Jasa dapat dihitung per unit layanan, m, m2, jam, titik, desain, atau proyek.

Formula umum:
- Material terpakai = kuantitas terukur x biaya per satuan pemakaian.
- Biaya pembelian aktual untuk kebutuhan produksi = jumlah kemasan/lembar/batang/roll yang harus dibeli x harga beli, setelah mempertimbangkan stok yang tersedia dan sisa layak pakai.
- Total biaya produksi = material + jasa pihak ketiga + tenaga kerja + mesin + finishing + overhead + biaya langsung lain.
- Harga jual berbasis target margin: harga jual = total biaya / (1 - margin target), jika margin dinyatakan sebagai persentase dari harga jual.
- Markup berbeda dari margin; UI dan laporan tidak boleh menggunakan istilah keduanya secara tertukar.

Formula final harus disesuaikan dengan proses nyata per kategori material dan diuji dengan contoh potong/beli aktual.

## 6. Taksonomi katalog awal

Kategori awal yang perlu ditinjau dan diperluas:
- Kertas: HVS, art paper, art carton, ivory, duplex, kraft, NCR, linen, fancy paper.
- Media cetak dan sticker: vinyl, chromo, transparan, one-way vision, backlit, frontlit, mesh, canvas, tarpaulin, photo paper.
- Kayu dan panel: multiplek/plywood, MDF, HDF, particle board, blockboard, veneer, kayu solid (misalnya jati, meranti, pinus, mahoni) dengan grade dan ukuran.
- Akrilik: clear, milky, warna, hitam, mirror, frosted, cast/extruded, ketebalan dan ukuran lembar.
- Plastik dan panel: PVC foam board, PP board, PET, polycarbonate, ACP.
- Logam: aluminium hollow/profil/siku, besi hollow/plat/siku/pipa, stainless steel, galvanis.
- Elektrikal: LED module/strip, power supply, kabel, konektor, sakelar, timer, komponen kelistrikan.
- Consumables: lem, sealant, double tape, baut, sekrup, rivet, cat, thinner, amplas, mata bor, mata potong.
- Jasa/proses: desain, printing, cutting, laser, CNC, bending, welding, assembly, finishing, instalasi, transportasi.

Daftar ini adalah struktur awal, bukan klaim bahwa setiap jenis/grade/ketebalan telah diverifikasi tersedia di supplier. SKU dan spesifikasi harus dinormalisasi agar tidak membuat duplikasi.

## 7. Alur transaksi target

Lead/pelanggan -> kebutuhan dan brief -> estimator/HPP -> quotation -> revisi/approval -> sales order -> procurement/reservasi stok -> produksi/instalasi -> invoice sesuai termin -> pembayaran -> penutupan proyek -> evaluasi biaya dan laba.

Pengecualian yang wajib dirancang:
- Quotation ditolak/kedaluwarsa.
- Revisi setelah quotation dikirim.
- Perubahan spesifikasi setelah sales order.
- Pembelian mendesak dan material substitusi.
- Pembayaran sebagian/terlambat.
- Pembatalan, retur, refund, dan pekerjaan ulang.
- Harga supplier berubah di tengah proyek.

## 8. Strategi PDF

Prioritas perbaikan:
1. Reproduksi masalah PDF saat ini dan catat browser/perangkat, jenis dokumen, serta langkah yang memicu kegagalan.
2. Pisahkan data dokumen dari layout.
3. Buat template quotation dan invoice yang konsisten.
4. Implementasikan ekspor file PDF yang benar-benar dapat diunduh/disimpan.
5. Uji dokumen satu halaman dan multi-halaman, tabel panjang, nama pelanggan panjang, angka besar, logo, font, tanda tangan, serta tampilan mobile/desktop.
6. Pastikan tombol preview, download, dan print memiliki fungsi berbeda dan jelas.
7. Simpan arsip atau tautan dokumen sesuai kontrol akses.

## 9. Strategi implementasi

Kerjakan secara bertahap dan rilis kecil:

Fase 0 — Audit dan baseline
- Petakan modul, struktur data, Apps Script, sinkronisasi, akses, dan seluruh alur dokumen.
- Buat daftar bug dan tes regresi sebelum perubahan.

Fase 1 — PDF dan sales documents
- Perbaiki simpan/unduh PDF.
- Standarkan quotation, sales order, invoice.
- Validasi nomor dokumen, snapshot, status, dan pembayaran.

Fase 2 — Master data
- Desain SKU, kategori, atribut, satuan pembelian/pemakaian, supplier, dan histori harga.
- Impor katalog awal tanpa mengarang harga.
- Dukung impor/ekspor dan deteksi duplikasi.

Fase 3 — Costing engine
- Implementasikan konversi satuan dan formula per kategori.
- Mulai dari sheet/board, akrilik, profil/batang, media roll, dan aksesori.
- Tambahkan jasa, tenaga kerja, mesin, waste, overhead, serta margin.

Fase 4 — Procurement dan inventory
- PO, penerimaan, stok, reservasi, pemakaian, offcut, dan penyesuaian.

Fase 5 — Integrasi dan dashboard
- Hubungkan seluruh transaksi dan laporan.
- Uji alur end-to-end dengan data proyek nyata yang telah disamarkan bila diperlukan.

## 10. Standar QA dan kriteria penerimaan

Fitur dinyatakan selesai hanya jika:
- Ada kriteria penerimaan yang disepakati.
- Formula diuji dengan contoh hitung manual.
- Satuan tidak dapat tercampur tanpa konversi yang sah.
- Harga lama pada transaksi tidak berubah ketika master harga diperbarui.
- Data tersimpan setelah refresh dan sinkronisasi.
- Hak akses diuji.
- Tidak merusak modul lain.
- PDF berhasil diunduh, dibuka, dicetak, dan terbaca pada perangkat umum.
- Ada uji kasus normal, batas, data kosong, data tidak valid, dan kegagalan jaringan.
- Perubahan dokumentasi dan catatan rilis diperbarui.

## 11. Cara kerja setiap perubahan

Setiap pekerjaan mengikuti format:
1. Masalah bisnis yang ingin diselesaikan.
2. Kondisi kode dan data saat ini.
3. Keputusan desain dan alasan.
4. Dampak pada modul/data lain.
5. Implementasi pada branch pengembangan.
6. Tes otomatis dan tes manual.
7. Hasil, risiko tersisa, dan cara rollback.
8. Persetujuan sebelum merge/rilis ke main.

## 12. Keputusan yang masih memerlukan data CSK

Jangan mengasumsikan:
- Daftar harga beli terkini.
- Supplier dan merek yang benar-benar digunakan.
- Ukuran standar bahan yang dibeli CSK.
- Tarif jasa internal dan eksternal.
- Upah tenaga kerja, tarif mesin, overhead, dan kebijakan waste.
- Pajak, termin, dan rekening perusahaan.
- Metode valuasi stok dan perlakuan offcut.

Data tersebut dikumpulkan dari price list supplier, invoice pembelian, daftar tarif, dan keputusan owner. Gunakan label "belum diverifikasi" sampai ada sumber.

---
Dokumen ini adalah pedoman hidup proyek dan harus diperbarui ketika keputusan arsitektur atau proses bisnis berubah.


## 13. Implementation status — 20 November 2026

### Delivered on the feature branch
- Added a standalone vector PDF engine for A4 commercial documents. It creates a downloadable PDF file rather than relying only on the browser print dialog.
- Added direct PDF download actions to standalone quotation/invoice documents, saved document history, and the legacy project invoice/quotation screen.
- Kept browser printing as a separate fallback.
- Added multi-page line-item handling, page numbering, totals, payment instructions, terms, and signature block.
- Added a reference catalog covering 41 material families and 41 product and service families across paper, stickers, wood/panels, acrylic, plastic/composite panels, roll media, metal profiles, electrical, consumables, and production services.
- Added an Owner-only catalog activation manager. A material cannot be activated until supplier, price source, price date, purchase price, purchase unit, usage unit, and conversion factor are provided.
- Extended Materials and Services sheet contracts by appending columns to the right. The original five Materials columns and original Services columns remain in their existing order.
- Added service unit and internal cost fields.
- Integrated service internal costs into project HPP: HPP line selection now supports both materials and services, and zero-cost services are blocked from costing until a base cost is entered.
- Added automated tests for PDF generation logic, pagination, catalog coverage, catalog activation, and data-contract compatibility.

### Validation
- CSK Security Tests: passed on the feature branch.
- CSK business source regression checks: passed on the feature branch.
- Apps Script deployment source and canonical backend copy are byte-for-byte identical.
- Existing Materials columns are preserved; new columns are appended by the existing safe schema migration mechanism.

### Not yet production-ready
- Manual download/open verification on iPhone Safari and desktop browsers is still required.
- The reference catalog is not a live supplier price list. No supplier prices are invented or preloaded.
- Catalog families and variant dimensions must be reconciled with the actual brands, sizes, grades, and stock units used by CSK suppliers.
- The live Google Apps Script deployment and production Google Sheet have not been migrated by this feature branch.
- Advanced nesting optimization, stock/offcut inventory reservation and traceability, and automatic purchasing from production requirements remain subsequent implementation phases. The current custom cut-list engine is an estimate and requires workshop validation.


## 14. Custom costing foundation — 20 November 2026

### Scope delivered on the internal Business OS feature branch
- Added a separate custom-costing engine and modal, loaded only by `advertising-business-os/index.html`; the public Astro website repository is not modified.
- Sheet/roll cutting estimator accepts multiple rectangular component sizes, quantities, sheet/roll dimensions, kerf, waste allowance, and optional 90-degree rotation. It uses a MaxRects-style best-short-side-fit heuristic and records placements, estimated sheet count, yield, and offcut area.
- Profile/bar cutting estimator accepts multiple cut lengths, quantities, stock length, kerf, and waste allowance. It uses first-fit decreasing bin packing and reports estimated bar count and remaining offcut length.
- Pack-to-piece calculator supports either prorated consumption cost or whole-pack purchase cost.
- Dimensional calculators support area (m²/cm²), linear length (m/cm), and volume (m³).
- Every calculated line carries a price snapshot and structured costing details into the existing HPP item snapshot. Existing Cost_Sheets JSON storage is reused; no new production table is required.
- Added `RollLengthM` separately from `PanjangMm` so roll media length is not stored in the wrong unit. Existing Materials columns remain in place and the new field is appended.
- Added automated tests for conversion formulas, cut-list limits, waste allowance, pack purchasing choices, and internal HPP integration.

### Formula and costing rules
- Sheet/roll purchase mode: required whole sheets/rolls × verified purchase price per sheet/roll.
- Sheet/roll stock mode: charged cut area (including kerf allowance) × purchase price per m² of the source sheet/roll.
- Bar purchase mode: required whole bars × verified purchase price per bar.
- Bar stock mode: charged cut length (including kerf) × purchase price per meter of the source bar.
- Pack consumption mode: actual usage × (pack purchase price ÷ verified units per pack).
- Whole-pack mode: ceiling(adjusted usage ÷ units per pack) × pack purchase price.
- Area, linear, and volume methods convert millimeter dimensions into the selected cost unit before applying the verified master unit price.

### Explicit limitations before production use
- Nesting and bar allocation are estimates, not certified CAM/CNC cutting plans. They do not yet model grain direction constraints beyond a rotate toggle, defects, clamps, saw paths, edge trimming, stock-specific offcut reuse, or multiple stock lengths.
- Stock/offcut mode is a proportional cost allocation. Actual inventory reservations and offcut traceability are part of the inventory phase.
- Waste allowance is applied conservatively per component line; owner should calibrate it against actual workshop yield.
- Validate sample outputs with CSK's real acrylic, plywood, hollow, flexi, and accessory purchase invoices before using the result in customer quotations.


## 15. Sales Order and production workflow — 20 November 2026

### Delivered on the internal Business OS feature branch
- Added an Owner-only Sales Order dashboard and a direct conversion action on approved quotations.
- A quotation can create only one Sales Order. Creation is idempotent and reuses/creates the linked project before persisting the order.
- Sales Order snapshots retain quotation number, client contact, project, order date, target delivery date, line items, total value, DP percentage, required DP amount, notes, and status history.
- Added a dedicated `Sales_Orders` Google Sheets tab. The tab is appended to the existing data contract; no existing sheet columns are moved or rewritten.
- Sales Order data is included in Owner sync and read-back verification. Team sessions do not receive Sales Order data and cannot write it through generic sync.
- Production release is gated by actual, server-verified invoice payments linked to the approved quotation. An invoice being issued or a lead becoming Deal Won does not count as cash received.
- Workflow statuses: `awaiting_dp` → `ready_production` → `in_production` → `quality_check` → `ready_delivery` → `delivered` → `closed`. QC may return an order to production for rework. Cancellation is allowed only before production begins.
- Closing requires all linked invoices to be fully paid in the server-side payment ledger.
- Server validates quotation approval, project linkage, one-order-per-quotation, immutable quotation/item/value snapshots, unique order numbers, allowed status transitions, verified DP, and fully paid closure.
- Added engine tests, backend validation tests, RBAC tests, mapping tests, and CI checks.

### Operational flow
1. Owner approves a quotation in Commercial Document Center.
2. Owner creates or opens its Sales Order. The system links the project and freezes the commercial snapshot.
3. Owner issues/opens the linked invoice and records DP only after funds are actually received.
4. Owner moves the order to Ready Production only after verified payments meet the agreed DP threshold.
5. Owner tracks production, QC, rework if needed, delivery, and final closure.
6. The order can be closed only after delivery and full settlement of linked invoices.

### Not yet included
- Inventory reservation and decrement of stock when a Sales Order enters production.
- BOM/material requirement explosion from approved HPP into material pick lists.
- Automatic PR/PO creation from shortages, receiving notes, supplier invoice matching, and stock ledger reconciliation.
- Offcut/leftover stock identification and traceability.
- Actual-versus-estimated HPP and job profitability reconciliation.

### Safety and release boundary
- Changes are confined to `advertising-business-os` on the existing feature branch. The public Astro website repository and its deployment are untouched.
- No production Google Sheet migration, Apps Script deployment, branch merge, or production release has been performed.
- Before release, run Apps Script schema setup/migration under owner supervision, verify the new Sales_Orders tab, test a sample approved quotation and actual DP payment, and manually check desktop/iPhone UI.


## 16. Inventory ledger and Purchase Order receiving — 20 November 2026

### Delivered on the internal Business OS feature branch
- Added an Owner-only Inventory & Stok page with current balance by material and a dated movement history.
- Added stock movement types: opening balance, receipt, issue to project, return from project, adjustment in, and adjustment out.
- Stock is recorded in the usage unit configured on the Material Master. The system does not assume opening stock; balances begin at zero until an opening or receipt transaction is recorded.
- Opening balance can be recorded only once per material and must be the first ledger movement for that material.
- Project issue and return require a valid project. Adjustments require a reason. Receipts require a supplier or a linked Purchase Order.
- PO-linked receipts validate material, unit, and cumulative received quantity against the ordered PO line. A receipt cannot exceed the PO quantity.
- New Purchase Orders carry an inventory-control version and can only be marked Received after all ordered material quantities have been recorded in Inventory. A PO with any receipt cannot be cancelled. Historical POs without the version flag remain compatible with initial sync.
- Inventory transactions are append-only. Existing ledger entries cannot be edited or deleted; corrections use adjustment transactions.
- Server-side validation recomputes the dated ledger and blocks negative stock, duplicate opening balances, invalid units, invalid project references, unapproved PO receipts, and excess PO receipt quantities.
- Added a dedicated `Inventory_Transactions` tab and Owner-only sync/read-back verification. Team sessions do not receive or write the inventory ledger.
- Added engine, backend validation, PO receiving, mapping, RBAC, and CI tests.

### Operational rules
1. Set opening stock once for materials already held before the system goes live.
2. Record every supplier receipt; when possible, link the receipt to an ordered Purchase Order.
3. The system tracks received quantity per PO line. Once all ordered quantities are received, the PO status changes to Received.
4. Record material issues against the project that consumes the stock.
5. Record returns when unused material returns from a project.
6. Correct count differences through a documented adjustment, never by editing/deleting the original movement.

### Not yet included
- Automatic stock reservation when a Sales Order is released to production.
- Material pick lists and BOM/requirement explosion from HPP into stock demand.
- Purchasing suggestions based on stock shortages and reorder points.
- Purchase-unit to usage-unit conversion at goods receipt for pack-based or full-roll purchasing; current PO quantities must use the material stock unit.
- Supplier invoice matching, landed cost, stock valuation methods (FIFO/average), lot/batch traceability, and offcut/leftover stock.
- Actual-versus-estimated HPP reconciliation and project profitability.

### Safety and release boundary
- Changes remain inside `advertising-business-os`; the public Astro website repository and deployment remain untouched.
- No production Google Sheet migration, Apps Script deployment, branch merge, or production release has been performed.
- Before release, create/verify the `Inventory_Transactions` tab through the Apps Script schema setup, load verified opening stock, and test a receipt linked to a real ordered PO plus a project issue.


## 17. HPP material demand and shortage-driven draft purchasing — 20 November 2026

### Delivered on the internal Business OS feature branch
- Sales Order detail now reads the project's saved HPP and compares its material lines with physical stock from the Inventory ledger.
- HPP quantities are normalized to the Material Master stock unit. If the HPP line uses the material usage unit, quantity is used directly; if it uses the purchase unit, the verified `conversionFactor` converts it into stock units. Unknown or missing conversions are surfaced as errors rather than guessed.
- The material plan displays required quantity, physical stock, shortage, quantity already covered by Draft/Ordered POs, and remaining quantity still to purchase.
- Owner can create Draft Purchase Orders from uncovered shortages. Lines are grouped by the supplier recorded in Material Master, use the material stock unit and its current master unit price, and remain Draft for Owner review.
- Existing Draft/Ordered PO quantities are subtracted so the same project/material shortage is not automatically ordered twice.
- Draft PO creation does not issue the PO, reserve stock, or change physical inventory. Owner must review supplier, price, quantities, and then mark the PO as Ordered.

### Operational boundary
- Physical stock is not reduced by other Sales Orders because stock reservation has not yet been implemented. The planner explicitly labels stock as physical and not reserved.
- Draft PO suggestions depend on complete supplier and unit-price data in Material Master. Missing data blocks generation and must be corrected first.
- Master unit price is a planning snapshot; reconfirm supplier quotations before issuing a PO.
- Automatic reservation, pick lists, stock issue from reservations, and actual-versus-estimated HPP remain future phases.


## 18. Commercial validation and cross-order inventory commitments — 24 November 2026

### Commercial document controls
- The standalone quotation/invoice editor rejects invalid quantity, blank or negative unit price, negative discount, discount above subtotal, tax rates outside 0–100%, and DP outside 1–99%.
- Apps Script independently recalculates the expected subtotal, tax, and total for new or financially changed documents. Mismatched totals are rejected before sheet writes.
- Existing unchanged legacy financial snapshots are not revalidated, preserving compatibility during transition.
- Canonical Apps Script source and deployment mirror remain byte-for-byte identical.

### Cross-Sales-Order material commitment monitoring
- Inventory engine aggregates current HPP material demand for Sales Orders in Ready Production, In Production, Quality Control, and Ready Delivery.
- Multiple active Sales Orders linked to one project do not duplicate that project's HPP demand.
- Material issues reduce outstanding commitments; project returns restore the outstanding requirement.
- Verified purchase-to-usage conversions are applied. Missing HPP and invalid conversions are surfaced as unresolved rather than treated as zero demand.
- Inventory UI distinguishes physical stock, active material commitments, estimated free stock, and shortage.

### Boundary and next phase
- This is a monitoring estimate, not a persisted or locked reservation. It uses the latest saved project HPP; HPP edits can change the estimate.
- No reservation ledger, automatic issue, pick list, or purchase-unit conversion at goods receiving is enabled yet.
- GitHub Actions source-checks and test jobs pass. No main-branch merge, Apps Script production deployment, live Google Sheets migration, or public website deployment has occurred.
- Next: implement server-enforced reservation at production release, including partial issue/return and reservation release, then material pick lists and purchase-unit receiving conversion.


## 19. Server-enforced production material reservation and picking — 25 November 2026

### Delivered on the internal Business OS feature branch
- Sales Orders can enter **Waiting for Material** after DP verification when the HPP is missing, invalid, or physical stock is insufficient.
- A Sales Order is released to **Ready Production** only after the backend verifies DP, HPP lines, material identities, units, conversion factors, and available stock.
- The backend stores an immutable MaterialRequirementsJSON snapshot on the Sales Order at first production release. Later HPP edits do not silently rewrite an active order's material commitment.
- Reservations are active while the Sales Order is in Ready Production or In Production. Moving to Quality Control releases any unissued quantity. Rework from QC reactivates the original snapshot, even if the current HPP has changed.
- The inventory page separates physical stock, reserved stock, available stock, and shortage. It also renders a project-level picking list with a prefilled issue action.
- Picking is recorded as an append-only issue transaction linked to the project. Each issue is limited by the project's outstanding reservation and available stock.
- Returns are linked to the project, cannot exceed prior net issues, and increase physical stock while reducing the project's net issued quantity.
- Backend validation prevents an unreserved project issue or stock adjustment from consuming stock already committed to active production.
- Inventory and Sales Order writes are serialized under a server lock during sync. The canonical Apps Script source and deployment mirror remain byte-for-byte identical.
- GitHub Actions runs are triggered for source regression and security checks; final conclusions are recorded only after the runs finish.

### Operational flow
1. Verify Master Material stock units, purchase units, conversion factors, and HPP lines.
2. Record verified opening stock and supplier receipts before releasing production.
3. Convert an approved quotation to Sales Order and record the required DP.
4. Release the Sales Order to production. The backend reserves the HPP material snapshot only when stock is sufficient.
5. Warehouse follows the picking list and records each partial issue against the project.
6. Record unused material returns against the same project.
7. Move the order to Quality Control when production is complete. Remaining unissued reservation is released.
8. If rework is required, return the Sales Order to In Production. The original HPP snapshot is reactivated and checked against current stock.

### Boundaries and release safety
- Reservation is a calculated commitment derived from Sales Order snapshots and the append-only stock ledger; it is not a second quantity ledger that can drift independently.
- Purchase orders and receipts still use the material stock unit. Pack/roll purchase-unit receiving conversion, offcut tracking, FIFO/average valuation, supplier invoice matching, and actual-versus-estimated HPP reconciliation remain future work.
- Changes are confined to the existing feature branch. No merge to main, Apps Script production deployment, Google Sheets migration, or public website deployment is performed by these source edits.
- Before release, run CI to completion, review the full diff, verify the Sales Orders and Inventory sheet headers through the controlled schema setup, and test with a real project using verified opening stock and supplier receipts.


## 18. Production material reservations and picking — 25 November 2026

### Delivered on the internal Business OS feature branch
- Added a `Menunggu Material` Sales Order status for orders whose DP is satisfied (or zero-DP) but whose HPP/material plan or available stock is not ready.
- When an order moves to `Siap Produksi`, the system creates a frozen material requirement snapshot from the project's HPP and checks stock availability after reservations held by other production projects.
- The snapshot is stored in the new `Sales_Orders.MaterialRequirementsJSON` column. It is immutable after the first production release; rework after Quality Control reuses the same snapshot even if the current HPP is edited later.
- Reservations are derived from Sales Order status plus the frozen snapshot and the project's net issue/return transactions. A project reserves material while the order is `Siap Produksi` or `Dalam Produksi`. Entering `Quality Control` releases the unissued balance; rework into production reactivates the original reservation.
- Inventory now shows physical stock, active reservation, free stock after reservations, reservation shortages, and a project/material picking list.
- The picking list opens a prefilled project issue transaction. The issue quantity is limited to the remaining reservation and available physical stock.
- Project issues cannot exceed the HPP reservation. Returns cannot exceed the quantity previously issued. An unreserved project cannot consume stock held for other active production projects. Stock adjustments cannot reduce stock below active reservations.
- Server-side validation recomputes reservations and stock balances under a script lock before committing Sales Order and inventory changes, preventing concurrent syncs from double-allocating the same stock.
- Sales Order material snapshots are validated against the authoritative HPP at first reservation. Existing active legacy orders without a snapshot continue to use current HPP for monitoring until a supported reservation transition creates a snapshot.

### Reservation rules
1. Physical stock is the quantity in the append-only Inventory ledger.
2. Reserved stock is the outstanding HPP quantity for projects in `Siap Produksi` or `Dalam Produksi`, less net material already issued to the project.
3. Available stock is physical stock minus all active project reservations.
4. Picking material reduces physical stock and the project's outstanding reservation by the same quantity.
5. A return increases physical stock and restores the project's outstanding reservation while production is active.
6. Quality Control releases any unissued reservation. Rework must pass the stock availability check before returning to production.

### Architecture and limitations
- No separate mutable reservation table was added. The frozen requirement snapshot lives on the Sales Order, and active reservation balances are derived from status plus Inventory transactions. This avoids a second source of truth.
- The current reservation unit is the Material Master stock/usage unit. Verified purchase-to-usage conversion is applied when the HPP snapshot is created.
- Actual-versus-estimated HPP reconciliation, production work orders, machine/labor time capture, finished-goods stock, and scrap/offcut accounting remain future phases.
- Changes remain inside `advertising-business-os`; the public Astro website repository is untouched. No live Apps Script deployment, production schema migration, merge to main, or production release has been performed.


## 19. Warehouse picking document — 25 November 2026

### Delivered on the internal Business OS feature branch
- Added a project-specific Material Picking List PDF action to the Inventory reservation panel.
- The PDF contains CSK branding, project and Sales Order references, generation date, material name, stock unit, frozen HPP requirement, net quantity already issued, remaining quantity to pick, and a physical check column.
- Long lists paginate across A4 pages and include warehouse handover signature fields.
- The document is generated from the current server-synced reservation and append-only ledger data. It does not create or change a stock transaction. Warehouse must still record each actual issue in Inventory.
- Added automated tests for filtering fully issued items, deterministic filenames, empty-list rejection, and multi-page A4 layout.

### Operational note
The PDF is a picking instruction, not proof of material issue. The Inventory issue transaction remains the source of truth for physical stock movement.


## 20. Material usage reconciliation report — 25 November 2026

### Delivered on the internal Business OS feature branch
- Sales Order HPP detail now offers a branded A4 PDF report for project material quantities.
- The report compares the HPP material plan with net material issued to the project (issue transactions less recorded returns), showing planned quantity, net issued quantity, variance, and remaining HPP quantity.
- When a frozen Sales Order material snapshot exists, the report explicitly identifies it as the source. Legacy orders without a frozen snapshot use the current HPP and label that source as not frozen.
- Long reports paginate and include project/SO identifiers, status, report date, and verification signature fields.
- The report is quantity reconciliation only. It does not claim that net material issued equals material consumed, does not value inventory, and does not calculate actual material cost or project profit.

### Next accounting prerequisite
Actual-versus-estimated material cost is now available in Sales Order detail using Moving Weighted Average and frozen HPP cost snapshots. The quantity PDF remains quantity-only. Supplier invoice matching, landed-cost allocation, and full project profitability remain future work.


## 21. Inventory valuation and actual material cost — 25 November 2026

### Delivered on the internal Business OS feature branch
- Added immutable inventory cost snapshots to new stock movements: unit cost, total cost, cost source, and valuation method. The fields are appended to the Inventory_Transactions sheet mapping; existing columns are not reordered.
- Implemented Moving Weighted Average (WAC) for inventory value and average unit cost. New opening balances and manual receipts capture a unit cost; PO-linked receipts use the unit price saved on the PO line.
- Project issues and stock-out adjustments use the weighted-average unit cost at the time of posting.
- Project returns use the weighted-average cost of that project's net issues, so a later supplier receipt with a different price does not rewrite the cost of material already issued to the project.
- Sales Order production reservation snapshots now freeze estimated HPP material quantity, estimated unit cost, and estimated total material cost.
- Sales Order detail compares estimated HPP material cost with actual net issue cost (issue cost less return cost), and displays the cost variance.
- Inventory shows current average unit cost, stock value, transaction-level unit/total cost, and cost source.

### Cost-source and historical-data rules
- `purchase_order`: cost is taken from the linked PO line and validated by Apps Script.
- `opening_manual` / `manual_receipt`: cost is entered by Owner for opening stock or a receipt not priced by a linked PO.
- `moving_average`: issue and stock adjustment cost is validated against the current WAC balance.
- `project_issue_average`: a project return reverses the cost of that project's net issued material.
- `master_fallback`: reserved for historical legacy rows or valuation paths where the original cost basis is missing. New opening balances and manual supplier receipts cannot use a Master price as a substitute for documented cost. Fallback-derived values are visibly marked as estimates.
- Historical Inventory rows are not rewritten to invent a cost history. Their valuation can use Master Material price as a visibly estimated fallback until the Owner reconciles original documents.

### Interpretation and boundaries
- The displayed actual material cost is the net cost of Inventory issues less returns. It is not a complete project profit calculation and does not include labor, services, overhead, machine time, scrap/offcut, or other non-material costs.
- The estimated material cost comes from the frozen HPP line subtotals. Missing HPP prices remain null and do not become zero-cost estimates.
- Owner must verify opening unit costs, manual receipt prices, supplier PO line prices, and the first stock valuation before production use. Do not treat fallback values or PO prices as supplier invoice reconciliation.
- No automatic valuation-method migration, historical ledger rewrite, live Apps Script deployment, Google Sheets migration, merge to main, or public website deployment has been performed.

### Test coverage
- WAC calculation after opening, supplier receipt, and project issue.
- Project returns retain original issue valuation after a later receipt changes the warehouse average.
- Backend rejects manipulated issue costs and PO receipt costs.
- HPP material cost snapshots are frozen at production release; missing cost estimates remain unknown rather than zero.
- Legacy cost fallback is flagged as estimated.


## 22. Actual material cost reconciliation PDF — 25 November 2026

### Delivered on the internal Business OS feature branch
- Added an Owner-only “Unduh Rekonsiliasi Biaya PDF” action in Sales Order material costing.
- Generates a branded landscape A4 PDF with project/Sales Order identifiers, HPP estimate, net material issue cost, cost variance, material-level quantities and costs, valuation completeness, and verification signatures.
- The PDF uses the frozen HPP material cost snapshot for released Sales Orders and the current HPP only for legacy orders that do not yet have a frozen snapshot; the source is explicitly labelled.
- The report marks incomplete cost data rather than treating missing values as zero. Legacy Master Material fallback is identified as an estimate.
- The report is marked temporary until the Sales Order is delivered/closed. Net issues less returns represent material cost assigned to the project, not proof that all issued material has been consumed.
- Long material lists paginate across landscape A4 pages.

### Accounting boundary
- This is a material-cost reconciliation report, not a full job-costing or profit-and-loss statement.
- Labor, service, machine time, overhead, scrap/offcut, wastage, taxes, and other project costs remain separate cost components.
- A final project margin must not be declared until all material returns, supplier invoices, labor/services, and project expenses are reconciled.

### Tests
- Cost report normalization preserves unknown HPP estimates as null.
- Landscape A4 dimensions, multi-page pagination, and download API are covered by PDF regression tests.
- Inventory cost variance is suppressed when actual cost valuation is incomplete.


### Cost variance completeness rule
- The project-level variance remains unavailable until every HPP material has at least one corresponding issue/return movement, all related transaction costs can be valued, all HPP estimated costs are known, and no unplanned material issue exists.
- A material with no issue/return activity is displayed as not yet issued, not as zero-cost savings. Per-material costs with missing valuation remain marked incomplete.
