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
  const props = { API_TOKEN: 'TEST_TOKEN_ONLY' };
  const backend = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: key => tables[key] || null,
        insertSheet: key => tables[key] = sheet([]),
        getSheets: () => Object.values(tables),
        deleteSheet: () => {}
      })
    },
    ContentService: { MimeType: { JSON: 'JSON' }, createTextOutput: text => ({ text, setMimeType(){ return this; } }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props[key] || null, setProperty: (key,val) => {props[key]=val;}
    }) },
    ScriptApp: { getProjectTriggers: () => [] },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: () => {} },
    Utilities: { formatDate: () => '2026-10-31' },
    Logger: { log() {} },
    console
  };
  vm.createContext(backend);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'google_apps_script.js'),'utf8'), backend);
  const sent = [];
  let ignorePosts = false;
  const server = {
    tables, sent,
    read() { return JSON.parse(backend.doGet({ parameter: { token: 'TEST_TOKEN_ONLY' } }).text); },
    post(data) { return JSON.parse(backend.doPost({ postData: { contents: JSON.stringify(data) } }).text); },
    suppressPosts(value) { ignorePosts = value; },
    fetch: async (url, opts = {}) => {
      if (opts.method === 'POST') {
        const payload = JSON.parse(opts.body);
        sent.push(payload);
        if (!ignorePosts) server.post(payload);
        return { type: 'opaque' }; // Apps Script POST CORS can't be inspected
      }
      const token = new URL(url).searchParams.get('token');
      return {
        ok: true,
        json: async () => JSON.parse(backend.doGet({ parameter: { token } }).text)
      };
    }
  };
  return server;
}
function localStorageStub() {
  const values = {};
  return { getItem: k => values[k] || null, setItem: (k,v) => {values[k]=v;} };
}

test('real backend + real frontend delta: edit -> POST -> GET readback', async () => {
  const api = createBackend();
  const original = { id:'TEST-1', date:'2026-10-31', name:'Dummy A', phone:'0', source:'QA', value:1, status:'new', notes:'',email:'',website:'',industry:'',pic:'',picTitle:'',linkedin:'',score:0 };
  assert.equal(api.post({action:'sync_all',token:'TEST_TOKEN_ONLY',leads:[original]}).status, 'success');
  const local = api.read().data;
  const engine = createEngine(localStorageStub(),api.fetch);
  engine.init(local);
  engine.merge(api.read().data,local);
  local.leads[0].name='Dummy B';
  engine.track(local);
  assert.equal(engine.countPending(),1);
  const result = await engine.flush('https://example.test/exec','TEST_TOKEN_ONLY');
  assert.equal(result.status,'verified');
  assert.equal(engine.countPending(),0);
  assert.equal(api.read().data.leads.find(x=>x.id==='TEST-1').name,'Dummy B');
  assert.equal(api.sent.length,1);
  assert.deepEqual(Object.keys(api.sent[0]).sort(),['action','leads','token']);
});
test('real backend + frontend: delete -> GET confirms missing', async () => {
  const api=createBackend();
  const finance={id:'FIN-DEL',date:'2026-10-31',type:'expense',category:'QA',amount:175000,description:'Dummy'};
  assert.equal(api.post({action:'sync_all',token:'TEST_TOKEN_ONLY',finance:[finance]}).status,'success');
  const local=api.read().data;
  const engine=createEngine(localStorageStub(),api.fetch);
  engine.init(local);
  engine.merge(api.read().data,local);
  local.finance=[];
  engine.track(local);
  const result=await engine.flush('https://example.test/exec','TEST_TOKEN_ONLY');
  assert.equal(result.status,'verified');
  assert.equal(api.read().data.finance.length,0);
  assert.equal(api.sent[0].action,'delete');
});
test('real backend + frontend: two-client edit conflicts without writing', async () => {
  const api=createBackend();
  const initial={id:'TEST-2',date:'2026-10-31',name:'Server old',phone:'',source:'QA',value:0,status:'new',notes:'',email:'',website:'',industry:'',pic:'',picTitle:'',linkedin:'',score:0};
  api.post({action:'sync_all',token:'TEST_TOKEN_ONLY',leads:[initial]});
  const local=api.read().data;
  const engine=createEngine(localStorageStub(),api.fetch);
  engine.init(local);
  engine.merge(api.read().data,local);
  local.leads[0].name='Phone edit';
  engine.track(local);
  api.post({action:'sync_all',token:'TEST_TOKEN_ONLY',leads:[{...initial,name:'PC edit'}]});
  const result=await engine.flush('https://example.test/exec','TEST_TOKEN_ONLY');
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
  const result=await engine.flush('https://example.test/exec','TEST_TOKEN_ONLY');
  assert.equal(result.status,'unverified');
  assert.equal(engine.countPending(),1);
  assert.equal(api.read().data.projects.length,0);
});
