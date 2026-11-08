# Setup CSK Business OS — Google Sheets + Apps Script + PIN

Arsitektur ini menggunakan Google Sheets sebagai database dan Google Apps Script sebagai backend. Tidak membutuhkan Google Cloud OAuth, domain, server hosting berbayar, atau API token bersama.

## Akun dan peran

- Owner: `cahayaselatankreasindo@gmail.com`
- Tim: `zefdas@gmail.com`

Role ditentukan oleh backend dari email yang login. Dropdown role di antarmuka bukan sumber otorisasi.

## Instalasi pertama

1. Gunakan Spreadsheet database CSK yang sudah ada agar data lama tetap terhubung. Buat Spreadsheet baru bernama **Database CSK Business OS** hanya jika belum ada database.
2. Dari Spreadsheet, buka **Extensions → Apps Script**.
3. Ganti kode editor dengan isi file `apps-script/Code.gs` dari repositori.
4. Simpan, lalu jalankan `setupSheet()` sekali. Berikan izin yang diminta. Fungsi ini memvalidasi header dan menambahkan tab/kolom yang belum ada tanpa menghapus data lama. Cadangkan Spreadsheet sebelum perubahan skema.
5. Kembali ke Google Spreadsheet dan muat ulang halaman agar menu **CSK Security** muncul.
6. Pilih **CSK Security → Setup PIN Owner & Tim**. Masukkan PIN Owner dan PIN Tim yang berbeda (masing-masing 8–12 digit). Gunakan PIN yang tidak dipakai untuk akun lain. **Jangan jalankan fungsi dialog ini melalui tombol Run di Apps Script Editor** karena dialog Spreadsheet memerlukan konteks UI.
7. Buka **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Deploy dan salin URL yang berakhiran `/exec`.
9. Buka aplikasi CSK. Tempel URL pada layar login, lalu masuk menggunakan email dan PIN.

## Memisahkan pembaruan frontend dan backend

GitHub Pages menerbitkan frontend dari branch `main`. Merge kode ke GitHub tidak memperbarui Google Apps Script Web App secara otomatis. Setelah mengganti kode Apps Script:

1. Simpan kode di Apps Script Editor.
2. Buka **Deploy → Manage deployments**.
3. Klik Edit pada deployment Web App yang sedang dipakai.
4. Pilih **New version**, lalu klik **Deploy**.
5. Pertahankan URL deployment `/exec` yang sama dan pastikan URL itu dimasukkan pada layar login aplikasi.

## Perlindungan akses

- PIN di-hash berulang dengan salt acak dan disimpan di Script Properties.
- Lima kegagalan login memicu pembatasan sementara selama 15 menit.
- Sesi backend aktif maksimal 30 menit dan diperbarui selama aktivitas.
- Tim hanya dapat membaca, membuat, dan memperbarui Leads, Clients, dan Projects.
- Tim tidak dapat menghapus Leads, Clients, atau Projects. Larangan penghapusan diperiksa di backend dan UI; hanya Owner yang dapat menghapus setelah hasilnya terverifikasi di Google Sheets.
- Finance, Memory, Marketing, HPP, Purchase Orders, dan data sensitif lain hanya dikirim ke sesi Owner.
- Server menolak upaya Tim mengirim atau menghapus koleksi Owner.
- Status Deal Menang hanya dapat ditetapkan oleh Owner.
- PIN dan session ID tidak disimpan di localStorage.
- Cold email tetap dinonaktifkan. Tidak ada email otomatis yang dikirim.

## Memperbarui backend

1. Perbarui kode `apps-script/Code.gs` pada project Apps Script.
2. Simpan.
3. Buka **Deploy → Manage deployments**.
4. Edit deployment Web App yang aktif, pilih versi baru, lalu deploy.
5. URL `/exec` tetap sama untuk deployment yang diperbarui.

Jangan jalankan ulang setup PIN jika kredensial sudah dibuat. Untuk rotasi PIN yang disengaja, jalankan `rotateCSKPinCredentialsFromPrompt()`. Rotasi mengubah hash dan membuat sesi lama tidak valid saat request berikutnya.

## Catatan migrasi

Data lama pada penyimpanan lokal Owner dipertahankan sampai sinkronisasi cloud berhasil dibaca ulang dan diverifikasi. Setelah verifikasi berhasil, salinan lama di localStorage dihapus. Jika sinkronisasi gagal, aplikasi mempertahankan salinan lama dan memperingatkan sebelum halaman ditutup. Data operasional Tim disimpan terpisah karena tidak memuat koleksi sensitif Owner. Sinkronisasi cloud menggunakan merge/upsert berdasarkan ID; data lama yang tidak dikirim tidak dihapus.

`setupSheet()` memvalidasi header yang duplikat atau ambigu dan menghentikan proses tanpa menghapus kolom/data. Lakukan backup Spreadsheet sebelum perubahan skema besar.