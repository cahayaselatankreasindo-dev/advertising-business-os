# CSK LAB — pengamanan endpoint sebelum uji browser

Status: **BELUM AKTIF DI APPS SCRIPT LAB**. Kode repo adalah persiapan; deploy LAB tetap **Only myself**. Aplikasi produksi dan Google Sheets produksi **jangan disentuh**.

## Bukti yang sudah didapat
- LAB_TEST_PASS dari Apps Script LAB: create/update/delete/readback data dummy.
- GET /exec tanpa token dari browser pemilik LAB menghasilkan status error Tidak diizinkan.
- Tanpa login Google, URL /exec privat menghasilkan login_required dari Google.
- Frontend Business OS di GitHub Pages **tidak bisa memakai endpoint Only myself secara langsung** karena login Google/CORS.

## Integrasi *hanya* untuk Apps Script LAB (belum dieksekusi)
1. Pastikan project Apps Script ID **1IushkEIqi-CsKxsdx83sxs08_G5wk8rbOQ9A_eM0UF1wOKszDfYJqzB4** dan spreadsheet ID **19le34ltpZCMIHmjw2n_JbEvrtZBWNTKd61U-xEAoR5Y**. Jika berbeda, STOP.
2. Tambahkan file **LabRequestGuard.gs** dari folder apps-script/ di branch PR #2. **Belum perlu menjalankan fungsi apa pun atau deploy ulang**.
3. Di file Code.gs LAB saja, setelah try block pada fungsi **doGet(e)**, tambah:
   ~~~js
   cskLabGuardRead_();
   ~~~
4. Di file Code.gs LAB saja, dalam fungsi **doPost(e)**, tepat setelah:
   ~~~js
   const payload = JSON.parse(e.postData.contents);
   ~~~
   tambah:
   ~~~js
   cskLabGuardPost_(payload);
   ~~~
5. Simpan. Semua GET/POST LAB akan menolak spreadsheet salah, token belum dikonfigurasi, ID asli, status lead won, dan action di luar allowlist (sync_all, delete). Proteksi autentikasi lama tetap dipakai.
6. Ulangi pemeriksaan internal cskLabCheckReadiness lalu cskLabRunIsolatedSmokeTest khusus LAB. Periksa LAB_TEST_PASS tanpa membagikan token.
7. Deployment Web App yang sudah aktif tidak otomatis memakai kode terbaru; **jangan deploy ulang atau ubah Who has access** sebelum audit dan persetujuan eksplisit untuk uji browser.

## Keamanan & keterbatasan
- Guard tidak menambah autentikasi per pengguna. API_TOKEN pada frontend browser bisa disalin oleh siapa pun yang mengakses sesi browser. Ini hanya layak untuk data dummy.
- Jika suatu saat LAB diterapkan untuk Anyone, pihak yang mengetahui token berpotensi mengakses semua data LAB. Jangan pakai token LAB untuk produksi, jangan tulis token ke repo, dan jangan pernah kirim URL ?token=... ke chat.
- Guard bergantung pada cskLabRequireDummySheet_ dari LabSelfTest.gs. File itu harus tetap terpasang.
- Backend mengembalikan respons error jika guard gagal, menggunakan penanganan error Code.gs.
- Uji konflik multi-perangkat yang atomik, izin/CORS, dan hasil frontend tetap belum selesai.
- Jangan mengubah Web App menjadi Anyone pada tahap ini.
