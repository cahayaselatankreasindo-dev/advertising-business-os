# CSK Business OS — Operations Suite (6 Sistem, STAGING)

**Status: branch draft PR #2 saja. Belum merge, belum deploy, tidak mengubah Sheets, Apps Script produksi, atau CRM.**

## Ringkasan modul

| Modul | Input | Hasil / aturan |
| --- | --- | --- |
| Follow-up Tracker | Referensi ID dari Leads CRM, tanggal, kanal, catatan | Tugas terjadwal/selesai, jumlah follow-up jatuh tempo. Tidak mengirim WA/email otomatis. |
| Quotation & RAB | Lead CRM + satu estimasi HPP tersimpan dan lengkap | Membekukan harga/HPP saat penawaran dibuat, status Draft → Terkirim → Diterima/Ditolak; unduh dokumen penawaran HTML untuk dicetak PDF. RAB biaya internal diekspor dalam JSON **terpisah**. |
| Supplier Pricebook | Nama supplier, kategori, material/jasa, harga, unit, tanggal, kontak | Catatan harga yang bisa diperbarui. Harga supplier **belum** otomatis menggantikan biaya di HPP. |
| Invoice & Payment | Penawaran berstatus Diterima, nomor invoice, tanggal/jatuh tempo, pembayaran aktual | Saldo invoice, DP/pelunasan, piutang jatuh tempo, unduh HTML untuk dicetak PDF. Tidak otomatis mencatat pemasukan di Finance. PPN belum dihitung. |
| Production & QC | Proyek CRM, tahap kerja, hasil, catatan | Progres delapan tahap, log masalah/QC. Tidak mengubah status proyek utama. Tombol foto membuka uploader Google Drive privat LAB terpisah; log QC lokal tetap tanpa lampiran. |
| Marketing Attribution | Lead CRM, kanal, nama campaign/UTM, tanggal, bukti | Jumlah lead unik, penawaran, penawaran diterima, dan kas invoice yang **tertambat secara manual** ke satu campaign tak ambigu. Lead multi-touch tidak dialokasikan ke angka kas untuk mencegah penghitungan ganda. Tidak mengklaim ROAS atau sebab-akibat. |

## Cara memakai

1. Buka menu **Operasional Terpadu · 6 Sistem** di sidebar atau tombol **Ops** pada navigasi HP.
2. Pilih salah satu dari enam tab. Form membaca daftar lead/proyek dari CRM aktif, tetapi menulis data baru hanya ke penyimpanan lokal Operations Suite.
3. Untuk penawaran, buka **Hitung HPP & Penawaran** terlebih dahulu, lengkapi semua harga dan **simpan estimasi**. Setelah itu pilih estimasi tersebut pada tab **Penawaran & RAB**.
4. Ubah status penawaran menjadi **Diterima** berdasarkan persetujuan klien sebelum membuat invoice. Catat pembayaran **hanya ketika uang benar-benar diterima**.
5. Gunakan tombol **Unduh Backup** secara berkala. Tombol **Gabungkan Backup** hanya menambah ID yang belum ada; ID yang sudah ada tidak ditimpa. Impor memerlukan persetujuan pengguna dan divalidasi sebelum disimpan.

## Penyimpanan dan batasan

- Storage key baru: `csk_ops_local_v1`. Terpisah dari `csk_business_os_db`, antrean Safe Sync, `csk_hpp_local_quotes_v1`, dan `csk_email_marketing_local_v1`.
- Versi pertama **lokal per browser/perangkat**, bukan sinkron lintas perangkat. Menghapus data aplikasi/browser dapat menghilangkan catatan. Backup JSON memuat informasi bisnis sehingga harus dijaga privat.
- Data Operations tetap tanpa POST/GET API, Gmail, WhatsApp, MailApp, Google Sheets, atau integrasi Finance otomatis. Khusus foto, UI hanya membuka URL uploader LAB privat di tab baru setelah pemilik mengonfigurasinya.
- Nomor penawaran/invoice diisi manual agar tidak terjadi tabrakan nomor lintas perangkat. Validasi keunikan lintas perangkat baru bisa diterapkan setelah database server dan mekanisme atomic revision siap.
- Dokumen pelanggan yang diunduh adalah **HTML siap cetak**, bukan PDF terbitan otomatis; buka lalu pilih Print/Simpan PDF. Periksa identitas, pajak, termin, diskon, dan rincian pekerjaan sebelum dikirim.
- Dokumen penawaran pelanggan **tidak menampilkan HPP internal**. Untuk analisis biaya, gunakan ekspor **RAB Internal JSON** yang tidak boleh diberikan kepada pelanggan.
- Modul tidak membuat diskon/PPN otomatis, faktur pajak, pembayaran bank, tracking WhatsApp, reminder terjadwal, atau otomatisasi iklan.
- Role Owner/Tim dalam frontend adalah tampilan, bukan autentikasi server. Jangan mengumumkan sistem siap produksi sebelum gate keamanan PR #2 terpenuhi.

## Integrasi produksi berikutnya (belum dilakukan)

1. Backend dengan validasi user, LockService, expectedVersion, dan otorisasi server.
2. Migrasi data lokal per koleksi menggunakan ID, cek duplikasi, backup dan simulasi restore.
3. Integrasi quote/invoice dengan Finance melalui jurnal aktual terverifikasi, bukan nilai deal.
4. Fitur foto QC privat **baru tahap draft terpisah** (lihat `docs/photo-reports-staging.md`); bukti pembayaran dan dokumen persetujuan desain belum terintegrasi.
5. Pengujian multi-perangkat, race condition, PWA lama, offline/retry, dan rollback sebelum rilis.

Pengujian lokal: `node operations.test.js`. Workflow GitHub Actions menjalankan pemeriksaan Operations dan Safe Sync di branch draft.
