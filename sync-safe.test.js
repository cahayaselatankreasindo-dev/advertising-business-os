/* Run: node sync-safe.test.js
 * No real Sheets API calls. Exercises the staged delta sync engine in memory.
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { createEngine } = require('./sync-safe.js');
const columns = ['leads', 'clients', 'projects', 'finance', 'memory', 'marketingSpend'];
const sheetKey = { Leads:'leads', Clients:'clients', Projects:'projects', Finance:'finance', Memory:'memory', Marketing_Spend:'marketingSpend' };

function store() {
  const data = {};
  return { getItem:k=>data[k]||null, setItem:(k,v)=>{data[k]=String(v);} };
}
function fixture(name='Original') {
  return {
    leads:[{id:'lead-1', date:'2026-10-31', name, phone:'', source:'WhatsApp', value:100, status:'new', notes:'', email:'', website:'', industry:'', pic:'', picTitle:'', linkedin:'', score:0}],
    clients:[], projects:[], finance:[], memory:[], marketingSpend:[]
  };
}
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function fakeCloud(initial, writeEnabled=true) {
  const rows = clone(initial);
  const calls = [];
  return {
    rows, calls,
    fetch: async (url, opts={}) => {
      if (opts.method === 'POST') {
        const body = JSON.parse(opts.body);
        calls.push(body);
        if (!writeEnabled) return { type: 'opaque' };
        if (body.action === 'sync_all') {
          for (const col of columns) {
            for (const record of body[col] || []) {
              const index = rows[col].findIndex(x=>String(x.id)===String(record.id));
              if (index < 0) rows[col].push(record);
              else rows[col][index]=record;
            }
          }
        } else if (body.action === 'delete') {
          const col=sheetKey[body.sheet];
          rows[col]=rows[col].filter(x=>String(x.id)!==String(body.id));
        }
        return { type:'opaque' };
      }
      return { ok: true, json: async ()=>({ status:'success', data:clone(rows) }) };
    }
  };
}

test('send ONLY changed lead and confirm real cloud state', async ()=>{
  const cloud=fakeCloud(fixture());
  const db=fixture();
  const engine=createEngine(store(),cloud.fetch);
  engine.init(db);
  engine.merge(clone(cloud.rows),db);
  db.leads[0].name='Updated';
  engine.track(db);
  assert.equal(engine.countPending(),1);
  const result=await engine.flush('https://example.test/exec','');
  assert.equal(result.status,'verified');
  assert.equal(engine.countPending(),0);
  assert.equal(cloud.rows.leads[0].name,'Updated');
  assert.deepEqual(Object.keys(cloud.calls[0]).sort(),['action','leads','token']);
});

test('delete is queued, verified, and does not resurrect record on pull',async()=>{
  const cloud=fakeCloud(fixture());
  const db=fixture();
  const engine=createEngine(store(),cloud.fetch);
  engine.init(db);
  engine.merge(clone(cloud.rows),db);
  db.leads=[];
  engine.track(db);
  engine.merge(clone(cloud.rows),db);
  assert.equal(db.leads.length,0);
  const result=await engine.flush('https://example.test/exec','');
  assert.equal(result.status,'verified');
  assert.equal(cloud.rows.leads.length,0);
});

test('conflicting remote edit stops all cloud writes',async()=>{
  const cloud=fakeCloud(fixture());
  const db=fixture();
  const engine=createEngine(store(),cloud.fetch);
  engine.init(db);
  engine.merge(clone(cloud.rows),db);
  db.leads[0].name='Edited locally';
  engine.track(db);
  cloud.rows.leads[0].name='Edited on phone';
  const result=await engine.flush('https://example.test/exec','');
  assert.equal(result.status,'conflict');
  assert.equal(cloud.calls.length,0);
  assert.equal(engine.countPending(),1);
});

test('a POST without actual server save is never considered verified',async()=>{
  const cloud=fakeCloud(fixture(),false);
  const db=fixture();
  const engine=createEngine(store(),cloud.fetch);
  engine.init(db);
  engine.merge(clone(cloud.rows),db);
  db.leads[0].name='Not persisted';
  engine.track(db);
  const result=await engine.flush('https://example.test/exec','');
  assert.equal(result.status,'unverified');
  assert.equal(engine.countPending(),1);
});

test('queued changes survive reloading the page',()=>{
  const storage=store();
  const db=fixture();
  const engine=createEngine(storage, fakeCloud(fixture()).fetch);
  engine.init(db);
  db.leads[0].name='Offline edit';
  engine.track(db);
  const next=createEngine(storage, fakeCloud(fixture()).fetch);
  next.init(clone(db));
  assert.equal(next.countPending(),1);
});

test('browser inline script still parses',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length>0,'inline script present');
  assert.doesNotThrow(()=>new vm.Script(scripts[scripts.length-1][1],{filename:'index.html'}));
});


test('recovery restores local snapshot without queuing old records to cloud', () => {
  const storage = store();
  const db = fixture();
  const engine = createEngine(storage, fakeCloud(fixture()).fetch);
  engine.init(db);
  db.leads[0].name = 'Pending edit';
  engine.track(db);
  assert.equal(engine.countPending(), 1);
  const restored = fixture('Backup-only');
  engine.restoreLocalOnly(restored);
  assert.equal(engine.countPending(), 0);
  assert.equal(engine.verifiedAt, '');
  const reopened = createEngine(storage, fakeCloud(fixture()).fetch);
  reopened.init(restored);
  assert.equal(reopened.countPending(), 0, 'old backup must not auto-upload after reload');
});

test('staged app starts without demo customers or baked-in production endpoint', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /let db = \{\s*leads: \[\]/);
  assert.doesNotMatch(html, /AKfycbxDW7mfI4QjTXLtaYBFycTZD8dtKmjC0ML831hngmz1y2idtC_/);
  assert.match(html, /id="sync-banner"/);
  assert.doesNotMatch(html, /user-scalable=no/);
  assert.match(html, /if \(pending > 0\) \{/);
  assert.match(html, /safeSync\.restoreLocalOnly\(db\)/);
});

test('staged backend never treats a won lead as a cash deposit', () => {
  const source = fs.readFileSync('google_apps_script.js', 'utf8');
  assert.doesNotMatch(source, /id:\s*"AUTO-FIN-/);
  assert.match(source, /AUTO_PROJECT_FROM_WON/);
  assert.match(source, /if \(!expected \|\| expected\.length < 20/);
});
