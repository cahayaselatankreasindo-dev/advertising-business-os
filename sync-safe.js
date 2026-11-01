/* CSK Business OS — conservative, opt-in-to-cloud delta sync (draft release).
 * Cloud writes are NEVER called "saved" until a fresh GET verifies them.
 * Do not deploy until backend and multi-device tests have been reviewed.
 */
(function (root) {
  'use strict';

  const DATA = {
    leads: { sheet: 'Leads', fields: ['id','date','name','phone','source','value','status','notes','email','website','industry','pic','picTitle','linkedin','score'] },
    clients: { sheet: 'Clients', fields: ['id','name','phone','projectsCount','totalSpend','notes','rating','review'] },
    projects: { sheet: 'Projects', fields: ['id','title','client','value','status','deadline','notes','sopChecklist','pic'] },
    finance: { sheet: 'Finance', fields: ['id','date','type','category','amount','description'] },
    memory: { sheet: 'Memory', fields: ['id','date','category','title','content'] },
    marketingSpend: { sheet: 'Marketing_Spend', fields: ['id','date','platform','campaign','budget','spent','leadsGenerated','notes'] }
  };
  const STATE_KEY = 'csk_business_os_safe_sync_v1';
  const LEGACY_BACKUP_KEY = 'csk_business_os_legacy_local_backup_v1';

  function stableFingerprint(value) {
    if (!value) return '';
    const keys = Object.keys(value).sort();
    return JSON.stringify(keys.map(k => [k, value[k]]));
  }
  function byId(rows) {
    const result = {};
    (rows || []).forEach(row => {
      if (row && row.id !== undefined && row.id !== null && String(row.id).trim()) {
        result[String(row.id)] = row;
      }
    });
    return result;
  }
  function emptyQueue() {
    const q = {};
    Object.keys(DATA).forEach(k => { q[k] = { upserts: {}, deletes: {} }; });
    return q;
  }
  function normalized(value, field) {
    if (value === undefined || value === null) return '';
    if (field === 'date' || field === 'deadline') {
      const s = String(value);
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    }
    return String(value).trim();
  }
  function matchesWrittenRecord(area, expected, remote) {
    if (!remote) return false;
    return DATA[area].fields.every(field =>
      normalized(expected[field], field) === normalized(remote[field], field)
    );
  }
  function createEngine(storage, fetcher) {
    const network = fetcher || root.fetch.bind(root);
    let queue = emptyQueue();
    let baseline = {};
    let verifiedAt = '';
    let snapshot = {};
    let busy = false;
    let lastError = '';

    function persist() {
      storage.setItem(STATE_KEY, JSON.stringify({ queue, baseline, verifiedAt }));
    }
    function countPending() {
      return Object.keys(DATA).reduce((sum, area) =>
        sum + Object.keys(queue[area].upserts).length +
          Object.keys(queue[area].deletes).length, 0);
    }
    function takeSnapshot(db) {
      const next = {};
      Object.keys(DATA).forEach(area => {
        next[area] = {};
        (db[area] || []).forEach(item => {
          if (item && item.id !== undefined && item.id !== null) {
            next[area][String(item.id)] = JSON.stringify(item);
          }
        });
      });
      return next;
    }
    function init(db) {
      try {
        const raw = JSON.parse(storage.getItem(STATE_KEY) || 'null');
        if (raw && raw.queue) {
          Object.keys(DATA).forEach(area => {
            queue[area] = {
              upserts: (raw.queue[area] && raw.queue[area].upserts) || {},
              deletes: (raw.queue[area] && raw.queue[area].deletes) || {}
            };
          });
          baseline = raw.baseline || {};
          verifiedAt = raw.verifiedAt || '';
        } else if (!storage.getItem(LEGACY_BACKUP_KEY)) {
          // Before first migration, retain an independent recovery copy of the local DB.
          storage.setItem(LEGACY_BACKUP_KEY, JSON.stringify(db));
        }
      } catch (error) {
        lastError = 'Status sinkronisasi lokal tidak terbaca: ' + error.message;
      }
      snapshot = takeSnapshot(db);
    }
    function track(db) {
      const current = takeSnapshot(db);
      Object.keys(DATA).forEach(area => {
        const oldItems = snapshot[area] || {};
        const newItems = current[area] || {};
        const newRecords = byId(db[area]);
        Object.keys(newItems).forEach(id => {
          if (oldItems[id] !== newItems[id]) {
            queue[area].upserts[id] = newRecords[id];
            delete queue[area].deletes[id];
          }
        });
        Object.keys(oldItems).forEach(id => {
          if (!(id in newItems)) {
            delete queue[area].upserts[id];
            queue[area].deletes[id] = true;
          }
        });
      });
      snapshot = current;
      persist();
    }
    function rebaseline(area, remoteRows) {
      const old = baseline[area] || {};
      const next = {};
      // Keep the record version the user edited, until their pending edit is settled.
      Object.keys(queue[area].upserts).concat(Object.keys(queue[area].deletes)).forEach(id => {
        if (old[id]) next[id] = old[id];
      });
      (remoteRows || []).forEach(item => {
        if (!item || item.id === undefined || item.id === null) return;
        const id = String(item.id);
        if (!(id in queue[area].upserts) && !(id in queue[area].deletes)) {
          next[id] = stableFingerprint(item);
        }
      });
      baseline[area] = next;
    }
    function merge(remote, db) {
      Object.keys(DATA).forEach(area => {
        const cloudRows = remote[area] || [];
        const localRows = db[area] || [];
        const merged = new Map();
        cloudRows.forEach(item => {
          if (item && item.id !== undefined && !queue[area].deletes[String(item.id)]) {
            merged.set(String(item.id), item);
          }
        });
        localRows.forEach(item => {
          if (!item || item.id === undefined) return;
          const id = String(item.id);
          if (queue[area].deletes[id]) return;
          // Cloud wins for unchanged records; local wins only for explicitly pending edits.
          if (queue[area].upserts[id] || !merged.has(id)) merged.set(id, item);
        });
        db[area] = Array.from(merged.values());
        rebaseline(area, cloudRows);
      });
      snapshot = takeSnapshot(db);
      persist();
      return db;
    }
    function replaceFromCloud(remote, db) {
      queue = emptyQueue();
      Object.keys(DATA).forEach(area => { db[area] = remote[area] || []; });
      Object.keys(DATA).forEach(area => rebaseline(area, db[area]));
      snapshot = takeSnapshot(db);
      verifiedAt = new Date().toISOString();
      persist();
      return db;
    }
    // Restore is local-only. Do not queue a historical backup for cloud upload:
    // records may have been deleted on another device since that backup.
    function restoreLocalOnly(db) {
      if (busy) throw new Error('Tidak bisa memulihkan saat sinkronisasi berlangsung.');
      queue = emptyQueue();
      baseline = {};
      verifiedAt = '';
      lastError = '';
      snapshot = takeSnapshot(db);
      persist();
    }
    async function readCloud(url, token) {
      const separator = url.includes('?') ? '&' : '?';
      const address = url + separator + 'token=' + encodeURIComponent(token || '') + '&_t=' + Date.now();
      const response = await network(address, { cache: 'no-store' });
      if (!response || !response.ok) throw new Error('Tidak bisa membaca respons Google Sheets.');
      const json = await response.json();
      if (!json || json.status !== 'success' || !json.data) {
        throw new Error((json && json.message) || 'Respons API tidak valid.');
      }
      return json.data;
    }
    async function send(url, body) {
      // Apps Script cross-origin POST returns an opaque response. Only GET readback is proof.
      await network(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(body)
      });
    }
    async function flush(url, token) {
      if (busy) return { status: 'busy', pending: countPending() };
      if (!url) return { status: 'offline', pending: countPending() };
      if (!countPending()) return { status: 'clean', pending: 0 };
      busy = true;
      lastError = '';
      try {
        const work = JSON.parse(JSON.stringify(queue));
        const remote = await readCloud(url, token);
        const conflicts = [];
        const nothingToDelete = [];
        Object.keys(DATA).forEach(area => {
          const onServer = byId(remote[area]);
          const base = baseline[area] || {};
          Object.keys(work[area].upserts).concat(Object.keys(work[area].deletes)).forEach(id => {
            const now = onServer[id];
            const prior = base[id];
            // Unknown server record or changed record -> never overwrite silently.
            if ((now && (!prior || stableFingerprint(now) !== prior)) ||
                (!now && !!prior)) conflicts.push(area + '/' + id);
            if (!now && work[area].deletes[id]) nothingToDelete.push([area, id]);
          });
        });
        if (conflicts.length) {
          lastError = conflicts.length + ' konflik cloud ditemukan. Tidak ada data cloud yang diubah.';
          return { status: 'conflict', conflicts, pending: countPending() };
        }
        for (const [area, id] of nothingToDelete) {
          if (queue[area].deletes[id]) delete queue[area].deletes[id];
        }
        for (const area of Object.keys(DATA)) {
          for (const id of Object.keys(work[area].deletes)) {
            if (nothingToDelete.some(x => x[0] === area && x[1] === id)) continue;
            await send(url, { action: 'delete', sheet: DATA[area].sheet, id, token });
          }
        }
        const payload = { action: 'sync_all', token };
        let hasUpserts = false;
        Object.keys(DATA).forEach(area => {
          const records = Object.values(work[area].upserts);
          if (records.length) { payload[area] = records; hasUpserts = true; }
        });
        if (hasUpserts) await send(url, payload);

        // A no-cors POST cannot report success. Verify actual record values with GET.
        let confirmed = null;
        let allVerified = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt) await new Promise(resolve => setTimeout(resolve, attempt * 900));
          confirmed = await readCloud(url, token);
          allVerified = Object.keys(DATA).every(area => {
            const cloud = byId(confirmed[area]);
            return Object.values(work[area].upserts).every(record =>
              matchesWrittenRecord(area, record, cloud[String(record.id)])) &&
              Object.keys(work[area].deletes).every(id => !cloud[id]);
          });
          if (allVerified) break;
        }
        if (!allVerified) {
          lastError = 'Data dikirim, tetapi belum terverifikasi di Google Sheets. Perubahan tetap mengantre.';
          persist();
          return { status: 'unverified', pending: countPending() };
        }
        Object.keys(DATA).forEach(area => {
          const cloud = byId(confirmed[area]);
          Object.keys(work[area].upserts).forEach(id => {
            if (JSON.stringify(queue[area].upserts[id]) === JSON.stringify(work[area].upserts[id])) {
              delete queue[area].upserts[id];
            }
            if (cloud[id]) {
              if (!baseline[area]) baseline[area] = {};
              baseline[area][id] = stableFingerprint(cloud[id]);
            }
          });
          Object.keys(work[area].deletes).forEach(id => {
            if (queue[area].deletes[id]) delete queue[area].deletes[id];
            if (baseline[area]) delete baseline[area][id];
          });
          rebaseline(area, confirmed[area]);
        });
        verifiedAt = new Date().toISOString();
        persist();
        return { status: 'verified', pending: countPending(), verifiedAt };
      } catch (error) {
        lastError = error.message || String(error);
        return { status: 'error', pending: countPending(), message: lastError };
      } finally {
        busy = false;
      }
    }
    return {
      init, track, merge, replaceFromCloud, restoreLocalOnly, readCloud, flush, countPending,
      get verifiedAt() { return verifiedAt; },
      get lastError() { return lastError; },
      get busy() { return busy; }
    };
  }
  const api = { createEngine, DATA, matchesWrittenRecord };
  root.CSKSafeSync = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : {});
