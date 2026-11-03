# Foto Laporan Proyek CSK — Google Drive Privat (LAB / DRAFT)

**Status per 2 November 2026:** owner telah membuat dan men-deploy Apps Script Web App dengan akses **Only myself**. Satu foto dummy berhasil diunggah; owner mengonfirmasi file muncul di folder Google Drive LAB dan baris metadata muncul di tab `Photo_Reports`. Integrasi launcher pada Business OS sedang dikerjakan di PR #2 branch draft; belum masuk produksi.

## Alur operasional

1. Owner membuka **Operasional Terpadu → QC Produksi** pada Business OS.
2. Pada bagian **Foto Laporan Proyek**, masukkan URL Web App LAB berakhiran `/exec` dan klik **Simpan URL Uploader LAB** satu kali pada browser tersebut.
3. Pilih proyek dari daftar CRM dan tahap pekerjaan pada form dokumentasi foto. Nama proyek diambil dari judul proyek CRM; ID proyek ikut diteruskan sebagai parameter.
4. Klik **Buka Upload Foto Proyek Privat**. Business OS membuka tab Apps Script terpisah dengan `projectId` dan `stage` terisi otomatis.
5. Di uploader, owner menulis caption dan memilih 1–6 foto. Browser mengompresi gambar hingga maksimal 1.600 px dan 1,8 MB per foto, lalu membuat JPEG baru agar EXIF/GPS foto asli tidak ikut diteruskan.
6. Apps Script memeriksa identitas owner, folder privat, spreadsheet LAB, marker, dan header metadata sebelum menerima upload.
7. Foto disimpan di Drive LAB privat. Baris metadata mencatat ID laporan, waktu, ID proyek, tahap, caption, file ID, nama asli, mime, ukuran, dan email owner.
8. Riwayat foto proyek tersedia di halaman uploader. Tautan Drive tetap memerlukan izin akun owner.

Business OS **tidak mengirim file foto melalui server atau menyimpan foto dalam backup lokal**. Foto juga tidak otomatis mengubah status proyek, checklist SOP, atau catatan QC. Catatan QC dan dokumentasi foto tetap dua aktivitas terpisah agar tidak membuat status pekerjaan fiktif.

## Infrastruktur LAB yang sudah disiapkan

- Folder: **LAB - Foto Laporan Proyek Business OS (DRAFT)**.
- Spreadsheet: **CSK PHOTO LAB - Business OS (DRAFT)**, berada di folder LAB dan memiliki tab `_CSK_PHOTO_LAB` serta `Photo_Reports`.
- Tab metadata menggunakan header tetap: `ReportID, UploadedAtUTC, ProjectID, Stage, Caption, DriveFileID, OriginalName, MimeType, Bytes, OwnerEmail`.
- Proyek Apps Script terpisah dari Apps Script Business OS. Jangan menyalin kode Photo LAB ke backend produksi.
- Web App berjalan sebagai owner dan aksesnya **Only myself**. Jangan ubah ke Anyone, Anyone with link, atau akses domain.
- Script Properties saat uji operasional: `CSK_PHOTO_OWNER_EMAIL`, `CSK_PHOTO_LAB_FOLDER_ID`, `CSK_PHOTO_LAB_SPREADSHEET_ID` terisi sesuai LAB; `CSK_PHOTO_ENABLE_WRITE=true` agar owner dapat mengunggah. Set `false` hanya bila ingin menghentikan penerimaan upload sementara.
- URL Web App disimpan di browser Business OS melalui localStorage key `csk_photo_lab_uploader_url_v1`. URL tidak dimasukkan ke source code, GitHub, atau backup data. Pengaturan ini harus diulang jika memakai browser/perangkat lain.

## Pengamanan dan batasan

- Pemeriksaan server mensyaratkan email user aktif dan efektif sama dengan email owner. Identitas kosong atau berbeda ditolak.
- Folder dan spreadsheet harus privat, tidak memiliki viewer/editor lain, dan harus berada pada lokasi LAB yang benar. File foto tidak diberi akses publik.
- Server memvalidasi format ID proyek dan tahap, tetapi belum mencocokkan ID tersebut terhadap daftar CRM di server. Karena itu, pilih proyek dengan benar dari Business OS.
- Upload foto dan penulisan metadata bukan satu transaksi atomik. Jika file sudah masuk Drive tetapi penulisan metadata gagal, sistem mengembalikan status perlu pemeriksaan; jangan langsung mengunggah ulang.
- Retry menggunakan UUID unggahan yang sama untuk mencegah file duplikat setelah respons terputus. Memilih ulang file dapat menghasilkan UUID baru; periksa riwayat sebelum mengulang.
- Batas penggunaan: maksimal 6 foto per batch, 1,8 MB setelah kompresi per foto, dan 100 laporan terakhir ditampilkan per proyek.
- Hindari mengunggah KTP, kartu bank, dokumen kontrak sensitif, atau wajah orang tanpa dasar pemrosesan/izin.
- Uji upload dummy telah dilakukan oleh owner. Pengujian aktif memakai akun non-owner belum dilakukan; jangan pernah melonggarkan pengaturan **Only myself** atau pemeriksaan identitas untuk mengatasi masalah akses.

## Status rilis

- Photo LAB: **berhasil untuk uji upload owner** ke Drive privat dan pencatatan metadata.
- CI browser smoke test Playwright pada desktop dan mobile: **PASS** untuk nama proyek CRM, validasi URL uploader, penerusan `projectId`/`stage`, tidak ada POST foto dari Business OS, dan layout mobile. Tes ini memakai URL Apps Script dummy yang di-stub; **bukan** panggilan HTTP ke deployment LAB sungguhan.
- Integrasi Business OS: **draft branch PR #2**; launcher memilih proyek CRM, meneruskan ID dan tahap, serta membuka uploader terpisah. Perubahan ini belum di-deploy ke produksi.
- PR #2 tetap **draft** dan tidak boleh di-merge atau di-deploy sebagai produksi sebelum seluruh gate Safe Sync, backup/restore, autentikasi server-side, dan pengujian mobile yang tercantum pada dokumen rollout selesai.
- `photo-lab.test.js` tetap merupakan tes unit dengan mock Google Apps Script; hasilnya bukan pengganti uji manual pada Drive dan Spreadsheet sungguhan.
