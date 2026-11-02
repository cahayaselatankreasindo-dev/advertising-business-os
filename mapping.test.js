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
const LoggerStub = { log() {} };
// Stub PropertiesService (in-memory) untuk fitur token API
const _props = {};
const PropertiesServiceStub = {
  getScriptProperties() {
    return {
      getProperty(k) { return (k in _props) ? _props[k] : null; },
      setProperty(k, v) { _props[k] = v; },
      deleteProperty(k) { delete _props[k]; },
    };
  },
};
const MailAppStub = { getRemainingDailyQuota() { return 100; }, sendEmail() {} };
let uuidCounter = 0;
const UtilitiesStub = {
  formatDate() { return '2026-10-09'; },
  getUuid() { uuidCounter++; return 'UUID-TEST-' + uuidCounter; },
};

// ---------- 2. Muat google_apps_script.js ke sandbox ----------
const src = fs.readFileSync(path.join(__dirname, 'google_apps_script.js'), 'utf8');
const sandbox = {
  SpreadsheetApp: SpreadsheetAppStub,
  ContentService: ContentServiceStub,
  ScriptApp: ScriptAppStub,
  Logger: LoggerStub,
  PropertiesService: PropertiesServiceStub,
  MailApp: MailAppStub,
  Utilities: UtilitiesStub,
  console,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
_props['OWNER_API_TOKEN'] = 'OWNER_TEST_TOKEN';
_props['TEAM_API_TOKEN'] = 'TEAM_TEST_TOKEN';

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
    ['Clients','Costings','Finance','Leads','Marketing_Spend','Memory','Project_Costs','Projects'].sort(),
    'FIELD_MAP mencakup 8 tab');
  eq(FIELD_MAP.Projects.headers,
    ['ID','NamaProyek','Klien','NilaiProyek','Status','Deadline','Catatan','SOP_Checklist','PIC_Tim'],
    'FIELD_MAP.Projects.headers = hasil Tahap 2 + PIC_Tim');
  eq(FIELD_MAP.Clients.fields,
    ['id','name','phone','projectsCount','totalSpend','notes','rating','review'],
    'FIELD_MAP.Clients.fields memakai rating+review (bukan ratingReview)');
  eq(FIELD_MAP.Projects.fields,
    ['id','title','client','value','status','deadline','notes','sopChecklist','pic'],
    'FIELD_MAP.Projects.fields memuat pic');
  eq(FIELD_MAP.Costings.headers,
    ['ID','Tanggal','Klien','NamaPekerjaan','ModelProduksi','LeadID','ItemsJSON','BiayaLangsung','OverheadPersen','OverheadNominal','CadanganPersen','CadanganNominal','HPP','MarginPersen','HargaPenawaran','Status','ProjectID','Catatan','NomorQuotation','VersiQuotation','MasaBerlakuHari','WaktuPengerjaanHari','SyaratPembayaran','RuangLingkup','DisetujuiPada','POConfirmedAt','RiwayatQuotationJSON','DikirimPada'],
    'FIELD_MAP.Costings.headers sesuai kontrak quotation');
  eq(FIELD_MAP.Costings.fields,
    ['id','date','client','title','productionModel','leadId','itemsJson','directCost','overheadPct','overheadAmount','contingencyPct','contingencyAmount','hpp','marginPct','sellingPrice','status','projectId','notes','quoteNo','quoteVersion','validityDays','deliveryDays','paymentTerms','scope','approvedAt','poConfirmedAt','quoteHistoryJson','sentAt'],
    'FIELD_MAP.Costings.fields sesuai model quotation');
  eq(FIELD_MAP.Project_Costs.headers,
    ['ID','Tanggal','ProjectID','Kategori','Sumber','Deskripsi','Vendor','Qty','HargaSatuan','Nominal','StatusPembayaran','Referensi','Catatan'],
    'FIELD_MAP.Project_Costs.headers sesuai kontrak biaya aktual');
  eq(FIELD_MAP.Project_Costs.fields,
    ['id','date','projectId','category','source','description','vendor','qty','unitCost','amount','paymentStatus','reference','notes'],
    'FIELD_MAP.Project_Costs.fields sesuai model biaya aktual');
  const costingRow=sandbox.recordToRow('Costings',{
    id:'COST-ROW',date:'2026-11-03',client:'PT Retail',title:'Rak Display',productionModel:'hybrid',
    leadId:'L-10',itemsJson:'[]',directCost:7000000,overheadPct:5,overheadAmount:350000,
    contingencyPct:3,contingencyAmount:220500,hpp:7570500,marginPct:30,sellingPrice:10815000,
    status:'draft',projectId:'',notes:'uji mapping',quoteNo:'QUO-CSK-202611-COSTROW',
    quoteVersion:2,validityDays:14,deliveryDays:21,paymentTerms:'DP 50%',scope:'Rak display',
    approvedAt:'',poConfirmedAt:'',quoteHistoryJson:'[]',sentAt:''
  });
  eq(costingRow.length,28,'Costings: jumlah kolom 28');
  eq(costingRow[12],7570500,'Costings: HPP pada kolom M');
  eq(costingRow[18],'QUO-CSK-202611-COSTROW','Costings: nomor quotation pada kolom S');
  eq(sandbox.rowToRecord('Costings',costingRow,FIELD_MAP.Costings.headers).sellingPrice,10815000,'Costings: harga penawaran terbaca kembali');
  const projectCostRow=sandbox.recordToRow('Project_Costs',{
    id:'PC-ROW',date:'2026-11-03',projectId:'P1',category:'material',source:'vendor',
    description:'Acrylic sheet',vendor:'Vendor A',qty:2,unitCost:500000,amount:1000000,
    paymentStatus:'unpaid',reference:'INV-1',notes:'uji mapping'
  });
  eq(projectCostRow.length,13,'Project_Costs: jumlah kolom 13');
  eq(projectCostRow[9],1000000,'Project_Costs: nominal pada kolom J');
  eq(sandbox.rowToRecord('Project_Costs',projectCostRow,FIELD_MAP.Project_Costs.headers).amount,1000000,'Project_Costs: nominal terbaca kembali');
  const costingRow = sandbox.recordToRow('Costings', {
    id:'COST-ROW', date:'2026-11-02', client:'PT Retail', title:'Rak Display',
    productionModel:'hybrid', leadId:'L-10', itemsJson:'[]', directCost:7000000,
    overheadPct:5, overheadAmount:350000, contingencyPct:3, contingencyAmount:220500,
    hpp:7570500, marginPct:30, sellingPrice:10815000, status:'draft',
    projectId:'', notes:'uji mapping'
  });
  eq(costingRow.length, 18, 'Costings: jumlah kolom 18');
  eq(costingRow[12], 7570500, 'Costings: HPP ditulis pada kolom ke-13');
  eq(sandbox.rowToRecord('Costings', costingRow, FIELD_MAP.Costings.headers).sellingPrice, 10815000, 'Costings: harga penawaran dibaca kembali');
}

