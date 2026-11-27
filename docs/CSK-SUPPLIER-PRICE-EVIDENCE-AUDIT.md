# Audit Bukti Harga Supplier — CSK Master Material

## Tujuan dan batas penggunaan

Dokumen ini mengatur pemeriksaan bukti harga supplier sebelum impor harga ke Master Material. Register CSV yang menyertai dokumen ini dibuat dari katalog seed pada head PR #56: **101 baris katalog, terdiri dari 100 SKU non-template dan 1 kode kelompok/template yang dikecualikan**.

Register dibuat kosong untuk seluruh data komersial. Tidak ada harga, nama supplier, nomor quotation, invoice, atau tautan dokumen yang diisi secara asumtif. **Jangan mengisi harga perkiraan.**

Dokumen supplier aktual bersifat rahasia. Jangan commit quotation, invoice, price list, atau harga supplier aktual ke repository GitHub. Simpan dokumen pada folder privat yang aksesnya dibatasi untuk Purchasing dan Owner. Kolom `evidence_file_ref` berisi tautan/path privat yang dapat dibuka oleh pemeriksa berwenang.

## 1. Pemetaan kolom CSV ke bukti sumber

| Kolom impor | Bukti sumber yang wajib diperiksa | Aturan audit |
|---|---|---|
| `sku` | Master Material dan baris item dokumen supplier | Harus cocok tepat dengan satu SKU non-template. Jangan membuat SKU baru dari file impor. |
| `name` | Nama/spesifikasi pada Master Material dan dokumen supplier | Cocokkan jenis, ukuran, ketebalan, warna, grade, dan spesifikasi lain yang tersedia. |
| `purchase_unit` | Quotation, invoice, atau price list | Harga harus berlaku untuk satuan beli yang sama dengan Master Material. |
| `usage_unit` | Master Material, BOM, atau standar produksi internal | Tidak ditentukan oleh harga supplier; harus sama dengan satuan pemakaian Master Material. |
| `conversion_factor` | Spesifikasi kemasan/panjang/isi supplier dan standar konversi internal yang disetujui | Wajib sama dengan Master Material. Jika berbeda, hentikan impor dan koreksi master melalui proses perubahan terpisah. |
| `purchase_price` | Quotation resmi, price list bertanggal/berlaku, atau invoice pembelian | Cocokkan nominal, basis satuan, diskon, pajak, ongkos kirim, dan syarat lain. Jangan mengubah basis harga diam-diam. |
| `supplier_name` | Identitas penerbit dokumen dan master vendor | Harus konsisten dengan supplier yang menerbitkan bukti. |
| `price_source` | Dokumen supplier asli dan register bukti | Wajib memakai referensi terstruktur VERIFIED seperti format pada bagian 2. |
| `price_date` | Tanggal mulai berlakunya harga pada dokumen supplier; jika tidak ada, tanggal dokumen yang disetujui sebagai dasar harga | Harus valid dan tidak lebih lama dari tanggal harga yang tersimpan. Catat tanggal dokumen dan masa berlaku secara terpisah di Evidence Register. |
| `waste_rate` | BOM, standar waste produksi, atau persetujuan teknis internal | Harus sama dengan Master Material; jangan menganggap waste supplier sebagai waste produksi. |

## 2. Format referensi bukti yang diwajibkan

Kolom `price_source` harus memakai enam bagian yang dipisahkan karakter pipa:

```
VERIFIED|JENIS_DOKUMEN|NOMOR_DOKUMEN|URL_ATAU_PATH_FILE|PEMERIKSA|YYYY-MM-DD
```

Jenis dokumen yang diterima:
- `QUOTATION`
- `INVOICE`
- `PRICE_LIST`
- `WRITTEN_CONFIRMATION`

Contoh format ilustratif, bukan dokumen atau harga nyata:

```
VERIFIED|QUOTATION|QT-2026-001|https://drive.google.com/file/d/FILE_ID/view|owner|2026-11-28
```

Ketentuan:
- Ganti seluruh nilai contoh dengan nomor dokumen, tautan file, identitas pemeriksa, dan tanggal verifikasi yang benar-benar ada.
- URL hanya boleh memakai HTTP/HTTPS. Path relatif harus menunjuk file PDF/JPG/PNG.
- Referensi maksimal 240 karakter karena disimpan pada field `SumberHarga` yang sudah ada.
- Format VERIFIED adalah kontrol sintaks dan jejak rujukan, **bukan bukti kriptografis keaslian dokumen**. Pemeriksa tetap harus membuka dan mencocokkan dokumen sumber.
- Jangan memasukkan formula spreadsheet atau teks yang diawali `=`, `+`, `-`, atau `@`.

