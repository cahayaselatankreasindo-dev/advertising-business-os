# CSK Business OS — Backup aman Google Sheets

Status: **RANCANGAN — belum aktif pada produksi** sampai Apps Script disinkronkan dan installer dijalankan. Branch ini tidak mengubah database/Google Apps Script produksi.

## Sumber data yang dilindungi
- Spreadsheet aktif: `CSK BUSINESS OS - DATABASE UTAMA - AKTIF - JANGAN HAPUS`.
- Folder aktif: `Manajerial Internal CSK/00 - BUSINESS OS - DATABASE AKTIF`.
- Folder cadangan: `Manajerial Internal CSK/99 - BACKUP BUSINESS OS - JANGAN HAPUS`.
- File salinan: `BACKUP HARIAN CSK BUSINESS OS - YYYY-MM-DD - JANGAN HAPUS`.

Folder target harus sudah tersedia. Script menolak berjalan jika folder atau nama spreadsheet tidak sesuai. ID disimpan pada Script Properties setelah instalasi, bukan di repository.

## Aktivasi oleh pemilik (setelah review dan deploy Apps Script)
1. Simpan snapshot Apps Script lama; verifikasi perubahan file `apps-script/Backup.gs` saja dan jangan timpa perubahan backend produksi lain.
2. Sinkronkan file `Backup.gs` ke proyek Apps Script **yang terikat pada spreadsheet utama**. Jangan melakukan `clasp push` membabi-buta jika script produksi mungkin berbeda dari repo.
3. Jalankan `installCskBusinessOsDailyBackup()` sekali menggunakan akun pemilik CSK dan terima izin Spreadsheet, Drive, Script Properties, dan trigger yang diminta.
4. Lihat hasil **Executions / Logs**; jalankan `checkCskBusinessOsBackupStatus()` dan pastikan `configured: true`, `dailyTriggerCount: 1`, serta backup terbaru tercatat.
5. Cek Google Drive: backup hari ini muncul di folder backup. Pastikan hanya owner/pihak internal terotorisasi yang memiliki akses.
6. Uji pemulihan pada salinan lain, **bukan pada database produksi**.

## Ketentuan keamanan
- Skrip **tidak menghapus** file atau tab dan tidak mengubah data produksi.
- Salinan dibuat **sekali per tanggal WIB**; pemanggilan ulang pada hari yang sama tidak menambah file duplikat dengan nama sama.
- Cadangan harian berjalan melalui pemicu Apps Script pada rentang **02.00–03.00 WIB** (jadwal pemicu bukan jaminan menit persis).
- Gagal membuat salinan memunculkan error pada Apps Script Executions; pemilik perlu memeriksa error/kuota/otorisasi. Ini **bukan** layanan backup transaksional berjaminan.
- Tidak ada penghapusan otomatis atau kebijakan retensi di fase awal, untuk menghindari kehilangan data karena salah konfigurasi. Tinjau kuota Drive berkala.
- Cadangan yang berada di akun Drive yang sama masih berisiko jika akun utama hilang/terkompromi. Pertimbangkan cadangan berkala di akun/penyimpanan terpisah dengan akses terbatas.
- Mengubah sharing Google Sheets menjadi **Restricted** tidak otomatis mengunci endpoint Google Apps Script. Audit autentikasi `doGet`/`doPost`, CORS, hak akses, dan versi deployment secara terpisah.

## Pengecekan kegagalan
Jika `dailyTriggerCount = 0`, installer belum dijalankan di proyek yang tepat.
Jika backup harian tidak muncul, cek **Apps Script > Executions** serta kuota Drive. Jangan menjalankan `setupSheet` atau `dedupeHeaders` sebagai langkah troubleshooting backup.
Jika salinan gagal diverifikasi, jangan menimpa spreadsheet utama: investigasi izin/identitas folder terlebih dulu.

## Tugas berikutnya
- Tambahkan API respons yang bisa dibaca frontend untuk **konfirmasi write**; jangan menampilkan “berhasil disimpan” setelah `fetch(..., {mode: 'no-cors'})`.
- Terapkan token wajib / autentikasi yang benar di backend dan uji deployment setelah transisi.
- Tambahkan validasi revisi per-record, pencatatan peristiwa, serta mekanisme konflik sinkronisasi dua perangkat.
