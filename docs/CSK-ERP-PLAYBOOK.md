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
- Advanced nesting optimization, stock/offcut inventory reservation and traceability, and full Sales Order workflow remain subsequent implementation phases. The current custom cut-list engine is an estimate and requires workshop validation.


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
