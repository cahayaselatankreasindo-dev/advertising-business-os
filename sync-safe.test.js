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
  const reads = [];
  return {
    rows, calls, reads,
    fetch: async (url, opts={}) => {
      if (opts.method === 'POST') {
        const body = JSON.parse(opts.body);
        if (body.action === 'read') {
          reads.push({ url, opts, body });
          return { ok: true, type: 'cors', json: async () => ({ status:'success', protocolVersion:2, data:clone(rows) }) };
        }
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
      throw new Error('GET is disabled; use authenticated POST action read.');
    }
  };
}

test('read sends the bearer token in a POST body, never in the URL', async () => {
  const cloud = fakeCloud(fixture());
  const engine = createEngine(store(), cloud.fetch);
  const endpoint = 'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec';
  const secret = 'TEST_ONLY_SESSION_TOKEN_2026';
  const data = await engine.readCloud(endpoint, secret);
  assert.equal(data.leads[0].id, 'lead-1');
  assert.equal(cloud.reads.length, 1);
  assert.equal(cloud.reads[0].url, endpoint);
  assert.deepEqual(JSON.parse(cloud.reads[0].opts.body), { action: 'read', token: secret, protocolVersion: 2 });
  assert.equal(cloud.reads[0].opts.mode, 'cors');
  assert.equal(cloud.reads[0].opts.redirect, 'follow');
  assert.equal(cloud.reads[0].opts.headers['Content-Type'], 'text/plain;charset=UTF-8');
  assert.equal(new URL(cloud.reads[0].url).search, '');
});

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
    if (opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      if (body.action === 'read') return { ok: true, json: async () => ({ status: 'success', protocolVersion: 1, data: fixture() }) };
      posts++;
      return { type: 'opaque' };
    }
    throw new Error('Unexpected GET request');
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

test('two independent devices racing to edit one record cannot silently overwrite each other', async () => {
  const cloud = fakeCloud(fixture());
  const dbA = fixture();
  const dbB = fixture();
  const engineA = createEngine(store(), cloud.fetch);
  const engineB = createEngine(store(), cloud.fetch);
  engineA.init(dbA); engineB.init(dbB);
  engineA.merge(clone(cloud.rows), dbA);
  engineB.merge(clone(cloud.rows), dbB);
  dbA.leads[0].name = 'Device A edit';
  dbB.leads[0].name = 'Device B edit';
  engineA.track(dbA); engineB.track(dbB);

  const results = await Promise.all([
    engineA.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', ''),
    engineB.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', '')
  ]);
  assert.equal(results.filter(x => x.status === 'verified').length, 1);
  assert.equal(results.filter(x => x.status === 'conflict').length, 1);
  assert.ok(['Device A edit', 'Device B edit'].includes(cloud.rows.leads[0].name));
  const loser = results[0].status === 'conflict' ? engineA : engineB;
  assert.equal(loser.countPending(), 1, 'losing device must retain its local edit');
  assert.deepEqual(loser.conflicts, ['leads/lead-1']);
});

