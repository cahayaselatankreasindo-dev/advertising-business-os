# Foto Laporan Proyek CSK — Drive Privat (LAB / DRAFT)

**Status: hanya PR draft Business OS #2. Folder Drive LAB dibuat privat. Kode uploader belum dipasang sebagai Apps Script dan belum ada pengujian HTTP langsung/unggah foto asli. Tidak boleh merge atau deploy produksi.**

## Alur yang disiapkan

1. Owner membuka **Operasional Terpadu → QC Produksi** di Business OS draft, memilih proyek CRM dan tahap kerja.
2. Owner memasukkan URL **uploader Apps Script LAB terpisah** lalu klik **Buka Upload Foto Proyek Privat**. Business OS hanya membuka tab baru dengan `projectId` dan `stage`; foto **tidak** dikirim oleh halaman Business OS maupun disimpan dalam backup lokal Operations.
3. Uploader Apps Script memeriksa email user aktif dan efektif adalah owner; akses kosong/salah ditolak. Server memastikan target folder bernama LAB, privat, tanpa editor/viewer lain dan Sheet metadata mempunyai marker LAB.
4. Owner memasukkan catatan dan memilih 1–6 foto; browser mengecilkan gambar ke maksimal 1600 px dan 1,8 MB per file, membuat JPEG baru agar EXIF/lokasi asli tidak diteruskan.
5. Setelah owner mengaktifkan `CSK_PHOTO_ENABLE_WRITE=true` **khusus LAB**, server menyimpan blob ke Drive LAB privat, lalu mengindeks `ReportID`, waktu, ID proyek, tahap, caption, file ID, nama asli, mime, ukuran, dan akun owner pada Sheet LAB terpisah.
6. Riwayat 100 foto per proyek dapat dilihat pada uploader privat dengan tautan Drive yang tetap memerlukan izin owner. Catatan QC lokal tidak otomatis diubah oleh upload.

## Folder dan penyiapan owner (JANGAN lakukan di proyek produksi)

- Folder baru: **LAB - Foto Laporan Proyek Business OS (DRAFT)**, berada di bawah **Manajerial Internal CSK**; akun owner `cahayaselatankreasindo@gmail.com`, metadata folder saat dibuat menunjukkan `shared=false` dan hanya pemilik.
- **Tidak** mengubah berbagi folder Drive lama dan **tidak** membuat Sheet metadata di spreadsheet produksi.
- Buat **proyek Apps Script baru**, bukan proyek yang sudah digunakan Business OS. Salin `photo-lab/Code.gs`, `photo-lab/Index.html`, dan manifest `photo-lab/appsscript.json` ke proyek baru (manifest mengunci akses awal ke `MYSELF`).
- Isi **Script Properties** (bukan source code, GitHub, atau URL):

  | Key | Nilai awal / aturan |
  | --- | --- |
  | `CSK_PHOTO_OWNER_EMAIL` | Email owner CSK yang masuk ke Apps Script |
  | `CSK_PHOTO_LAB_FOLDER_ID` | ID folder Drive LAB privat baru; jangan pilih folder produksi |
  | `CSK_PHOTO_ENABLE_WRITE` | `false` sampai uji akses dan persetujuan owner |
  | `CSK_PHOTO_LAB_SPREADSHEET_ID` | **Kosong** sebelum setup; fungsi setup mengisinya otomatis |

- Jalankan `setupPhotoLab()` **sekali** secara manual dari editor proyek LAB. Fungsi ini membuat **spreadsheet baru** bertanda `CSK_PHOTO_LAB_ONLY_V1` di dalam folder LAB dan merekam ID-nya pada Script Properties. Tidak pernah menerima spreadsheet produksi sebagai lokasi tulis: sheet harus bernama tepat `CSK PHOTO LAB - Business OS (DRAFT)`, memiliki marker LAB, dan benar-benar berada dalam folder LAB.
- Buat deployment Web App **baru** dengan eksekusi **sebagai owner** dan akses **Only myself / Hanya saya**. Jangan gunakan setting Anyone, Anyone with link, atau domain-wide. Jika `Session.getActiveUser().getEmail()` kosong di deployment, sistem sengaja menolak akses: periksa konfigurasi, jangan matikan pemeriksaan identitas.
- Uji dengan satu foto dummy tanpa informasi pelanggan, lalu pastikan file dan metadata tercatat dan akun lain **tidak** bisa membuka uploader, folder, maupun file. Setelah itu baru izinkan foto internal yang benar.
- Gunakan URL deployment LAB berakhiran `/exec` pada kotak URL di tab QC. URL tersimpan **hanya di browser itu** (`csk_photo_lab_uploader_url_v1`) dan tidak otomatis terbawa ke perangkat lain.

## Batasan dan gate rilis

- **Belum live:** kode disiapkan tetapi belum dibuat sebagai proyek Apps Script baru, belum ada URL deployment LAB, `CSK_PHOTO_ENABLE_WRITE` belum diaktifkan, dan belum ada foto pelanggan yang diunggah.
- `photo-lab.test.js` menjalankan tes unit dengan mock Google Apps Script dan bukan pengujian terhubung ke Drive/Spreadsheet secara nyata. Pastikan uji manual owner dan uji dengan akun lain sebelum aktif.
- Tidak ada sinkronisasi QC, bukti pembayaran, dan proyek utama otomatis. Foto bisa terkait ID proyek yang diambil dari URL; server hanya memvalidasi format ID, **belum** mencocokkan dengan daftar CRM produksi. Owner harus memeriksa proyek yang dipilih.
- Penyimpanan blob Drive dan penulisan baris Sheet **tidak satu transaksi atomik**. Jika metadata gagal, sistem mempertahankan file dan mengembalikan status **butuh pemeriksaan**, bukan menghapus file atau mengklaim sukses penuh. Jangan unggah ulang sebelum memeriksa duplikasi.
- Google Drive/Sheets punya kuota dan batas penggunaan. Siapkan audit retensi, backup folder privat, review izin, batas kapasitas, dan pemulihan sebelum operasi resmi.
- Simpan foto pekerjaan yang pantas; hindari KTP, kartu bank, dokumen kontrak sensitif, dan wajah orang tanpa dasar pemrosesan/izin.
- PR #2 tetap **draft, tidak merge/deploy**. Gate Safe Sync produksi yang belum lulus tetap berlaku secara terpisah: autentikasi backend, lock/versi atomik, browser HTTP/CORS, stale PWA, backup dan uji mobile.