## 3. Status Evidence Register

Gunakan status berikut untuk setiap SKU:

| Status | Arti | Boleh masuk CSV impor? |
|---|---|---|
| `PENDING_EVIDENCE` | Dokumen belum diterima atau belum diperiksa | Tidak |
| `VERIFIED` | Dokumen dibuka, sumber dan seluruh atribut cocok, pemeriksa serta tanggal tercatat | Ya, setelah referensi VERIFIED dibuat |
| `HOLD_CONFLICT` | Ada perbedaan harga, spesifikasi, satuan, tanggal, pajak, atau syarat | Tidak |
| `REJECTED` | Dokumen tidak valid, tidak dapat diverifikasi, atau bukan sumber yang dapat diterima | Tidak |

Kolom `evidence_verified_by` dan `evidence_verified_at` harus diisi saat status berubah menjadi VERIFIED. `price_source` disusun dari nomor dokumen, file reference, pemeriksa, dan tanggal verifikasi yang sama.

## 4. Pemeriksaan sebelum impor

1. Pastikan supplier dan dokumen sumber dapat diidentifikasi.
2. Buka file sumber; jangan mengandalkan nama file atau teks yang diketik.
3. Cocokkan SKU, nama, spesifikasi, harga, basis satuan, pajak, diskon, biaya tambahan, dan tanggal berlaku.
4. Cocokkan `purchase_unit`, `usage_unit`, `conversion_factor`, serta `waste_rate` dengan Master Material.
5. Catat nomor dokumen, tanggal dokumen, tanggal mulai/akhir berlaku, file reference, pemeriksa, dan hasil pada Evidence Register.
6. Tandai VERIFIED hanya setelah seluruh pemeriksaan lulus. Jika ada perbedaan, gunakan HOLD_CONFLICT; jika belum ada dokumen, biarkan PENDING_EVIDENCE.
7. Isi template impor hanya dari baris VERIFIED. Isi seluruh sembilan kolom wajib: SKU, harga beli, supplier, sumber harga, tanggal harga, satuan beli, satuan pakai, faktor konversi, dan waste.
8. Periksa pratinjau. Rekonsiliasi jumlah baris valid dan dilewati dengan Evidence Register sebelum menekan Terapkan.
9. Arsipkan CSV final yang dipakai dan salinan Evidence Register pada folder privat yang sama. Catat siapa yang mengimpor dan kapan.

## 5. Perlakuan untuk baris yang belum memiliki bukti

- Jangan isi harga dengan nol, perkiraan, harga lama tanpa dasar, atau harga supplier lain.
- Jangan isi `price_source` dengan TBD, nama supplier saja, atau keterangan dokumen yang tidak dapat dibuka.
- Biarkan harga dan supplier kosong pada Evidence Register; pertahankan `PENDING_EVIDENCE`.
- Keluarkan baris tersebut dari CSV impor. Jika sudah telanjur ada di CSV, sistem harus menolaknya karena field bukti VERIFIED tidak valid.
- Untuk konflik, jangan memilih salah satu harga berdasarkan perkiraan. Minta klarifikasi supplier dan catat hasilnya.

## 6. Batas aktivasi Draft SKU

- Impor harga hanya memperbarui harga dan sumber pada master; status Draft tetap Draft.
- Menyimpan/edit Draft dengan harga lengkap tidak mengaktifkannya.
- SKU baru selalu dibuat sebagai Draft.
- SKU Nonaktif tetap Nonaktif ketika diedit.
- Aktivasi hanya melalui tindakan Owner yang eksplisit dan harus lulus pemeriksaan harga positif, satuan, konversi, waste, supplier, tanggal, dan referensi bukti VERIFIED.
- Kode kelompok/template tidak dapat diaktifkan.
- Harga yang sudah diimpor tidak dengan sendirinya membuktikan bahwa material siap dipakai untuk HPP, PO, atau stok.

## 7. Kontrol teknis dan batas TEST

- Importer tetap Owner-only, melakukan preview dan validasi ulang sebelum penyimpanan.
- Kolom satuan beli, satuan pakai, faktor konversi, dan waste sekarang wajib ada dan harus cocok dengan Master Material.
- Tidak ada perubahan skema Google Sheets/Apps Script pada pekerjaan ini. Referensi bukti disimpan dalam field sumber harga yang sudah tersedia; register lengkap tetap menjadi arsip audit privat.
- Tidak ada harga supplier aktual yang diisi oleh pekerjaan ini.
- Acceptance Apps Script/Google Sheets TEST dan QA perangkat nyata tetap menjadi gerbang terpisah.
- Tidak ada merge ke `main`, deployment Apps Script, migrasi, atau perubahan produksi.
