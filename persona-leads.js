/* CSK Business OS | Persona B2B — panduan read-only, tanpa akses API/Sheets.
 * Sumber: Persona-Lead-CSK.md.md (11 Okt 2026), 17 hipotesis persona.
 * Rentang proyek adalah asumsi sumber, BUKAN harga resmi, HPP, atau prediksi.
 */
(function (root) {
  'use strict';

  const DATA = [
    {id:'P1',tier:'T1',name:'Brand Manager FMCG',roles:'Brand Manager, Trade Marketing Manager',industry:'FMCG: makanan, minuman, skincare, kosmetik',services:'POSM, display akrilik, rak display, gondola',triggers:'Launching produk, campaign musiman, ekspansi distribusi',range:'Rp30–300 juta/kampanye',pain:'Display produk tenggelam di antara kompetitor meskipun sudah dirancang.',objections:['Ketepatan deadline','Kualitas dibanding vendor besar','Transparansi harga']},
    {id:'P2',tier:'T1',name:'Event Organizer',roles:'Project Manager, Producer, Owner EO',industry:'EO, Event Agency, Activation Agency',services:'Booth pameran, backdrop, mini counter, equipment event',triggers:'Mendapat proyek event, launching, activation',range:'Rp20–300 juta/event',pain:'Harus mengoordinasikan banyak vendor saat deadline singkat.',objections:['Fleksibilitas produksi','Kepastian deadline','Hasil sesuai mockup']},
    {id:'P3',tier:'T1',name:'Procurement / GA Corporate',roles:'Procurement Manager, GA Manager, Corporate Communication',industry:'Korporasi, BUMN, perusahaan besar',services:'Booth, backdrop, signage kantor, corporate gift',triggers:'Event tahunan, renovasi kantor, annual meeting, CSR',range:'Rp50–500 juta/proyek',pain:'Koordinasi desain, produksi, dan pemasangan terpecah.',objections:['Dokumen vendor, SPK, dan invoice','Kelengkapan tender','Kelayakan administratif pemasok']},
    {id:'P4',tier:'T1',name:'Pemilik Cafe / Resto',roles:'Owner, Marketing Manager F&B',industry:'Cafe, restoran, franchise, cloud kitchen',services:'Signage, neon box, display akrilik, menu board',triggers:'Buka cabang, rebranding, relaunch',range:'Rp10–100 juta/outlet',pain:'Signage outlet kurang terlihat, terutama pada malam hari.',objections:['Ketahanan cuaca dan pencahayaan','Garansi atau layanan purnajual']},
    {id:'P5',tier:'T2',name:'Merchandising Manager Retail Chain',roles:'Merchandising Manager, Store Operations Manager',industry:'Retail chain, minimarket, supermarket',services:'Rak display, gondola, floor display, signage toko',triggers:'Cabang baru, renovasi, rebranding',range:'Rp20–150 juta/outlet',pain:'Unit display tidak konsisten dan rusak sebelum digunakan.',objections:[]},
    {id:'P6',tier:'T2',name:'Expansion Manager F&B Chain',roles:'Expansion Manager, Business Development',industry:'Franchise F&B, jaringan F&B',services:'Signage outlet, display akrilik, branding store',triggers:'Pembukaan banyak cabang',range:'Rp10–80 juta/outlet',pain:'Butuh standar produksi yang konsisten di banyak lokasi.',objections:[]},
    {id:'P7',tier:'T2',name:'Marketing Manager Corporate',roles:'Marketing Manager, Marketing Communication',industry:'Bank, asuransi, telko, properti',services:'Booth, backdrop, signage kantor, corporate gift',triggers:'Launching produk, event tahunan, campaign',range:'Rp30–200 juta/proyek',pain:'Hasil produksi harus mengikuti pedoman identitas merek.',objections:[]},
    {id:'P8',tier:'T2',name:'Visual Merchandiser Retail',roles:'Visual Merchandiser, VM Specialist',industry:'Retail brand, fashion, department store',services:'Display akrilik, mannequin stand, POP display',triggers:'Seasonal display, launching koleksi',range:'Rp10–80 juta/musim',pain:'Produksi tidak selalu sesuai desain dan mood board.',objections:[]},
    {id:'P9',tier:'T2',name:'Agency Account Executive',roles:'Account Executive, Account Manager, Producer Agency',industry:'Advertising, digital, brand agency',services:'Booth, backdrop, display, signage',triggers:'Permintaan produksi dari klien agency',range:'Rp20–200 juta/proyek',pain:'Reputasi agency ikut terdampak bila vendor produksi gagal.',objections:[]},
    {id:'P10',tier:'T2',name:'Event Manager In-House Corporate',roles:'Event Manager, Corporate Event Specialist',industry:'Korporasi, BUMN, bank, telko',services:'Booth internal, backdrop, signage event',triggers:'Annual gathering, town hall, launching internal',range:'Rp30–150 juta/event',pain:'Memerlukan kepastian produksi sebelum tanggal event.',objections:[]},
    {id:'P11',tier:'T3',name:'Owner UMKM / Startup Brand',roles:'Founder, Owner',industry:'UMKM, startup, brand lokal',services:'Signage awal, booth pertama, display sederhana',triggers:'Launching usaha atau event pertama',range:'Rp5–30 juta/proyek',pain:'Anggaran terbatas, tetapi tetap ingin presentasi brand yang profesional.',objections:[]},
    {id:'P12',tier:'T3',name:'Franchise Owner',roles:'Franchise Owner, Master Franchise',industry:'Franchise F&B, retail, jasa',services:'Branding outlet, signage, display',triggers:'Pembukaan outlet, rebranding',range:'Rp15–100 juta/outlet',pain:'Harus mengikuti spesifikasi identitas merek franchisor.',objections:[]},
    {id:'P13',tier:'T2E',name:'Brand Owner',roles:'Owner, Founder, Co-Founder',industry:'FMCG, minuman, brand lokal, startup brand',services:'POSM, merchandise, display akrilik, booth',triggers:'Launching produk, ekspansi pasar, event brand',range:'Rp50–500 juta/proyek',pain:'Mencari mitra yang proaktif memberi ide produksi sesuai identitas brand.',objections:['Ide vendor kurang proaktif','Merchandise tidak sesuai identitas merek','Lead time terlalu panjang']},
    {id:'P14',tier:'T2E',name:'Agency Account / Project Manager',roles:'Account Manager, AE, Project Manager, Producer',industry:'Advertising, brand, activation agency',services:'Booth, backdrop, POSM, merchandise, display',triggers:'Campaign atau activation dari klien agency',range:'Rp30–300 juta/proyek',pain:'Deadline produksi yang gagal akan berdampak pada hubungan dengan klien.',objections:['Kurang memahami brand guideline','Diskusi teknis tidak mendalam','Sulit menangani revisi cepat']},
    {id:'P15',tier:'T2E',name:'Trade Marketing / Merchandising Manager',roles:'Trade Marketing Manager, Merchandising Manager, Brand Activation Manager',industry:'FMCG, beverage, consumer goods, retail',services:'POSM, glorifier, display akrilik, shelf talker, pop-up store',triggers:'Campaign kuartalan, SKU baru, ekspansi distribusi',range:'Rp50–200 juta/kampanye',pain:'Display toko perlu menonjol tanpa mengabaikan standar retail.',objections:['Standar display retail','Ketahanan material akrilik','Kerapian instalasi']},
    {id:'P16',tier:'T2E',name:'Brand Experience / Activation Specialist',roles:'Brand Experience Manager, Activation Manager, Event Specialist',industry:'FMCG, beverage, telko, otomotif',services:'Pop-up store, booth activation, merchandise event, display interaktif',triggers:'Roadshow, activation mall, festival',range:'Rp30–250 juta/activation',pain:'Butuh booth yang mudah dipindah dan dibongkar-pasang.',objections:['Bobot dan mobilitas booth','Pilihan material','Penyesuaian ruang lokasi']},
    {id:'P17',tier:'T2E',name:'Visual Merchandiser (Brand Side)',roles:'Visual Merchandiser, VM Specialist, Display Designer',industry:'Fashion, kosmetik, FMCG, retail brand',services:'Display akrilik, mannequin stand, POP display, glorifier',triggers:'Seasonal display, koleksi baru, rebranding',range:'Rp20–100 juta/musim',pain:'Finishing hasil produksi harus presisi terhadap technical drawing.',objections:['Kemampuan membaca gambar kerja','Kualitas finishing dan tepi akrilik','Quality control sebelum kirim']}
  ];

  const TIERS = {T1:'Tier 1 · Prioritas',T2:'Tier 2 · Potensial',T2E:'Tier 2 Extended',T3:'Tier 3 · Pelengkap'};
  const OVERLAPS = 'P9 ↔ P14 (agency), P8 ↔ P17 (visual merchandising), P5 ↔ P15 (merchandising), P4 ↔ P6/P12 (F&B/franchise). Profil beririsan; jangan hitung sebagai lead berbeda.';
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function filter(query, tier) {
    const q = String(query || '').toLocaleLowerCase('id').trim();
    return DATA.filter(p => (!tier || p.tier === tier) && (!q || [p.id,p.name,p.roles,p.industry,p.services,p.triggers,p.pain,p.objections.join(' ')].join(' ').toLocaleLowerCase('id').includes(q)));
  }
  function outreachText(persona) {
    if (!persona || !DATA.some(p => p.id === persona.id)) return '';
    return `Halo Bapak/Ibu, saya dari Cahaya Selatan Kreasindo (CSK). Kami mendukung kebutuhan produksi seperti ${persona.services.toLowerCase()}.\n\nSaya melihat tim ${persona.roles.split(',')[0]} biasanya perlu mempertimbangkan ${persona.triggers.toLowerCase()}. Jika saat ini ada kebutuhan terkait, bolehkah saya berbagi contoh pekerjaan dan mendiskusikan spesifikasinya?\n\nTerima kasih.\nCSK — Production Partner untuk Brand dan Bisnis.`;
  }
  function card(persona) {
    const objections = persona.objections.length ? '<ul class="csk-persona-list">'+persona.objections.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>' : '<p class="csk-persona-muted">Belum dirinci dalam sumber.</p>';
    return `<article class="csk-persona-card" data-persona="${esc(persona.id)}">
      <div class="csk-persona-cardtop"><span class="csk-persona-id">${esc(persona.id)}</span><span class="csk-persona-tier">${esc(TIERS[persona.tier])}</span></div>
      <h3>${esc(persona.name)}</h3><p class="csk-persona-muted">${esc(persona.roles)}</p>
      <p><strong>Industri:</strong> ${esc(persona.industry)}</p><p><strong>Kebutuhan CSK:</strong> ${esc(persona.services)}</p>
      <details><summary>Lihat trigger, masalah & keberatan</summary><div class="csk-persona-detail"><p><strong>Trigger:</strong> ${esc(persona.triggers)}</p><p><strong>Masalah utama:</strong> ${esc(persona.pain)}</p><strong>Keberatan yang perlu dijawab:</strong>${objections}<p class="csk-persona-muted"><strong>Potensi dari dokumen:</strong> ${esc(persona.range)} — hipotesis, belum tervalidasi.</p></div></details>
      <button type="button" class="csk-persona-copy" data-copy-persona="${esc(persona.id)}">Salin ide pesan pendekatan</button>
    </article>`;
  }
  function mount(rootElement) {
    if (!rootElement || rootElement.dataset.personaMounted === '1') return;
    rootElement.dataset.personaMounted = '1';
    rootElement.innerHTML = `<div class="csk-persona-toolbar"><label>Cari persona, jabatan, layanan, atau trigger<input type="search" id="csk-persona-search" placeholder="Contoh: launching, signage, procurement"></label><label>Tingkat prioritas<select id="csk-persona-tier"><option value="">Semua tier (17)</option>${Object.keys(TIERS).map(k=>`<option value="${k}">${esc(TIERS[k])}</option>`).join('')}</select></label></div>
      <p id="csk-persona-count" role="status" aria-live="polite" class="csk-persona-count"></p><div id="csk-persona-grid" class="csk-persona-grid"></div>
      <p class="csk-persona-warning"><strong>Perhatian:</strong> Data ini adalah hipotesis buyer persona dari dokumen internal CSK (11 Oktober 2026), bukan data pelanggan atau kisaran harga jual resmi. Cocokkan dengan transaksi, kemampuan produksi, dan syarat pengadaan aktual. Untuk procurement, verifikasi persyaratan legal/tender per calon klien.</p>
      <p class="csk-persona-muted"><strong>Tumpang tindih:</strong> ${esc(OVERLAPS)}</p>
      <div class="csk-persona-copybox" hidden><label for="csk-persona-draft">Draf pesan (pilih dan salin manual)</label><textarea id="csk-persona-draft" rows="7" readonly></textarea></div><p id="csk-persona-feedback" role="status" aria-live="polite" class="csk-persona-muted"></p>`;
    const search = rootElement.querySelector('#csk-persona-search');
    const tier = rootElement.querySelector('#csk-persona-tier');
    const grid = rootElement.querySelector('#csk-persona-grid');
    const count = rootElement.querySelector('#csk-persona-count');
    function update() {
      const matches = filter(search.value, tier.value);
      count.textContent = `${matches.length} dari ${DATA.length} persona ditampilkan`;
      grid.innerHTML = matches.length ? matches.map(card).join('') : '<p class="csk-persona-muted">Tidak ada persona yang cocok. Coba kata kunci lain.</p>';
    }
    search.addEventListener('input',update);
    tier.addEventListener('change',update);
    rootElement.addEventListener('click', async function (event) {
      const button = event.target.closest('[data-copy-persona]');
      if (!button) return;
      const persona = DATA.find(p=>p.id===button.dataset.copyPersona);
      if (!persona) return;
      const message = outreachText(persona);
      const feedback = rootElement.querySelector('#csk-persona-feedback');
      const copybox = rootElement.querySelector('.csk-persona-copybox');
      const textarea = rootElement.querySelector('#csk-persona-draft');
      copybox.hidden = false;
      textarea.value = message;
      try {
        if (!root.navigator || !root.navigator.clipboard || !root.navigator.clipboard.writeText) throw new Error('clipboard-unavailable');
        await root.navigator.clipboard.writeText(message);
        feedback.textContent = `Ide pesan ${persona.id} disalin. Periksa dan personalisasikan sebelum dikirim; tidak ada pesan yang dikirim otomatis.`;
      } catch (error) {
        textarea.focus(); textarea.select();
        feedback.textContent = 'Penyalinan otomatis tidak tersedia. Draf sudah ditampilkan dan dipilih untuk disalin manual.';
      }
    });
    update();
  }

  const api = Object.freeze({DATA:Object.freeze(DATA),TIERS:Object.freeze(TIERS),OVERLAPS,filter,outreachText,mount,esc});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CSKLeadPersonas = api;
})(typeof window !== 'undefined' ? window : globalThis);
