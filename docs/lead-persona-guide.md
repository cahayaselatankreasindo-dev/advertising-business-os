# Panduan Persona B2B — CSK Business OS (staging)

Sumber: berkas `Persona-Lead-CSK.md.md`, dibuat 11 Oktober 2026. Sebanyak 17 buyer persona (P1–P17) diterjemahkan menjadi referensi **read-only** di aplikasi, tanpa menambah kontak fiktif.

## Penggunaan

1. Buka **Leads CRM → Buka Panduan Persona** (di HP) atau **Panduan 17 Persona B2B** (di sidebar desktop).
2. Cari berdasarkan **jabatan, industri, trigger kebutuhan, atau layanan**, lalu filter berdasarkan tier.
3. Baca masalah utama dan keberatan buyer sebelum membuat penawaran.
4. Gunakan tombol **Salin ide pesan pendekatan** sebagai draf, personalisasikan dan verifikasi relevansinya sebelum menghubungi prospek.

## Interpretasi

- **Tier 1 (P1–P4):** target prioritas dalam sumber; tidak otomatis berarti paling cepat closing.
- **Tier 2 (P5–P10), Tier 2 Extended (P13–P17):** peluang lain yang perlu diuji.
- **Tier 3 (P11–P12):** pelengkap; tetap relevan untuk order kecil atau hubungan jangka panjang.
- **Overlaps:** P9/P14 (agency), P8/P17 (VM), P5/P15 (merchandising), serta P4/P6/P12 (F&B/franchise) beririsan. Jangan menghitungnya sebagai lead perusahaan berbeda.
- Rentang nilai proyek berasal dari asumsi dokumen, bukan data transaksi atau pricelist resmi. **Jangan gunakan untuk HPP, quotation, forecast, atau lead scoring otomatis tanpa validasi.**
- Untuk procurement korporasi, verifikasi dokumen pengadaan, legalitas, dan syarat tender pada setiap calon klien. Tidak ada klaim otomatis mengenai kelayakan CSK.

## Batas keamanan data

Modul `persona-leads.js` tidak membaca atau menulis `db.leads`, `localStorage`, Google Sheets, API, email, maupun WhatsApp. Tombol hanya menyalin draf teks; tidak mengirim pesan. Seluruh perubahan berada di branch draft PR #2 dan **bukan deployment produksi** sampai gate keamanan serta persetujuan owner selesai.

Modul ini nantinya bisa menjadi acuan `personaId` pada Leads, tetapi migrasi kolom tersebut **belum dilakukan** agar tidak mengubah kontrak sinkronisasi yang masih diuji.
