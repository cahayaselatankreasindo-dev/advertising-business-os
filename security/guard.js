/* CSK Business OS: authenticated client gate and role-aware data handling.
 * The backend remains authoritative. This file never stores a PIN or session ID.
 */
(function () {
  'use strict';

  var OWNER_EMAIL = 'cahayaselatankreasindo@gmail.com';
  var TEAM_EMAIL = 'zefdas@gmail.com';
  var OWNER_KEY = 'csk_business_os_db_owner';
  var TEAM_KEY = 'csk_business_os_db_team';
  var URL_KEY = 'csk_gas_url';
  var SESSION_TTL_LABEL = 'Sesi aktif · berakhir setelah 30 menit tidak ada aktivitas';
  var sessionId = '';
  var identity = null;
  var ready = false;
  var legacyOwnerCache = null;
  var originalLoadDB = window.loadDB;
  var originalNav = window.nav;
  var originalImportData = window.importData;
  var syncTimer = null;
  var syncRunning = false;
  var syncQueued = false;

  function safeLocalGet(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }
  function safeLocalSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { console.warn('CSK local storage unavailable:', e); }
  }
  function apiUrl() {
    var fromDb = (typeof db !== 'undefined' && db.settings && db.settings.googleSheetUrl) || '';
    return String(fromDb || safeLocalGet(URL_KEY) || '').trim();
  }
  function validApiUrl(value) {
    try {
      var u = new URL(String(value || '').trim());
      return u.protocol === 'https:' && u.hostname === 'script.google.com' &&
        /^\/macros\/s\/[^/]+\/exec\/?$/.test(u.pathname);
    } catch (e) { return false; }
  }
  function randomSessionId() {
    if (!window.crypto || !window.crypto.getRandomValues) throw new Error('Browser tidak mendukung secure random. Gunakan Chrome/Edge versi terbaru.');
    var bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    var binary = '';
    bytes.forEach(function (b) { binary += String.fromCharCode(b); });
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function status(message, isError) {
    var el = document.getElementById('csk-auth-status');
    if (el) {
      el.textContent = message;
      el.style.color = isError ? '#b91c1c' : '#64748b';
    }
  }
  function ensureGate() {
    var gate = document.getElementById('csk-auth-gate');
    if (gate) return gate;
    var style = document.createElement('style');
    style.id = 'csk-auth-styles';
    style.textContent = '#csk-auth-gate{position:fixed;inset:0;z-index:99999;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:20px}#csk-auth-card{width:100%;max-width:390px;background:#fff;border-radius:18px;padding:26px;box-shadow:0 24px 80px rgba(0,0,0,.35)}#csk-auth-card input{width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:11px 12px;font-size:14px;outline:none}#csk-auth-card input:focus{border-color:#d97706;box-shadow:0 0 0 2px rgba(217,119,6,.15)}#csk-auth-card button{border-radius:9px;padding:11px 14px;font-weight:700}#csk-auth-login{background:#0f172a;color:#fff;width:100%}#csk-auth-save-url{background:#f1f5f9;color:#334155;width:100%;font-size:12px}#csk-auth-status{min-height:18px;font-size:12px}#csk-session-badge{position:fixed;right:12px;top:12px;z-index:1000;display:flex;align-items:center;gap:8px;background:#0f172a;color:#fff;border:1px solid #334155;border-radius:999px;padding:6px 9px;font-size:11px;box-shadow:0 4px 18px rgba(15,23,42,.18)}#csk-session-badge button{background:#f1f5f9;color:#0f172a;border-radius:999px;padding:4px 9px;font-weight:700}';
    document.head.appendChild(style);
    gate = document.createElement('div');
    gate.id = 'csk-auth-gate';
    gate.innerHTML = '<div id="csk-auth-card"><div style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:.02em">CSK BUSINESS OS</div><p style="font-size:13px;color:#64748b;margin:7px 0 20px">Masuk dengan email terdaftar dan PIN pribadi.</p><label for="csk-login-email" style="display:block;font-size:12px;font-weight:700;color:#334155;margin:0 0 5px">Email akun</label><input id="csk-login-email" type="email" autocomplete="username" placeholder="nama@email.com"><label for="csk-login-pin" style="display:block;font-size:12px;font-weight:700;color:#334155;margin:14px 0 5px">PIN (8-12 digit)</label><input id="csk-login-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="current-password" placeholder="Masukkan PIN"><label for="csk-backend-url" style="display:block;font-size:12px;font-weight:700;color:#334155;margin:14px 0 5px">Google Apps Script Web App URL</label><input id="csk-backend-url" type="url" autocomplete="url" placeholder="https://script.google.com/macros/s/.../exec" style="font-size:11px"><button id="csk-auth-save-url" type="button" style="margin-top:8px">Simpan URL Backend</button><button id="csk-auth-login" type="button" style="margin-top:12px">Masuk</button><p id="csk-auth-status" style="margin:12px 0 0">Siapkan URL backend dan masukkan email serta PIN.</p><p style="font-size:10px;line-height:1.5;color:#94a3b8;margin:10px 0 0">Akses Tim hanya untuk Leads, Klien, dan Proyek. Data keuangan dan pengaturan Owner dibatasi di server.</p></div>';
    document.body.appendChild(gate);
    var save = document.getElementById('csk-auth-save-url');
    if (save) save.addEventListener('click', function () {
      var value = document.getElementById('csk-backend-url').value.trim();
      if (!validApiUrl(value)) return status('URL tidak valid. Gunakan URL Web App Apps Script yang berakhiran /exec.', true);
      safeLocalSet(URL_KEY, value);
      if (typeof db !== 'undefined') {
        db.settings = db.settings || {};
        db.settings.googleSheetUrl = value;
      }
      status('URL backend tersimpan di perangkat ini.');
    });
    var login = document.getElementById('csk-auth-login');
    if (login) login.addEventListener('click', loginWithPin);
    var pin = document.getElementById('csk-login-pin');
    if (pin) pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') loginWithPin(); });
    return gate;
  }
  function resetDb() {
    if (typeof db === 'undefined') return;
    ['leads','clients','projects','finance','memory','marketingSpend','materials','costSheets','legacyCostings','projectCosts','services','purchaseOrders','quotationSnapshots','quotations','invoices','invoicePayments'].forEach(function (key) { db[key] = []; });
    db.settings = { googleSheetUrl: apiUrl(), lastSync: '', lastSyncError: '' };
    db.role = 'team';
  }
  function mergeById(cloudRows, localRows) {
    var map = new Map();
    (cloudRows || []).forEach(function (row) { if (row && row.id !== undefined && row.id !== null) map.set(String(row.id), row); });
    (localRows || []).forEach(function (row) { if (row && row.id !== undefined && row.id !== null) map.set(String(row.id), row); });
    return Array.from(map.values());
  }
  function setLegacyReadOnlyCollections(data) {
    if (typeof db === 'undefined') return;
    var owner = !!(identity && identity.role === 'owner');
    db.legacyCostings = owner && Array.isArray(data && data.legacyCostings) ? data.legacyCostings : [];
    db.projectCosts = owner && Array.isArray(data && data.projectCosts) ? data.projectCosts : [];
  }

  function readSaved(key) {
    try {
      var value = JSON.parse(safeLocalGet(key) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (e) { return {}; }
  }
  function saveScoped() {
    if (!ready || typeof db === 'undefined') return;
    db.settings = db.settings || {};
    db.role = identity.role;
    if (identity.role === 'owner') {
      // Owner collections are not persisted in browser storage. Google Sheets is the source of truth.
      // Keep only an in-memory recovery copy until the server confirms synchronization.
      try { legacyOwnerCache = JSON.parse(JSON.stringify(db)); } catch (e) { legacyOwnerCache = null; }
      // Keep legacy browser data until the cloud write is read back and verified.
      // Removing it before verification can permanently lose data on refresh/login failure.
    } else {
      safeLocalSet(TEAM_KEY, JSON.stringify({ leads: db.leads || [], clients: db.clients || [], projects: db.projects || [] }));
    }
  }
  async function post(payload) {
    var url = apiUrl();
    if (!url || !sessionId) throw new Error('URL backend atau sesi belum tersedia.');
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({}, payload, { sessionId: sessionId }))
    });
    return { submitted: true };
  }
  async function get(action) {
    var url = apiUrl();
    if (!url || !sessionId) throw new Error('URL backend atau sesi belum tersedia.');
    var target = new URL(url);
    target.searchParams.set('sessionId', sessionId);
    if (action) target.searchParams.set('action', action);
    var response = await fetch(target.toString(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Backend tidak merespons (' + response.status + ').');
    var json = await response.json();
    if (json.status !== 'success') throw new Error(json.code || json.message || 'Permintaan ditolak.');
    return json;
  }
  function collectionsForRole() {
    if (identity.role === 'team') return ['leads','clients','projects'];
    return ['leads','clients','projects','finance','memory','marketingSpend','materials','costSheets','services','purchaseOrders','quotationSnapshots','quotations','invoices'];
  }
  function makeSyncPayload() {
    var payload = { action: 'sync_all' };
    collectionsForRole().forEach(function (key) { payload[key] = Array.isArray(db[key]) ? db[key] : []; });
    return payload;
  }
  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce(function (out, key) {
        out[key] = canonicalize(value[key]);
        return out;
      }, {});
    }
    return value;
  }
  function normalizeSyncValue(value, field) {
    if (value === undefined || value === null) return '';
    if (field === 'date' || field === 'deadline' || field === 'dueDate') return String(value).slice(0, 10);
    if (typeof value === 'object') return JSON.stringify(canonicalize(value));
    return String(value).trim();
  }
  async function verifySync(payload) {
    var result = await get('get_data');
    var data = result.data || {};
    var checked = [];
    collectionsForRole().forEach(function (key) {
      var expected = Array.isArray(payload[key]) ? payload[key] : [];
      var rows = Array.isArray(data[key]) ? data[key] : [];
      var cloudById = new Map(rows.filter(function (row) { return row && row.id !== undefined; }).map(function (row) { return [String(row.id), row]; }));
      expected.forEach(function (localRow) {
        if (!localRow || localRow.id === undefined || localRow.id === null) throw new Error('Verifikasi ' + key + ' gagal: ada data lokal tanpa ID.');
        var cloudRow = cloudById.get(String(localRow.id));
        if (!cloudRow) throw new Error('Verifikasi ' + key + ' gagal: ID ' + localRow.id + ' belum ditemukan di Google Sheets.');
        var ignoredFields = ['updatedAt','itemsJson','linesJson'];
        var fields = Object.keys(localRow).filter(function (field) {
          return localRow[field] !== undefined && ignoredFields.indexOf(field) === -1;
        });
        var mismatches = fields.filter(function (field) {
          return normalizeSyncValue(localRow[field], field) !== normalizeSyncValue(cloudRow[field], field);
        });
        if (mismatches.length) throw new Error('Verifikasi ' + key + ' gagal untuk ID ' + localRow.id + '. Nilai berbeda pada: ' + mismatches.join(', ') + '.');
      });
      checked.push(key);
    });
    return { modules: checked.length, checkedAt: data.lastSynced || new Date().toISOString() };
  }
  async function syncNow(silent) {
    if (!ready || !identity) return false;
    if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
    if (syncRunning) { syncQueued = true; return false; }
    syncRunning = true;
    var succeeded = false;
    try {
      var payload = makeSyncPayload();
      await post(payload);
      var verified = await verifySync(payload);
      db.settings.lastSync = verified.checkedAt;
      db.settings.lastSyncModules = verified.modules;
      db.settings.lastSyncError = '';
      saveScoped();
      if (identity && identity.role === 'owner') {
        legacyOwnerCache = null;
        // Retire legacy local copies only after the server read-back confirms every row.
        try { localStorage.removeItem(DB_KEY); localStorage.removeItem(OWNER_KEY); } catch (e) {}
      }
      succeeded = true;
      if (typeof updateCloudIndicator === 'function') updateCloudIndicator();
      if (!silent && typeof showToast === 'function') showToast('Sinkronisasi terverifikasi: ' + verified.modules + ' modul.');
    } catch (e) {
      if (typeof db !== 'undefined') {
        db.settings = db.settings || {};
        db.settings.lastSyncError = String(e && e.message || e);
        saveScoped();
      }
      if (typeof updateCloudIndicator === 'function') updateCloudIndicator();
      if (!silent && typeof showToast === 'function') showToast('Sinkronisasi belum terverifikasi: ' + String(e && e.message || e), true);
      if (/SESSION_EXPIRED|SESSION_REVOKED|AUTH_REQUIRED/.test(String(e && e.message || e))) lockScreen('Sesi berakhir. Silakan masuk kembali.');
    } finally {
      syncRunning = false;
      if (syncQueued) {
        syncQueued = false;
        scheduleSync(true);
      }
    }
    return succeeded;
  }
  function scheduleSync(silent) {
    if (!ready) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { syncTimer = null; syncNow(!!silent); }, 700);
  }
  function applyRole() {
    if (!identity) return;
    var isTeam = identity.role === 'team';
    document.querySelectorAll('.pillar-finance,.pillar-marketing,.pillar-riset,.pillar-marketing-mob').forEach(function (el) {
      el.style.display = isTeam ? 'none' : '';
    });
    var ownerPages = ['finance','marketing','analysis','memory','settings','services','purchasing','hpp','documents'];
    document.querySelectorAll('[onclick]').forEach(function (el) {
      var source = el.getAttribute('onclick') || '';
      var match = source.match(/(?:nav|mobileGo)\(['"]([^'"]+)['"]\)/);
      if (match && isTeam && ownerPages.indexOf(match[1]) >= 0) el.style.display = 'none';
    });
    ['role-select','role-select-mob'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    var who = document.getElementById('csk-session-role');
    if (who) who.textContent = (isTeam ? 'Tim' : 'Owner') + ' · ' + identity.email;
  }
  function createSessionBadge() {
    var old = document.getElementById('csk-session-badge');
    if (old) old.remove();
    var badge = document.createElement('div');
    badge.id = 'csk-session-badge';
    badge.innerHTML = '<span id="csk-session-role"></span><button type="button" id="csk-logout-button">Keluar</button>';
    document.body.appendChild(badge);
    document.getElementById('csk-logout-button').addEventListener('click', logout);
    applyRole();
  }
  function lockScreen(message) {
    ready = false;
    identity = null;
    sessionId = '';
    resetDb();
    if (typeof renderAll === 'function') renderAll();
    var badge = document.getElementById('csk-session-badge');
    if (badge) badge.remove();
    var gate = ensureGate();
    gate.style.display = 'flex';
    var email = document.getElementById('csk-login-email');
    var pin = document.getElementById('csk-login-pin');
    if (pin) pin.value = '';
    status(message || 'Silakan masuk kembali.');
  }
  async function loginWithPin() {
    var email = (document.getElementById('csk-login-email').value || '').trim().toLowerCase();
    var pin = document.getElementById('csk-login-pin').value || '';
    var urlInput = document.getElementById('csk-backend-url');
    var url = (urlInput && urlInput.value || apiUrl()).trim();
    if (![OWNER_EMAIL, TEAM_EMAIL].includes(email)) return status('Email tidak terdaftar.', true);
    if (!/^\d{8,12}$/.test(pin)) return status('PIN harus 8-12 digit.', true);
    if (!validApiUrl(url)) return status('Masukkan URL Web App Google Apps Script yang valid.', true);
    safeLocalSet(URL_KEY, url);
    if (typeof db !== 'undefined') {
      db.settings = db.settings || {};
      db.settings.googleSheetUrl = url;
    }
    var button = document.getElementById('csk-auth-login');
    if (button) { button.disabled = true; button.textContent = 'Memverifikasi...'; }
    try {
      sessionId = randomSessionId();
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', email: email, pin: pin, sessionId: sessionId })
      });
      var response = await get('get_data');
      identity = response.identity;
      if (!identity || !['owner','team'].includes(identity.role) || identity.email !== email) throw new Error('LOGIN_INVALID');

      var local = identity.role === 'owner' ? (legacyOwnerCache || {}) : readSaved(TEAM_KEY);
      var cloud = response.data || {};
      setLegacyReadOnlyCollections(cloud);
      collectionsForRole().forEach(function (collection) {
        db[collection] = mergeById(cloud[collection], local[collection]);
      });
      db.invoicePayments = identity.role === 'owner' && Array.isArray(cloud.invoicePayments) ? cloud.invoicePayments : [];
      db.settings = db.settings || {};
      db.settings.googleSheetUrl = url;
      db.settings.lastSync = cloud.lastSynced || '';
      db.settings.lastSyncError = '';
      var settingsUrlInput = document.getElementById('setting-google-url');
      if (settingsUrlInput) settingsUrlInput.value = url;
      db.role = identity.role;
      ready = true;
      saveScoped();
      applyRole();
      createSessionBadge();
      var gate = document.getElementById('csk-auth-gate');
      if (gate) gate.style.display = 'none';
      var pinInput = document.getElementById('csk-login-pin');
      if (pinInput) pinInput.value = '';
      if (typeof renderAll === 'function') renderAll();
      if (typeof initStarPicker === 'function') initStarPicker('client-star-picker');
      var syncVerified = await syncNow(true);
      if (!syncVerified) {
        status('Login berhasil, tetapi sinkronisasi belum terverifikasi. Jangan tutup atau muat ulang halaman sampai koneksi cloud pulih.', true);
      } else if (typeof showToast === 'function') {
        showToast('Login berhasil sebagai ' + (identity.role === 'owner' ? 'Owner.' : 'Tim.'));
      }
    } catch (e) {
      sessionId = '';
      identity = null;
      ready = false;
      if (typeof db !== 'undefined') resetDb();
      var msg = /LOGIN_INVALID|SESSION_EXPIRED|AUTH_REQUIRED/.test(String(e && e.message || e))
        ? 'Login gagal. Periksa email, PIN, atau konfigurasi backend.'
        : String(e && e.message || e);
      status(msg, true);
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Masuk'; }
    }
  }
  async function logout() {
    var logoutRole = identity && identity.role;
    var syncSucceeded = false;
    if (ready) {
      if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
      syncSucceeded = await syncNow(true);
    }
    if (logoutRole === 'owner' && !syncSucceeded && legacyOwnerCache) {
      var proceed = confirm('Ada data Owner yang belum berhasil diverifikasi tersimpan di Google Sheets. Jika keluar sekarang, perubahan lokal yang belum tersinkron akan hilang. Tetap keluar?');
      if (!proceed) return;
      legacyOwnerCache = null;
    }
    try { if (sessionId) await post({ action: 'logout' }); } catch (e) { /* sesi lokal tetap ditutup */ }
    lockScreen('Anda sudah keluar. Masukkan email dan PIN untuk melanjutkan.');
  }
  function migrateLegacyStorage() {
    if (typeof db === 'undefined') return;
    var legacy = readSaved(DB_KEY);
    var owner = readSaved(OWNER_KEY);
    var hasLegacy = !!safeLocalGet(DB_KEY);
    var hasOwner = !!safeLocalGet(OWNER_KEY);
    var url = (legacy.settings && legacy.settings.googleSheetUrl) || (owner.settings && owner.settings.googleSheetUrl) || (db.settings && db.settings.googleSheetUrl) || safeLocalGet(URL_KEY);
    if (url) safeLocalSet(URL_KEY, url);
    if (hasLegacy || hasOwner) {
      var merged = Object.assign({}, legacy, owner);
      ['leads','clients','projects','finance','memory','marketingSpend','materials','costSheets','services','purchaseOrders','quotationSnapshots','quotations','invoices'].forEach(function (key) {
        merged[key] = mergeById(legacy[key], owner[key]);
      });
      merged.settings = Object.assign({}, legacy.settings || {}, owner.settings || {});
      merged.settings = merged.settings || {};
      merged.settings.googleSheetUrl = url || merged.settings.googleSheetUrl || '';
      delete merged.settings.apiToken;
      // Preserve the original browser copy until a verified Owner sync succeeds.
      // A failed login, refresh, or network interruption must not destroy the only copy.
      legacyOwnerCache = merged;
    }
    resetDb();
    var input = document.getElementById('csk-backend-url');
    if (input) input.value = apiUrl() || safeLocalGet(URL_KEY);
  }

  // The main application loads its legacy local database on DOMContentLoaded.
  // Wrap that call so the owner data is migrated, then clear memory before login.
  if (typeof originalLoadDB === 'function') {
    window.loadDB = function () {
      originalLoadDB();
      migrateLegacyStorage();
    };
  }

  window.nav = function (page) {
    if (!ready || !identity) {
      status('Login diperlukan.');
      return false;
    }
    if (identity.role === 'team' && ['finance','marketing','analysis','memory','settings','services','purchasing','hpp','documents'].indexOf(page) >= 0) {
      if (typeof showToast === 'function') showToast('Modul ini hanya tersedia untuk Owner.', true);
      return false;
    }
    return typeof originalNav === 'function' ? originalNav(page) : false;
  };
  window.onRoleChange = function () {
    if (typeof showToast === 'function') showToast('Hak akses ditentukan oleh akun yang berhasil login.', true);
    applyRole();
  };
  window.saveDB = function (skipCloudSync) {
    if (!ready) return;
    saveScoped();
    if (!skipCloudSync) scheduleSync(true);
    if (typeof renderAll === 'function') renderAll();
  };
  window.syncWithGoogle = function (silent) { return syncNow(!!silent); };
  window.pullAndMerge = async function () {
    if (!ready) return;
    try {
      var response = await get('get_data');
      var cloud = response.data || {};
      setLegacyReadOnlyCollections(cloud);
      collectionsForRole().forEach(function (key) { db[key] = mergeById(cloud[key], db[key]); });
      db.invoicePayments = identity.role === 'owner' && Array.isArray(cloud.invoicePayments) ? cloud.invoicePayments : [];
      db.settings.lastSync = cloud.lastSynced || new Date().toISOString();
      db.settings.lastSyncError = '';
      saveScoped();
      if (typeof renderAll === 'function') renderAll();
      if (typeof updateCloudIndicator === 'function') updateCloudIndicator();
    } catch (e) {
      console.warn('CSK pullAndMerge failed:', e);
      if (/SESSION_EXPIRED|SESSION_REVOKED|AUTH_REQUIRED/.test(String(e && e.message || e))) lockScreen('Sesi berakhir. Silakan masuk kembali.');
    }
  };
  window.pullData = async function () {
    if (!ready) return;
    if (typeof showToast === 'function') showToast('Menggabungkan data cloud dengan data lokal; data lama tidak ditimpa.');
    await window.pullAndMerge();
    if (typeof showToast === 'function') showToast('Data cloud dan lokal selesai digabungkan.');
  };
  window.deleteOnCloud = async function (sheet, id) {
    if (!ready || !identity) return false;
    if (identity.role !== 'owner') {
      if (typeof showToast === 'function') showToast('Penghapusan data hanya dapat dilakukan oleh Owner.', true);
      return false;
    }
    try {
      await post({ action: 'delete', sheet: sheet, id: id });
      var response = await get('get_data');
      var rows = response.data && response.data[({Leads:'leads',Clients:'clients',Projects:'projects',Finance:'finance',Memory:'memory',Marketing_Spend:'marketingSpend',Materials:'materials',Cost_Sheets:'costSheets',Services:'services',Purchase_Orders:'purchaseOrders',Quotations:'quotationSnapshots',Commercial_Quotations:'quotations',Invoices:'invoices'})[sheet]];
      if (!Array.isArray(rows)) throw new Error('Data penghapusan tidak dapat diverifikasi.');
      if (rows.some(function (row) { return String(row.id) === String(id); })) throw new Error('Penghapusan belum terverifikasi.');
      return true;
    } catch (e) {
      console.warn('CSK cloud delete failed:', e);
      if (typeof showToast === 'function') showToast('Penghapusan cloud belum terverifikasi: ' + String(e && e.message || e), true);
      return false;
    }
  };
  window.saveGoogleUrl = function () {
    if (!ready || identity.role !== 'owner') return alert('Hanya Owner yang dapat mengubah koneksi backend.');
    var input = document.getElementById('setting-google-url');
    var value = input && input.value.trim();
    if (!validApiUrl(value)) return alert('URL Google Apps Script tidak valid.');
    safeLocalSet(URL_KEY, value);
    db.settings.googleSheetUrl = value;
    saveScoped();
    if (typeof showToast === 'function') showToast('URL backend tersimpan.');
  };
  if (typeof originalImportData === 'function') {
    window.importData = function (event) {
      if (!ready || identity.role !== 'owner') {
        if (typeof showToast === 'function') showToast('Pemulihan database hanya dapat dilakukan oleh Owner.', true);
        return;
      }
      return originalImportData(event);
    };
  }

  async function recordInvoicePayment(payment) {
    if (!ready || !identity) throw new Error('AUTH_REQUIRED');
    if (identity.role !== 'owner') throw new Error('FORBIDDEN_PAYMENT_WRITE');
    if (!payment || !payment.id || !payment.invoiceId) throw new Error('PAYMENT_REQUIRED');
    if (syncRunning) throw new Error('SYNC_IN_PROGRESS_TRY_AGAIN');
    var synced = await syncNow(true);
    if (!synced) throw new Error('INVOICE_SYNC_REQUIRED_BEFORE_PAYMENT');
    await post({ action: 'record_invoice_payment', payment: payment });
    var response = await get('get_data');
    var cloud = response.data || {};
    var paymentRows = Array.isArray(cloud.invoicePayments) ? cloud.invoicePayments : [];
    var financeRows = Array.isArray(cloud.finance) ? cloud.finance : [];
    var stored = paymentRows.find(function(x) { return String(x.id) === String(payment.id); });
    var financeId = 'FIN-PAY-' + String(payment.id);
    var finance = financeRows.find(function(x) { return String(x.id) === financeId; });
    if (!stored || !finance ||
        String(stored.invoiceId) !== String(payment.invoiceId) ||
        Number(stored.amount) !== Number(payment.amount) ||
        String(stored.paymentDate) !== String(payment.paymentDate) ||
        String(stored.paymentType) !== String(payment.paymentType) ||
        String(stored.method) !== String(payment.method) ||
        Number(finance.amount) !== Number(payment.amount) ||
        String(finance.type).toLowerCase() !== 'income') {
      throw new Error('PAYMENT_NOT_VERIFIED_CHECK_AND_RETRY');
    }
    db.invoicePayments = paymentRows;
    db.finance = financeRows;
    db.invoices = Array.isArray(cloud.invoices) ? cloud.invoices : db.invoices;
    saveScoped();
    if (typeof renderAll === 'function') renderAll();
    if (typeof updateCloudIndicator === 'function') updateCloudIndicator();
    return { payment: stored, finance: finance };
  }

  window.CSKAuth = {
    isReady: function () { return ready; },
    getIdentity: function () { return identity ? { email: identity.email, role: identity.role } : null; },
    logout: logout,
    sync: function (silent) { return syncNow(!!silent); },
    pull: function () { return window.pullAndMerge(); },
    deleteRecord: function (sheet, id) { return window.deleteOnCloud(sheet, id); },
    getData: function () { return get('get_data'); },
    recordInvoicePayment: recordInvoicePayment
  };

  // Warn before leaving while Owner changes or a legacy migration still await verified cloud sync.
  window.addEventListener('beforeunload', function (event) {
    if (!ready || !identity || identity.role !== 'owner') return;
    if (!legacyOwnerCache && !syncTimer && !syncRunning && !syncQueued) return;
    event.preventDefault();
    event.returnValue = '';
  });

  // Gate is inserted before the application becomes interactive.
  ensureGate();
  var initialUrl = apiUrl() || safeLocalGet(URL_KEY);
  var urlField = document.getElementById('csk-backend-url');
  if (urlField) urlField.value = initialUrl;
  var emailField = document.getElementById('csk-login-email');
  if (emailField) emailField.value = OWNER_EMAIL;
  document.addEventListener('DOMContentLoaded', function () {
    var current = apiUrl() || safeLocalGet(URL_KEY);
    var input = document.getElementById('csk-backend-url');
    if (input && current) input.value = current;
  });
})();