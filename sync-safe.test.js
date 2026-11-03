/* Run: node sync-safe.test.js
 * No real Sheets API calls. Exercises the staged delta sync engine in memory.
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { createEngine } = require('./sync-safe.js');
const CSK = require('./sync-safe.js');
const columns = ['leads', 'clients', 'projects', 'finance', 'memory', 'marketingSpend', 'costings', 'projectCosts'];
const sheetKey = { Leads:'leads', Clients:'clients', Projects:'projects', Finance:'finance', Memory:'memory', Marketing_Spend:'marketingSpend', Costings:'costings', Project_Costs:'projectCosts' };

function store() {
  const data = {};
  return { getItem:k=>data[k]||null, setItem:(k,v)=>{data[k]=String(v);} };
}
function fixture(name='Original') {
  return {
    leads:[{id:'lead-1', date:'2026-10-31', name, phone:'', source:'WhatsApp', value:100, status:'new', notes:'', email:'', website:'', industry:'', pic:'', picTitle:'', linkedin:'', score:0}],
    clients:[], projects:[], finance:[], memory:[], marketingSpend:[], costings:[], projectCosts:[]
  };
}
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function fingerprint(record) {
  return JSON.stringify(Object.keys(record).sort().map(key => [key, record[key]]));
}
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
          const pending = [];
          let valid = true;
          for (const col of columns) {
            const sheet = Object.keys(sheetKey).find(key => sheetKey[key] === col);
            const versions = body.expectedRecords && body.expectedRecords[sheet];
            for (const record of body[col] || []) {
              const id = String(record.id);
              const index = rows[col].findIndex(x=>String(x.id)===id);
              const expected = versions && Object.prototype.hasOwnProperty.call(versions, id) ? versions[id] : undefined;
              const current = index < 0 ? null : rows[col][index];
              if (expected === undefined ||
                  (expected === null ? !!current : (!current || fingerprint(current) !== expected))) valid = false;
              pending.push({col,record,index});
            }
          }
          if (valid) pending.forEach(({col,record,index}) => {
            if (index < 0) rows[col].push(record);
            else rows[col][index]=record;
          });
        } else if (body.action === 'delete') {
          const col=sheetKey[body.sheet];
          const current=rows[col].find(x=>String(x.id)===String(body.id));
          if (current && fingerprint(current) === body.expectedFingerprint) {
            rows[col]=rows[col].filter(x=>String(x.id)!==String(body.id));
          }
        }
        return { type:'opaque' };
      }
      return { ok: true, json: async ()=>({ status:'success', protocolVersion:2, data:clone(rows) }) };
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
  const result=await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(result.status,'verified');
  assert.equal(engine.countPending(),0);
  assert.equal(cloud.rows.leads[0].name,'Updated');
  assert.deepEqual(Object.keys(cloud.calls[0]).sort(),['action','expectedRecords','leads','protocolVersion','token']);
});

test('new client refuses a backend with a different protocol version', async () => {
  let posts = 0;
  const fetcher = async (_url, opts = {}) => {
    if (opts.method === 'POST') { posts++; return { type: 'opaque' }; }
    return { ok: true, json: async () => ({ status: 'success', protocolVersion: 1, data: fixture() }) };
  };
  const db = fixture();
  const engine = createEngine(store(), fetcher);
  engine.init(db);
  db.leads[0].name = 'Must remain pending';
  engine.track(db);
  const result = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', '');
  assert.equal(result.status, 'error');
  assert.match(result.message, /Versi backend tidak cocok/);
  assert.equal(posts, 0, 'no write may be sent to a mismatched backend');
  assert.equal(engine.countPending(), 1);
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
  const result=await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(result.status,'verified');
  assert.equal(cloud.rows.leads.length,0);
  assert.equal(typeof cloud.calls[0].expectedFingerprint, 'string');
});

test('server-side version check catches an edit racing after client preflight', async () => {
  const cloud = fakeCloud(fixture());
  const db = fixture();
  const raceFetcher = async (url, opts = {}) => {
    if (opts.method === 'POST') cloud.rows.leads[0].name = 'Edited on second device';
    return cloud.fetch(url, opts);
  };
  const engine = createEngine(store(), raceFetcher);
  engine.init(db);
  engine.merge(clone(cloud.rows), db);
  db.leads[0].name = 'Edited on first device';
  engine.track(db);
  const result = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', '');
  assert.equal(result.status, 'conflict');
  assert.deepEqual(result.conflicts, ['leads/lead-1']);
  assert.equal(cloud.rows.leads[0].name, 'Edited on second device');
  assert.equal(engine.countPending(), 1);
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
  const result=await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(result.status,'conflict');
  assert.equal(cloud.calls.length,0);
  assert.equal(engine.countPending(),1);
});

test('conflict resolution can safely adopt the latest cloud record', async () => {
  const cloud = fakeCloud(fixture());
  const db = fixture();
  const engine = createEngine(store(), cloud.fetch);
  engine.init(db);
  engine.merge(clone(cloud.rows), db);
  db.leads[0].name = 'Edited locally';
  engine.track(db);
  cloud.rows.leads[0].name = 'Edited on phone';
  const conflict = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', '');
  assert.equal(conflict.status, 'conflict');
  assert.deepEqual(engine.conflicts, ['leads/lead-1']);

  const resolved = engine.resolveConflict('leads', 'lead-1', 'cloud', clone(cloud.rows), db);
  assert.equal(resolved.pending, 0);
  assert.deepEqual(resolved.conflicts, []);
  assert.equal(db.leads[0].name, 'Edited on phone');
  assert.equal(engine.countPending(), 0);
  assert.equal(engine.conflicts.length, 0);
});

test('explicit local conflict choice rebases to the latest cloud version before retry', async () => {
  const cloud = fakeCloud(fixture());
  const db = fixture();
  const engine = createEngine(store(), cloud.fetch);
  engine.init(db);
  engine.merge(clone(cloud.rows), db);
  db.leads[0].name = 'Edited locally';
  engine.track(db);
  cloud.rows.leads[0].name = 'Edited on phone';
  const conflict = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', '');
  assert.equal(conflict.status, 'conflict');

  const resolved = engine.resolveConflict('leads', 'lead-1', 'local', clone(cloud.rows), db);
  assert.equal(resolved.pending, 1);
  assert.deepEqual(resolved.conflicts, []);
  assert.equal(engine.countPending(), 1);
  const retry = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', '');
  assert.equal(retry.status, 'verified');
  assert.equal(cloud.rows.leads[0].name, 'Edited locally');
  assert.equal(engine.countPending(), 0);
});

test('conflict IDs survive reload until explicitly resolved', async () => {
  const storage = store();
  const cloud = fakeCloud(fixture());
  const db = fixture();
  const engine = createEngine(storage, cloud.fetch);
  engine.init(db);
  engine.merge(clone(cloud.rows), db);
  db.leads[0].name = 'Local';
  engine.track(db);
  cloud.rows.leads[0].name = 'Remote';
  await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', '');
  const reopened = createEngine(storage, cloud.fetch);
  reopened.init(clone(db));
  assert.deepEqual(reopened.conflicts, ['leads/lead-1']);
});

test('a POST without actual server save is never considered verified',async()=>{
  const cloud=fakeCloud(fixture(),false);
  const db=fixture();
  const engine=createEngine(store(),cloud.fetch);
  engine.init(db);
  engine.merge(clone(cloud.rows),db);
  db.leads[0].name='Not persisted';
  engine.track(db);
  const result=await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
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
  assert.match(html, /id="sync-conflict-review-btn"/);
  assert.match(html, /function reviewSyncConflicts\(\)/);
  assert.match(html, /function resolveSyncConflictChoice\(/);
  assert.match(html, /conflictRecovery,/);
  assert.match(html, /csk_business_os_conflict_recovery_v1/);
  assert.doesNotMatch(html, /user-scalable=no/);
  assert.match(html, /if \(pending > 0\) \{/);
  assert.match(html, /safeSync\.restoreLocalOnly\(db\)/);
});

test('staged backend never treats a won lead as a cash deposit', () => {
  const source = fs.readFileSync('google_apps_script.js', 'utf8');
  assert.doesNotMatch(source, /id:\s*"AUTO-FIN-/);
  assert.match(source, /AUTO_PROJECT_FROM_WON/);
  assert.ok(source.includes('function secureTokenEquals_('));
  assert.match(source, /expected.length < 20/);
  assert.ok(source.includes('function getRequestRole('));
});

test('imported customer text is escaped before HTML rendering', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const from = html.indexOf('    function escapeHTML(value) {');
  const to = html.indexOf('    function safeInlineId(value) {', from);
  assert.ok(from > 0 && to > from, 'HTML escape function exists');
  const escape = vm.runInNewContext(html.slice(from, to) + '\n escapeHTML;');
  assert.equal(escape('<img src=x onerror="alert(1)">'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.match(html, /safeExternalHref\(l\.website\)/);
  assert.match(html, /safeExternalHref\(l\.linkedin\)/);
  assert.match(html, /safeInlineId\(l\.id\)/);
});


test('Google Apps Script endpoint validation blocks token exfiltration to arbitrary hosts and paths', async () => {
  const valid = 'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec';
  assert.equal(CSK.validateEndpoint(valid), valid);
  assert.equal(CSK.validateEndpoint('https://script.google.com/a/macros/example.com/s/TEST_DEPLOYMENT_ID/exec'),
    'https://script.google.com/a/macros/example.com/s/TEST_DEPLOYMENT_ID/exec');
  const invalid = [
    'http://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec',
    'https://script.google.com.evil.example/macros/s/TEST_DEPLOYMENT_ID/exec',
    'https://evil.example/macros/s/TEST_DEPLOYMENT_ID/exec',
    'https://script.google.com/anything/exec',
    'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec?redirect=https://evil.example',
    'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec#token',
    'https://user:pass@script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec'
  ];
  invalid.forEach(url => assert.throws(() => CSK.validateEndpoint(url), /URL HTTPS deployment Google Apps Script/));
  let networkCalls = 0;
  const engine = createEngine(store(), async () => { networkCalls++; throw new Error('network must not run'); });
  await assert.rejects(engine.readCloud('https://evil.example/macros/s/TEST_DEPLOYMENT_ID/exec', 'secret-token'),
    /URL HTTPS deployment Google Apps Script/);
  assert.equal(networkCalls, 0, 'token-bearing request must be blocked before network access');
});

test('large pending changes are sent in verified batches of at most 40 across all modules', async () => {
  const initial = fixture();
  initial.leads = Array.from({length:85}, (_,i) => ({
    ...initial.leads[0], id:'lead-batch-'+i, name:'Lead '+i
  }));
  const cloud = fakeCloud(initial);
  const db = clone(initial);
  const engine = createEngine(store(), cloud.fetch);
  engine.init(db);
  engine.merge(clone(cloud.rows), db);
  db.leads.forEach((lead,i) => { lead.name = 'Updated '+i; });
  engine.track(db);
  assert.equal(engine.countPending(),85);
  const result = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(result.status,'verified');
  assert.equal(engine.countPending(),0);
  const batches = cloud.calls.filter(call => call.action === 'sync_all');
  assert.deepEqual(batches.map(batch => batch.leads.length),[40,40,5]);
  assert.ok(batches.every(batch => Object.values(batch).filter(Array.isArray).flat().length <= 40));
  assert.equal(cloud.rows.leads.every((lead,i) => lead.name === 'Updated '+i),true);
});

test('unrelated cloud edits remain conflicts after a different record is successfully synced', async () => {
  const initial = fixture();
  initial.leads.push({...initial.leads[0],id:'lead-2',name:'Second original'});
  const cloud = fakeCloud(initial);
  const db = clone(initial);
  let raced = false;
  const raceFetcher = async (url, options={}) => {
    if (options.method === 'POST' && !raced) {
      const payload = JSON.parse(options.body);
      if (payload.action === 'sync_all') {
        cloud.rows.leads[1].name = 'Changed on second device';
        raced = true;
      }
    }
    return cloud.fetch(url, options);
  };
  const engine = createEngine(store(), raceFetcher);
  engine.init(db);
  engine.merge(clone(cloud.rows), db);
  db.leads[0].name = 'First device edit';
  engine.track(db);
  const first = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(first.status,'verified');
  assert.equal(db.leads[1].name,'Second original','local copy remains unchanged until explicit cloud merge');
  db.leads[1].notes = 'Local follow-up';
  engine.track(db);
  const second = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(second.status,'conflict','unrelated remote edit must not be silently rebaselined');
  assert.deepEqual(second.conflicts,['leads/lead-2']);
  assert.equal(cloud.rows.leads[1].name,'Changed on second device');
});
