# CSK Business OS — Kalkulator HPP & Penawaran (staging)

**Status:** TERSEDIA DI BRANCH PENGUJIAN; **BELUM DI-MERGE / BELUM DI-DEPLOY PRODUKSI.**

Akses:
- Modul di `index.html` melalui menu **Hitung HPP & Penawaran** (desktop dan mobile).
- [Kalkulator mandiri untuk HP / offline](../preview/CSK-HPP-Kalkulator-Offline.html) — satu file HTML, tidak mengirim data ke Google Sheets.

## Aturan harga CSK

**Produksi + instalasi:** biaya pokok produksi (HPP dasar) x 2 (markup 100%). Biaya tambahan di luar HPP, seperti ongkir titipan, ditambahkan setelah markup dan tidak dikenai markup tambahan.

**Maklon siap pakai tanpa instalasi:** harga dasar/vendor tanpa markup (0%) sesuai kebijakan CSK. Biaya tambahan di luar HPP diteruskan sesuai nominal yang diisi.

Rumus:
- `subtotal_item = jumlah x harga_satuan x (1 + waste_percent / 100)`
- `HPP_dasar = SUM(subtotal_item material, jasa, finishing, vendor, instalasi yang termasuk HPP)`
- `biaya_tambahan = SUM(ongkir, parkir, biaya titipan di luar HPP)`
- `total_HPP = HPP_dasar + biaya_tambahan`
- `markup = HPP_dasar x (100% jika dengan instalasi, selain itu 0%)`
- `harga_penawaran = HPP_dasar + markup + biaya_tambahan`
- `estimasi_laba_kotor = harga_penawaran - total_HPP`
- `margin_kotor = estimasi_laba_kotor / harga_penawaran x 100%` (bila harga > 0)
- `harga_per_hasil = harga_penawaran / jumlah_produk_jadi`

**Contoh:** HPP dasar Rp760.000, ongkir + parkir di luar HPP Rp100.000, membutuhkan instalasi. Penawaran: Rp760.000 × 2 + Rp100.000 = **Rp1.620.000**; HPP semua biaya Rp860.000; potensi laba kotor Rp760.000. **Bukan nilai invoice final dan belum termasuk pajak.**

## Template material

- Rak Display Custom PVC: **PVC Board Nulite 5 mm 122×244 cm Rp175.000/lembar** (harga acuan yang sudah dikonfirmasi CSK, cek kembali pembelian aktual). Jasa potong/produksi harus diisi manual.
- Tripod Banner + Foamboard A1: **Rp70.000/paket** sebagai harga vendor CSK yang pernah dikonfirmasi; mode maklon tanpa instalasi 0% markup.
- Booth, signage/neon box, display akrilik: harga material/jasa **0** dan UI menandai belum lengkap sampai ada harga vendor terkini.

## Keamanan dan penyimpanan

- HPP tersimpan hanya di browser perangkat; `csk_hpp_local_draft_v1` dan `csk_hpp_local_quotes_v1` **terpisah** dari `csk_business_os_db` dan queue Safe Sync.
- **Tidak** mengubah database Leads, Projects, Finance, atau Google Sheets. Tidak ada koneksi API.
- Browser yang menghapus storage dapat menghilangkan riwayat. Gunakan **Unduh JSON** untuk mengamankan satu estimasi; JSON ini bukan bagian backup cloud maupun backup Business OS utama.
- Pemilihan jenis pekerjaan menentukan markup default; harga bahan/vendor harus diperiksa.
- Pajak/PPN belum termasuk, laporan kas tidak bertambah otomatis, dan belum ada alokasi HPP ke proyek atau integrasi RAB/Invoice.

## Pengujian
Jalankan `node hpp-calculator.test.js` dan GitHub Actions **Check Business OS safe sync**.
Tes meliputi penetapan markup, vendor tanpa markup, waste, biaya di luar HPP, unit cost, input invalid, sintaks UI, halaman kalkulator mandiri, dan pemisahan data dari cloud.

## Kriteria sebelum produksi
Tetap jangan merge PR #2 sebelum pengamanan sinkronisasi antarperangkat, otorisasi dan pengujian end-to-end selesai. Kalkulator dapat di-review sekarang pada preview offline, tetapi tidak boleh dianggap otomatis tersimpan di server.
