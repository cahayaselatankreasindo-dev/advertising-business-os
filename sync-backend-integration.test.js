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
  return {
    rows,
    getLastRow() { return rows.length; },
    getLastColumn() { return Math.max(...rows.map(x => x.length)); },
    getDataRange() { return { getValues() { return rows.map(x => x.slice()); } }; },
    getRange(row, col, countRows = 1, countCols = 1) {
      return {
        getValues() {
          return Array.from({ length: countRows }, (_, i) =>
            Array.from({ length: countCols }, (_, j) => (rows[row - 1 + i] || [])[col - 1 + j] ?? ''));
        },
        setValues(v) {
          v.forEach((items, i) => {
            if (!rows[row - 1 + i]) rows[row - 1 + i] = [];
            items.forEach((value,j) => { rows[row - 1 + i][col - 1 + j] = value; });
          });
          return this;
        },
        setValue(v) {
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
    Marketing_Spend: sheet(['ID','Tanggal','Platform','Kampanye','Budget','Terpakai','LeadsDihasilkan','Catatan'])
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
      getProperty: key => props[key] || null, setProperty: (key,val) => {props[key]=val;}
    }) },
    ScriptApp: { getProjectTriggers: () => [] },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: () => {} },
    Utilities: { formatDate: () => '2026-10-31', getUuid: () => '0e53d4f6-137d-4bdc-86c2-67fa792a5237' },
    Logger: { log() {} },
    console
  };
  vm.createContext(backend);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'google_apps_script.js'),'utf8'), backend);
  const sent = [];
  let ignorePosts = false;
  const server = {
    tables, sent,
    read() { return JSON.parse(backend.doGet({ parameter: { token: 'TEST_ONLY_LAB_API_TOKEN_2026_SAFE', protocolVersion: 2 } }).text); },
    post(data) {
      const payload = Object.assign({ protocolVersion: 2 }, data);
      return JSON.parse(backend.doPost({ postData: { contents: JSON.stringify(payload) } }).text);
    },
    suppressPosts(value) { ignorePosts = value; },
    fetch: async (url, opts = {}) => {
      if (opts.method === 'POST') {
        const payload = JSON.parse(opts.body);
        sent.push(payload);
        if (!ignorePosts) server.post(payload);
        return { type: 'opaque' }; // Apps Script POST CORS can't be inspected
      }
      const query = new URL(url).searchParams;
      const token = query.get('token');
      const protocolVersion = query.get('protocolVersion');
      return {
        ok: true,
        json: async () => JSON.parse(backend.doGet({ parameter: { token, protocolVersion } }).text)
      };
    }
  };
  return {...server, sandbox:backend};
}
function localStorageStub() {
  const values = {};
  return { getItem: k => values[k] || null, setItem: (k,v) => {values[k]=v;} };
}

test('real backend + real frontend delta: edit -> POST -> GET readback', async () => {
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
  const result = await engine.flush('https://example.test/exec','TEST_ONLY_LAB_API_TOKEN_2026_SAFE');
  assert.equal(result.status,'verified');
  assert.equal(engine.countPending(),0);
  assert.equal(api.read().data.leads.find(x=>x.id==='TEST-1').name,'Dummy B');
  assert.equal(api.sent.length,1);
  assert.deepEqual(Object.keys(api.sent[0]).sort(),['action','leads','protocolVersion','token']);
});
test('real backend + frontend: delete -> GET confirms missing', async () => {
  const api=createBackend();
  const finance={id:'FIN-DEL',date:'2026-10-31',type:'expense',category:'QA',amount:175000,description:'Dummy'};
  assert.equal(api.post({action:'sync_all',token:'TEST_ONLY_LAB_API_TOKEN_2026_SAFE',finance:[finance]}).status,'success');
  const local=api.read().data;
  const engine=createEngine(localStorageStub(),api.fetch);
  engine.init(local);
  engine.merge(api.read().data,local);
  local.finance=[];
  engine.track(local);
  const result=await engine.flush('https://example.test/exec','TEST_ONLY_LAB_API_TOKEN_2026_SAFE');
  assert.equal(result.status,'verified');
  assert.equal(api.read().data.finance.length,0);
  assert.equal(api.sent[0].action,'delete');
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
  const result=await engine.flush('https://example.test/exec','TEST_ONLY_LAB_API_TOKEN_2026_SAFE');
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
  const result=await engine.flush('https://example.test/exec','TEST_ONLY_LAB_API_TOKEN_2026_SAFE');
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
  assert.equal(guardSmoke.blockedUnsafeRequests,13);
  assert.equal(guardSmoke.databaseWritesPerformed,0);
  assert.equal(guardSmoke.emailSendsPerformed,0);

  const accepted = {
    action:'sync_all',token:secret,protocolVersion:2,leads:[
      {id:'TEST-QA-NEW-1',date:'2026-10-31',name:'Dummy',status:'new'}
    ],
    finance:[{id:'QA-LAB-FIN-1',date:'2026-10-31',type:'expense',amount:175000}]
  };
  assert.doesNotThrow(()=>ctx.cskLabGuardPost_(accepted));
  assert.doesNotThrow(()=>ctx.cskLabGuardPost_({
    action:'delete',token:secret,protocolVersion:2,sheet:'Leads',id:'TEST-QA-NEW-1'
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
  const getAnchor='function doGet(e) {\n  try {';
  const postAnchor='const payload = JSON.parse(e.postData.contents);';
  assert.ok(source.includes(getAnchor),'GET handler anchor missing');
  assert.ok(source.includes(postAnchor),'POST handler anchor missing');
  source=source.replace(getAnchor,getAnchor+'\n    cskLabGuardRead_();');
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
  const legacyRead = JSON.parse(api.sandbox.doGet({ parameter: { token } }).text);
  assert.equal(legacyRead.code, 'CLIENT_PROTOCOL_MISMATCH');
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