// ---------- 6. Tes BACA (doGet): Sheet -> field HTML ----------
function callDoGet(token = 'OWNER_TEST_TOKEN') {
  const out = sandbox.doGet({ parameter: { token } });
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

// ---------- 7. Tes TULIS (sync_all): MERGE — tidak menghapus data lama ----------
function callDoPost(payload) {
  const request = Object.assign({}, payload);
  if (request.token === undefined) request.token = 'OWNER_TEST_TOKEN';
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
  costings: [{ id: 'COST-OWNER-1', date: '2026-11-03', client: 'PT Retail', title: 'Rak Display', productionModel: 'hybrid', leadId: 'L9', itemsJson: '[]', directCost: 7000000, overheadPct: 5, overheadAmount: 350000, contingencyPct: 3, contingencyAmount: 220500, hpp: 7570500, marginPct: 30, sellingPrice: 10815000, status: 'draft', projectId: '', notes: '', quoteNo: 'QUO-CSK-202611-COSTOWN1', quoteVersion: 1, validityDays: 14, deliveryDays: 21, paymentTerms: 'DP 50%', scope: 'Rak display', approvedAt: '', poConfirmedAt: '', quoteHistoryJson: '[]', sentAt: '' }],
  projectCosts: [{ id: 'PC-OWNER-1', date: '2026-11-03', projectId: 'P1', category: 'material', source: 'vendor', description: 'Acrylic sheet', vendor: 'Vendor A', qty: 2, unitCost: 500000, amount: 1000000, paymentStatus: 'unpaid', reference: 'INV-1', notes: '' }]
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
const newCostRow = findRow('Costings', 'COST-OWNER-1');
eq(!!newCostRow, true, 'sync new Costings: record HPP tersimpan');
eq(newCostRow[12], 7570500, 'sync new Costings: nilai HPP tersimpan pada kolom M');
eq(newCostRow[14], 10815000, 'sync new Costings: harga penawaran tersimpan pada kolom O');
eq(callDoGet().data.costings.find(x => x.id === 'COST-OWNER-1').sellingPrice, 10815000, 'doGet Costings: harga penawaran terbaca');
eq(newCostRow[18], 'QUO-CSK-202611-COSTOWN1', 'Costings: nomor quotation tersimpan');
eq(newCostRow[20], 14, 'Costings: masa berlaku tersimpan');
const ownerProjectCostRow=findRow('Project_Costs','PC-OWNER-1');
eq(!!ownerProjectCostRow,true,'sync new Project_Costs: biaya aktual tersimpan');
eq(ownerProjectCostRow[9],1000000,'Project_Costs: nominal aktual pada kolom J');
eq(callDoGet().data.projectCosts.find(x=>x.id==='PC-OWNER-1').amount,1000000,'doGet Project_Costs: nominal terbaca');

// Deal menang membuat Client/Project secara idempoten, bukan transaksi Finance.
const financeBeforeWonAutomation = sheets['Finance'].rows.length;
callDoPost({ action: 'sync_all', leads: [{
  id: 'L-WON-AUTO', date: '2026-10-09', name: 'Klien Otomatis', phone: '0812',
  source: 'Referral', value: 8000000, status: 'won', notes: 'Deal dikonfirmasi'
}] });
eq(!!findRow('Clients', 'AUTO-CLI-L-WON-AUTO'), true, 'automation: Client dibuat untuk Deal Menang');
eq(!!findRow('Projects', 'AUTO-PRJ-L-WON-AUTO'), true, 'automation: Project dibuat dengan ID stabil');
eq(sheets['Finance'].rows.length, financeBeforeWonAutomation, 'automation: Deal Menang tidak membuat pendapatan otomatis');
const projectCountAfterWon = sheets['Projects'].rows.filter(r => String(r[6] || '').includes('[LEAD-L-WON-AUTO]')).length;
callDoPost({ action: 'sync_all', leads: [{
  id: 'L-WON-AUTO', date: '2026-10-09', name: 'Klien Otomatis', phone: '0812',
  source: 'Referral', value: 8000000, status: 'won', notes: 'Deal dikonfirmasi'
}] });
eq(sheets['Projects'].rows.filter(r => String(r[6] || '').includes('[LEAD-L-WON-AUTO]')).length, projectCountAfterWon, 'automation: pengulangan sync tidak menggandakan project');

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

// ---------- 9c. Kasus NYATA: header HURUF BESAR + kolom duplikat ----------
// Ganti sheet "Leads" dengan versi header HURUF BESAR + kolom duplikat
// (persis kondisi sheet user). Sistem harus: dedupe + tetap tulis kolom benar.
sheets['Leads'] = makeSheet([
  'ID','TANGGAL','Nama','Whatsapp','SUMBER','ESTIMASINILAI','STATUS','CATATAN',   // asli (HURUF BESAR)
  'Tanggal','WhatsApp','Sumber','EstimasiNilai','Status','Catatan',               // duplikat (campur)
  'Email','Website','Industri','PIC','JabatanPIC','LinkedIn','SkorPrioritas'      // B2B
]);
sheets['Leads'].appendRow(['L-OLD','2026-09-01','Budi','081','IG',8000000,'won','ok','','','','','','','','','','','','','']);

// Paksa dedupe + migrasi lewat setupSheet (pakai SpreadsheetApp stub yg sama)
sandbox.setupSheet();
eq(!!sheets['Costings'], true, 'setupSheet: tab Costings dibuat');
eq(sheets['Costings'].rows[0].join('|'), FIELD_MAP.Costings.headers.join('|'), 'setupSheet: header Costings sesuai kontrak');
eq(!!sheets['Project_Costs'], true, 'setupSheet: tab Project_Costs dibuat');
eq(sheets['Project_Costs'].rows[0].join('|'), FIELD_MAP.Project_Costs.headers.join('|'), 'setupSheet: header Project_Costs sesuai kontrak');

const h2 = sheets['Leads'].rows[0].map(h => String(h).trim().toLowerCase());
const dupCount = h2.filter(x => x === 'tanggal').length;
eq(dupCount, 1, 'dedupe: kolom "TANGGAL/Tanggal" jadi 1 (tidak duplikat)');
eq(h2.filter(x => x === 'sumber').length, 1, 'dedupe: kolom "SUMBER/Sumber" jadi 1');
eq(h2.filter(x => x === 'whatsapp').length, 1, 'dedupe: kolom "WhatsApp" jadi 1');

// Data lama harus tetap ada setelah dedupe
const oldRow2 = sheets['Leads'].rows.find(r => String(r[0]) === 'L-OLD');
eq(!!oldRow2, true, 'dedupe: baris lama L-OLD tetap ada');
eq(oldRow2[2], 'Budi', 'dedupe: data kolom Nama tidak rusak');

// Tulis lead baru dgn header HURUF BESAR -> harus masuk kolom yang benar
callDoPost({ action: 'sync_all', leads: [{
  id: 'L-CAPS', date: '2026-10-09', name: 'PT Test Caps', phone: '0899',
  source: 'Referral', value: 5000000, status: 'new', notes: 'catatan caps',
  email: 'pic@testcaps.co.id', website: 'https://testcaps.co.id', industry: 'Retail',
  pic: 'Siti', picTitle: 'Store Dev Manager', linkedin: 'https://linkedin.com/in/siti', score: 90
}] });
const capsRow = sheets['Leads'].rows.find(r => String(r[0]) === 'L-CAPS');
const idx = (n) => h2.indexOf(n);
eq(capsRow[idx('email')], 'pic@testcaps.co.id', 'CAPS: Email masuk kolom Email (header huruf besar)');
eq(capsRow[idx('website')], 'https://testcaps.co.id', 'CAPS: Website masuk kolom Website');
eq(capsRow[idx('industri')], 'Retail', 'CAPS: Industri masuk kolom Industri');
eq(capsRow[idx('pic')], 'Siti', 'CAPS: PIC masuk kolom PIC');
eq(capsRow[idx('skorprioritas')], 90, 'CAPS: SkorPrioritas masuk kolom SkorPrioritas');

// doGet harus baca benar meski header huruf besar
const gotCaps = callDoGet().data.leads.find(l => String(l.id) === 'L-CAPS');
eq(gotCaps.email, 'pic@testcaps.co.id', 'CAPS doGet: email terbaca benar');
eq(gotCaps.picTitle, 'Store Dev Manager', 'CAPS doGet: picTitle terbaca benar');

// ---------- 9d. Tes action 'delete' (tombol hapus di app) ----------
const beforeDel = sheets['Leads'].rows.length;
const delRes = callDoPost({ action: 'delete', sheet: 'Leads', id: 'L-CAPS' });
eq(delRes.status, 'success', "delete: status success");
eq(sheets['Leads'].rows.find(r => String(r[0]) === 'L-CAPS'), undefined, 'delete: baris L-CAPS benar-benar terhapus');
eq(sheets['Leads'].rows.length, beforeDel - 1, 'delete: jumlah baris berkurang 1');
// Hapus ID yang tidak ada -> tidak error
const delRes2 = callDoPost({ action: 'delete', sheet: 'Leads', id: 'TIDAK-ADA-XYZ' });
eq(delRes2.status, 'success', 'delete: ID tidak ada tetap success (idempoten)');

// Tombstone: stale sync tidak boleh menghidupkan kembali data yang sudah dihapus.
const staleLead = {
  id: 'L-CAPS', date: '2026-10-09', name: 'PT Test Caps Stale', phone: '0899',
  source: 'Referral', value: 5000000, status: 'new', notes: 'stale local copy',
  email: 'pic@testcaps.co.id', website: 'https://testcaps.co.id', industry: 'Retail',
  pic: 'Siti', picTitle: 'Store Dev Manager', linkedin: 'https://linkedin.com/in/siti', score: 90
};
const staleSync = callDoPost({ action: 'sync_all', leads: [staleLead] });
eq(staleSync.status, 'success', 'tombstone: stale sync diterima dengan aman');
eq(!!sheets['Leads'].rows.find(r => String(r[0]) === 'L-CAPS'), false, 'tombstone: lead terhapus tidak muncul kembali');
eq(sheets['_CSK_Deleted'].rows.filter(r => String(r[0]) === 'Leads' && String(r[1]) === 'L-CAPS').length, 1, 'tombstone: satu catatan penghapusan dibuat');
const getAfterDelete = callDoGet();
eq(!!getAfterDelete.data.deletedRecords.find(r => r.sheet === 'Leads' && r.id === 'L-CAPS'), true, 'tombstone: GET mengembalikan catatan penghapusan');
callDoPost({ action: 'delete', sheet: 'Leads', id: 'L-CAPS' });
eq(sheets['_CSK_Deleted'].rows.filter(r => String(r[0]) === 'Leads' && String(r[1]) === 'L-CAPS').length, 1, 'tombstone: penghapusan berulang tidak menggandakan ledger');

// Finance deletion is protected by the same ledger.
callDoPost({ action: 'sync_all', finance: [{
  id: 'F-DELETE-TEST', date: '2026-10-09', type: 'expense', category: 'Test',
  amount: 100, description: 'delete regression'
}] });
eq(callDoPost({ action: 'delete', sheet: 'Finance', id: 'F-DELETE-TEST' }).status, 'success', 'tombstone: Owner dapat menghapus Finance');
callDoPost({ action: 'sync_all', finance: [{
  id: 'F-DELETE-TEST', date: '2026-10-09', type: 'expense', category: 'Test',
  amount: 100, description: 'stale finance'
}] });
eq(!!sheets['Finance'].rows.find(r => String(r[0]) === 'F-DELETE-TEST'), false, 'tombstone: Finance yang dihapus tidak muncul kembali');
eq(!!callDoGet().data.deletedRecords.find(r => r.sheet === 'Finance' && r.id === 'F-DELETE-TEST'), true, 'tombstone: Finance deletion disertakan pada GET');

// ---------- 9e. Tes KEAMANAN: token Owner/Tim, fail-closed, dan izin server ----------
delete _props['OWNER_API_TOKEN'];
delete _props['TEAM_API_TOKEN'];
delete _props['API_TOKEN'];
eq(sandbox.isAuthorized({ action: 'sync_all' }), false, 'auth: tanpa token terkonfigurasi -> ditolak (fail-closed)');
eq(JSON.parse(sandbox.doGet({})._t).status, 'error', 'auth: GET tanpa token -> ditolak');

const beforeAuth = sheets['Leads'].rows.length;
const noTokenRes = callDoPost({ action: 'sync_all', token: '', leads: [{ id: 'HACK-1', name: 'Hacker' }] });
eq(noTokenRes.status, 'error', 'auth: POST tanpa token -> status error');
eq(sheets['Leads'].rows.length, beforeAuth, 'auth: POST tanpa token tidak mengubah data');

_props['OWNER_API_TOKEN'] = 'OWNER_TEST_TOKEN';
_props['TEAM_API_TOKEN'] = 'TEAM_TEST_TOKEN';
eq(sandbox.isAuthorized({ action: 'sync_all', token: 'OWNER_TEST_TOKEN' }), true, 'auth: token Owner diterima');
eq(sandbox.isAuthorized({ action: 'sync_all', token: 'TEAM_TEST_TOKEN' }), true, 'auth: token Tim diterima');
eq(sandbox.isAuthorized({ action: 'sync_all', token: 'SALAH' }), false, 'auth: token salah ditolak');

const teamGet = callDoGet('TEAM_TEST_TOKEN');
eq(teamGet.status, 'success', 'auth: GET token Tim berhasil');
eq(teamGet.role, 'team', 'auth: GET mengembalikan role Tim');
eq(teamGet.data.finance.length, 0, 'auth: GET Tim tidak mengembalikan Finance');
eq(teamGet.data.memory.length, 0, 'auth: GET Tim tidak mengembalikan Memory');
eq(teamGet.data.marketingSpend.length, 0, 'auth: GET Tim tidak mengembalikan Marketing');

const financeRowsBeforeTeamSync = sheets['Finance'].rows.length;
const teamSync = callDoPost({
  action: 'sync_all',
  token: 'TEAM_TEST_TOKEN',
  leads: [{ id: 'TEAM-LEAD', date: '2026-10-09', name: 'Team Lead', phone: '', source: 'x', value: 0, status: 'new', notes: '' }],
  finance: [{ id: 'TEAM-FIN', date: '2026-10-09', type: 'income', category: 'x', amount: 999, description: 'unauthorized' }],
  memory: [{ id: 'TEAM-MEM', date: '2026-10-09', category: 'x', title: 'x', content: 'unauthorized' }],
  marketingSpend: [{ id: 'TEAM-MKT', date: '2026-10-09', platform: 'x', campaign: 'x', budget: 1, spent: 1, leadsGenerated: 1, notes: '' }],
  costings: [{ id: 'TEAM-COST', date: '2026-11-03', client: 'x', title: 'x', hpp: 1, sellingPrice: 2 }],
  projectCosts: [{ id: 'TEAM-PC', date: '2026-11-03', projectId: 'P1', category: 'material', source: 'vendor', description: 'x', vendor: 'Vendor', qty: 1, unitCost: 999, amount: 999, paymentStatus: 'unpaid', reference: '', notes: '' }]
});
eq(teamSync.status, 'success', 'auth: Tim boleh sync modul operasional');
eq(!!sheets['Leads'].rows.find(r => String(r[0]) === 'TEAM-LEAD'), true, 'auth: data Leads Tim tersimpan');
eq(sheets['Finance'].rows.length, financeRowsBeforeTeamSync, 'auth: sync Tim tidak mengubah Finance');
eq(!!sheets['Finance'].rows.find(r => String(r[0]) === 'TEAM-FIN'), false, 'auth: sync Tim mengabaikan Finance');
eq(!!sheets['Costings'].rows.find(r => String(r[0]) === 'TEAM-COST'), false, 'auth: sync Tim mengabaikan Costings');
eq(callDoGet('TEAM_TEST_TOKEN').data.costings.length, 0, 'auth: GET Tim tidak mengembalikan Costings');
eq(!!sheets['Project_Costs'].rows.find(r=>String(r[0])==='TEAM-PC'),false,'auth: sync Tim tidak dapat menulis Project_Costs');
eq(callDoGet('TEAM_TEST_TOKEN').data.projectCosts.length,0,'auth: GET Tim tidak mengembalikan Project_Costs');
const teamTombstone = callDoPost({
  action: 'sync_all', token: 'TEAM_TEST_TOKEN',
  deletedRecords: [{ sheet: 'Finance', id: 'F1', deletedAt: '2026-10-09' }]
});
eq(teamTombstone.status, 'success', 'auth: sync tombstone Tim tetap berjalan');
eq(!!sheets['_CSK_Deleted'].rows.find(r => String(r[0]) === 'Finance' && String(r[1]) === 'F1'), false, 'auth: Tim tidak dapat menghapus Finance lewat sync payload');

eq(callDoPost({ action: 'delete', token: 'TEAM_TEST_TOKEN', sheet: 'Finance', id: 'F1' }).status, 'error', 'auth: Tim tidak boleh menghapus Finance');
eq(callDoPost({ action: 'insert', token: 'TEAM_TEST_TOKEN', sheet: 'Finance', data: { id: 'TEAM-FIN-INSERT' } }).status, 'error', 'auth: Tim tidak boleh insert Finance');
eq(callDoPost({ action: 'update_status', token: 'TEAM_TEST_TOKEN', sheet: 'Finance', id: 'F1', status: 'expense' }).status, 'error', 'auth: Tim tidak boleh update Finance');
eq(callDoPost({ action: 'send_cold_email', token: 'TEAM_TEST_TOKEN', toEmail: 'x@example.com' }).status, 'error', 'auth: Tim tidak boleh mengirim cold email');

const ownerSync = callDoPost({
  action: 'sync_all',
  token: 'OWNER_TEST_TOKEN',
  finance: [{ id: 'OWNER-FIN', date: '2026-10-09', type: 'income', category: 'x', amount: 500, description: 'authorized' }]
});
eq(ownerSync.status, 'success', 'auth: Owner dapat sync Finance');
eq(!!sheets['Finance'].rows.find(r => String(r[0]) === 'OWNER-FIN'), true, 'auth: data Finance Owner tersimpan');
eq(callDoPost({action:'delete',token:'OWNER_TEST_TOKEN',sheet:'Project_Costs',id:'PC-OWNER-1'}).status,'success','Project_Costs: Owner dapat menghapus biaya aktual');
callDoPost({action:'sync_all',token:'OWNER_TEST_TOKEN',projectCosts:[{
  id:'PC-OWNER-1',date:'2026-11-03',projectId:'P1',category:'material',source:'vendor',
  description:'stale copy',vendor:'Vendor A',qty:2,unitCost:500000,amount:1000000,
  paymentStatus:'unpaid',reference:'INV-1',notes:''
}]});
eq(!!sheets['Project_Costs'].rows.find(r=>String(r[0])==='PC-OWNER-1'),false,'Project_Costs: tombstone mencegah biaya terhapus muncul kembali');
eq(callDoPost({ action: 'delete', token: 'OWNER_TEST_TOKEN', sheet: 'Costings', id: 'COST-OWNER-1' }).status, 'success', 'Costings: Owner dapat menghapus kalkulasi');
callDoPost({
  action: 'sync_all', token: 'OWNER_TEST_TOKEN',
  costings: [{ id: 'COST-OWNER-1', date: '2026-11-02', client: 'PT Retail', title: 'Rak Display', productionModel: 'hybrid', leadId: 'L9', itemsJson: '[]', directCost: 7000000, overheadPct: 5, overheadAmount: 350000, contingencyPct: 3, contingencyAmount: 220500, hpp: 7570500, marginPct: 30, sellingPrice: 10815000, status: 'draft', projectId: '', notes: 'stale copy' }]
});
eq(!!sheets['Costings'].rows.find(r => String(r[0]) === 'COST-OWNER-1'), false, 'Costings: tombstone mencegah kalkulasi terhapus muncul kembali');

_props['API_TOKEN'] = 'LEGACY_TOKEN';
const generatedTokens = sandbox.setupApiTokens();
eq(!!generatedTokens.ownerToken, true, 'auth setup: token Owner dibuat');
eq(!!generatedTokens.teamToken, true, 'auth setup: token Tim dibuat');
eq(_props['API_TOKEN'], undefined, 'auth setup: token legacy dihapus');
eq(_props['OWNER_API_TOKEN'], generatedTokens.ownerToken, 'auth setup: token Owner disimpan');
eq(_props['TEAM_API_TOKEN'], generatedTokens.teamToken, 'auth setup: token Tim disimpan');

delete _props['OWNER_API_TOKEN'];
delete _props['TEAM_API_TOKEN'];
delete _props['API_TOKEN'];

// ---------- 10. Ringkasan ----------
console.log(`\nmapping.test.js: ${pass} lolos, ${fail} gagal`);
failures.forEach(f => console.log(f));
process.exit(fail === 0 ? 0 : 1);
