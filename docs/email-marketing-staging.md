# CSK Business OS — Email Marketing B2B (staging)

**Status:** fitur sudah dikembangkan pada PR #2, **belum di-merge dan belum dipakai produksi**. Tidak ada email dikirim otomatis.

## Tujuan
Mengambil data prospek yang sudah tercatat dalam tab Leads CRM agar owner CSK bisa menyiapkan kampanye B2B tanpa menyalin kontak ke sistem lain. Fitur ini bukan email blast: tahap awal fokus pada kualitas data, segmentasi, izin, dan draft untuk satu penerima.

## Kolom Leads yang dipakai
- `email` (Email), `name` (Nama perusahaan / brand), `pic` (Nama PIC), `picTitle` (Jabatan PIC), `industry` (Industri), `source` (Sumber), `status` (Status Lead), `id` (ID).
- Data ditarik langsung dari `db.leads` di aplikasi. **Tidak ada upload CSV pelanggan ke GitHub**.
- Email invalid, kosong, dan duplikat dikecualikan dari daftar penerima.
- Filter menurut nama, alamat email, PIC, industri, status dan status izin.

## Draft kampanye
- Template: perkenalan CSK, follow-up penawaran, portofolio B2B.
- Personalisasi hanya placeholder teks sederhana: `{{pic}}`, `{{brand}}`, `{{industry}}`, `{{source}}`, `{{status}}`, `{{picTitle}}`.
- Preview subject/body untuk penerima berizin. Tombol **Buka Draft Email Individu** membuka `mailto:` di aplikasi email; email **baru terkirim jika owner menekan Send secara manual**.
- CSV kampanye dapat diunduh **hanya untuk penerima yang izinnya sudah dicatat**. CSV memakai escape formula spreadsheet.
- Tombol Email lama pada kartu Lead sekarang mengarah ke Studio Draft, tidak lagi melakukan POST `no-cors` ke Apps Script.

## Persetujuan & unsubscribe
- **Memiliki alamat email di CRM bukan bukti persetujuan**.
- Awalnya semua alamat berstatus **Belum diverifikasi**. Untuk mengizinkan, owner harus memasukkan catatan bukti yang sebenarnya ada.
- Status `unsubscribed` memblokir preview, draft dan ekspor. Kontak yang sudah diblokir tidak boleh diaktifkan tanpa bukti baru.
- Catatan izin dan blokir **sementara hanya disimpan di localStorage browser**, di key `csk_email_marketing_local_v1`. Ini bukan registrasi persetujuan lintas perangkat, tidak memenuhi kebutuhan audit produksi dan bisa hilang jika browser dibersihkan. Jangan menganggap status lokal sebagai bukti hukum atau data opt-out yang sudah tersinkron.
- Untuk pengiriman massal yang sebenarnya, perlu **database izin/penolakan sentral**, riwayat kontak yang terverifikasi, penanganan permintaan berhenti, review template, batas pengiriman, autentikasi domain pengirim, dan penyedia layanan email yang mendukung delivery/bounce/unsubscribe.

## Coba sekarang
File HTML mandiri: [Preview Email Marketing CSK Offline](../preview/CSK-Email-Marketing-Offline.html).

Preview memakai 4 Lead **fiktif** yang dipasang di file HTML, bukan memuat Google Sheets. Unduh raw file dan buka via Chrome; tombol Catat Izin bisa dicoba dengan bukti **khusus simulasi**. Data asli jangan dimasukkan ke demo.

## Batasan & release gate
- Belum terhubung ke Gmail API, MailApp atau penyedia pengirim. Tidak ada penjadwalan dan tidak ada klaim tracking open/click atau delivered.
- Pengujian offline/CI bukan validasi kemampuan mengirim email real.
- Sinkronisasi Google Apps Script produksi tetap terkunci sampai audit Safe Sync dan kontrol akses selesai.
- Jangan merge PR #2/deploy produksi sebelum peninjauan ulang model izin, opt-out sentral, akses akun, keamanan token, dan tes end-to-end.
- Alur pengembangan selanjutnya: kontak dari Leads -> consent terverifikasi -> segmentasi -> preview -> kirim dengan persetujuan owner -> pencatatan status yang benar -> follow-up terjadwal.

Pengujian: `node email-marketing.test.js` dan GitHub Actions workflow safe-sync.
