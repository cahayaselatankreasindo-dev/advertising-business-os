/**
 * mapping.test.js — Tahap 3: Samakan mapping React <-> Apps Script.
 *
 * Cara jalan: node mapping.test.js   (exit 0 = semua lolos)
 *
 * File ini memuat google_apps_script.js apa adanya ke dalam sandbox Node
 * dengan stub SpreadsheetApp/ContentService/ScriptApp minimal, lalu
 * memverifikasi KONTRAK MAPPING dua arah untuk seluruh tab:
 *   Sheet header (huruf besar, hasil Tahap 1-2) <-> field HTML (camelCase)
 *
 * Aturan kontrak (single source of truth = FIELD_MAP):
 *   Leads:           ID,Tanggal,Nama,WhatsApp,Sumber,EstimasiNilai,Status,Catatan,NextFollowUp,LastContactAt,FollowUpNote
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
        getValue() { return (self.rows[r - 1] || [])[c - 1]; },
        setValues(vals) {
          // Tiru Google Sheets asli: range di luar data otomatis memperluas sheet.
          for (let i = 0; i < vals.length; i++) {
            const rowIdx = r - 1 + i;
            if (!self.rows[rowIdx]) self.rows[rowIdx] = [];
            for (let j = 0; j < vals[i].length; j++)
              self.rows[rowIdx][c - 1 + j] = vals[i][j];
          }
        },
        setValue(v) {
          const rowIdx = r - 1;
          if (!self.rows[rowIdx]) self.rows[rowIdx] = [];
          self.rows[rowIdx][c - 1] = v;
        },
        clearContent() { return this; },
        setFontWeight() { return this; },
        setBackground() { return this; },
        setFontColor() { return this; },
      };
    },
    appendRow(row) { this.rows.push(row.slice()); },
    clear() { this.rows.length = 0; },
    deleteRow(r) { this.rows.splice(r - 1, 1); },
    setFrozenRows() {},
  };
}

const sheets = {};
const SpreadsheetAppStub = {
  getActiveSpreadsheet() {
    return {
      getSheetByName(name) { return sheets[name] || null; },
      insertSheet(name) { sheets[name] = makeSheet([]); return sheets[name]; },
      getSheets() { return Object.keys(sheets).map(k => sheets[k]); },
      deleteSheet(s) { /* noop di stub */ },
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
const LockServiceStub = { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } };
const LoggerStub = { log() {} };
// Stub PropertiesService (in-memory) untuk fitur token API
const _props = {};
const PropertiesServiceStub = {
  getScriptProperties() {
    return {
      getProperty(k) { return (k in _props) ? _props[k] : null; },
      setProperty(k, v) { _props[k] = v; },
      setProperties(values, deleteAll) {
        if (deleteAll) Object.keys(_props).forEach(k => delete _props[k]);
        Object.assign(_props, values);
      },
    };
  },
};
const _cache = new Map();
const CacheServiceStub = {
  getScriptCache() {
    return {
      get(k) { return _cache.has(k) ? _cache.get(k) : null; },
      put(k, v) { _cache.set(k, String(v)); },
      remove(k) { _cache.delete(k); },
    };
  },
};
let uuidCounter = 0;
function fakeDigest(value) {
  let h = 2166136261 >>> 0;
  const str = String(value);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const out = [];
  for (let i = 0; i < 32; i++) { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; out.push((h >>> 24) & 255); }
  return out;
}
const MailAppStub = { getRemainingDailyQuota() { return 100; }, sendEmail() {} };
const UtilitiesStub = {
  formatDate() { return '2026-10-09'; },
  getUuid() { uuidCounter++; return 'test-uuid-' + uuidCounter; },
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  computeDigest(algorithm, value) { return fakeDigest(value); },
};