test('stale delete from one device cannot remove a record edited by another device', async () => {
  const cloud = fakeCloud(fixture());
  const dbA = fixture();
  const dbB = fixture();
  const engineA = createEngine(store(), cloud.fetch);
  const engineB = createEngine(store(), cloud.fetch);
  engineA.init(dbA); engineB.init(dbB);
  engineA.merge(clone(cloud.rows), dbA);
  engineB.merge(clone(cloud.rows), dbB);

  dbB.leads[0].name = 'Updated on device B';
  engineB.track(dbB);
  const update = await engineB.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', '');
  assert.equal(update.status, 'verified');

  dbA.leads = [];
  engineA.track(dbA);
  const deletion = await engineA.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', '');
  assert.equal(deletion.status, 'conflict');
  assert.deepEqual(deletion.conflicts, ['leads/lead-1']);
  assert.equal(cloud.rows.leads[0].name, 'Updated on device B');
  assert.equal(engineA.countPending(), 1);
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


test('local restore clears persisted conflict state as well as the pending queue', async () => {
  const storage = store();
  const cloud = fakeCloud(fixture());
  const db = fixture();
  const engine = createEngine(storage, cloud.fetch);
  engine.init(db);
  engine.merge(clone(cloud.rows), db);
  db.leads[0].name = 'Local conflict version';
  engine.track(db);
  cloud.rows.leads[0].name = 'Remote conflict version';
  const conflict = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', '');
  assert.equal(conflict.status, 'conflict');

  const restored = fixture('Restored backup');
  engine.restoreLocalOnly(restored);
  assert.deepEqual(engine.conflicts, []);
  assert.equal(engine.countPending(), 0);
  assert.equal(engine.verifiedAt, '');

  const reopened = createEngine(storage, cloud.fetch);
  reopened.init(restored);
  assert.deepEqual(reopened.conflicts, []);
  assert.equal(reopened.countPending(), 0);
});

test('manual cloud replacement clears stale conflict markers', async () => {
  const storage = store();
  const cloud = fakeCloud(fixture());
  const db = fixture();
  const engine = createEngine(storage, cloud.fetch);
  engine.init(db);
  engine.merge(clone(cloud.rows), db);
  db.leads[0].name = 'Local conflict version';
  engine.track(db);
  cloud.rows.leads[0].name = 'Remote conflict version';
  const conflict = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', '');
  assert.equal(conflict.status, 'conflict');

  engine.replaceFromCloud(clone(cloud.rows), db);
  assert.deepEqual(engine.conflicts, []);
  assert.equal(engine.countPending(), 0);
  assert.equal(db.leads[0].name, 'Remote conflict version');
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


test('prototype-named record IDs survive queue persistence and verified sync', async () => {
  const storage = store();
  const cloud = fakeCloud(fixture());
  const db = fixture();
  const engine = createEngine(storage, cloud.fetch);
  engine.init(db);
  engine.merge(clone(cloud.rows), db);
  db.leads.push(
    {...db.leads[0],id:'__proto__',name:'Prototype ID'},
    {...db.leads[0],id:'constructor',name:'Constructor ID'}
  );
  engine.track(db);
  assert.equal(engine.countPending(),2);
  const reopened = createEngine(storage, cloud.fetch);
  reopened.init(clone(db));
  assert.equal(reopened.countPending(),2);
  const result = await reopened.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(result.status,'verified');
  assert.equal(reopened.countPending(),0);
  assert.equal(cloud.rows.leads.find(row=>row.id==='__proto__').name,'Prototype ID');
  assert.equal(cloud.rows.leads.find(row=>row.id==='constructor').name,'Constructor ID');
});


test('retry reconciles a committed write when all immediate readbacks fail', async () => {
  const cloud = fakeCloud(fixture());
  const db = fixture();
  let failReadbacks = 0;
  const flaky = async (url, options={}) => {
    if (options.method === 'POST') {
      const payload = JSON.parse(options.body);
      if (payload.action === 'read') {
        if (failReadbacks > 0) {
          failReadbacks--;
          throw new Error('temporary readback failure');
        }
        return cloud.fetch(url, options);
      }
      const result = await cloud.fetch(url, options);
      failReadbacks = 3;
      return result;
    }
    throw new Error('GET is disabled; use authenticated POST action read.');
  };
  const storage = store();
  const engine = createEngine(storage, flaky);
  engine.init(db);
  engine.merge(clone(cloud.rows), db);
  db.leads[0].name = 'Committed but readback unavailable';
  engine.track(db);
  const first = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(first.status,'error');
  assert.equal(engine.countPending(),1);
  assert.equal(cloud.rows.leads[0].name,'Committed but readback unavailable');

  const postCount = cloud.calls.length;
  const second = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(second.status,'verified',JSON.stringify({
    second,lastError:engine.lastError,pending:engine.countPending(),remote:cloud.rows.leads[0]
  }));
  assert.equal(engine.countPending(),0);
  assert.equal(cloud.calls.length,postCount,'retry must reconcile, not duplicate the committed POST');
});

test('retry safely reconciles a deletion committed before a later delete request fails', async () => {
  const initial = fixture();
  initial.leads.push({...initial.leads[0],id:'lead-2',name:'Second lead'});
  const cloud = fakeCloud(initial);
  const db = clone(initial);
  let failSecondDelete = true;
  const flaky = async (url, options={}) => {
    if (options.method === 'POST') {
      const payload = JSON.parse(options.body);
      if (payload.action === 'delete' && payload.id === 'lead-2' && failSecondDelete) {
        failSecondDelete = false;
        throw new Error('temporary network interruption');
      }
    }
    return cloud.fetch(url, options);
  };
  const engine = createEngine(store(), flaky);
  engine.init(db);
  engine.merge(clone(cloud.rows), db);
  db.leads = [];
  engine.track(db);
  const first = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(first.status,'error');
  assert.equal(cloud.rows.leads.some(row=>row.id==='lead-1'),false);
  assert.equal(cloud.rows.leads.some(row=>row.id==='lead-2'),true);
  assert.equal(engine.countPending(),2);

  const second = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(second.status,'verified');
  assert.equal(engine.countPending(),0);
  assert.equal(cloud.rows.leads.length,0);
});


test('retry after a partial delete clears the already absent row and does not conflict', async () => {
  const initial = fixture();
  initial.leads.push({...initial.leads[0],id:'lead-2',name:'Second lead'});
  const cloud = fakeCloud(initial);
  const db = clone(initial);
  let interrupted = false;
  const flaky = async (url, options={}) => {
    if (options.method === 'POST' && !interrupted) {
      const payload = JSON.parse(options.body);
      if (payload.action === 'delete' && payload.id === 'lead-2') {
        interrupted = true;
        throw new Error('interrupted before second delete');
      }
    }
    return cloud.fetch(url, options);
  };
  const engine = createEngine(store(), flaky);
  engine.init(db);
  engine.merge(clone(cloud.rows), db);
  db.leads = [];
  engine.track(db);
  const first = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(first.status,'error');
  assert.equal(engine.countPending(),2);
  const second = await engine.flush('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec','');
  assert.equal(second.status,'verified');
  assert.equal(engine.countPending(),0);
  assert.equal(cloud.rows.leads.length,0);
});
