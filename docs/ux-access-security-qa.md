# CSK Business OS — UX, Accessibility & Security QA (STAGING)

**Sasaran:** CSK Business OS mudah dipakai owner melalui Android/iPhone/desktop, status data tidak menyesatkan, dan perubahan tidak diam-diam menimpa record dari perangkat lain.

**Status:** CHECKLIST QA untuk PR #2, **BUKAN bukti kelulusan end-to-end**. Kode PR belum di-merge ke main maupun di-deploy pada database produksi.

## Checklist UX / aksesibilitas manual

| Uji | Kondisi lolos | Status |
| --- | --- | --- |
| First launch | Instalasi baru kosong tanpa prospek contoh, endpoint dan token kosong | Kode tersedia, QA perangkat nyata belum |
| Data lama | localStorage sebelumnya tidak hilang saat upgrade PWA | Unit test/kontrak, QA browser nyata belum |
| Mobile 320–430 px | Navbar bawah mudah disentuh, input tidak zoom paksa, tidak terpotong | Perlu QA perangkat |
| Zoom & keyboard | Pinch zoom berjalan, Tab terlihat, skip-link ke main, dialog bisa tutup lewat Escape | Kode tersedia, QA perangkat perlu |
| Screen reader | Indikator sinkronisasi dibacakan melalui live region dan modal berlabel | Kode tersedia, pemeriksaan perlu |
| Offline | Ubah lead → “tersimpan lokal / menunggu verifikasi”, bukan “cloud sukses” | Emulator lulus, browser nyata perlu |
| Retry | POST opaque tetapi data tidak tersimpan → tetap tertahan di antrean | Emulator lulus, browser nyata perlu |
| Konflik | Dua perangkat edit ID yang sama → jangan menimpa data diam-diam | Emulator preflight lulus; CAS atomik belum |
| Tarik cloud | Tombol Tarik ditolak selama perubahan belum terverifikasi | Kode tersedia; QA perangkat perlu |
| Backup | Unduh JSON tanpa token/API URL, file bisa dipulihkan lokal | Unit test parsial, QA file browser perlu |
| Finance | Deal Menang tidak mengubah kas masuk otomatis | Test backend emulator; real backend belum |
| Iklan | CPL tersedia dari data tercatat; ROAS “Belum terukur” tanpa atribusi | Kode tersedia |
| Role “Tim” | Menu boleh disembunyikan tetapi label tegas bukan kontrol akses | Kode tersedia; server role belum |
| Stale PWA | Pengguna yang masih membuka JS lama tidak boleh membaca atau mengirim full-sync ke backend baru | Source-level protocol gate tersedia; live endpoint test masih wajib |
| Akses otentik | Pengguna tim tidak dapat membaca/mengubah keuangan dengan request langsung | **BELUM** — release blocker |

## Release gates (wajib)

**Gate A: Source/QA.** GitHub Actions (sync unit, integration emulator, Sheets mapping) seluruhnya hijau pada commit HEAD. Validasi browser visual pada smartphone dilakukan dengan data dummy.

**Gate B: LAB.** Gunakan Apps Script dan Spreadsheet salinan dummy LAB yang sudah ditetapkan. Pastikan Code.gs LAB doGet/doPost memanggil `cskLabGuardRead_()` / `cskLabGuardPost_(payload)`; hasil fungsi internal `cskLabVerifyActiveHandlers()` = `LAB_HANDLER_GUARD_PASS`. Jangan membuka permission LAB ke Anyone hanya untuk mengejar test.

**Gate C: HTTP.** Browser test nyata terhadap endpoint staging terpisah dan terautentikasi; lakukan GET/POST, readback, koneksi timeout, POST blocked, offline, multi-device, rollback, dan cek CORS dengan Google Apps Script. **Belum terpenuhi.**

**Gate D: Concurrency.** Validasi atomik di backend (expectedVersion/revision dan LockService) serta conflict resolution UI. Belum terpenuhi. Protocol gate untuk stale PWA sudah ada di source; tetap verifikasi request versi lama ditolak pada endpoint staging.

**Gate E: Server access.** Autentikasi pengguna dan otorisasi Finance, Marketing, user admin, akses ekspor per role; batasi data sensitif dari aplikasi publik. Dropdown role client-only **tidak cukup**. **Belum terpenuhi.**

**Gate F: Release.** Backup produksi + uji restore, persetujuan owner, staging smoke test, deployment bertahap, rencana rollback, dan pemantauan hasil verifikasi. **Belum terpenuhi.**

## Prioritas bisnis CSK

Fitur berikutnya hanya dijadikan target setelah release gate selesai: HPP fabrikasi/margin, biaya vendor dan supplier, daftar pekerjaan beserta material, progress proyek, penawaran/invoice dengan DP aktual, KPI konversi dari WhatsApp dan iklan. Hindari mencatat deal sebagai pembayaran, mencampur biaya marketing dengan jurnal expense, atau menyajikan ROAS tanpa sumber atribusi.

**Keamanan:** Token ditanam pada aplikasi browser tetap dapat diakses pengguna lokal. Jangan menyebutnya sistem login. Jangan menempelkan token, URL bertoken, ID klien, atau database bisnis asli ke GitHub/issue/hasil test.