// ---------- 2. Muat google_apps_script.js ke sandbox ----------
const src = fs.readFileSync(path.join(__dirname, 'google_apps_script.js'), 'utf8');
const sandbox = {
  SpreadsheetApp: SpreadsheetAppStub,
  ContentService: ContentServiceStub,
  ScriptApp: ScriptAppStub,
  LockService: LockServiceStub,
  Logger: LoggerStub,
  PropertiesService: PropertiesServiceStub,
  CacheService: CacheServiceStub,
  MailApp: MailAppStub,
  Utilities: UtilitiesStub,
  console,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

// Autentikasi uji menggunakan PIN Owner dan Tim yang berbeda.
_props['API_TOKEN'] = 'legacy-token-must-remain-unused';
_props['UNRELATED_PROPERTY'] = 'preserve-this-value';
sandbox.setupCSKPinCredentials('12345678', '87654321');
const OWNER_SESSION = 'O'.repeat(43);
const TEAM_SESSION = 'T'.repeat(43);
function login(email, pin, sessionId) {
  const out = sandbox.doPost({ postData: { contents: JSON.stringify({ action: 'login', email, pin, sessionId }) } });
  return JSON.parse(out._t);
}
const ownerLogin = login('cahayaselatankreasindo@gmail.com', '12345678', OWNER_SESSION);
const teamLogin = login('zefdas@gmail.com', '87654321', TEAM_SESSION);

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
seed('Projects', ['ID','NamaProyek','Klien','NilaiProyek','Status','Deadline','Catatan','SOP_Checklist','PIC_Tim','SuggestedPrice','SourceQuotationID','SourceInvoiceID'], [
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

// Legacy cost history is seeded separately and must remain read-only.
const legacyCostItems = JSON.stringify([
  { id:'LCI-1', name:'PVC 5 mm', category:'material', source:'vendor', qty:1, unitCost:180000 },
  { id:'LCI-2', name:'Potong dan rakit', category:'labor', source:'internal', qty:1, unitCost:125000 }
]);
const legacyQuotationHistory = JSON.stringify([
  { docNo:'QUO-LEGACY-001', version:1, status:'sent', quotedPrice:420000 }
]);
seed('Costings', [
  'ID','Tanggal','Klien','NamaPekerjaan','ModelProduksi','LeadID','ItemsJSON','BiayaLangsung',
  'OverheadPersen','OverheadNominal','CadanganPersen','CadanganNominal','HPP','MarginPersen',
  'HargaPenawaran','Status','ProjectID','Catatan','NomorQuotation','VersiQuotation',
  'MasaBerlakuHari','WaktuPengerjaanHari','SyaratPembayaran','RuangLingkup','DisetujuiPada',
  'POConfirmedAt','RiwayatQuotationJSON','DikirimPada'
], [[
  'LEGACY-COST-1','2026-11-01','PT Arsip Dummy','Rak Display','hybrid','L1',legacyCostItems,
  305000,5,15250,3,9608,329858,30,471226,'sent','P1','arsip lama','QUO-LEGACY-001',1,
  14,10,'DP 50%','Ruang lingkup arsip','','',legacyQuotationHistory,'2026-11-02'
]]);
seed('Project_Costs', [
  'ID','Tanggal','ProjectID','Kategori','Sumber','Deskripsi','Vendor','Qty',
  'HargaSatuan','Nominal','StatusPembayaran','Referensi','Catatan'
], [[
  'LEGACY-PCOST-1','2026-11-03','P1','finishing','vendor','Finishing arsip','Vendor Dummy',
  1,75000,75000,'unpaid','REF-LEGACY-1','read-only archive'
]]);

// ---------- 5. Tes KONTRAK: FIELD_MAP harus ada & lengkap ----------
const FIELD_MAP = sandbox.FIELD_MAP;
eq(typeof FIELD_MAP, 'object', 'FIELD_MAP diekspor sebagai objek');
if (FIELD_MAP) {
  eq(Object.keys(FIELD_MAP).sort(),
    ['Clients','Commercial_Quotations','Cost_Sheets','Finance','Invoice_Payments','Invoices','Leads','Marketing_Spend','Materials','Memory','Projects','Purchase_Orders','Quotations','Services'].sort(),
    'FIELD_MAP mencakup 14 tab');
  eq(FIELD_MAP.Leads.headers.slice(-3),
    ['NextFollowUp','LastContactAt','FollowUpNote'],
    'FIELD_MAP.Leads menambahkan field follow-up di kanan');
  eq(FIELD_MAP.Leads.fields.slice(-3),
    ['nextFollowUp','lastContactAt','followUpNote'],
    'FIELD_MAP.Leads fields follow-up lengkap');
  eq(FIELD_MAP.Projects.headers,
    ['ID','NamaProyek','Klien','NilaiProyek','Status','Deadline','Catatan','SOP_Checklist','PIC_Tim','SuggestedPrice','SourceQuotationID','SourceInvoiceID'],
    'FIELD_MAP.Projects.headers = hasil Tahap 2 + PIC_Tim');
  eq(FIELD_MAP.Clients.fields,
    ['id','name','phone','projectsCount','totalSpend','notes','rating','review'],
    'FIELD_MAP.Clients.fields memakai rating+review (bukan ratingReview)');
  eq(FIELD_MAP.Projects.fields,
    ['id','title','client','value','status','deadline','notes','sopChecklist','pic','suggestedPrice','sourceQuotationId','sourceInvoiceId'],
    'FIELD_MAP.Projects.fields memuat referensi dokumen');
  eq(FIELD_MAP.Commercial_Quotations.fields,
    ['id','projectId','leadId','projectName','client','clientPhone','clientEmail','clientAddress','contactPerson','docNo','date','dueDate','linesJson','subtotal','discount','taxRate','taxAmount','total','dpPercent','terms','paymentTerms','notes','status','convertedInvoiceId','createdAt','updatedAt'],
    'FIELD_MAP.Commercial_Quotations.fields lengkap');
  eq(FIELD_MAP.Invoices.fields,
    ['id','projectId','leadId','quotationId','sourceQuotationId','projectName','client','clientPhone','clientEmail','clientAddress','contactPerson','docNo','date','dueDate','linesJson','subtotal','discount','taxRate','taxAmount','total','dpPercent','paymentTerms','terms','notes','status','createdAt','updatedAt'],
    'FIELD_MAP.Invoices.fields lengkap');
  eq(FIELD_MAP.Invoice_Payments.fields,
    ['id','invoiceId','invoiceNo','paymentDate','paymentType','amount','method','reference','notes','financeId','createdAt','createdBy'],
    'FIELD_MAP.Invoice_Payments.fields lengkap');
}

// ---------- 6. Tes BACA (doGet): Sheet -> field HTML ----------
function callDoGet(sessionId = OWNER_SESSION) {
  const out = sandbox.doGet({ parameter: sessionId ? { sessionId } : {} });
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
  eq(got.data.legacyCostings[0].id, 'LEGACY-COST-1', 'doGet reads legacy Costings without adding it to FIELD_MAP');
  eq(got.data.legacyCostings[0].jobName, 'Rak Display', 'legacy Costings maps NamaPekerjaan -> jobName');
  eq(got.data.legacyCostings[0].items[1].unitCost, 125000, 'legacy Costings ItemsJSON is decoded');
  eq(got.data.legacyCostings[0].quotationHistory[0].docNo, 'QUO-LEGACY-001', 'legacy quotation history JSON is decoded');
  eq(got.data.legacyCostings[0].readOnly, true, 'legacy Costings is marked read-only');
  eq(got.data.projectCosts[0].amount, 75000, 'legacy Project_Costs maps Nominal -> amount');
  eq(got.data.projectCosts[0].paymentStatus, 'unpaid', 'legacy Project_Costs maps payment status');
}

// ---------- 7. Tes TULIS (sync_all): MERGE — tidak menghapus data lama ----------
function callDoPost(payload, sessionId = OWNER_SESSION) {
  const request = Object.assign({}, payload);
  if (sessionId) request.sessionId = sessionId;
  else delete request.sessionId;
  const out = sandbox.doPost({ postData: { contents: JSON.stringify(request) } });
  return JSON.parse(out._t);
}
const leadsBefore = sheets['Leads'].rows.length;
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

// (a) Data LAMA harus tetap ada (ini inti fix — tidak boleh terhapus)
eq(sheets['Leads'].rows.length, leadsBefore + 1, 'sync_all MERGE: data lama dipertahankan, baris baru ditambah');
eq(sheets['Leads'].rows[1][2], 'Budi', 'sync_all MERGE: lead lama (Budi) tidak terhapus');

// (b) Baris BARU ditulis di kolom yang tepat (cari by ID — autoTrigger bisa menambah baris lain)
const findRow = (sheetName, id) => sheets[sheetName].rows.find(r => String(r[0]) === id);
const newLeadRow = findRow('Leads', 'L9');
eq(newLeadRow[0], 'L9', 'sync new Lead: ID di kolom A');
eq(newLeadRow[2], 'Sari', 'sync new Lead: Nama di kolom C');
eq(newLeadRow[6], 'new', 'sync new Lead: Status di kolom G');

const newClientRow = findRow('Clients', 'C9');
eq(newClientRow[6], '4 | Bagus', 'sync new Client: rating+review digabung ke Rating_Review (kolom G)');

const newProjRow = findRow('Projects', 'P9');
eq(newProjRow[7], 'Brief:0;Produksi:0;Review:0;Revisi:0;Delivery:0', 'sync new Project: SOP di kolom H');
eq(newProjRow[8], 'Beni', 'sync new Project: pic di kolom I (PIC_Tim)');

const newFinRow = findRow('Finance', 'F9');
eq(newFinRow[4], 100000, 'sync new Finance: Nominal di kolom E');

const newMkRow = findRow('Marketing_Spend', 'K9');
eq(newMkRow[6], 5, 'sync new Marketing: LeadsDihasilkan di kolom G');

// (c) sync_all ID yang SUDAH ADA -> diupdate, bukan diduplikasi
const leadsBefore2 = sheets['Leads'].rows.length;
callDoPost({ action: 'sync_all', leads: [{ id: 'L1', date: '2026-09-01', name: 'Budi Updated', phone: '081', source: 'IG', value: 8000000, status: 'won', notes: 'ok' }] });
eq(sheets['Leads'].rows.length, leadsBefore2, 'sync_all UPSERT: ID lama diupdate, tidak menambah baris');
eq(sheets['Leads'].rows[1][2], 'Budi Updated', 'sync_all UPSERT: nilai lead lama benar-benar terupdate');

// (d) Duplikat ID dalam SATU payload -> hanya ditulis sekali
const leadsBefore3 = sheets['Leads'].rows.length;
callDoPost({ action: 'sync_all', leads: [
  { id: 'LDUP', date: '2026-09-12', name: 'Dup', phone: '0', source: 'x', value: 1, status: 'new', notes: '' },
  { id: 'LDUP', date: '2026-09-12', name: 'Dup', phone: '0', source: 'x', value: 1, status: 'new', notes: '' },
] });
eq(sheets['Leads'].rows.length, leadsBefore3 + 1, 'sync_all: ID duplikat dalam 1 payload hanya ditulis sekali');

// ---------- 8. Tes update_status tetap jalan ----------
const upd = callDoPost({ action: 'update_status', sheet: 'Leads', id: 'L9', status: 'nego' });
eq(upd.status, 'success', 'update_status nego success');
const l9Row = sheets['Leads'].rows.find(r => String(r[0]) === 'L9');
eq(l9Row[6], 'nego', 'update_status menulis kolom Status yang benar');

// ---------- 9. Tes insert memakai header Sheet ----------
const ins = callDoPost({ action: 'insert', sheet: 'Memory', data: { id: 'M10', date: '2026-09-11', category: 'Ide', title: 'x', content: 'y' } });
eq(ins.status, 'success', 'insert Memory success');
const lastMem = sheets['Memory'].rows[sheets['Memory'].rows.length - 1];
eq(lastMem[3], 'x', 'insert Memory: Judul di kolom D (ikut header Sheet, bukan keyOrder lama)');

// ---------- 9b. Tes KOLOM B2B BARU (migrasi skema + tulis by-name) ----------
// Setelah sync, sheet Leads harus punya kolom B2B baru di kanan (tidak menggeser kolom lama).
const leadHeaders = sheets['Leads'].rows[0].map(h => String(h).trim());
['Email', 'Website', 'Industri', 'PIC', 'JabatanPIC', 'LinkedIn', 'SkorPrioritas'].forEach(h => {
  eq(leadHeaders.indexOf(h) !== -1, true, `migrasi: kolom '${h}' otomatis ditambahkan ke Leads`);
});
// Kolom lama tidak bergeser posisinya
eq(leadHeaders[0], 'ID', 'migrasi: kolom A tetap ID');
eq(leadHeaders[2], 'Nama', 'migrasi: kolom C tetap Nama');
eq(leadHeaders[7], 'Catatan', 'migrasi: kolom H tetap Catatan');

// Tulis lead dengan field B2B -> harus masuk ke kolom yang BENAR (by name)
callDoPost({ action: 'sync_all', leads: [{
  id: 'LB2B', date: '2026-10-09', name: 'PT Mayora Indah', phone: '', source: 'IndoBuildTech',
  value: 0, status: 'new', notes: 'FMCG',
  email: 'vendor@mayora.co.id', website: 'https://www.mayoraindah.co.id', industry: 'FMCG',
  pic: 'Budi Santoso', picTitle: 'Procurement Manager', linkedin: 'https://linkedin.com/in/budi', score: 85
}] });
const b2bRow = findRow('Leads', 'LB2B');
const colOf = (name) => leadHeaders.indexOf(name);
eq(b2bRow[colOf('Email')], 'vendor@mayora.co.id', 'B2B: Email masuk kolom Email');
eq(b2bRow[colOf('Website')], 'https://www.mayoraindah.co.id', 'B2B: Website masuk kolom Website');
eq(b2bRow[colOf('Industri')], 'FMCG', 'B2B: Industri masuk kolom Industri');
eq(b2bRow[colOf('PIC')], 'Budi Santoso', 'B2B: PIC masuk kolom PIC');
eq(b2bRow[colOf('JabatanPIC')], 'Procurement Manager', 'B2B: JabatanPIC masuk kolom JabatanPIC');
eq(b2bRow[colOf('LinkedIn')], 'https://linkedin.com/in/budi', 'B2B: LinkedIn masuk kolom LinkedIn');
eq(b2bRow[colOf('SkorPrioritas')], 85, 'B2B: SkorPrioritas masuk kolom SkorPrioritas');

// doGet harus mengembalikan field B2B sebagai camelCase
const gotB2B = callDoGet().data.leads.find(l => String(l.id) === 'LB2B');
eq(gotB2B.email, 'vendor@mayora.co.id', 'doGet: Email -> email');
eq(gotB2B.website, 'https://www.mayoraindah.co.id', 'doGet: Website -> website');
eq(gotB2B.industry, 'FMCG', 'doGet: Industri -> industry');
eq(gotB2B.pic, 'Budi Santoso', 'doGet: PIC -> pic');
eq(gotB2B.picTitle, 'Procurement Manager', 'doGet: JabatanPIC -> picTitle');
eq(gotB2B.score, 85, 'doGet: SkorPrioritas -> score');

// ---------- 9c. Migrasi aman: header ambigu tidak boleh menghapus data ----------
const duplicateLeads = makeSheet([
  'ID','TANGGAL','Nama','Whatsapp','SUMBER','ESTIMASINILAI','STATUS','CATATAN',
  'Tanggal','WhatsApp','Sumber','EstimasiNilai','Status','Catatan',
  'Email','Website','Industri','PIC','JabatanPIC','LinkedIn','SkorPrioritas'
]);
duplicateLeads.appendRow(['L-OLD','2026-09-01','Budi','081','IG',8000000,'won','ok','','','','','','','','','','','','','']);
sheets['Leads'] = duplicateLeads;
const duplicateBefore = JSON.stringify(duplicateLeads.rows);
const beforeSetupNames = Object.keys(sheets).sort();
const beforeSetupState = JSON.stringify(beforeSetupNames.map(name => [name, sheets[name].rows]));
let duplicateError = '';
try { sandbox.setupSheet(); } catch (err) { duplicateError = String(err.message || err); }
eq(!!duplicateError, true, 'migrasi aman: header duplikat menghentikan setup');
eq(JSON.stringify(duplicateLeads.rows), duplicateBefore, 'migrasi aman: semua data Leads dipertahankan saat header duplikat');
eq(JSON.stringify(Object.keys(sheets).sort()), JSON.stringify(beforeSetupNames), 'migrasi aman: setup tidak membuat tab sebelum preflight selesai');
eq(JSON.stringify(Object.keys(sheets).sort().map(name => [name, sheets[name].rows])), beforeSetupState, 'migrasi aman: setup tidak mengubah tab/data apa pun saat preflight gagal');
eq(duplicateError.indexOf('tidak ada data yang diubah') !== -1, true, 'migrasi aman: error menegaskan tidak ada perubahan');

sheets['Leads'] = makeSheet([
  'ID','TANGGAL','Nama','Whatsapp','SUMBER','ESTIMASINILAI','STATUS','CATATAN',
  'Email','Website','Industri','PIC','JabatanPIC','LinkedIn','SkorPrioritas'
]);
sheets['Leads'].appendRow(['L-OLD','2026-09-01','Budi','081','IG',8000000,'won','ok','','','','','','','']);

// Simulasikan header database aktif yang sudah diverifikasi: Leads 15 kolom,
// Projects 9 kolom. Migrasi harus menambahkan kolom baru di kanan tanpa
// menggeser atau menghilangkan data lama.
const legacyProjectSheet = sheets['Projects'];
legacyProjectSheet.rows = legacyProjectSheet.rows.map(row => row.slice(0, 9));
legacyProjectSheet.rows[0] = ['ID','NAMAPROYEK','klien','NILAIPROYEK','STATUS','DEADLINE','CATATAN','SOP_Checklist','PIC_Tim'];
legacyProjectSheet.headers = legacyProjectSheet.rows[0].slice();
const legacyProjectRecord = legacyProjectSheet.rows.find(row => String(row[0]) === 'P1').slice();

sandbox.setupSheet();

const h2 = sheets['Leads'].rows[0].map(h => String(h).trim().toLowerCase());
const migratedLeadHeaders = sheets['Leads'].rows[0].map(h => String(h).trim());
['NextFollowUp','LastContactAt','FollowUpNote'].forEach(h => {
  eq(migratedLeadHeaders.indexOf(h) !== -1, true, `migrasi produksi: kolom '${h}' ditambahkan ke kanan Leads`);
});
eq(migratedLeadHeaders.slice(0, 15).map(x => x.toLowerCase()), [
  'id','tanggal','nama','whatsapp','sumber','estimasinilai','status','catatan',
  'email','website','industri','pic','jabatanpic','linkedin','skorprioritas'
], 'migrasi produksi: urutan 15 kolom Leads lama tetap');
const migratedProjectHeaders = sheets['Projects'].rows[0].map(h => String(h).trim());
eq(migratedProjectHeaders.slice(0, 9).map(x => x.toLowerCase()), [
  'id','namaproyek','klien','nilaiproyek','status','deadline','catatan','sop_checklist','pic_tim'
], 'migrasi produksi: urutan 9 kolom Projects lama tetap');
['SuggestedPrice','SourceQuotationID','SourceInvoiceID'].forEach(h => {
  eq(migratedProjectHeaders.indexOf(h) !== -1, true, `migrasi produksi: kolom '${h}' ditambahkan ke kanan Projects`);
});
const migratedProjectRecord = sheets['Projects'].rows.find(row => String(row[0]) === 'P1');
eq(migratedProjectRecord.slice(0, 9), legacyProjectRecord, 'migrasi produksi: nilai Projects lama tetap utuh');
['Commercial_Quotations','Invoices','Invoice_Payments'].forEach(name => {
  eq(!!sheets[name], true, `migrasi produksi: tab ${name} dibuat`);
  eq(sheets[name].rows[0].length, FIELD_MAP[name].headers.length, `migrasi produksi: header ${name} lengkap`);
});
eq(h2.filter(x => x === 'tanggal').length, 1, 'migrasi aman: header TANGGAL tetap tunggal');
eq(h2.filter(x => x === 'sumber').length, 1, 'migrasi aman: header SUMBER tetap tunggal');
eq(h2.filter(x => x === 'whatsapp').length, 1, 'migrasi aman: header Whatsapp tetap tunggal');
const oldRow2 = sheets['Leads'].rows.find(r => String(r[0]) === 'L-OLD');
eq(!!oldRow2, true, 'migrasi aman: baris lama tetap ada');
eq(oldRow2[2], 'Budi', 'migrasi aman: nilai kolom Nama tidak rusak');

callDoPost({ action: 'sync_all', leads: [{
  id: 'L-CAPS', date: '2026-10-09', name: 'PT Test Caps', phone: '0899',
  source: 'Referral', value: 5000000, status: 'new', notes: 'catatan caps',
  email: 'pic@testcaps.co.id', website: 'https://testcaps.co.id', industry: 'Retail',
  pic: 'Siti', picTitle: 'Store Dev Manager', linkedin: 'https://linkedin.com/in/siti', score: 90
}] });
const capsRow = sheets['Leads'].rows.find(r => String(r[0]) === 'L-CAPS');
const idx = (n) => h2.indexOf(n);
eq(capsRow[idx('email')], 'pic@testcaps.co.id', 'CAPS: Email masuk kolom Email');
eq(capsRow[idx('website')], 'https://testcaps.co.id', 'CAPS: Website masuk kolom Website');
eq(capsRow[idx('industri')], 'Retail', 'CAPS: Industri masuk kolom Industri');
eq(capsRow[idx('pic')], 'Siti', 'CAPS: PIC masuk kolom PIC');
eq(capsRow[idx('skorprioritas')], 90, 'CAPS: SkorPrioritas masuk kolom SkorPrioritas');
const gotCaps = callDoGet().data.leads.find(l => String(l.id) === 'L-CAPS');
eq(gotCaps.email, 'pic@testcaps.co.id', 'CAPS doGet: email terbaca benar');
eq(gotCaps.picTitle, 'Store Dev Manager', 'CAPS doGet: picTitle terbaca benar');

// ---------- 9c2. Kolom custom milik pengguna harus tetap terjaga saat upsert ----------
const customLeadSheet = sheets['Leads'];
const customColumnIndex = customLeadSheet.rows[0].length;
customLeadSheet.rows[0].push('Custom_Operational_Note');
const customLeadRow = customLeadSheet.rows.find(r => String(r[0]) === 'L-CAPS');
customLeadRow.push('jangan-hapus-catatan-ini');
const customUpsert = callDoPost({ action: 'sync_all', leads: [{
  id: 'L-CAPS', date: '2026-10-09', name: 'PT Test Caps', phone: '0899',
  source: 'Referral', value: 5000000, status: 'new', notes: 'catatan caps',
  email: 'pic@testcaps.co.id', website: 'https://testcaps.co.id', industry: 'Retail',
  pic: 'Siti', picTitle: 'Store Dev Manager', linkedin: 'https://linkedin.com/in/siti', score: 90,
  nextFollowUp: '2026-11-10', lastContactAt: '2026-11-08', followUpNote: 'Kirim revisi quotation'
}] });
eq(customUpsert.status, 'success', 'upsert dengan kolom custom tetap berhasil');
const customLeadAfter = customLeadSheet.rows.find(r => String(r[0]) === 'L-CAPS');
eq(customLeadAfter[customColumnIndex], 'jangan-hapus-catatan-ini', 'upsert mempertahankan isi kolom custom di luar FIELD_MAP');

// ---------- 9d. Tes action 'delete' (tombol hapus di app) ----------
const beforeDel = sheets['Leads'].rows.length;
const delRes = callDoPost({ action: 'delete', sheet: 'Leads', id: 'L-CAPS' });
eq(delRes.status, 'success', "delete: status success");
eq(sheets['Leads'].rows.find(r => String(r[0]) === 'L-CAPS'), undefined, 'delete: baris L-CAPS benar-benar terhapus');
eq(sheets['Leads'].rows.length, beforeDel - 1, 'delete: jumlah baris berkurang 1');
// Hapus ID yang tidak ada -> tidak error
const delRes2 = callDoPost({ action: 'delete', sheet: 'Leads', id: 'TIDAK-ADA-XYZ' });
eq(delRes2.status, 'success', 'delete: ID tidak ada tetap success (idempoten)');

// ---------- 9e. Tes KEAMANAN: PIN, sesi, dan RBAC server-side ----------
eq(ownerLogin.status, 'success', 'auth: Owner dapat login dengan email dan PIN yang benar');
eq(ownerLogin.identity.role, 'owner', 'auth: role Owner ditentukan server');
eq(teamLogin.status, 'success', 'auth: Tim dapat login dengan email dan PIN yang benar');
eq(teamLogin.identity.role, 'team', 'auth: role Tim ditentukan server');
eq(_props['API_TOKEN'], 'legacy-token-must-remain-unused', 'auth: setup PIN tidak menghapus properti API_TOKEN lama');
eq(_props['UNRELATED_PROPERTY'], 'preserve-this-value', 'auth: setup PIN mempertahankan Script Properties lain');

const wrongPin = login('cahayaselatankreasindo@gmail.com', '00000000', 'W'.repeat(43));
eq(wrongPin.status, 'error', 'auth: PIN salah ditolak');
const unknownEmail = login('intruder@example.com', '12345678', 'X'.repeat(43));
eq(unknownEmail.status, 'error', 'auth: email tidak terdaftar ditolak');

const noSessionGet = callDoGet(null);
eq(noSessionGet.status, 'error', 'auth: GET tanpa sesi ditolak');
const noSessionPost = callDoPost({ action: 'sync_all', leads: [{ id: 'NOSESSION', name: 'No Session' }] }, null);
eq(noSessionPost.status, 'error', 'auth: POST tanpa sesi ditolak');

const ownerData = callDoGet(OWNER_SESSION);
eq(ownerData.status, 'success', 'auth: Owner dapat membaca data');
eq(!!ownerData.data.finance, true, 'RBAC: Owner menerima data Finance');
eq(!!ownerData.data.marketingSpend, true, 'RBAC: Owner menerima data Marketing');
eq(ownerData.data.legacyCostings.length, 1, 'RBAC: Owner dapat membaca arsip Costings');
eq(ownerData.data.projectCosts.length, 1, 'RBAC: Owner dapat membaca arsip Project_Costs');
const legacyCostingsBefore = JSON.stringify(sheets['Costings'].rows);
const legacyProjectCostsBefore = JSON.stringify(sheets['Project_Costs'].rows);
const legacyWriteAttempt = callDoPost({ action:'sync_all', legacyCostings:[{ id:'SPOOF-LEGACY', hpp:1 }] }, OWNER_SESSION);
eq(legacyWriteAttempt.status, 'error', 'legacy Costings cannot be written through sync_all');
eq(legacyWriteAttempt.code, 'LEGACY_COST_DATA_READ_ONLY', 'legacy write rejection has an explicit reason');
eq(JSON.stringify(sheets['Costings'].rows), legacyCostingsBefore, 'legacy Costings source rows remain unchanged');
eq(JSON.stringify(sheets['Project_Costs'].rows), legacyProjectCostsBefore, 'legacy Project_Costs source rows remain unchanged');
eq(callDoPost({ action:'delete', sheet:'Costings', id:'LEGACY-COST-1' }, OWNER_SESSION).status, 'error', 'legacy Costings cannot be deleted through generic endpoint');
eq(JSON.stringify(sheets['Costings'].rows), legacyCostingsBefore, 'legacy Costings remains unchanged after delete attempt');

const teamData = callDoGet(TEAM_SESSION);
eq(teamData.status, 'success', 'auth: Tim dapat membaca data operasional');
eq(Object.prototype.hasOwnProperty.call(teamData.data, 'finance'), false, 'RBAC: Finance tidak dikirim kepada Tim');
eq(Object.prototype.hasOwnProperty.call(teamData.data, 'memory'), false, 'RBAC: Memory tidak dikirim kepada Tim');
eq(Object.prototype.hasOwnProperty.call(teamData.data, 'marketingSpend'), false, 'RBAC: Marketing tidak dikirim kepada Tim');
eq(Object.prototype.hasOwnProperty.call(teamData.data, 'legacyCostings'), false, 'RBAC: arsip Costings tidak dikirim kepada Tim');
eq(Object.prototype.hasOwnProperty.call(teamData.data, 'projectCosts'), false, 'RBAC: arsip Project_Costs tidak dikirim kepada Tim');

const financeBeforeTeam = sheets['Finance'].rows.length;
const forbiddenSync = callDoPost({ action: 'sync_all', finance: [{ id: 'HACK-FIN', amount: 999999 }] }, TEAM_SESSION);
eq(forbiddenSync.status, 'error', 'RBAC: Tim tidak dapat mengirim Finance');
eq(sheets['Finance'].rows.length, financeBeforeTeam, 'RBAC: Finance tidak berubah setelah percobaan Tim');

const forbiddenInsert = callDoPost({ action: 'insert', sheet: 'Finance', data: { id: 'HACK-FIN-2', amount: 1 } }, TEAM_SESSION);
eq(forbiddenInsert.status, 'error', 'RBAC: Tim tidak dapat insert Finance');

const forbiddenDelete = callDoPost({ action: 'delete', sheet: 'Finance', id: 'F1' }, TEAM_SESSION);
eq(forbiddenDelete.status, 'error', 'RBAC: Tim tidak dapat menghapus Finance');
eq(sheets['Finance'].rows.some(r => String(r[0]) === 'F1'), true, 'RBAC: baris Finance tetap utuh setelah percobaan hapus');

const forbiddenWon = callDoPost({ action: 'update_status', sheet: 'Leads', id: 'L9', status: 'won' }, TEAM_SESSION);
eq(forbiddenWon.status, 'error', 'RBAC: Tim tidak dapat menetapkan status Deal Menang');
const forbiddenNewWon = callDoPost({ action: 'sync_all', leads: [{ id: 'TEAM-WON', name: 'Team Won', status: 'won' }] }, TEAM_SESSION);
eq(forbiddenNewWon.status, 'error', 'RBAC: Tim tidak dapat menyisipkan Lead baru berstatus Deal Menang');

const allowedTeamSync = callDoPost({ action: 'sync_all', leads: [{ id: 'TEAM-OK', date: '2026-10-09', name: 'Team Allowed', phone: '', source: 'WA', value: 0, status: 'new', notes: '' }] }, TEAM_SESSION);
eq(allowedTeamSync.status, 'success', 'RBAC: Tim dapat sinkronisasi Leads operasional');
eq(!!sheets['Leads'].rows.find(r => String(r[0]) === 'TEAM-OK'), true, 'RBAC: Lead operasional Tim tersimpan');

const beforeOwnerWrite = sheets['Finance'].rows.length;
const ownerWrite = callDoPost({ action: 'sync_all', finance: [{ id: 'OWNER-FIN', date: '2026-10-09', type: 'expense', category: 'Test', amount: 1, description: 'Owner test' }] }, OWNER_SESSION);
eq(ownerWrite.status, 'success', 'RBAC: Owner dapat sinkronisasi Finance');
eq(sheets['Finance'].rows.length, beforeOwnerWrite + 1, 'RBAC: Finance hanya berubah melalui sesi Owner');

// Deal Won membuat antrean proyek, bukan pemasukan Finance.
const financeBeforeWonLead = sheets['Finance'].rows.length;
const wonLeadPayload = { action: 'sync_all', leads: [{
  id: 'L-WON-NO-FIN', date: '2026-11-09', name: 'Lead Belum Bayar', phone: '080',
  source: 'WA', value: 9000000, status: 'won', notes: ''
}] };
const wonLeadWrite = callDoPost(wonLeadPayload, OWNER_SESSION);
eq(wonLeadWrite.status, 'success', 'Deal Won owner tersimpan');
eq(sheets['Finance'].rows.length, financeBeforeWonLead, 'Deal Won tidak membuat pemasukan Finance');
const wonLeadToken = '[LEAD-L-WON-NO-FIN]';
const wonLeadProjects = () => sheets['Projects'].rows.filter(row => row.map(String).join('|').indexOf(wonLeadToken) !== -1);
eq(wonLeadProjects().length, 1, 'Deal Won membuat satu antrean proyek');
callDoPost(wonLeadPayload, OWNER_SESSION);
eq(sheets['Finance'].rows.length, financeBeforeWonLead, 'Sinkronisasi ulang Deal Won tetap tanpa pemasukan Finance');
eq(wonLeadProjects().length, 1, 'Antrean proyek Deal Won idempoten');

const logoutRes = callDoPost({ action: 'logout' }, TEAM_SESSION);
eq(logoutRes.status, 'success', 'auth: logout berhasil');
eq(callDoGet(TEAM_SESSION).status, 'error', 'auth: sesi yang logout tidak dapat digunakan lagi');


 // ---------- 9d. Commercial Document Center: storage, relations, and Owner-only access ----------
 const commercialWrite = callDoPost({
   action: 'sync_all',
   quotations: [{ id:'CQ1', projectId:'', leadId:'L1', projectName:'Booth', client:'PT Buyer', clientPhone:'081', clientEmail:'buyer@example.test', clientAddress:'Jakarta', contactPerson:'Ayu', docNo:'QUO-CSK-2026-00001', date:'2026-11-09', dueDate:'2026-11-23', lines:[{id:'QL1',name:'Backdrop',qty:2,unit:'unit',unitPrice:150000}], subtotal:300000, discount:10000, taxRate:11, taxAmount:31900, total:321900, dpPercent:50, terms:'Syarat quote', paymentTerms:'50% DP', notes:'Catatan quote', status:'draft', convertedInvoiceId:'CI1', createdAt:'2026-11-09T01:00:00.000Z', updatedAt:'2026-11-09T01:00:00.000Z' }],
   invoices: [{ id:'CI1', projectId:'', leadId:'L1', quotationId:'CQ1', sourceQuotationId:'CQ1', projectName:'Booth', client:'PT Buyer', clientPhone:'081', clientEmail:'buyer@example.test', clientAddress:'Jakarta', contactPerson:'Ayu', docNo:'INV-CSK-2026-00001', date:'2026-11-09', dueDate:'2026-11-16', lines:[{id:'IL1',name:'Backdrop',qty:2,unit:'unit',unitPrice:150000}], subtotal:300000, discount:0, taxRate:0, taxAmount:0, total:300000, dpPercent:50, paymentTerms:'Transfer', terms:'Syarat invoice', notes:'Catatan invoice', status:'draft', createdAt:'2026-11-09T01:00:00.000Z', updatedAt:'2026-11-09T01:00:00.000Z' }],
   projects: [{ id:'PC1', title:'Booth', client:'PT Buyer', value:300000, suggestedPrice:300000, status:'plan', deadline:'2026-11-16', notes:'From invoice', sopChecklist:'Brief:0', pic:'', sourceQuotationId:'CQ1', sourceInvoiceId:'CI1' }]
 }, OWNER_SESSION);
 eq(commercialWrite.status, 'success', 'Owner sync quotation, invoice, and project');
 eq(!!sheets['Commercial_Quotations'], true, 'Commercial_Quotations tab created');
 eq(!!sheets['Invoices'], true, 'Invoices tab created');
 const quoteRow = sheets['Commercial_Quotations'].rows.find(r => String(r[0]) === 'CQ1');
 const invoiceRow = sheets['Invoices'].rows.find(r => String(r[0]) === 'CI1');
 const projectDocRow = sheets['Projects'].rows.find(r => String(r[0]) === 'PC1');
 const quoteHeaders = sheets['Commercial_Quotations'].rows[0].map(String);
 const invoiceHeaders = sheets['Invoices'].rows[0].map(String);
 const projectHeaders = sheets['Projects'].rows[0].map(String);
 eq(quoteRow[quoteHeaders.indexOf('NomorDokumen')], 'QUO-CSK-2026-00001', 'Quotation number persisted');
 eq(JSON.parse(quoteRow[quoteHeaders.indexOf('LinesJSON')])[0].name, 'Backdrop', 'Quotation item JSON persisted');
 eq(invoiceRow[invoiceHeaders.indexOf('NomorDokumen')], 'INV-CSK-2026-00001', 'Invoice number persisted');
 eq(invoiceRow[invoiceHeaders.indexOf('SourceQuotationID')], 'CQ1', 'Invoice source quotation persisted');
 eq(projectDocRow[projectHeaders.indexOf('SourceInvoiceID')], 'CI1', 'Project source invoice persisted');
 eq(sheets['Quotations'].rows[0][0], 'ID', 'Legacy HPP quotation tab remains separate');
 const ownerCommercialData = callDoGet(OWNER_SESSION);
 eq(ownerCommercialData.data.quotations[0].id, 'CQ1', 'Owner reads commercial quotation');
 eq(ownerCommercialData.data.invoices[0].id, 'CI1', 'Owner reads invoice');
 eq(Array.isArray(ownerCommercialData.data.invoicePayments), true, 'Owner reads invoice payment ledger');
 eq(ownerCommercialData.data.quotations[0].lines[0].name, 'Backdrop', 'Quotation line JSON decodes');
 eq(ownerCommercialData.data.invoices[0].quotationId, 'CQ1', 'Invoice quotation relation reads');
 eq(ownerCommercialData.data.projects.find(x => x.id === 'PC1').sourceInvoiceId, 'CI1', 'Project invoice relation reads');
 const TEAM_SESSION_COMMERCIAL = 'C'.repeat(43);
 const teamCommercialLogin = login('zefdas@gmail.com', '87654321', TEAM_SESSION_COMMERCIAL);
 eq(teamCommercialLogin.status, 'success', 'Team can start a fresh session for access tests');
 const teamCommercialData = callDoGet(TEAM_SESSION_COMMERCIAL);
 eq(Object.prototype.hasOwnProperty.call(teamCommercialData.data, 'quotations'), false, 'Team cannot read quotations');
 eq(Object.prototype.hasOwnProperty.call(teamCommercialData.data, 'invoices'), false, 'Team cannot read invoices');
 eq(Object.prototype.hasOwnProperty.call(teamCommercialData.data, 'invoicePayments'), false, 'Team cannot read invoice payment ledger');
 const beforeTeamCommercial = sheets['Invoices'].rows.length;
 eq(callDoPost({ action:'sync_all', invoices:[{id:'TEAM-I',docNo:'INV-TEAM'}] }, TEAM_SESSION_COMMERCIAL).status, 'error', 'Team cannot sync invoices');
 eq(callDoPost({ action:'sync_all', quotations:[{id:'TEAM-Q',docNo:'QUO-TEAM'}] }, TEAM_SESSION_COMMERCIAL).status, 'error', 'Team cannot sync quotations');
 eq(sheets['Invoices'].rows.length, beforeTeamCommercial, 'Team invoice write denied');
 eq(callDoPost({ action:'delete', sheet:'Invoices', id:'CI1' }, TEAM_SESSION_COMMERCIAL).status, 'error', 'Team cannot delete invoices');

 // ---------- 9e. Invoice payment ledger -> Finance: DP, cicilan, pelunasan, idempotency ----------
 const payment1 = { id:'PAY-CI1-DP-001', invoiceId:'CI1', paymentDate:'2026-11-10', paymentType:'dp', amount:100000, method:'transfer', reference:'TRX-DP-001', notes:'DP pertama' };
 const financeBeforePayment = sheets['Finance'].rows.length;
 const paymentWrite1 = callDoPost({ action:'record_invoice_payment', payment:payment1 }, OWNER_SESSION);
 eq(paymentWrite1.status, 'success', 'Owner can record invoice DP');
 eq(sheets['Invoice_Payments'].rows.length, 2, 'DP creates one ledger row');
 eq(sheets['Finance'].rows.length, financeBeforePayment + 1, 'DP creates one Finance income row');
 const paymentHeaders = sheets['Invoice_Payments'].rows[0].map(String);
 const paymentRow = sheets['Invoice_Payments'].rows.find(r => String(r[0]) === payment1.id);
 const financePaymentId = 'FIN-PAY-' + payment1.id;
 const dpFinanceRow = sheets['Finance'].rows.find(r => String(r[0]) === financePaymentId);
 eq(paymentRow[paymentHeaders.indexOf('InvoiceID')], 'CI1', 'Payment links to invoice');
 eq(paymentRow[paymentHeaders.indexOf('Nominal')], 100000, 'Payment amount persists');
 eq(paymentRow[paymentHeaders.indexOf('FinanceID')], financePaymentId, 'Payment stores Finance reference');
 eq(dpFinanceRow[2], 'income', 'Payment Finance type is income');
 eq(dpFinanceRow[3], 'Pembayaran Invoice', 'Payment Finance category is invoice payment');
 eq(dpFinanceRow[4], 100000, 'Payment Finance amount matches received amount');
 const financeAfterDp = sheets['Finance'].rows.length;
 const ledgerAfterDp = sheets['Invoice_Payments'].rows.length;
 eq(callDoPost({ action:'record_invoice_payment', payment:payment1 }, OWNER_SESSION).status, 'success', 'Retry same payment ID is accepted idempotently');
 eq(sheets['Finance'].rows.length, financeAfterDp, 'Retry does not duplicate Finance');
 eq(sheets['Invoice_Payments'].rows.length, ledgerAfterDp, 'Retry does not duplicate payment ledger');
 const conflictingPayment = Object.assign({}, payment1, { amount:110000 });
 eq(callDoPost({ action:'record_invoice_payment', payment:conflictingPayment }, OWNER_SESSION).status, 'error', 'Reusing payment ID with changed amount is rejected');
 eq(sheets['Finance'].rows.length, financeAfterDp, 'Conflicting retry does not change Finance');
 eq(callDoPost({ action:'record_invoice_payment', payment:Object.assign({}, payment1, { id:'PAY-CI1-OVER-001', amount:250001 }) }, OWNER_SESSION).status, 'error', 'Overpayment beyond outstanding balance is rejected');
 const payment2 = { id:'PAY-CI1-SET-001', invoiceId:'CI1', paymentDate:'2026-11-12', paymentType:'settlement', amount:200000, method:'qris', reference:'QR-SET-001', notes:'Pelunasan' };
 eq(callDoPost({ action:'record_invoice_payment', payment:payment2 }, OWNER_SESSION).status, 'success', 'Remaining balance can be settled');
 eq(sheets['Invoice_Payments'].rows.length, ledgerAfterDp + 1, 'Settlement creates one more payment row');
 eq(sheets['Finance'].rows.length, financeAfterDp + 1, 'Settlement creates one more Finance income row');
 const paymentReadback = callDoGet(OWNER_SESSION).data.invoicePayments;
 eq(paymentReadback.length, 2, 'Owner reads both payment rows');
 eq(paymentReadback.reduce((sum,x)=>sum+Number(x.amount||0),0), 300000, 'Payment ledger total equals invoice total');
 eq(callDoGet(TEAM_SESSION_COMMERCIAL).data.invoicePayments, undefined, 'Team response omits invoice payment ledger');
 const settlementFinanceIndex = sheets['Finance'].rows.findIndex(r => String(r[0]) === 'FIN-PAY-' + payment2.id);
 sheets['Finance'].deleteRow(settlementFinanceIndex + 1);
 eq(callDoPost({ action:'record_invoice_payment', payment:payment2 }, OWNER_SESSION).status, 'success', 'Retry repairs missing Finance row after partial write');
 eq(sheets['Finance'].rows.filter(r => String(r[0]) === 'FIN-PAY-' + payment2.id).length, 1, 'Finance repair remains idempotent');
 const beforeTeamPaymentLedger = sheets['Invoice_Payments'].rows.length;
 const beforeTeamPaymentFinance = sheets['Finance'].rows.length;
 const forbiddenPayment = callDoPost({ action:'record_invoice_payment', payment:{ id:'PAY-TEAM-001', invoiceId:'CI1', paymentDate:'2026-11-13', paymentType:'installment', amount:1, method:'cash' } }, TEAM_SESSION_COMMERCIAL);
 eq(forbiddenPayment.status, 'error', 'Team cannot record invoice payment');
 eq(sheets['Invoice_Payments'].rows.length, beforeTeamPaymentLedger, 'Team payment attempt does not change ledger');
 eq(sheets['Finance'].rows.length, beforeTeamPaymentFinance, 'Team payment attempt does not change Finance');
 eq(callDoPost({ action:'sync_all', invoicePayments:[{ id:'PAY-SPOOF-001' }] }, OWNER_SESSION).status, 'error', 'Invoice payment ledger cannot be client-synced');
 eq(callDoPost({ action:'delete', sheet:'Invoice_Payments', id:payment1.id }, OWNER_SESSION).status, 'error', 'Invoice payment ledger cannot be deleted through generic endpoint');


// ---------- 10. Ringkasan ----------
console.log(`\nmapping.test.js: ${pass} lolos, ${fail} gagal`);
failures.forEach(f => console.log(f));
process.exit(fail === 0 ? 0 : 1);
