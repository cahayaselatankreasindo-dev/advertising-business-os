# CSK Business OS — UX, Accessibility & Security QA (STAGING)

**Sasaran:** CSK Business OS mudah dipakai owner melalui Android/iPhone/desktop, status data tidak menyesatkan, dan perubahan tidak diam-diam menimpa record dari perangkat lain.

**Status:** CHECKLIST QA untuk PR #4 (integrasi staging), **BUKAN bukti kelulusan end-to-end atau deployment produksi**. Owner menyatakan aplikasi sudah diuji oleh agen Astra; pengujian itu dicatat sebagai konfirmasi owner, terpisah dari CI source-level dan verifikasi deployment.

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
| Konflik | Dua perangkat edit ID yang sama → bandingkan versi cloud/perangkat, pilih sumber, lalu retry dengan CAS | Emulator LockService + CAS dan pilihan resolusi lulus; live multi-device masih perlu |
| Tarik cloud | Tombol Tarik ditolak selama perubahan belum terverifikasi | Kode tersedia; QA perangkat perlu |
| Backup | Unduh JSON tanpa token/API URL, file bisa dipulihkan lokal | Unit test parsial, QA file browser perlu |
| Finance | Deal Menang tidak mengubah kas masuk otomatis | Test backend emulator; real backend belum |
| Iklan | CPL tersedia dari data tercatat; ROAS “Belum terukur” tanpa atribusi | Kode tersedia |
| Role “Tim” | Menu boleh disembunyikan tetapi label tegas bukan kontrol akses | Source staging memiliki token Owner/Team terpisah dan allowlist server; endpoint live belum diverifikasi |
| Stale PWA | Pengguna yang masih membuka JS lama tidak boleh membaca atau mengirim full-sync ke backend baru | Source-level protocol gate tersedia; live endpoint test masih wajib |
| Akses otentik | Pengguna Team tidak dapat membaca/mengubah Finance, Marketing, Memory, HPP dan biaya proyek lewat request langsung | **Source-level allowlist tersedia; HTTP endpoint live belum diverifikasi. Token bearer bukan login per-pengguna** — tetap release blocker untuk akses multi-user luas |

## Release gates (wajib)

**Gate A: Source/QA.** GitHub Actions untuk safe sync, integrasi backend emulator, mapping, modul komersial, UI render safety, manifest LAB, legacy archive dan deployment guard lulus pada HEAD teruji. Ini validasi source-level; browser visual pada perangkat nyata tetap perlu bila ada perubahan UI.

**Gate B: LAB.** Gunakan Apps Script dan Spreadsheet salinan dummy LAB yang sudah ditetapkan. Source `Code.gs` memanggil `cskLabGuardRead_()` / `cskLabGuardPost_(payload)` dan contract test memeriksa wiring-nya. Manifest kedua proyek dibatasi `MYSELF` / `USER_DEPLOYING`. Tetap verifikasi project ID, handler aktif, dan `LAB_HANDLER_GUARD_PASS` pada deployment LAB nyata. Jangan membuka permission LAB ke Anyone.

**Gate C: HTTP.** Browser test nyata terhadap endpoint staging terpisah dan terautentikasi; lakukan POST read/write, readback, koneksi timeout, POST blocked, offline, multi-device, rollback, redirect ContentService, dan cek CORS dengan Google Apps Script. GET harus mengembalikan `POST_REQUIRED` tanpa data. **Belum terpenuhi.**

**Gate D: Concurrency.** Source backend memakai LockService dan compare-and-set (`expectedRecords` untuk upsert, `expectedFingerprint` untuk delete); emulator menguji stale write dan konflik dua perangkat. UI menampilkan kedua versi, menyediakan pilihan cloud/perangkat, dan menyimpan recovery lokal sebelum keputusan. Verifikasi live multi-device dan protocol gate pada endpoint staging tetap wajib.

**Gate E: Server access.** Source staging sudah memverifikasi token Owner/Team di backend dan membatasi tab Finance, Marketing, Memory, Costings, serta Project Costs untuk Owner. Token browser kini hanya berada di memori tab dan dikirim di body POST, bukan di `localStorage` atau query string. Namun token tetap bearer credential yang bisa diekstrak selama sesi aktif, dan belum ada identitas per pengguna/user admin. Uji HTTP langsung pada deployment aktual belum dilakukan. **Belum terpenuhi untuk pembukaan akses multi-user luas.**

**Gate F: Release.** Backup produksi + uji restore, persetujuan owner, staging smoke test, deployment bertahap, rencana rollback, dan pemantauan hasil verifikasi. **Belum terpenuhi.**

## Prioritas bisnis CSK

Fitur berikutnya hanya dijadikan target setelah release gate selesai: HPP fabrikasi/margin, biaya vendor dan supplier, daftar pekerjaan beserta material, progress proyek, penawaran/invoice dengan DP aktual, KPI konversi dari WhatsApp dan iklan. Hindari mencatat deal sebagai pembayaran, mencampur biaya marketing dengan jurnal expense, atau menyajikan ROAS tanpa sumber atribusi.

**Keamanan:** Token bearer tetap dapat diakses dari browser selama sesi aktif, tetapi tidak lagi disimpan di `localStorage` atau dikirim melalui query URL. Ini bukan login per-pengguna. Jangan gunakan perangkat bersama atau membagikan URL request, token, ID klien, maupun database bisnis asli ke GitHub/issue/hasil test.
