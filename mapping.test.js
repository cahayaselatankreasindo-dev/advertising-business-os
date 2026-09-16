/**
 * mapping.test.js — Tahap 3: Samakan mapping React <-> Apps Script.
 *
 * Cara jalan: node mapping.test.js   (exit 0 = semua lolos)
 *
 * File ini memuat google_apps_script.js apa adanya ke dalam sandbox Node
 * dengan stub SpreadsheetApp/ContentService/ScriptApp minimal, lalu
 * memverifikasi KONTRAK MAPPING dua arah untuk 6 tab:
 *   Sheet header (huruf besar, hasil Tahap 1-2) <-> field HTML (camelCase)
 *
 * Aturan kontrak (single source of truth = FIELD_MAP):
 *   Leads:           ID,Tanggal,Nama,WhatsApp,Sumber,EstimasiNilai,Status,Catatan
 *   Clients:         ID,NamaKlien,WhatsApp,TotalProyek,TotalBelanja,Catatan,Rating_Review
 *   Projects:        ID,NamaProyek,Klien,NilaiProyek,Status,Deadline,Catatan,SOP_Checklist,PIC_Tim
 *   Finance:         ID,Tanggal,Tipe,Kategori,Nominal,Keterangan
 *   Memory:          ID,Tanggal,Kategori,Judul,Isi
 *   Marketing_Spend: ID,Tanggal,Platform,Kampanye,Budget,Terpakai,LeadsDihasilkan,Catatan
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- 1. Stub API Apps Script (minimal, in-memory) ----------
function makeSheet(headers) {
  // Setia dgn API nyata: sheet BARU = 0 baris (getLastRow()===0).
  // Sheet seed = [header, ...data].
  const rows = (headers && headers.length) ? [headers.slice()] : [];
  return {
    headers: (headers || []).slice(),
    rows,
    getLastRow() { return this.rows.length; },
    getLastColumn() { return this.rows.length ? this.rows[0].length : 0; },
    getSheetByName() { return null; },
    getName() { return 'stub'; },
    getDataRange() {
      const self = this;
      return { getValues() { return self.rows.map(r => r.slice()); } };
    },
    getRange(r, c, nr, nc) {
      const self = this;
      return {
        getValues() {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const row = [];
            for (let j = 0; j < nc; j++) row.push((self.rows[r - 1 + i] || [])[c - 1 + j]);
            out.push(row);
          }
          return out;
        },
        setValues(vals) {
          for (let i = 0; i < vals.length; i++)
            for (let j = 0; j < vals[i].length; j++)
              self.rows[r - 1 + i][c - 1 + j] = vals[i][j];
        },
        setValue(v) { self.rows[r - 1][c - 1] = v; },
        clearContent() { return this; },
        setFontWeight() { return this; },
        setBackground() { return this; },
        setFontColor() { return this; },
      };
    },
    appendRow(row) { this.rows.push(row.slice()); },
    setFrozenRows() {},
  };
}

const sheets = {};
const SpreadsheetAppStub = {
  getActiveSpreadsheet() {
    return {
      getSheetByName(name) { return sheets[name] || null; },
      insertSheet(name) { sheets[name] = makeSheet([]); return sheets[name]; },
    };
  },
};

const ContentServiceStub = {
  MimeType: { JSON: 'JSON' },
  createTextOutput(text) {
    return { _t: text, setMimeType() { return this; } };
  },
};
const ScriptAppStub = { getProjectTriggers() { return []; } };

// ---------- 2. Muat google_apps_script.js ke sandbox ----------
const src = fs.readFileSync(path.join(__dirname, 'google_apps_script.js'), 'utf8');
const sandbox = {
  SpreadsheetApp: SpreadsheetAppStub,
  ContentService: ContentServiceStub,
  ScriptApp: ScriptAppStub,
  console,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

// ---------- 3. Mini test runner ----------
let pass = 0, fail = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; failures.push(`FAIL ${label}\n  expected: ${e}\n  actual:   ${a}`); }
}

// ---------- 4. Siapkan Sheet sesuai hasil Tahap 1-2 ----------
function seed(name, headers, dataRows) {
  const s = makeSheet(headers);
  dataRows.forEach(r => s.appendRow(r));
  sheets[name] = s;
}
seed('Leads', ['ID','Tanggal','Nama','WhatsApp','Sumber','EstimasiNilai','Status','Catatan'], [
  ['L1','2026-09-01','Budi','081','IG','8000000','won','ok'],
]);
seed('Clients', ['ID','NamaKlien','WhatsApp','TotalProyek','TotalBelanja','Catatan','Rating_Review'], [
  ['C1','Budi','081',1,8000000,'loyal','5 | Sangat puas'],
]);
seed('Projects', ['ID','NamaProyek','Klien','NilaiProyek','Status','Deadline','Catatan','SOP_Checklist','PIC_Tim'], [
  ['P1','Branding','Budi',8000000,'ongoing','2026-09-20','n','Brief:1;Produksi:0;Review:0;Revisi:0;Delivery:0','Andi'],
]);
seed('Finance', ['ID','Tanggal','Tipe','Kategori','Nominal','Keterangan'], [
  ['F1','2026-09-02','income','DP Proyek',4000000,'DP 50%'],
]);
seed('Memory', ['ID','Tanggal','Kategori','Judul','Isi'], [
  ['M1','2026-09-02','Strategi','Formula','isi'],
]);
seed('Marketing_Spend', ['ID','Tanggal','Platform','Kampanye','Budget','Terpakai','LeadsDihasilkan','Catatan'], [
  ['K1','2026-09-04','Meta Ads','Sept',1000000,500000,8,''],
]);

// ---------- 5. Tes KONTRAK: FIELD_MAP harus ada & lengkap ----------
const FIELD_MAP = sandbox.FIELD_MAP;
eq(typeof FIELD_MAP, 'object', 'FIELD_MAP diekspor sebagai objek');
if (FIELD_MAP) {
  eq(Object.keys(FIELD_MAP).sort(),
    ['Clients','Finance','Leads','Marketing_Spend','Memory','Projects'].sort(),
    'FIELD_MAP mencakup 6 tab');
  eq(FIELD_MAP.Projects.headers,
    ['ID','NamaProyek','Klien','NilaiProyek','Status','Deadline','Catatan','SOP_Checklist','PIC_Tim'],
    'FIELD_MAP.Projects.headers = hasil Tahap 2 + PIC_Tim');
  eq(FIELD_MAP.Clients.fields,
    ['id','name','phone','projectsCount','totalSpend','notes','rating','review'],
    'FIELD_MAP.Clients.fields memakai rating+review (bukan ratingReview)');
  eq(FIELD_MAP.Projects.fields,
    ['id','title','client','value','status','deadline','notes','sopChecklist','pic'],
    'FIELD_MAP.Projects.fields memuat pic');
}

// ---------- 6. Tes BACA (doGet): Sheet -> field HTML ----------
function callDoGet() {
  const out = sandbox.doGet({});
  return JSON.parse(out._t);
}
const got = callDoGet();
eq(got.status, 'success', 'doGet status success');
if (got.status === 'success') {
  eq(got.data.leads[0].name, 'Budi', 'doGet Leads Nama -> name');
  eq(got.data.clients[0].rating, 5, 'doGet Clients "5 | Sangat puas" -> rating=5');
  eq(got.data.clients[0].review, 'Sangat puas', 'doGet Clients "5 | Sangat puas" -> review');
  eq(got.data.projects[0].pic, 'Andi', 'doGet Projects PIC_Tim -> pic');
  eq(got.data.projects[0].sopChecklist, 'Brief:1;Produksi:0;Review:0;Revisi:0;Delivery:0', 'doGet SOP_Checklist lolos apa adanya');
  eq(got.data.finance[0].amount, 4000000, 'doGet Finance Nominal -> amount');
  eq(got.data.marketingSpend[0].spent, 500000, 'doGet Marketing Terpakai -> spent');
  eq(got.data.marketingSpend[0].leadsGenerated, 8, 'doGet Marketing LeadsDihasilkan -> leadsGenerated');
}

// ---------- 7. Tes TULIS (sync_all): field HTML -> kolom Sheet yang benar ----------
function callDoPost(payload) {
  const out = sandbox.doPost({ postData: { contents: JSON.stringify(payload) } });
  return JSON.parse(out._t);
}
const postRes = callDoPost({
  action: 'sync_all',
  leads: [{ id: 'L9', date: '2026-09-10', name: 'Sari', phone: '082', source: 'WA', value: 1500000, status: 'new', notes: 'n' }],
  clients: [{ id: 'C9', name: 'Sari', phone: '082', projectsCount: 0, totalSpend: 0, notes: '', rating: 4, review: 'Bagus' }],
  projects: [{ id: 'P9', title: 'Logo', client: 'Sari', value: 1500000, status: 'plan', deadline: '2026-09-30', notes: '', sopChecklist: 'Brief:0;Produksi:0;Review:0;Revisi:0;Delivery:0', pic: 'Beni' }],
  finance: [{ id: 'F9', date: '2026-09-10', type: 'expense', category: 'Operasional', amount: 100000, description: 'd' }],
  memory: [{ id: 'M9', date: '2026-09-10', category: 'SOP', title: 't', content: 'c' }],
  marketingSpend: [{ id: 'K9', date: '2026-09-10', platform: 'TikTok Ads', campaign: 'k', budget: 200000, spent: 100000, leadsGenerated: 5, notes: '' }],
});
eq(postRes.status, 'success', 'sync_all status success');
// Baris 2 (index 1) tiap sheet harus berisi value di kolom yang tepat:
eq(sheets['Leads'].rows[1][2], 'Sari', 'sync Leads: Nama di kolom C');
eq(sheets['Leads'].rows[1][6], 'new', 'sync Leads: Status di kolom G');
eq(sheets['Clients'].rows[1][6], '4 | Bagus', 'sync Clients: rating+review digabung ke Rating_Review (kolom G)');
eq(sheets['Projects'].rows[1][7], 'Brief:0;Produksi:0;Review:0;Revisi:0;Delivery:0', 'sync Projects: SOP di kolom H');
eq(sheets['Projects'].rows[1][8], 'Beni', 'sync Projects: pic di kolom I (PIC_Tim)');
eq(sheets['Finance'].rows[1][4], 100000, 'sync Finance: Nominal di kolom E');
eq(sheets['Marketing_Spend'].rows[1][6], 5, 'sync Marketing: LeadsDihasilkan di kolom G');

// ---------- 8. Tes update_status tetap jalan ----------
const upd = callDoPost({ action: 'update_status', sheet: 'Leads', id: 'L9', status: 'nego' });
eq(upd.status, 'success', 'update_status nego success');
eq(sheets['Leads'].rows[1][6], 'nego', 'update_status menulis kolom Status yang benar');

// ---------- 9. Tes insert memakai header Sheet ----------
const ins = callDoPost({ action: 'insert', sheet: 'Memory', data: { id: 'M10', date: '2026-09-11', category: 'Ide', title: 'x', content: 'y' } });
eq(ins.status, 'success', 'insert Memory success');
const lastMem = sheets['Memory'].rows[sheets['Memory'].rows.length - 1];
eq(lastMem[3], 'x', 'insert Memory: Judul di kolom D (ikut header Sheet, bukan keyOrder lama)');

// ---------- 10. Ringkasan ----------
console.log(`\nmapping.test.js: ${pass} lolos, ${fail} gagal`);
failures.forEach(f => console.log(f));
process.exit(fail === 0 ? 0 : 1);
