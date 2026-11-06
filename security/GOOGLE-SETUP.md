# Setup gratis — Google Sheets + Apps Script + login PIN

Tidak perlu Google Cloud OAuth, domain, Client ID, Client Secret, atau hosting berbayar.

1. Buka project Apps Script yang terhubung ke spreadsheet.
2. Salin versi terbaru `google_apps_script.js` dari branch keamanan ini ke project Apps Script setelah review.
3. Pastikan Script Properties berisi Owner `cahayaselatankreasindo@gmail.com` dan Team `zefdas@gmail.com`.
4. Jalankan `setupCSKPinCredentials(ownerPin, teamPin)` satu kali dari editor Apps Script. Gunakan dua PIN berbeda, masing-masing 8–12 digit. Jangan masukkan PIN ke source code, GitHub, atau chat.
5. Gunakan URL Web App Apps Script `/exec` yang sudah ada. Jangan deploy produksi sebelum persetujuan.
6. Masukkan URL tersebut di layar login OS, lalu login dengan email dan PIN individual.

PIN disimpan sebagai hash dengan salt acak di Script Properties. Lima kegagalan login mengunci percobaan untuk email tersebut selama 15 menit. Sesi berlaku 30 menit. Spreadsheet tetap privat dan tidak perlu dibagikan kepada akun Team.
