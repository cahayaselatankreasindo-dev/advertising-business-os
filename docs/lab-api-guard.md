# CSK LAB — pengamanan endpoint sebelum uji browser

Status: **BELUM AKTIF DI APPS SCRIPT LAB**. Kode repo adalah persiapan; deploy LAB tetap **Only myself**. Aplikasi produksi dan Google Sheets produksi **jangan disentuh**.

Konfigurasi manifest kedua proyek (`apps-script/appsscript.json` dan `photo-lab/appsscript.json`) dikunci ke `webapp.access: MYSELF` dan `executeAs: USER_DEPLOYING`. CI memeriksa keempat nilai ini; jangan mengubahnya menjadi `ANYONE` atau `ANYONE_ANONYMOUS`.

## Bukti yang sudah didapat
- LAB_TEST_PASS dari Apps Script LAB: create/update/delete/readback data dummy.
- GET /exec tidak lagi mengembalikan data dan merespons `POST_REQUIRED`; pembacaan terautentikasi memakai POST action `read` dengan token di body.
- Tanpa login Google, URL /exec privat menghasilkan login_required dari Google.
- Frontend Business OS di GitHub Pages **tidak bisa memakai endpoint Only myself secara langsung** karena login Google/CORS.

## Integrasi *hanya* untuk Apps Script LAB (belum dieksekusi)
1. Pastikan project Apps Script ID **1IushkEIqi-CsKxsdx83sxs08_G5wk8rbOQ9A_eM0UF1wOKszDfYJqzB4** dan spreadsheet ID **19le34ltpZCMIHmjw2n_JbEvrtZBWNTKd61U-xEAoR5Y**. Jika berbeda, STOP.
2. Tambahkan file **LabRequestGuard.gs** dari folder apps-script/ di branch PR #2. **Belum perlu menjalankan fungsi apa pun atau deploy ulang**.
3. Di file Code.gs LAB saja, fungsi **doGet()** hanya memanggil `cskLabGuardRead_()` lalu mengembalikan `POST_REQUIRED`; jangan membaca token dari query string atau mengembalikan data melalui GET. Bentuk responsnya:
   ~~~js
   cskLabGuardRead_();
   return jsonResponse({status:"error",code:"POST_REQUIRED",protocolVersion:2,message:"Gunakan POST action read dengan token di request body."});
   ~~~
   Respons GET sukses juga harus menyertakan `protocolVersion: 2` di objek JSON terluar. Frontend baru menolak backend yang tidak mengirim versi ini.
4. Di file Code.gs LAB saja, dalam fungsi **doPost(e)**, tepat setelah:
   ~~~js
   const payload = JSON.parse(e.postData.contents);
   ~~~
   tambah:
   ~~~js
   cskLabGuardPost_(payload);
   ~~~
5. Tambahkan `case "read"` pada switch `doPost`: allowlist hanya `action`, `token`, dan `protocolVersion`, lalu kembalikan data dari spreadsheet dummy dengan filter role Owner/Team. `LabRequestGuard.gs` harus mengizinkan bentuk read ini dan menolak field tambahan. Guard POST tetap mewajibkan `protocolVersion: 2`; write LAB hanya `sync_all` dan `delete` untuk ID dummy.
6. Ulangi pemeriksaan internal cskLabCheckReadiness lalu cskLabRunIsolatedSmokeTest khusus LAB. Periksa LAB_TEST_PASS tanpa membagikan token.
7. Deployment Web App yang sudah aktif tidak otomatis memakai kode terbaru; **jangan deploy ulang atau ubah Who has access** sebelum audit dan persetujuan eksplisit untuk uji browser.

## Keamanan & keterbatasan
- Guard tidak menambah autentikasi per pengguna. API_TOKEN pada frontend browser bisa disalin oleh siapa pun yang mengakses sesi browser. Ini hanya layak untuk data dummy.
- Jika suatu saat LAB diterapkan untuk Anyone, pihak yang mengetahui token berpotensi mengakses data sesuai role token. Token hanya disimpan di memori tab dan dikirim melalui body POST, tetapi tetap bisa diekstrak dari sesi browser. Jangan pakai token LAB untuk produksi, jangan tulis token ke repo, dan jangan pernah membagikan request body berisi token.
- Guard bergantung pada cskLabRequireDummySheet_ dari LabSelfTest.gs. File itu harus tetap terpasang.
- Backend mengembalikan respons error jika guard gagal, menggunakan penanganan error Code.gs.
- Uji konflik multi-perangkat yang atomik, izin/CORS untuk POST read, redirect ContentService, dan hasil frontend tetap belum selesai.
- Jangan mengubah Web App menjadi Anyone pada tahap ini.
