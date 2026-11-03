/**
 * IN-MEMORY integration contract test. Executes the REAL current backend
 * google_apps_script.js and REAL frontend sync-safe.js against emulated
 * Apps Script services, WITHOUT network, customer data or production writes.
 *
 * Run: node sync-backend-integration.test.js
 * This is not a live Google Apps Script deployment test.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createEngine } = require('./sync-safe.js');

function sheet(headers) {
  const rows = [headers.slice()];
  let dataRangeReadCount = 0;
  const rangeReadShapes = [];
  const rangeWriteShapes = [];
  return {
    rows,
    getDataRangeReadCount() { return dataRangeReadCount; },
    getRangeReadShapes() { return rangeReadShapes.slice(); },
    getRangeWriteShapes() { return rangeWriteShapes.slice(); },
    getLastRow() { return rows.length; },
    getLastColumn() { return Math.max(...rows.map(x => x.length)); },
    getDataRange() {
      dataRangeReadCount++;
      return { getValues() { return rows.map(x => x.slice()); } };
    },
    getRange(row, col, countRows = 1, countCols = 1) {
      return {
        getValues() {
          rangeReadShapes.push({row,col,countRows,countCols});
          return Array.from({ length: countRows }, (_, i) =>
            Array.from({ length: countCols }, (_, j) => (rows[row - 1 + i] || [])[col - 1 + j] ?? ''));
        },
        setValues(v) {
          rangeWriteShapes.push({row,col,countRows,countCols,rows:v.length});
          v.forEach((items, i) => {
            if (!rows[row - 1 + i]) rows[row - 1 + i] = [];
            items.forEach((value,j) => { rows[row - 1 + i][col - 1 + j] = value; });
          });
          return this;
        },
        setValue(v) {
          rangeWriteShapes.push({row,col,countRows:1,countCols:1,rows:1,single:true});
          if (!rows[row - 1]) rows[row - 1] = [];
          rows[row - 1][col - 1] = v;
          return this;
        },
        clearContent() { for(let i=0;i<countRows;i++) for(let j=0;j<countCols;j++) if(rows[row-1+i])rows[row-1+i][col-1+j]=''; return this; },
        setFontWeight() { return this; },
        setBackground() { return this; },
        setFontColor() { return this; }
      };
    },
    appendRow(r) { rows.push(r.slice()); },
    clear() { rows.length = 0; },
    deleteRow(row) { rows.splice(row - 1, 1); },
    setFrozenRows() { return this; }
  };
}
function createBackend() {
  const tables = {
    Leads: sheet(['ID','Tanggal','Nama','WhatsApp','Sumber','EstimasiNilai','Status','Catatan','Email','Website','Industri','PIC','JabatanPIC','LinkedIn','SkorPrioritas']),
    Clients: sheet(['ID','NamaKlien','WhatsApp','TotalProyek','TotalBelanja','Catatan','Rating_Review']),
    Projects: sheet(['ID','NamaProyek','Klien','NilaiProyek','Status','Deadline','Catatan','SOP_Checklist','PIC_Tim']),
    Finance: sheet(['ID','Tanggal','Tipe','Kategori','Nominal','Keterangan']),
    Memory: sheet(['ID','Tanggal','Kategori','Judul','Isi']),
    Marketing_Spend: sheet(['ID','Tanggal','Platform','Kampanye','Budget','Terpakai','LeadsDihasilkan','Catatan']),
    Costings: sheet(['ID','Tanggal','Klien','NamaPekerjaan','ModelProduksi','LeadID','ItemsJSON','BiayaLangsung','OverheadPersen','OverheadNominal','CadanganPersen','CadanganNominal','HPP','MarginPersen','HargaPenawaran','Status','ProjectID','Catatan','NomorQuotation','VersiQuotation','MasaBerlakuHari','WaktuPengerjaanHari','SyaratPembayaran','RuangLingkup','DisetujuiPada','POConfirmedAt','RiwayatQuotationJSON','DikirimPada']),
    Project_Costs: sheet(['ID','Tanggal','ProjectID','Kategori','Sumber','Deskripsi','Vendor','Qty','HargaSatuan','Nominal','StatusPembayaran','Referensi','Catatan'])
  };
  const props = { API_TOKEN: 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE' };
  const backend = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getId: () => '19le34ltpZCMIHmjw2n_JbEvrtZBWNTKd61U-xEAoR5Y',
        getName: () => 'TEST ONLY - CSK BUSINESS OS - DATA DUMMY - JANGAN PAKAI PRODUKSI',
        getSheetByName: key => tables[key] || null,
        insertSheet: key => tables[key] = sheet([]),
        getSheets: () => Object.values(tables),
        deleteSheet: () => {}
      })
    },
    ContentService: { MimeType: { JSON: 'JSON' }, createTextOutput: text => ({ text, getContent(){return this.text;}, setMimeType(){ return this; } }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props[key] || null,
      setProperty: (key,val) => {props[key]=val;},
      deleteProperty: key => {delete props[key];}
    }) },
    ScriptApp: { getProjectTriggers: () => [] },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: () => {} },
    Utilities: {
      formatDate: () => '2026-10-31',
      getUuid: (() => { let uuidCounter = 0; return () => {
        uuidCounter++;
        return '00000000-0000-4000-8000-' + String(uuidCounter).padStart(12,'0');
      }; })()
    },
    Logger: { log() {} },
    console
  };
  vm.createContext(backend);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'google_apps_script.js'),'utf8'), backend);
  const sent = [];
  let ignorePosts = false;
  const server = {
    tables, sent,
    read(token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE') {
      return JSON.parse(backend.doPost({ postData: { contents: JSON.stringify({ action: 'read', token, protocolVersion: 2 }) } }).text);
    },
    post(data) {
      const payload = Object.assign({ protocolVersion: 2 }, data);
      const areaSheets = {
        leads: 'Leads', clients: 'Clients', projects: 'Projects',
        finance: 'Finance', memory: 'Memory', marketingSpend: 'Marketing_Spend',
        costings: 'Costings', projectCosts: 'Project_Costs'
      };
      if (payload.action === 'sync_all' && !payload.expectedRecords) {
        payload.expectedRecords = {};
        Object.keys(areaSheets).forEach(area => {
          if (!Array.isArray(payload[area]) || !payload[area].length) return;
          const sheetName = areaSheets[area];
          const current = backend.readSheetData(backend.SpreadsheetApp.getActiveSpreadsheet(), sheetName);
          const versions = {};
          payload[area].forEach(record => {
            const id = String(record.id);
            const existing = current.find(row => String(row.id) === id);
            versions[id] = existing ? backend.stableRecordFingerprint_(existing) : null;
          });
          payload.expectedRecords[sheetName] = versions;
        });
      }
      if (payload.action === 'delete' && payload.expectedFingerprint === undefined) {
        const current = backend.readSheetData(backend.SpreadsheetApp.getActiveSpreadsheet(), payload.sheet || 'Leads')
          .find(row => String(row.id) === String(payload.id));
        payload.expectedFingerprint = current ? backend.stableRecordFingerprint_(current) : 'NO_BASELINE';
      }
      return JSON.parse(backend.doPost({ postData: { contents: JSON.stringify(payload) } }).text);
    },
    suppressPosts(value) { ignorePosts = value; },
    fetch: async (url, opts = {}) => {
      if (opts.method === 'POST') {
        const payload = JSON.parse(opts.body);
        if (payload.action === 'read') {
          const response = server.post(payload);
          return { ok: true, type: 'cors', json: async () => response };
        }
        sent.push(payload);
        if (!ignorePosts) server.post(payload);
        return { type: 'opaque' };
      }
      throw new Error('GET is disabled; authenticated reads must use POST action read.');
    }
  };
  return {...server, sandbox:backend};
}
function localStorageStub() {
  const values = {};
  return { getItem: k => values[k] || null, setItem: (k,v) => {values[k]=v;} };
}

test('legacy Finance schema appends ProjectID safely and round-trips project references', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const project = {id:'TEST-PROJECT-FINANCE-ROUNDTRIP',title:'Dummy project',client:'Dummy',value:1500,status:'active'};
  const finance = {id:'TEST-FINANCE-ROUNDTRIP',date:'2026-11-04',type:'expense',category:'Material',amount:500,description:'Dummy linked cost',projectId:project.id};
  const result = api.post({
    action:'sync_all',token,protocolVersion:2,
    expectedRecords:{
      Projects:{[project.id]:null},
      Finance:{[finance.id]:null}
    },
    projects:[project],finance:[finance]
  });
  assert.equal(result.status,'success');
  const headers = api.tables.Finance.rows[0];
  assert.deepEqual(headers.slice(0,6),['ID','Tanggal','Tipe','Kategori','Nominal','Keterangan']);
  assert.equal(headers[6],'ProjectID','new relation column must be appended without moving legacy columns');
  const saved = api.read().data.finance.find(row=>row.id===finance.id);
  assert.equal(saved.projectId,project.id,'Finance projectId must survive a write/read round trip');
});

test('Finance and project cost writes reject missing project references atomically', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const finance = {id:'TEST-FIN-ORPHAN',date:'2026-11-03',type:'expense',category:'Material',amount:1000,description:'Dummy',projectId:'MISSING-PROJECT'};
  const cost = {id:'TEST-PCOST-ORPHAN',date:'2026-11-03',projectId:'MISSING-PROJECT',category:'Material',description:'Dummy',qty:1,unitCost:1000,amount:1000};
  const before = JSON.stringify(Object.fromEntries(Object.entries(api.tables).map(([k,v])=>[k,v.rows])));
  const result = api.post({action:'sync_all',token,finance:[finance],projectCosts:[cost]});
  assert.equal(result.status,'error');
  assert.equal(result.code,'PROJECT_REFERENCE_INVALID');
  assert.ok(result.conflicts.some(x=>x.includes('TEST-FIN-ORPHAN')));
  assert.ok(result.conflicts.some(x=>x.includes('TEST-PCOST-ORPHAN')));
  assert.equal(JSON.stringify(Object.fromEntries(Object.entries(api.tables).map(([k,v])=>[k,v.rows]))),before,
    'invalid project references must not partially write Finance or Project_Costs');
});

test('project deletion is blocked while Finance, HPP or Project_Costs still reference it', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const project = {id:'TEST-PROJECT-LOCK',title:'Dummy project',client:'Dummy',value:1000,status:'active'};
  const finance = {id:'TEST-FIN-LOCK',date:'2026-11-03',type:'expense',category:'Material',amount:1000,description:'Dummy',projectId:project.id};
  const costing = {id:'TEST-COSTING-LOCK',date:'2026-11-03',client:'Dummy',title:'Dummy',projectId:project.id,hpp:1000,sellingPrice:1500,status:'draft'};
  const projectCost = {id:'TEST-PCOST-LOCK',date:'2026-11-03',projectId:project.id,category:'Material',description:'Dummy',qty:1,unitCost:1000,amount:1000};
  const seeded = api.post({action:'sync_all',token,projects:[project],finance:[finance],costings:[costing],projectCosts:[projectCost]});
  assert.equal(seeded.status,'success');
  const row = api.read().data.projects.find(x=>x.id===project.id);
  const fingerprint = api.sandbox.stableRecordFingerprint_(row);
  const deleted = api.post({action:'delete',token,sheet:'Projects',id:project.id,expectedFingerprint:fingerprint});
  assert.equal(deleted.status,'error');
  assert.equal(deleted.code,'RECORD_IN_USE');
  assert.deepEqual(JSON.parse(JSON.stringify(deleted.references)),{finance:1,costings:1,projectCosts:1});
  assert.ok(api.read().data.projects.some(x=>x.id===project.id),'referenced project must remain intact');
});

test('legacy insert validates Project_Costs and Finance references before writing', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const orphanCost = {id:'TEST-INSERT-ORPHAN',date:'2026-11-03',projectId:'MISSING-PROJECT',description:'Dummy',qty:1,unitCost:1000,amount:1000};
  const rejected = api.post({action:'insert',token,sheet:'Project_Costs',data:orphanCost,expectedAbsent:true});
  assert.equal(rejected.status,'error');
  assert.equal(rejected.code,'PROJECT_REFERENCE_INVALID');
  assert.equal(api.read().data.projectCosts.length,0);

  const project = {id:'TEST-INSERT-PROJECT',title:'Dummy project',client:'Dummy',value:1000,status:'active'};
  const seeded = api.post({action:'sync_all',token,projects:[project]});
  assert.equal(seeded.status,'success');
  const validCost = {...orphanCost,id:'TEST-INSERT-VALID',projectId:project.id};
  const inserted = api.post({action:'insert',token,sheet:'Project_Costs',data:validCost,expectedAbsent:true});
  assert.equal(inserted.status,'success');
  assert.ok(api.read().data.projectCosts.some(x=>x.id===validCost.id));
});

test('lead deletion is blocked while an HPP costing still references it', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const lead = {id:'TEST-LEAD-LOCK',date:'2026-11-03',name:'Dummy lead',status:'new'};
  const costing = {id:'TEST-COSTING-LEAD-LOCK',date:'2026-11-03',leadId:lead.id,client:'Dummy',title:'Dummy job',hpp:1000,sellingPrice:1500,status:'draft'};
  const seeded = api.post({action:'sync_all',token,leads:[lead],costings:[costing]});
  assert.equal(seeded.status,'success');
  const row = api.read().data.leads.find(x=>x.id===lead.id);
  const fingerprint = api.sandbox.stableRecordFingerprint_(row);
  const deleted = api.post({action:'delete',token,sheet:'Leads',id:lead.id,expectedFingerprint:fingerprint});
  assert.equal(deleted.status,'error');
  assert.equal(deleted.code,'RECORD_IN_USE');
  assert.ok(api.read().data.leads.some(x=>x.id===lead.id));
});

// Regression: both commercial modules must be persisted, not merely accepted.
test('Owner sync persists HPP quotations and project cost entries', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const project = {id:'TEST-PROJECT',title:'Booth test',client:'Dummy',value:300000,status:'draft'};
  const costing = {id:'TEST-QUO-HOTFIX',date:'2026-11-03',client:'Dummy',title:'Booth test',projectId:project.id,hpp:200000,sellingPrice:300000,status:'draft'};
  const cost = {id:'TEST-PCOST-HOTFIX',date:'2026-11-03',projectId:project.id,description:'Material dummy',qty:1,unitCost:1000,amount:1000};
  const result = api.post({action:'sync_all',token,projects:[project],costings:[costing],projectCosts:[cost]});
  assert.equal(result.status,'success');
  const cloud = api.read().data;
  assert.equal(cloud.costings.find(x => x.id === costing.id)?.hpp,200000);
  assert.equal(cloud.projectCosts.find(x => x.id === cost.id)?.amount,1000);
  assert.equal(cloud.finance.length,0,'quotation and costs must not fabricate cash receipts');
});

test('backup restoration validates and preserves both commercial arrays in staged HTML source', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'),'utf8');
  const validatorStart = html.indexOf('    function validateBackupData(parsed) {');
  const importStart = html.indexOf('    function importData(e) {', validatorStart);
  assert.ok(validatorStart >= 0 && importStart > validatorStart);
  const validator = html.slice(validatorStart, importStart);
  const restore = html.slice(importStart, importStart + 3500);
  assert.match(validator,/optional = \['costings', 'projectCosts'\]/);
  assert.match(validator,/data\[area\] = \[\]/);
  assert.match(validator,/required\.concat\(optional\)/);
  assert.match(restore,/const data = restored\.data/);
  assert.match(restore,/safeSync\.restoreLocalOnly\(db\)/);
  assert.match(restore,/conflict_recovery_v1/);
});

test('real backend + real frontend delta: edit -> POST -> authenticated POST readback', async () => {
  const api = createBackend();
  const original = { id:'TEST-1', date:'2026-10-31', name:'Dummy A', phone:'0', source:'QA', value:1, status:'new', notes:'',email:'',website:'',industry:'',pic:'',picTitle:'',linkedin:'',score:0 };
  assert.equal(api.post({action:'sync_all',token:'TEST_ONLY_LAB_API_TOKEN_2026_SAFE',leads:[original]}).status, 'success');
  const local = api.read().data;
  const engine = createEngine(localStorageStub(),api.fetch);
  engine.init(local);
  engine.merge(api.read().data,local);
  local.leads[0].name='Dummy B';
  engine.track(local);
  assert.equal(engine.countPending(),1);
  const result = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','TEST_ONLY_LAB_API_TOKEN_2026_SAFE');
  assert.equal(result.status,'verified');
  assert.equal(engine.countPending(),0);
  assert.equal(api.read().data.leads.find(x=>x.id==='TEST-1').name,'Dummy B');
  assert.equal(api.sent.length,1);
  assert.deepEqual(Object.keys(api.sent[0]).sort(),['action','expectedRecords','leads','protocolVersion','token']);
});
test('real backend + frontend: delete -> authenticated POST read confirms missing', async () => {
  const api=createBackend();
  const finance={id:'FIN-DEL',date:'2026-10-31',type:'expense',category:'QA',amount:175000,description:'Dummy'};
  assert.equal(api.post({action:'sync_all',token:'TEST_ONLY_LAB_API_TOKEN_2026_SAFE',finance:[finance]}).status,'success');
  const local=api.read().data;
  const engine=createEngine(localStorageStub(),api.fetch);
  engine.init(local);
  engine.merge(api.read().data,local);
  local.finance=[];
  engine.track(local);
  const result=await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','TEST_ONLY_LAB_API_TOKEN_2026_SAFE');
  assert.equal(result.status,'verified');
  assert.equal(api.read().data.finance.length,0);
  assert.equal(api.sent[0].action,'delete');
});
test('backend rejects a stale expected record version atomically', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const original = {id:'TEST-CAS-1',date:'2026-10-31',name:'Original',phone:'',source:'QA',
    value:0,status:'new',notes:'',email:'',website:'',industry:'',pic:'',picTitle:'',linkedin:'',score:0};
  assert.equal(api.post({action:'sync_all',token,leads:[original]}).status,'success');
  const baseline = api.read().data.leads.find(row => row.id === original.id);
  const staleFingerprint = api.sandbox.stableRecordFingerprint_(baseline);
  assert.equal(api.post({action:'sync_all',token,leads:[{...original,name:'Second device'}]}).status,'success');
  const staleWrite = api.post({
    action:'sync_all',token,
    expectedRecords:{Leads:{'TEST-CAS-1':staleFingerprint}},
    leads:[{...original,name:'Stale first device'}]
  });
  assert.equal(staleWrite.status,'error');
  assert.equal(staleWrite.code,'SYNC_CONFLICT');
  assert.equal(api.read().data.leads.find(row => row.id === original.id).name,'Second device');
});

test('backend refuses delete without matching record fingerprint', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const original = {id:'TEST-CAS-DELETE',date:'2026-10-31',name:'Original',phone:'',source:'QA',
    value:0,status:'new',notes:'',email:'',website:'',industry:'',pic:'',picTitle:'',linkedin:'',score:0};
  api.post({action:'sync_all',token,leads:[original]});
  const baseline = api.read().data.leads.find(row => row.id === original.id);
  const expectedFingerprint = api.sandbox.stableRecordFingerprint_(baseline);
  api.post({action:'sync_all',token,leads:[{...original,name:'Updated elsewhere'}]});
  const result = api.post({action:'delete',token,sheet:'Leads',id:original.id,expectedFingerprint});
  assert.equal(result.status,'error');
  assert.equal(result.code,'SYNC_CONFLICT');
  assert.equal(api.read().data.leads.find(row => row.id === original.id).name,'Updated elsewhere');
});

test('real backend + frontend: two-client edit conflicts without writing', async () => {
  const api=createBackend();
  const initial={id:'TEST-2',date:'2026-10-31',name:'Server old',phone:'',source:'QA',value:0,status:'new',notes:'',email:'',website:'',industry:'',pic:'',picTitle:'',linkedin:'',score:0};
  api.post({action:'sync_all',token:'TEST_ONLY_LAB_API_TOKEN_2026_SAFE',leads:[initial]});
  const local=api.read().data;
  const engine=createEngine(localStorageStub(),api.fetch);
  engine.init(local);
  engine.merge(api.read().data,local);
  local.leads[0].name='Phone edit';
  engine.track(local);
  api.post({action:'sync_all',token:'TEST_ONLY_LAB_API_TOKEN_2026_SAFE',leads:[{...initial,name:'PC edit'}]});
  const result=await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','TEST_ONLY_LAB_API_TOKEN_2026_SAFE');
  assert.equal(result.status,'conflict');
  assert.equal(api.read().data.leads[0].name,'PC edit');
  assert.equal(api.sent.length,0);
});
test('backend rejected POST but browser opaque: no success claim', async () => {
  const api=createBackend();
  const local=api.read().data;
  const engine=createEngine(localStorageStub(),api.fetch);
  engine.init(local);
  engine.merge(api.read().data,local);
  local.projects.push({id:'P-TEST',title:'Dummy Project',client:'Dummy',value:5000000,status:'plan',deadline:'2026-11-15',notes:'',sopChecklist:'Brief:0;Produksi:0;Review:0;Revisi:0;Delivery:0',pic:''});
  engine.track(local);
  api.suppressPosts(true);
  const result=await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','TEST_ONLY_LAB_API_TOKEN_2026_SAFE');
  assert.equal(result.status,'unverified');
  assert.equal(engine.countPending(),1);
  assert.equal(api.read().data.projects.length,0);
});

test('LAB-only internal smoke test safely creates/updates/deletes dummy via REAL backend', () => {
  const api = createBackend();
  const before = api.tables.Leads.rows.length;
  const vmContext = api.sandbox;
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'apps-script', 'LabSelfTest.gs'), 'utf8'), vmContext);
  const readiness = vmContext.cskLabCheckReadiness();
  assert.equal(readiness.labIdVerified, true);
  assert.equal(readiness.backendPresent, true);
  const result = vmContext.cskLabRunIsolatedSmokeTest();
  assert.equal(result.inserted, true);
  assert.equal(result.updated, true);
  assert.equal(result.deleted, true);
  assert.equal(result.verified, true);
  assert.equal(api.tables.Leads.rows.length, before, 'temporary LAB record cleaned up');
});
test('LAB smoke test rejects a production spreadsheet ID before any write', () => {
  const api = createBackend();
  api.sandbox.SpreadsheetApp.getActiveSpreadsheet = () => ({
    getId: () => '11fJC3i9jEcch8Gk_XPgWeilnQCzW4UXS3gWMIH-hqY8',
    getName: () => 'CSK BUSINESS OS - DATABASE UTAMA - AKTIF - JANGAN HAPUS'
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'apps-script', 'LabSelfTest.gs'), 'utf8'), api.sandbox);
  assert.throws(() => api.sandbox.cskLabRunIsolatedSmokeTest(), /DIBATALKAN/);
  assert.equal(api.sent.length,0);
});


test('LAB gateway guard allows only authorized synthetic data', () => {
  const api=createBackend();
  const ctx=api.sandbox;
  vm.runInContext(fs.readFileSync(path.join(__dirname,'apps-script','LabSelfTest.gs'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'apps-script','LabRequestGuard.gs'),'utf8'),ctx);
  const secret = 'LAB-TEST-SECURE-TOKEN-ONLY-DO-NOT-REUSE';
  ctx.PropertiesService.getScriptProperties().setProperty('API_TOKEN', secret);
  assert.equal(ctx.cskLabGuardRead_().getId(),
    '19le34ltpZCMIHmjw2n_JbEvrtZBWNTKd61U-xEAoR5Y');
  const guardSmoke = ctx.cskLabRunGuardNegativeTests();
  assert.equal(guardSmoke.status,'LAB_GUARD_PASS');
  assert.equal(guardSmoke.blockedUnsafeRequests,18);
  assert.equal(guardSmoke.databaseWritesPerformed,0);
  assert.equal(guardSmoke.emailSendsPerformed,0);

  const accepted = {
    action:'sync_all',token:secret,protocolVersion:2,
    expectedRecords:{Leads:{'TEST-QA-NEW-1':null},Finance:{'QA-LAB-FIN-1':null}},
    leads:[{id:'TEST-QA-NEW-1',date:'2026-10-31',name:'Dummy',status:'new'}],
    finance:[{id:'QA-LAB-FIN-1',date:'2026-10-31',type:'expense',amount:175000}]
  };
  assert.doesNotThrow(()=>ctx.cskLabGuardPost_(accepted));
  assert.doesNotThrow(()=>ctx.cskLabGuardPost_({
    action:'delete',token:secret,protocolVersion:2,sheet:'Leads',id:'TEST-QA-NEW-1',expectedFingerprint:'LAB-TEST-FINGERPRINT'
  }));

  const invalid = [
    {...accepted,token:'WRONG'},
    {...accepted,action:'send_email'},
    {...accepted,action:'insert'},
    {...accepted,foo:true},
    {...accepted,leads:[{id:'REAL-LEAD-1',status:'new'}]},
    {...accepted,leads:[{id:'TEST-WON-1',status:'won'}]},
    {...accepted,leads:[{id:'TEST-BAD-1',status:'deal menang'}]},
    {...accepted,leads:[{id:'TEST-NEST-1',status:'new'}], finance:'not-array'},
    {...accepted,leads:[] ,finance:[]},
    {action:'delete',token:secret,sheet:'Private',id:'TEST-1'},
    {action:'delete',token:secret,sheet:'Leads',id:'SECRET-REAL-1'},
    {action:'delete',token:secret,sheet:'Leads',id:'TEST-1',extra:'any'}
  ];
  for (const payload of invalid) {
    assert.throws(()=>ctx.cskLabGuardPost_(payload),
      /LAB guard:/,
      'invalid request should be blocked: '+JSON.stringify(payload).slice(0,90));
  }
  assert.equal(api.sent.length, 0, 'guard validation performs no network writes');
});

test('LAB Owner/Team role isolation filters five private modules and rejects writes/deletes', () => {
  const api = createBackend();
  const ctx = api.sandbox;
  vm.runInContext(fs.readFileSync(path.join(__dirname,'apps-script','LabSelfTest.gs'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'apps-script','LabRequestGuard.gs'),'utf8'),ctx);
  ctx.setupApiTokens();
  const roleTokens = ctx.getApiTokens();
  assert.ok(roleTokens.owner && roleTokens.owner.length >= 20);
  assert.ok(roleTokens.team && roleTokens.team.length >= 20);
  assert.notEqual(roleTokens.owner,roleTokens.team);
  const result = ctx.cskLabRunRoleIsolationTests();
  assert.equal(result.status,'LAB_ROLE_ISOLATION_PASS');
  assert.equal(result.labIdVerified,true);
  assert.equal(result.ownerReadAllowed,true);
  assert.equal(result.teamReadAllowed,true);
  assert.equal(result.teamPrivateAreasFiltered,5);
  assert.equal(result.teamFinanceWriteRejected,true);
  assert.equal(result.teamCostingsWriteRejected,true);
  assert.equal(result.teamFinanceDeleteRejected,true);
  assert.equal(result.privateSheetRowsUnchanged,true);
  assert.equal(api.sent.length,0);
});

test('LAB gateway guard refuses execution against production spreadsheet', () => {
  const api=createBackend();
  const ctx=api.sandbox;
  ctx.SpreadsheetApp.getActiveSpreadsheet=()=>({
    getId:()=> '11fJC3i9jEcch8Gk_XPgWeilnQCzW4UXS3gWMIH-hqY8',
    getName:()=> 'CSK BUSINESS OS - DATABASE UTAMA - AKTIF - JANGAN HAPUS'
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'apps-script','LabSelfTest.gs'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'apps-script','LabRequestGuard.gs'),'utf8'),ctx);
  assert.throws(()=>ctx.cskLabGuardRead_(), /DIBATALKAN/);
  assert.throws(()=>ctx.cskLabGuardPost_({
    action:'delete',token:'TEST_ONLY_LAB_API_TOKEN_2026_SAFE',sheet:'Leads',id:'TEST-LEAD-001'
  }), /DIBATALKAN/);
});


test('standalone Android LAB HTML loads the bundled engine and completes six browser scenarios', async () => {
  const html=fs.readFileSync(path.join(__dirname,'lab-frontend-smoke.html'),'utf8');
  assert.doesNotMatch(html, /<script[^>]+src\s*=/i,
    'offline LAB HTML must not request external JavaScript');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match=>match[1]);
  assert.equal(scripts.length,2,'inline engine and inline browser harness expected');

  const controls={
    '#run': {disabled:false, addEventListener(type,callback){
      assert.equal(type,'click');
      this.click=callback;
    }},
    '#results': {innerHTML:'',children:[],appendChild(el){this.children.push(el)}},
    '#raw': {textContent:''}
  };
  const doc={
    querySelector(selector){
      assert.ok(selector in controls,'unexpected document selector '+selector);
      return controls[selector];
    },
    createElement(type) {
      assert.ok(['div','strong','small'].includes(type),'unexpected element '+type);
      return {
        type,className:'',textContent:'',children:[],
        append(...items){this.children.push(...items)}
      };
    }
  };
  const context={document:doc};
  context.window=context;
  vm.createContext(context);
  for(const script of scripts)vm.runInContext(script,context);
  assert.equal(typeof context.CSKSafeSync.createEngine,'function');
  await controls['#run'].click();
  assert.equal(controls['#results'].children.length,6,
    controls['#raw'].textContent);
  for(const card of controls['#results'].children){
    assert.match(card.className,/case ok/,controls['#raw'].textContent);
  }
  assert.match(controls['#raw'].textContent,/6\/6 LULUS/);
  assert.equal(controls['#run'].disabled,false);
});


test('LAB real doGet/doPost wiring check rejects invalid delete without altering dummy rows',()=>{
  const api=createBackend(),ctx=api.sandbox;
  const backendPath=path.join(__dirname,'google_apps_script.js');
  let source=fs.readFileSync(backendPath,'utf8');
  const getAnchor='function doGet() {\n  // Never accept bearer credentials in query strings. All authenticated reads use POST action "read".\n  return jsonResponse({';
  const postAnchor='const payload = JSON.parse(e.postData.contents);';
  assert.ok(source.includes(getAnchor),'GET handler anchor missing');
  assert.ok(source.includes(postAnchor),'POST handler anchor missing');
  source=source.replace(getAnchor,'function doGet() {\n  cskLabGuardRead_();\n  // Never accept bearer credentials in query strings. All authenticated reads use POST action "read".\n  return jsonResponse({');
  source=source.replace(postAnchor,postAnchor+'\n    cskLabGuardPost_(payload);');
  vm.runInContext(source,ctx);
  for(const file of ['LabSelfTest.gs','LabRequestGuard.gs','LabHandlerVerification.gs']){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'apps-script',file),'utf8'),ctx);
  }
  ctx.PropertiesService.getScriptProperties().setProperty('API_TOKEN',
    'LAB-SYNTHETIC-TOKEN-FOR-EMULATOR-ONLY');
  const leadRows=api.tables.Leads.rows.length;
  const result=ctx.cskLabVerifyActiveHandlers();
  assert.equal(result.status,'LAB_HANDLER_GUARD_PASS');
  assert.equal(result.guardReadWired,true);
  assert.equal(result.guardPostWired,true);
  assert.equal(result.unsafeDeleteRejectedByLiveHandler,true);
  assert.equal(result.leadRowCountUnchanged,true);
  assert.equal(api.tables.Leads.rows.length,leadRows);
  assert.equal(api.sent.length,0);
});

test('LAB handler wiring check fails closed if Code.gs has not been guarded',()=>{
  const api=createBackend(),ctx=api.sandbox;
  for(const file of ['LabSelfTest.gs','LabRequestGuard.gs','LabHandlerVerification.gs']){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'apps-script',file),'utf8'),ctx);
  }
  ctx.PropertiesService.getScriptProperties().setProperty('API_TOKEN',
    'LAB-SYNTHETIC-TOKEN-FOR-EMULATOR-ONLY');
  assert.throws(()=>ctx.cskLabVerifyActiveHandlers(),
    /LAB_HANDLER_GUARD_FAIL: doGet\/doPost belum memanggil guard/);
  assert.equal(api.sent.length,0);
});

test('backend rejects stale clients that omit protocol version on both read and write', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const legacyRead = JSON.parse(api.sandbox.doGet({ parameter: { token, protocolVersion: 2 } }).text);
  assert.equal(legacyRead.code, 'POST_REQUIRED');
  assert.equal(legacyRead.data, undefined);
  const stalePostRead = JSON.parse(api.sandbox.doPost({ postData: { contents: JSON.stringify({ action: 'read', token }) } }).text);
  assert.equal(stalePostRead.code, 'CLIENT_PROTOCOL_MISMATCH');
  const beforeRows = api.tables.Leads.getLastRow();
  const legacyWrite = JSON.parse(api.sandbox.doPost({ postData: { contents: JSON.stringify({
    action: 'sync_all', token,
    leads: [{ id: 'TEST-STALE-CLIENT', name: 'Must be rejected', status: 'new' }]
  }) } }).text);
  assert.equal(legacyWrite.code, 'CLIENT_PROTOCOL_MISMATCH');
  assert.equal(api.tables.Leads.getLastRow(), beforeRows, 'legacy client must not mutate Sheets');
});

test('won status never fabricates an incoming DP or project by default', () => {
  const api = createBackend();
  const lead = { id: 'TEST-WON-CHECK', date:'2026-11-02', name:'Test Account', phone:'',
    source:'QA', value:4500000, status:'won', notes:'' };
  const response = api.post({ action:'sync_all', token:'TEST_ONLY_LAB_API_TOKEN_2026_SAFE', leads:[lead] });
  assert.equal(response.status, 'success');
  assert.equal(api.read().data.leads.find(l => l.id === lead.id).status, 'won');
  assert.equal(api.read().data.finance.length, 0, 'deal is not a cash deposit');
  assert.equal(api.read().data.projects.length, 0, 'project creation is opt-in on backend');
});

test('missing backend API token rejects reads and writes (fail closed)', () => {
  const api = createBackend();
  api.sandbox.PropertiesService.getScriptProperties().setProperty('API_TOKEN','');
  const attempted = api.post({
    action:'sync_all', token:'TEST_ONLY_LAB_API_TOKEN_2026_SAFE',
    leads:[{ id:'TEST-UNAUTHORIZED', name:'Should Never Save', status:'new' }]
  });
  assert.equal(attempted.status, 'error');
  assert.equal(api.tables.Leads.getLastRow(), 1);
  const read = api.read();
  assert.equal(read.status, 'error', 'tokenless server cannot disclose cloud rows');
});


test('sync_all rejects unknown payload keys and more than 40 records before writing', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const before = api.tables.Leads.getLastRow();
  const unknown = api.post({
    action:'sync_all', token, role:'owner', expectedRecords:{}
  });
  assert.equal(unknown.code,'INVALID_PAYLOAD');
  assert.equal(api.tables.Leads.getLastRow(),before);

  const leads = Array.from({length:21},(_,i)=>({
    id:'TEST-LIMIT-L-'+i,date:'2026-11-03',name:'Limit lead '+i,status:'new'
  }));
  const projects = Array.from({length:20},(_,i)=>({
    id:'TEST-LIMIT-P-'+i,title:'Limit project '+i,status:'plan'
  }));
  const expectedRecords = {Leads:{},Projects:{}};
  leads.forEach(row => { expectedRecords.Leads[row.id] = null; });
  projects.forEach(row => { expectedRecords.Projects[row.id] = null; });
  const limited = api.post({action:'sync_all',token,leads,projects,expectedRecords});
  assert.equal(limited.code,'SYNC_BATCH_LIMIT');
  assert.equal(api.tables.Leads.getLastRow(),before);
  assert.equal(api.tables.Projects.getLastRow(),1);
});

test('compare-and-set reads each affected sheet once per bounded batch', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const rows = Array.from({length:40},(_,i)=>({
    id:'TEST-READ-ONCE-'+i,date:'2026-11-03',name:'Read once '+i,status:'new'
  }));
  const expectedRecords = {Leads:{}};
  rows.forEach(row => { expectedRecords.Leads[row.id] = null; });
  api.tables.Leads.appendRow([
    'SEED-READ-ONCE','2026-11-02','Seed','','QA',0,'new','','','','','','','',0
  ]);
  const before = api.tables.Leads.getDataRangeReadCount();
  const result = api.post({action:'sync_all',token,leads:rows,expectedRecords});
  assert.equal(result.status,'success');
  assert.equal(api.tables.Leads.getDataRangeReadCount()-before,1,
    'CAS must read the Leads sheet once, not once per record');
});

test('Team token cannot read or mutate private modules and cannot trigger Owner automation', () => {
  const api = createBackend();
  const props = api.sandbox.PropertiesService.getScriptProperties();
  const ownerToken = 'TEST_ONLY_OWNER_TOKEN_2026_SAFE';
  const teamToken = 'TEST_ONLY_TEAM_TOKEN_2026_SAFE';
  props.setProperty('OWNER_API_TOKEN',ownerToken);
  props.setProperty('TEAM_API_TOKEN',teamToken);
  props.deleteProperty('API_TOKEN');
  props.setProperty('AUTO_PROJECT_FROM_WON','true');

  const teamRead = api.post({ action:'read', token:teamToken });
  assert.equal(teamRead.status,'success');
  assert.equal(teamRead.data.role,'team');
  for(const area of ['finance','memory','marketingSpend','costings','projectCosts']) {
    assert.deepEqual(teamRead.data[area],[], 'Team must not read '+area);
  }
  assert.equal(api.sandbox.getRequestRole({token:teamToken,role:'owner'}),'team',
    'client-supplied role must not elevate the token');

  const financeWrite = api.post({
    action:'sync_all',token:teamToken,
    finance:[{id:'TEST-TEAM-FINANCE',date:'2026-11-03',type:'income',amount:100}],
    expectedRecords:{Finance:{'TEST-TEAM-FINANCE':null}}
  });
  assert.notEqual(financeWrite.status,'success');
  assert.equal(api.tables.Finance.getLastRow(),1);

  const financeDelete = api.post({
    action:'delete',token:teamToken,sheet:'Finance',id:'TEST-PRIVATE',
    expectedFingerprint:'TEST-FINGERPRINT'
  });
  assert.equal(financeDelete.code,'FORBIDDEN');

  const wonLead = {id:'TEST-TEAM-WON',date:'2026-11-03',name:'Team won test',status:'won',value:500000};
  const teamWon = api.post({
    action:'sync_all',token:teamToken,leads:[wonLead],
    expectedRecords:{Leads:{[wonLead.id]:null}}
  });
  assert.equal(teamWon.status,'success');
  assert.equal(api.tables.Projects.getLastRow(),1,
    'Team lead changes must not run Owner-only project automation');
  assert.equal(api.tables.Finance.getLastRow(),1,
    'won lead must not fabricate cash receipts');
});


test('backend stores prototype-named IDs as normal records without index collisions', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const leads = [
    {id:'__proto__',date:'2026-11-03',name:'Prototype ID',status:'new'},
    {id:'constructor',date:'2026-11-03',name:'Constructor ID',status:'new'}
  ];
  const versions = Object.create(null);
  leads.forEach(row => { versions[row.id] = null; });
  const result = api.post({action:'sync_all',token,leads,expectedRecords:{Leads:versions}});
  assert.equal(result.status,'success');
  const saved = api.read().data.leads;
  assert.equal(saved.find(row=>row.id==='__proto__').name,'Prototype ID');
  assert.equal(saved.find(row=>row.id==='constructor').name,'Constructor ID');
});


test('checked-in LAB Code.gs runs its wired guards, role isolation and dummy smoke test', () => {
  const api = createBackend();
  const ctx = api.sandbox;
  ctx.PropertiesService.getScriptProperties().setProperty(
    'TEAM_API_TOKEN','LAB-SYNTHETIC-TEAM-TOKEN-FOR-EMULATOR-ONLY'
  );
  vm.runInContext(fs.readFileSync(path.join(__dirname,'apps-script/Code.gs'),'utf8'),ctx);
  for(const file of ['LabRequestGuard.gs','LabSelfTest.gs','LabHandlerVerification.gs']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'apps-script',file),'utf8'),ctx);
  }

  const handler = ctx.cskLabVerifyActiveHandlers();
  assert.equal(handler.status,'LAB_HANDLER_GUARD_PASS');
  const guard = ctx.cskLabRunGuardNegativeTests();
  assert.equal(guard.status,'LAB_GUARD_PASS');
  assert.equal(guard.databaseWritesPerformed,0);
  const roles = ctx.cskLabRunRoleIsolationTests();
  assert.equal(roles.status,'LAB_ROLE_ISOLATION_PASS');
  assert.equal(roles.privateSheetRowsUnchanged,true);
  const smoke = ctx.cskLabRunIsolatedSmokeTest();
  assert.equal(smoke.inserted,true);
  assert.equal(smoke.updated,true);
  assert.equal(smoke.deleted,true);
  assert.equal(smoke.verified,true);
  for(const table of Object.values(api.tables)) {
    assert.equal(table.getLastRow(),1,'LAB smoke test must clean up all dummy rows');
  }
  assert.equal(api.sent.length,0,'LAB checks must not send email');
});


test('won aliases normalize consistently and Owner automation remains opt-in and payload-scoped', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  for (const status of ['won','Deal Menang','deal-menang','deal_menang','dealwin','Deal Win']) {
    assert.equal(api.sandbox.isDealMenang(status),true,'status alias: '+status);
  }
  for (const status of ['new','proposal','lost','in progress']) {
    assert.equal(api.sandbox.isDealMenang(status),false,'non-won status: '+status);
  }

  const props = api.sandbox.PropertiesService.getScriptProperties();
  props.setProperty('AUTO_PROJECT_FROM_WON','true');
  const won = {id:'TEST-WON-ALIAS',date:'2026-11-03',name:'Alias client',value:250000,status:'deal_menang'};
  const expectedRecords = {Leads:{'TEST-WON-ALIAS':null}};
  const result = api.post({action:'sync_all',token,leads:[won],expectedRecords});
  assert.equal(result.status,'success');
  assert.equal(api.tables.Projects.getLastRow(),2,'Owner won alias creates one project only when feature flag is enabled');
  assert.equal(api.tables.Finance.getLastRow(),1,'won status must never fabricate a cash receipt');

  const unrelated = {id:'TEST-NON-WON',date:'2026-11-03',name:'Unrelated',value:1,status:'new'};
  const nonWon = api.post({
    action:'sync_all',token,leads:[unrelated],
    expectedRecords:{Leads:{'TEST-NON-WON':null}}
  });
  assert.equal(nonWon.status,'success');
  assert.equal(api.tables.Projects.getLastRow(),2,'non-won payload must not run the automation');
});


test('sync_all accepts identical duplicate rows once and rejects conflicting duplicates atomically', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const first = {id:'TEST-DUP-EXACT',date:'2026-11-03',name:'Exact duplicate',status:'new'};
  const exact = api.post({
    action:'sync_all',token,
    leads:[first,{...first}],
    expectedRecords:{Leads:{'TEST-DUP-EXACT':null}}
  });
  assert.equal(exact.status,'success');
  assert.equal(api.read().data.leads.filter(row=>row.id===first.id).length,1);

  const before = api.tables.Leads.getLastRow();
  const conflicting = api.post({
    action:'sync_all',token,
    leads:[{...first,id:'TEST-DUP-CONFLICT',name:'First value'},
      {...first,id:'TEST-DUP-CONFLICT',name:'Different value'}],
    expectedRecords:{Leads:{'TEST-DUP-CONFLICT':null}}
  });
  assert.equal(conflicting.status,'error');
  assert.equal(conflicting.code,'EXPECTED_VERSION_REQUIRED');
  assert.equal(api.tables.Leads.getLastRow(),before,
    'ambiguous duplicate payload must not write any row');
});


test('all write paths fail closed when existing cloud rows contain duplicate IDs', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const lead = {
    id:'TEST-CLOUD-DUPLICATE',date:'2026-11-03',name:'Original lead',phone:'',
    source:'QA',value:100,status:'new',notes:'',email:'',website:'',industry:'',
    pic:'',picTitle:'',linkedin:'',score:0
  };
  const seeded = api.post({
    action:'sync_all',token,leads:[lead],
    expectedRecords:{Leads:{[lead.id]:null}}
  });
  assert.equal(seeded.status,'success');

  api.tables.Leads.appendRow([
    lead.id,lead.date,'Duplicate row','','QA',100,'new','duplicate row',
    '','','','','','',0
  ]);
  const baseline = api.read().data.leads.find(row=>row.id===lead.id);
  const fingerprint = api.sandbox.stableRecordFingerprint_(baseline);
  const before = JSON.stringify(api.tables.Leads.rows);

  const sync = api.post({
    action:'sync_all',token,
    leads:[{...lead,name:'Must not overwrite'}],
    expectedRecords:{Leads:{[lead.id]:fingerprint}}
  });
  assert.equal(sync.status,'error');
  assert.equal(sync.code,'DUPLICATE_CLOUD_ID');
  assert.ok(sync.conflicts.includes('Leads/'+lead.id));

  const deletion = api.post({
    action:'delete',token,sheet:'Leads',id:lead.id,expectedFingerprint:fingerprint
  });
  assert.equal(deletion.status,'error');
  assert.equal(deletion.code,'DUPLICATE_CLOUD_ID');

  const status = api.post({
    action:'update_status',token,sheet:'Leads',id:lead.id,status:'contacted',
    expectedFingerprint:fingerprint
  });
  assert.equal(status.status,'error');
  assert.equal(status.code,'DUPLICATE_CLOUD_ID');

  assert.equal(JSON.stringify(api.tables.Leads.rows),before,
    'ambiguous cloud IDs must block sync, delete, and status changes without mutation');
});


test('read-only duplicate ID audit reports duplicate rows without mutating Sheets', () => {
  const api = createBackend();
  api.tables.Leads.appendRow([
    'TEST-AUDIT-DUP','2026-11-03','Audit lead A','','QA',0,'new','','','','','','','',0
  ]);
  api.tables.Leads.appendRow([
    'TEST-AUDIT-DUP','2026-11-03','Audit lead B','','QA',0,'new','','','','','','','',0
  ]);
  api.tables.Finance.appendRow([
    'TEST-AUDIT-FIN','2026-11-03','expense','QA',1000,'Dummy audit',''
  ]);
  api.tables.Finance.appendRow([
    'TEST-AUDIT-FIN','2026-11-03','expense','QA',1000,'Dummy audit',''
  ]);
  const beforeLeads = JSON.stringify(api.tables.Leads.rows);
  const beforeFinance = JSON.stringify(api.tables.Finance.rows);

  const report = api.sandbox.auditDuplicateRecordIds();
  assert.equal(report.status,'DUPLICATE_IDS_FOUND');
  assert.equal(report.totalDuplicateKeys,2);
  assert.equal(report.totalDuplicateRows,2);
  assert.deepEqual(
    JSON.parse(JSON.stringify(report.sheets.Leads.duplicateIds)),
    [{id:'TEST-AUDIT-DUP',rows:2}]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(report.sheets.Finance.duplicateIds)),
    [{id:'TEST-AUDIT-FIN',rows:2}]
  );
  assert.equal(JSON.stringify(api.tables.Leads.rows),beforeLeads);
  assert.equal(JSON.stringify(api.tables.Finance.rows),beforeFinance);
});


test('mergeSheet reads the data block once and coalesces contiguous updates into one write', () => {
  const api = createBackend();
  const token = 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE';
  const seeds = Array.from({length:4},(_,i)=>({
    id:'TEST-BULK-'+i,date:'2026-11-03',name:'Bulk '+i,phone:'',source:'QA',
    value:i,status:'new',notes:'',email:'',website:'',industry:'',pic:'',
    picTitle:'',linkedin:'',score:0
  }));
  seeds.forEach(row=>api.tables.Leads.appendRow([
    row.id,row.date,row.name,row.phone,row.source,row.value,row.status,row.notes,
    row.email,row.website,row.industry,row.pic,row.picTitle,row.linkedin,row.score
  ]));
  const expectedRecords = {Leads:{}};
  seeds.forEach(row=>{
    const current = api.read().data.leads.find(item=>item.id===row.id);
    expectedRecords.Leads[row.id] = api.sandbox.stableRecordFingerprint_(current);
  });
  const beforeReads = api.tables.Leads.getRangeReadShapes().length;
  const beforeWrites = api.tables.Leads.getRangeWriteShapes().length;
  const updated = seeds.map(row=>({...row,name:row.name+' updated'}));
  const result = api.post({action:'sync_all',token,leads:updated,expectedRecords});
  assert.equal(result.status,'success');
  assert.equal(result.summary.Leads.updated,4);

  const reads = api.tables.Leads.getRangeReadShapes().slice(beforeReads);
  assert.ok(reads.some(r=>r.row===2&&r.col===1&&r.countRows===4&&r.countCols===15),
    'one full data block should supply both ID indexing and old-row comparison');
  assert.equal(reads.filter(r=>r.row===2&&r.col===1&&r.countRows===4&&r.countCols===1).length,0,
    'the separate ID-only column scan must be removed');

  const writes = api.tables.Leads.getRangeWriteShapes().slice(beforeWrites);
  assert.equal(writes.filter(w=>w.row===2&&w.col===1&&w.countRows===4&&w.countCols===15&&!w.single).length,1,
    'four adjacent updates must be coalesced into one setValues call');
  assert.equal(api.read().data.leads.find(row=>row.id==='TEST-BULK-3').name,'Bulk 3 updated');
});


test('legacy insert and update_status enforce expected versions and Owner-only automation', () => {
  const api = createBackend();
  const props = api.sandbox.PropertiesService.getScriptProperties();
  const ownerToken = 'TEST_ONLY_OWNER_TOKEN_LEGACY_API';
  const teamToken = 'TEST_ONLY_TEAM_TOKEN_LEGACY_API';
  props.setProperty('OWNER_API_TOKEN',ownerToken);
  props.setProperty('TEAM_API_TOKEN',teamToken);
  props.deleteProperty('API_TOKEN');
  props.setProperty('AUTO_PROJECT_FROM_WON','true');
  const readOwner = () => api.post({ action:'read', token:ownerToken }).data;

  const lead = {id:'TEST-LEGACY-STATUS',date:'2026-11-03',name:'Legacy status',status:'new',value:100};
  const insertedLead = api.post({
    action:'sync_all',token:ownerToken,leads:[lead],
    expectedRecords:{Leads:{[lead.id]:null}}
  });
  assert.equal(insertedLead.status,'success');
  const original = readOwner().leads.find(row=>row.id===lead.id);
  const originalFingerprint = api.sandbox.stableRecordFingerprint_(original);

  const missingFingerprint = api.post({
    action:'update_status',token:ownerToken,sheet:'Leads',id:lead.id,status:'won'
  });
  assert.equal(missingFingerprint.code,'EXPECTED_VERSION_REQUIRED');
  assert.equal(api.tables.Projects.getLastRow(),1);

  const teamUpdate = api.post({
    action:'update_status',token:teamToken,sheet:'Leads',id:lead.id,status:'won',
    expectedFingerprint:originalFingerprint
  });
  assert.equal(teamUpdate.status,'success');
  assert.equal(api.tables.Projects.getLastRow(),1,
    'Team must not trigger Owner-only won-lead automation');

  const updatedLead = readOwner().leads.find(row=>row.id===lead.id);
  const ownerUpdate = api.post({
    action:'update_status',token:ownerToken,sheet:'Leads',id:lead.id,status:'won',
    expectedFingerprint:api.sandbox.stableRecordFingerprint_(updatedLead)
  });
  assert.equal(ownerUpdate.status,'success');
  assert.equal(api.tables.Projects.getLastRow(),2,
    'Owner may trigger the opt-in automation after a CAS-verified status update');

  const beforeInsert = api.tables.Memory.getLastRow();
  const missingAbsent = api.post({
    action:'insert',token:ownerToken,sheet:'Memory',
    data:{id:'TEST-LEGACY-INSERT',date:'2026-11-03',category:'QA',title:'No baseline',content:'Reject'}
  });
  assert.equal(missingAbsent.code,'EXPECTED_VERSION_REQUIRED');
  assert.equal(api.tables.Memory.getLastRow(),beforeInsert);

  const validInsert = api.post({
    action:'insert',token:ownerToken,sheet:'Memory',expectedAbsent:true,
    data:{id:'TEST-LEGACY-INSERT',date:'2026-11-03',category:'QA',title:'CAS insert',content:'Allowed'}
  });
  assert.equal(validInsert.status,'success');
  const duplicateInsert = api.post({
    action:'insert',token:ownerToken,sheet:'Memory',expectedAbsent:true,
    data:{id:'TEST-LEGACY-INSERT',date:'2026-11-03',category:'QA',title:'Duplicate',content:'Rejected'}
  });
  assert.equal(duplicateInsert.code,'SYNC_CONFLICT');
  assert.equal(api.tables.Memory.getLastRow(),beforeInsert+1);
});
