# CSK Business OS — Rencana perbaikan sinkronisasi data (staging)
Status: DRAFT, **BELUM DIPASANG KE APLIKASI PRODUKSI**.

## Masalah terbukti di branch main sebelum perubahan
- \`index.html\` fungsi \`saveDB\` mengirim *semua* tabel setelah setiap edit.
- \`syncWithGoogle\` memakai POST \`no-cors\`, lalu langsung mencatat \`lastSync\` dan menampilkan "berhasil" tanpa membaca hasil backend.
- \`pullAndMerge\` memprioritaskan salinan lokal untuk ID yang sama, walaupun data cloud lebih baru.
- \`deleteFinance\`, \`deleteMarketing\`, \`deleteMemory\` sebelumnya tidak melakukan delete khusus di cloud; full-merge bisa memunculkan kembali record.
- \`sync_all\` di Apps Script masih melakukan upsert tanpa proteksi revisi atomik.

## Perbaikan dalam PR
- Frontend memakai \`sync-safe.js\` tanpa mengubah Apps Script aktif.
- \`saveDB\` mencatat perubahan per ID menjadi antrean di localStorage, bukan POST massal.
- Update/delete hanya dikirim untuk record yang berubah.
- Sync memakai GET preflight sebagai perlindungan dasar konflik, dengan baseline pembacaan cloud terakhir.
- Respons POST \`no-cors\` **tidak** dianggap bukti keberhasilan. Hasil diverifikasi melalui GET setelah POST.
- Penggabungan startup: cloud digunakan untuk data yang tidak berubah; edit lokal yang masih pending tetap dipertahankan.
- Status jelas: "Cloud belum terverifikasi", "N perubahan menunggu verifikasi", dan "Cloud terverifikasi".
- PWA cache dibump agar script tambahan tidak hilang pada update.
- Tests unit termasuk failed write, pending queue setelah reload, konflik dua perangkat, penghapusan, dan kontrak mapping Sheets.

## Batasan penting yang BELUM diselesaikan
1. **Belum atomic conflict control**: ada jendela race antara GET preflight dan POST. Untuk keamanan multi-user/sering offline, Apps Script masih perlu endpoint bersyarat per-record (expectedVersion) dan LockService. Jangan klaim konflik sudah hilang 100%.
2. **Backend deployment**: kode GitHub belum tentu identik dengan seluruh Apps Script produksi (file \`Library\`, \`Layanan\` juga tersedia). Jangan overwrite produksi hanya untuk mengaktifkan frontend.
3. **Legacy local-only records**: pada startup, data lokal lama yang tidak ada di cloud akan tetap terlihat tetapi tidak otomatis dikirim. Butuh alur rekonsiliasi/migrasi yang sadar konflik agar record lama tidak membangkitkan data yang sudah dihapus di perangkat lain.
4. **Penyimpanan lokal**: localStorage bukan penyimpanan permanen lintas browser/perangkat; hapus cache/browser bisa menghilangkan antrean belum tersinkron. Backup Drive harian melindungi *cloud*, bukan antrean lokal yang belum terkirim.
5. **Keamanan**: endpoint Apps Script memakai \`ANYONE_ANONYMOUS\` dan \`API_TOKEN\` bersifat opsional di kode backend. Butuh audit terpisah dan migrasi token wajib/otorisasi yang benar.
6. **Finance**: backend masih otomatis membuat "DP Proyek" sebesar nilai lead saat Deal Menang. Ini masalah laporan keuangan lain yang harus ditangani sendiri sebelum pengembangan laporan laba atau kalkulator HPP.
7. **Cold email**: alur \`sendColdEmailLead\` masih memakai POST opaque, sehingga status kirim email belum terverifikasi; perubahan ini belum mengubahnya.
8. **Aplikasi lama**: browser yang belum menerima versi baru bisa tetap melakukan full sync. Perlu rencana migrasi/versi minimum client sebelum go-live.

## Cara memvalidasi sebelum merge
1. Pastikan backup Google Drive dan daftar trigger harian sudah benar.
2. Jalankan \`node sync-safe.test.js\` dan \`node mapping.test.js\` di branch PR; tunggu CI hijau.
3. Gunakan *salinan* Google Sheet + deployment Apps Script khusus uji (bukan database utama), isi record dummy.
4. Uji create/edit/delete, keadaan offline, koneksi terputus, POST yang gagal, kedua browser mengedit ID sama, lalu restore dari backup dummy.
5. Audit endpoint, role dan alur Finance serta desain server-side expectedVersion sebelum menandai aman untuk multi-user.
6. Baru setelah semua lolos, review/merge/deploy secara terkontrol. **Tidak perlu men-deploy PR ini sekarang**.

Rollback: kembalikan frontend ke commit sebelum PR. Database utama tidak direstrukturisasi oleh perubahan PR.
