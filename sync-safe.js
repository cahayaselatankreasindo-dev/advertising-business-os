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
    finance: { sheet: 'Finance', fields: ['id','date','type','category','amount','description','projectId'] },
    memory: { sheet: 'Memory', fields: ['id','date','category','title','content'] },
    marketingSpend: { sheet: 'Marketing_Spend', fields: ['id','date','platform','campaign','budget','spent','leadsGenerated','notes'] },
    costings: { sheet: 'Costings', fields: ['id','date','client','title','productionModel','leadId','itemsJson','directCost','overheadPct','overheadAmount','contingencyPct','contingencyAmount','hpp','marginPct','sellingPrice','status','projectId','notes','quoteNo','quoteVersion','validityDays','deliveryDays','paymentTerms','scope','approvedAt','poConfirmedAt','quoteHistoryJson','sentAt'] },
    projectCosts: { sheet: 'Project_Costs', fields: ['id','date','projectId','category','source','description','vendor','qty','unitCost','amount','paymentStatus','reference','notes'] }
  };
  const PROTOCOL_VERSION = 2;
  const MAX_BATCH_RECORDS = 40;
  const STATE_KEY = 'csk_business_os_safe_sync_v1';
  const LEGACY_BACKUP_KEY = 'csk_business_os_legacy_local_backup_v1';

  function stableFingerprint(value) {
    if (!value) return '';
    const keys = Object.keys(value).sort();
    return JSON.stringify(keys.map(k => [k, value[k]]));
  }
  function byId(rows) {
    const result = Object.create(null);
    (rows || []).forEach(row => {
      if (row && row.id !== undefined && row.id !== null && String(row.id).trim()) {
        result[String(row.id)] = row;
      }
    });
    return result;
  }
  function emptyQueue() {
    const q = {};
    Object.keys(DATA).forEach(k => {
      q[k] = { upserts: Object.create(null), deletes: Object.create(null) };
    });
    return q;
  }
  function copyIndex(source, accept) {
    const result = Object.create(null);
    if (!source || typeof source !== 'object' || Array.isArray(source)) return result;
    Object.keys(source).forEach(key => {
      if (accept(source[key])) result[key] = source[key];
    });
    return result;
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
    let conflicts = [];

    function persist() {
      storage.setItem(STATE_KEY, JSON.stringify({ queue, baseline, verifiedAt, conflicts }));
    }
    function countPending() {
      return Object.keys(DATA).reduce((sum, area) =>
        sum + Object.keys(queue[area].upserts).length +
          Object.keys(queue[area].deletes).length, 0);
    }
    function takeSnapshot(db) {
      const next = {};
      Object.keys(DATA).forEach(area => {
        next[area] = Object.create(null);
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
            const savedArea = raw.queue[area] || {};
            queue[area] = {
              upserts: copyIndex(savedArea.upserts, value =>
                !!value && typeof value === 'object' && !Array.isArray(value)),
              deletes: copyIndex(savedArea.deletes, value => value === true)
            };
          });
          baseline = {};
          Object.keys(DATA).forEach(area => {
            const savedBaseline = raw.baseline && raw.baseline[area];
            baseline[area] = copyIndex(savedBaseline, value =>
              typeof value === 'string' && value.length > 0);
          });
          verifiedAt = raw.verifiedAt || '';
          conflicts = Array.isArray(raw.conflicts) ? raw.conflicts.filter(key => {
            if (typeof key !== 'string') return false;
            const split = key.indexOf('/');
            return split > 0 && Object.prototype.hasOwnProperty.call(DATA, key.slice(0, split));
          }) : [];
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
      const next = Object.create(null);
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
    function resolveConflict(area, id, strategy, remote, db) {
      if (busy) throw new Error('Tidak bisa menyelesaikan konflik saat sinkronisasi berlangsung.');
      if (!Object.prototype.hasOwnProperty.call(DATA, area)) throw new Error('Area konflik tidak dikenal.');
      if (strategy !== 'cloud' && strategy !== 'local') throw new Error('Pilihan penyelesaian konflik tidak valid.');
      const key = area + '/' + String(id);
      if (!conflicts.includes(key)) throw new Error('Konflik ini sudah tidak aktif. Periksa ulang status sinkronisasi.');
      const recordId = String(id);
      const cloudRows = Array.isArray(remote && remote[area]) ? remote[area] : [];
      const cloudRecord = byId(cloudRows)[recordId] || null;
      if (!baseline[area]) baseline[area] = Object.create(null);
      const localRows = Array.isArray(db[area]) ? db[area] : (db[area] = []);
      const localIndex = localRows.findIndex(item => item && String(item.id) === recordId);
      const hasUpsert = Object.prototype.hasOwnProperty.call(queue[area].upserts, recordId);
      const hasDelete = Object.prototype.hasOwnProperty.call(queue[area].deletes, recordId);
      if (!hasUpsert && !hasDelete) throw new Error('Perubahan lokal untuk konflik ini tidak ditemukan.');

      if (strategy === 'cloud') {
        delete queue[area].upserts[recordId];
        delete queue[area].deletes[recordId];
        if (cloudRecord) {
          if (localIndex >= 0) localRows[localIndex] = cloudRecord;
          else localRows.push(cloudRecord);
          baseline[area][recordId] = stableFingerprint(cloudRecord);
        } else {
          if (localIndex >= 0) localRows.splice(localIndex, 1);
          delete baseline[area][recordId];
        }
      } else {
        // Explicitly keep the local version, but rebase its compare-and-set
        // expectation to the fresh cloud snapshot supplied by the UI.
        if (hasUpsert) {
          const currentLocal = localIndex >= 0 ? localRows[localIndex] : queue[area].upserts[recordId];
          queue[area].upserts[recordId] = currentLocal;
          if (localIndex < 0) localRows.push(currentLocal);
        }
        // If cloud already deleted a record that this device also meant to
        // delete, the desired state is already achieved; do not retry delete.
        if (hasDelete && !cloudRecord) delete queue[area].deletes[recordId];
        if (cloudRecord) baseline[area][recordId] = stableFingerprint(cloudRecord);
        else delete baseline[area][recordId];
      }

      conflicts = conflicts.filter(item => item !== key);
      lastError = conflicts.length ? conflicts.length + ' konflik cloud masih perlu ditinjau.' : '';
      snapshot = takeSnapshot(db);
      persist();
      return { strategy, pending: countPending(), conflicts: conflicts.slice() };
    }

    function validateEndpoint(value) {
      let parsed;
      try {
        parsed = new URL(String(value || ''));
      } catch (_) {
        throw new Error('URL Google Apps Script tidak valid.');
      }
      const standardPath = /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(parsed.pathname);
      const workspacePath = /^\/a\/macros\/[A-Za-z0-9.-]+\/s\/[A-Za-z0-9_-]+\/exec$/.test(parsed.pathname);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'script.google.com' ||
          parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash ||
          (!standardPath && !workspacePath)) {
        throw new Error('Gunakan URL HTTPS deployment Google Apps Script yang valid (/macros/s/.../exec).');
      }
      return parsed.origin + parsed.pathname;
    }
    async function readCloud(url, token) {
      const endpoint = validateEndpoint(url);
      const address = endpoint + '?token=' + encodeURIComponent(token || '') +
        '&protocolVersion=' + PROTOCOL_VERSION + '&_t=' + Date.now();
      const response = await network(address, { cache: 'no-store' });
      if (!response || !response.ok) throw new Error('Tidak bisa membaca respons Google Sheets.');
      const json = await response.json();
      if (!json || Number(json.protocolVersion) !== PROTOCOL_VERSION) {
        throw new Error('Versi backend tidak cocok. Muat ulang aplikasi atau periksa versi Apps Script.');
      }
      if (json.status !== 'success' || !json.data) {
        throw new Error((json && json.message) || 'Respons API tidak valid.');
      }
      return json.data;
    }
    async function send(url, body) {
      // Validate again at the write boundary; never disclose a token to an arbitrary URL.
      const endpoint = validateEndpoint(url);
      // Apps Script cross-origin POST returns an opaque response. Only GET readback is proof.
      await network(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(Object.assign({}, body, { protocolVersion: PROTOCOL_VERSION }))
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
        const foundConflicts = [];
        const nothingToDelete = [];
        const alreadyApplied = [];
        Object.keys(DATA).forEach(area => {
          const onServer = byId(remote[area]);
          const base = baseline[area] || {};
          Object.keys(work[area].upserts).forEach(id => {
            const now = onServer[id];
            const prior = base[id];
            // A previous POST may have committed while its readback failed. If the
            // current cloud row already matches our queued desired state, reconcile
            // it idempotently rather than misclassifying our own write as a conflict.
            if (now && matchesWrittenRecord(area, work[area].upserts[id], now)) {
              alreadyApplied.push({ area, id, record: work[area].upserts[id], remote: now });
              return;
            }
            // Unknown or concurrently changed server record -> never overwrite silently.
            if (now && (!prior || stableFingerprint(now) !== prior)) {
              foundConflicts.push(area + '/' + id);
            }
            if (!now && !!prior) foundConflicts.push(area + '/' + id);
          });
          Object.keys(work[area].deletes).forEach(id => {
            const now = onServer[id];
            const prior = base[id];
            // A missing row is already the desired state for a queued deletion,
            // including after a partial commit or an interrupted readback.
            if (!now) {
              nothingToDelete.push([area, id]);
              return;
            }
            if (!prior || stableFingerprint(now) !== prior) {
              foundConflicts.push(area + '/' + id);
            }
          });
        });
        if (foundConflicts.length) {
          conflicts = Array.from(new Set(foundConflicts));
          lastError = conflicts.length + ' konflik cloud ditemukan. Tidak ada data cloud yang diubah.';
          persist();
          return { status: 'conflict', conflicts: conflicts.slice(), pending: countPending() };
        }

        for (const item of alreadyApplied) {
          const current = queue[item.area].upserts[item.id];
          if (current && JSON.stringify(current) === JSON.stringify(item.record)) {
            delete queue[item.area].upserts[item.id];
          }
          if (!baseline[item.area]) baseline[item.area] = Object.create(null);
          baseline[item.area][item.id] = stableFingerprint(item.remote);
        }
        for (const [area, id] of nothingToDelete) {
          if (queue[area].deletes[id]) delete queue[area].deletes[id];
          if (baseline[area]) delete baseline[area][id];
        }
        if (alreadyApplied.length || nothingToDelete.length) persist();

        const sentDeletes = [];
        for (const area of Object.keys(DATA)) {
          for (const id of Object.keys(work[area].deletes)) {
            if (nothingToDelete.some(x => x[0] === area && x[1] === id)) continue;
            const expectedFingerprint = (baseline[area] || {})[id];
            if (typeof expectedFingerprint !== 'string' || !expectedFingerprint) {
              lastError = 'Versi dasar untuk penghapusan ' + area + '/' + id + ' tidak tersedia. Tarik ulang data sebelum mencoba lagi.';
              conflicts = [area + '/' + id];
              persist();
              return { status: 'conflict', conflicts: conflicts.slice(), pending: countPending() };
            }
            await send(url, { action: 'delete', sheet: DATA[area].sheet, id, token, expectedFingerprint });
            sentDeletes.push([area, id]);
          }
        }

        // LAB guard and production backend both cap one sync_all request at 40 records.
        // Process larger local queues in bounded batches and verify each batch before
        // clearing its local queue entries. A failed later batch cannot undo verified work.
        const upserts = [];
        Object.keys(DATA).forEach(area => {
          Object.keys(work[area].upserts).forEach(id => {
            upserts.push({ area, id, record: work[area].upserts[id] });
          });
        });

        for (let offset = 0; offset < upserts.length; offset += MAX_BATCH_RECORDS) {
          const batch = upserts.slice(offset, offset + MAX_BATCH_RECORDS);
          const payload = { action: 'sync_all', token, expectedRecords: Object.create(null) };
          batch.forEach(item => {
            if (!payload[item.area]) payload[item.area] = [];
            payload[item.area].push(item.record);
            const sheetName = DATA[item.area].sheet;
            if (!payload.expectedRecords[sheetName]) payload.expectedRecords[sheetName] = Object.create(null);
            const prior = baseline[item.area] || {};
            payload.expectedRecords[sheetName][item.id] =
              Object.prototype.hasOwnProperty.call(prior, item.id) ? prior[item.id] : null;
          });
          await send(url, payload);

          let confirmed = null;
          let batchVerified = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt) await new Promise(resolve => setTimeout(resolve, attempt * 900));
            confirmed = await readCloud(url, token);
            const cloudByArea = {};
            batch.forEach(item => {
              if (!cloudByArea[item.area]) cloudByArea[item.area] = byId(confirmed[item.area]);
            });
            batchVerified = batch.every(item =>
              matchesWrittenRecord(item.area, item.record, cloudByArea[item.area][item.id]));
            if (batchVerified) break;
          }

          if (!batchVerified) {
            const racedConflicts = [];
            batch.forEach(item => {
              const now = byId(confirmed && confirmed[item.area])[item.id];
              const prior = (baseline[item.area] || {})[item.id];
              if (now && matchesWrittenRecord(item.area, item.record, now)) return;
              if ((now && (!prior || stableFingerprint(now) !== prior)) ||
                  (!now && !!prior)) racedConflicts.push(item.area + '/' + item.id);
            });
            if (racedConflicts.length) {
              lastError = 'Konflik terdeteksi saat penyimpanan. Tidak ada data cloud yang ditimpa; periksa record yang ditandai.';
              conflicts = Array.from(new Set(racedConflicts));
              persist();
              return { status: 'conflict', conflicts: conflicts.slice(), pending: countPending() };
            }
            lastError = 'Batch dikirim, tetapi belum terverifikasi di Google Sheets. Perubahan yang tersisa tetap mengantre.';
            persist();
            return { status: 'unverified', pending: countPending() };
          }

          batch.forEach(item => {
            const current = queue[item.area].upserts[item.id];
            if (current && JSON.stringify(current) === JSON.stringify(item.record)) {
              delete queue[item.area].upserts[item.id];
            }
            const cloudRecord = byId(confirmed[item.area])[item.id];
            if (cloudRecord) {
              if (!baseline[item.area]) baseline[item.area] = Object.create(null);
              baseline[item.area][item.id] = stableFingerprint(cloudRecord);
            }
          });
          // Persist each verified batch so a reload never resends already confirmed rows.
          // Do not rebaseline unrelated records: a concurrent remote edit must stay a conflict.
          persist();
        }

        if (sentDeletes.length) {
          let confirmed = null;
          let deletesVerified = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt) await new Promise(resolve => setTimeout(resolve, attempt * 900));
            confirmed = await readCloud(url, token);
            const cloudByArea = {};
            sentDeletes.forEach(([area]) => {
              if (!cloudByArea[area]) cloudByArea[area] = byId(confirmed[area]);
            });
            deletesVerified = sentDeletes.every(([area, id]) => !cloudByArea[area][id]);
            if (deletesVerified) break;
          }
          if (!deletesVerified) {
            const racedConflicts = [];
            sentDeletes.forEach(([area, id]) => {
              const now = byId(confirmed && confirmed[area])[id];
              const prior = (baseline[area] || {})[id];
              if (now && (!prior || stableFingerprint(now) !== prior)) racedConflicts.push(area + '/' + id);
            });
            if (racedConflicts.length) {
              lastError = 'Konflik terdeteksi saat penghapusan. Data cloud tidak ditimpa.';
              conflicts = Array.from(new Set(racedConflicts));
              persist();
              return { status: 'conflict', conflicts: conflicts.slice(), pending: countPending() };
            }
            lastError = 'Penghapusan dikirim, tetapi belum terverifikasi di Google Sheets. Perubahan tetap mengantre.';
            persist();
            return { status: 'unverified', pending: countPending() };
          }
        }

        Object.keys(DATA).forEach(area => {
          Object.keys(work[area].deletes).forEach(id => {
            if (queue[area].deletes[id]) delete queue[area].deletes[id];
            if (baseline[area]) delete baseline[area][id];
          });
        });
        conflicts = [];
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
      init, track, merge, replaceFromCloud, restoreLocalOnly, readCloud, flush, countPending, resolveConflict,
      get conflicts() { return conflicts.slice(); },
      get verifiedAt() { return verifiedAt; },
      get lastError() { return lastError; },
      get busy() { return busy; }
    };
  }
  const api = { createEngine, DATA, matchesWrittenRecord, validateEndpoint, MAX_BATCH_RECORDS };
  root.CSKSafeSync = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : {});
