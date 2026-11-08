# Setup CSK Business OS — Google Sheets + Apps Script + PIN

Arsitektur ini menggunakan Google Sheets sebagai database dan Google Apps Script sebagai backend. Tidak membutuhkan Google Cloud OAuth, domain, server hosting berbayar, atau API token bersama.

## Akun dan peran

- Owner: `cahayaselatankreasindo@gmail.com`
- Tim: `zefdas@gmail.com`

Role ditentukan oleh backend dari email yang login. Dropdown role di antarmuka bukan sumber otorisasi.

## Instalasi pertama

1. Buat Google Spreadsheet bernama **Database CSK Business OS**.
2. Dari Spreadsheet, buka **Extensions → Apps Script**.
3. Ganti kode editor dengan isi file `apps-script/Code.gs` dari repositori.
4. Simpan, lalu jalankan `setupSheet()` sekali. Berikan izin yang diminta.
5. Jalankan `setupCSKPinCredentialsFromPrompt()` sekali.
6. Masukkan PIN Owner dan PIN Tim yang berbeda. Setiap PIN harus 8–12 digit. Gunakan PIN yang tidak dipakai untuk akun lain.
7. Buka **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Deploy dan salin URL yang berakhiran `/exec`.
9. Buka aplikasi CSK. Tempel URL pada layar login, lalu masuk menggunakan email dan PIN.

## Perlindungan akses

- PIN di-hash berulang dengan salt acak dan disimpan di Script Properties.
- Lima kegagalan login memicu pembatasan sementara selama 15 menit.
- Sesi backend aktif maksimal 30 menit dan diperbarui selama aktivitas.
- Tim hanya dapat membaca dan mengubah Leads, Clients, dan Projects.
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

Data lama pada penyimpanan lokal Owner dimigrasikan ke penyimpanan Owner terpisah pada perangkat saat aplikasi pertama kali dibuka dengan guard baru. Data lokal Tim disimpan terpisah. Sinkronisasi cloud menggunakan merge/upsert berdasarkan ID; data lama yang tidak dikirim tidak dihapus.

`setupSheet()` memvalidasi header yang duplikat atau ambigu dan menghentikan proses tanpa menghapus kolom/data. Lakukan backup Spreadsheet sebelum perubahan skema besar.