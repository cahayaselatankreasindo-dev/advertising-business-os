/**
 * GENERATED ONE-FILE CSK BUSINESS OS LAB BACKEND.
 * Generated from Code.gs + LabRequestGuard.gs + LabSelfTest.gs + LabHandlerVerification.gs.
 * Paste this entire file into Code.gs ONLY in the isolated TEST ONLY spreadsheet Apps Script project.
 * Never paste into production. Never deploy publicly. LAB Web App access must remain Only myself.
 * Regenerate with: node apps-script/build-lab-bundle.cjs
 */

// ===== BEGIN apps-script/Code.gs =====
/**
 * CSK BUSINESS OS — APPS SCRIPT LAB BACKEND (TEST ONLY).
 *
 * This file is ONLY for the spreadsheet:
 * TEST ONLY - CSK BUSINESS OS - DATA DUMMY - JANGAN PAKAI PRODUKSI
 *
 * Guard and LAB test helpers are appended in this generated one-file bundle.
 * doGet/doPost are guarded against the exact LAB spreadsheet and synthetic IDs.
 * Automatic triggers and email outreach are disabled. Never copy this file into
 * the production Apps Script project and never deploy it as a public Web App.
 *
 * This source is intended for manual review/copy into the isolated LAB project.
 * Updating this GitHub file does NOT update or deploy the Apps Script project.
 */

// ============== KONTRAK MAPPING (Tahap 3) ==============
// Single source of truth: header Sheet (hasil Tahap 1-2) <-> field HTML.
// - headers: urutan kolom persis seperti di Sheet (jangan diubah manual).
// - fields:  nama field yang dipakai index.html (camelCase).
// - rating/review digabung ke SATU kolom Sheet "Rating_Review" format "N | teks".
var FIELD_MAP = {
  Leads: {
    headers: ["ID", "Tanggal", "Nama", "WhatsApp", "Sumber", "EstimasiNilai", "Status", "Catatan",
              "Email", "Website", "Industri", "PIC", "JabatanPIC", "LinkedIn", "SkorPrioritas"],
    fields:  ["id", "date", "name", "phone", "source", "value", "status", "notes",
              "email", "website", "industry", "pic", "picTitle", "linkedin", "score"]
    // 8 kolom pertama = skema lama (posisi TIDAK berubah agar data lama aman).
    // 7 kolom baru (Email..SkorPrioritas) khusus data B2B / prospecting.
  },
  Clients: {
    headers: ["ID", "NamaKlien", "WhatsApp", "TotalProyek", "TotalBelanja", "Catatan", "Rating_Review"],
    fields:  ["id", "name", "phone", "projectsCount", "totalSpend", "notes", "rating", "review"]
    // NB: fields 8 item vs headers 7 kolom — rating+review digabung ke Rating_Review.
  },
  Projects: {
    headers: ["ID", "NamaProyek", "Klien", "NilaiProyek", "Status", "Deadline", "Catatan", "SOP_Checklist", "PIC_Tim"],
    fields:  ["id", "title", "client", "value", "status", "deadline", "notes", "sopChecklist", "pic"]
  },
  Finance: {
    headers: ["ID", "Tanggal", "Tipe", "Kategori", "Nominal", "Keterangan", "ProjectID"],
    fields:  ["id", "date", "type", "category", "amount", "description", "projectId"]
  },
  Memory: {
    headers: ["ID", "Tanggal", "Kategori", "Judul", "Isi"],
    fields:  ["id", "date", "category", "title", "content"]
  },
  Marketing_Spend: {
    headers: ["ID", "Tanggal", "Platform", "Kampanye", "Budget", "Terpakai", "LeadsDihasilkan", "Catatan"],
    fields:  ["id", "date", "platform", "campaign", "budget", "spent", "leadsGenerated", "notes"]
  },
  Costings: {
    headers: ["ID", "Tanggal", "Klien", "NamaPekerjaan", "ModelProduksi", "LeadID", "ItemsJSON", "BiayaLangsung", "OverheadPersen", "OverheadNominal", "CadanganPersen", "CadanganNominal", "HPP", "MarginPersen", "HargaPenawaran", "Status", "ProjectID", "Catatan", "NomorQuotation", "VersiQuotation", "MasaBerlakuHari", "WaktuPengerjaanHari", "SyaratPembayaran", "RuangLingkup", "DisetujuiPada", "POConfirmedAt", "RiwayatQuotationJSON", "DikirimPada"],
    fields:  ["id", "date", "client", "title", "productionModel", "leadId", "itemsJson", "directCost", "overheadPct", "overheadAmount", "contingencyPct", "contingencyAmount", "hpp", "marginPct", "sellingPrice", "status", "projectId", "notes", "quoteNo", "quoteVersion", "validityDays", "deliveryDays", "paymentTerms", "scope", "approvedAt", "poConfirmedAt", "quoteHistoryJson", "sentAt"]
  },
  Project_Costs: {
    headers: ["ID", "Tanggal", "ProjectID", "Kategori", "Sumber", "Deskripsi", "Vendor", "Qty", "HargaSatuan", "Nominal", "StatusPembayaran", "Referensi", "Catatan"],
    fields:  ["id", "date", "projectId", "category", "source", "description", "vendor", "qty", "unitCost", "amount", "paymentStatus", "reference", "notes"]
  }
};
var RATING_REVIEW_SEP = " | ";

// Pecah "N | teks" -> {rating, review}. Tahan: kosong, tanpa separator, rating non-angka.
function splitRatingReview(cell) {
  var s = String(cell == null ? "" : cell);
  var i = s.indexOf(RATING_REVIEW_SEP);
  if (i === -1) {
    var n = parseInt(s, 10);
    return { rating: isNaN(n) ? 0 : n, review: (s && isNaN(n)) ? s : "" };
  }
  var num = parseInt(s.slice(0, i).trim(), 10);
  return { rating: isNaN(num) ? 0 : num, review: s.slice(i + RATING_REVIEW_SEP.length).trim() };
}

function joinRatingReview(rating, review) {
  var n = Number(rating) || 0;
  var t = String(review == null ? "" : review).trim();
  return n + RATING_REVIEW_SEP + t;
}

// Sheet row (array, urutan header Sheet) -> objek field HTML.
// Header-aware: memetakan berdasarkan NAMA kolom (tahan beda huruf besar/kecil
// dan tahan kolom yang urutannya bergeser).
function rowToRecord(sheetName, row, headerRow) {
  var map = FIELD_MAP[sheetName];
  var rec = {};
  if (!map) return rec;

  // Tanpa headerRow (mis. dipanggil tanpa header) -> fallback ke urutan FIELD_MAP.
  if (!headerRow) {
    if (sheetName === "Clients") {
      rec.id = row[0]; rec.name = row[1]; rec.phone = row[2];
      rec.projectsCount = row[3]; rec.totalSpend = row[4]; rec.notes = row[5];
      var rr = splitRatingReview(row[6]);
      rec.rating = rr.rating; rec.review = rr.review;
      return rec;
    }
    map.fields.forEach(function (f, idx) { rec[f] = row[idx]; });
    return rec;
  }

  // Peta header Sheet (lowercase) -> index kolom
  var idxByName = {};
  headerRow.forEach(function (h, i) {
    var key = String(h).trim().toLowerCase();
    if (!(key in idxByName)) idxByName[key] = i; // ambil kemunculan PERTAMA saja
  });

  map.headers.forEach(function (sheetHeader, fi) {
    var field = map.fields[fi];
    if (field === undefined) return;
    var col = idxByName[String(sheetHeader).trim().toLowerCase()];
    rec[field] = (col === undefined) ? "" : row[col];
  });

  // Clients: rating+review digabung di kolom Rating_Review
  if (sheetName === "Clients") {
    var raw = rec.rating; // sementara berisi isi kolom Rating_Review
    var rr2 = splitRatingReview(raw);
    rec.rating = rr2.rating;
    rec.review = rr2.review;
  }
  return rec;
}

// Objek field HTML -> array urutan header Sheet (siap setValues/appendRow).
function recordToRow(sheetName, obj) {
  var map = FIELD_MAP[sheetName];
  if (!map) return [];
  obj = obj || {};
  if (sheetName === "Clients") {
    return [obj.id, obj.name, obj.phone, obj.projectsCount, obj.totalSpend, obj.notes,
      joinRatingReview(obj.rating, obj.review)];
  }
  return map.fields.map(function (f) {
    var v = obj[f];
    return (v === undefined || v === null) ? "" : v;
  });
}

// ============== BANTUAN SETUP & HELPER ==============

function setupSheet() {
  // This setup helper is intentionally locked to the verified dummy LAB spreadsheet.
  cskLabRequireDummySheet_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 5 Tab lama — tidak diubah strukturnya
  const legacySheets = [
    { name: "Leads",          headers: ["ID", "Tanggal", "Nama", "WhatsApp", "Sumber", "EstimasiNilai", "Status", "Catatan"] },
    { name: "Clients",        headers: ["ID", "NamaKlien", "WhatsApp", "TotalProyek", "TotalBelanja", "Catatan"] },
    { name: "Projects",       headers: ["ID", "NamaProyek", "Klien", "NilaiProyek", "Status", "Deadline", "Catatan"] },
    { name: "Finance",        headers: ["ID", "Tanggal", "Tipe", "Kategori", "Nominal", "Keterangan"] },
    { name: "Memory",         headers: ["ID", "Tanggal", "Kategori", "Judul", "Isi"] }
  ];

  legacySheets.forEach(s => ensureSheet(ss, s.name, s.headers));

  // Tambah kolom SOP_Checklist ke tab Projects (jika belum ada)
  ensureColumn(ss, "Projects", "SOP_Checklist");

  // Tambah kolom Rating_Review ke tab Clients (jika belum ada)
  ensureColumn(ss, "Clients", "Rating_Review");

  // Tab baru: Marketing_Spend (Pilar Pemasaran)
  const marketingHeaders = ["ID", "Tanggal", "Platform", "Kampanye", "Budget", "Terpakai", "LeadsDihasilkan", "Catatan"];
  ensureSheet(ss, "Marketing_Spend", marketingHeaders);

  // Migrasi skema: rapi-kan dulu kolom duplikat, lalu pastikan kolom kontrak ada.
  // Urutan penting: dedupe dulu (mis. "TANGGAL" & "Tanggal" dobel), baru tambah yang kurang.
  Object.keys(FIELD_MAP).forEach(function (name) {
    dedupeHeaders(ss, name);
  });
  Object.keys(FIELD_MAP).forEach(function (name) {
    ensureAllHeaders(ss, name);
  });

  // Hapus sheet kosong bawaan Google (Sheet1 / Sheet 1) bila masih ada
  const defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Sheet 1");
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
}

function ensureSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#1C2333")
      .setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Tambahkan satu kolom di akhir sheet jika belum ada
function ensureColumn(ss, sheetName, columnName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() === 0) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.indexOf(columnName) !== -1) return;
  const col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue(columnName);
  sheet.getRange(1, col)
    .setFontWeight("bold")
    .setBackground("#1C2333")
    .setFontColor("#FFFFFF");
}

/**
 * Pastikan SEMUA header di FIELD_MAP[sheetName].headers ada di sheet.
 * Kolom lama TIDAK digeser; kolom baru hanya ditambahkan di KANAN.
 * Pencocokan TIDAK case-sensitive (TANGGAL == Tanggal == tanggal).
 * Aman untuk sheet yang sudah berisi data (migrasi skema).
 */
function ensureAllHeaders(ss, sheetName) {
  var map = FIELD_MAP[sheetName];
  if (!map) return;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() === 0) return;

  var current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });

  map.headers.forEach(function (h) {
    if (current.indexOf(h.toLowerCase()) === -1) {
      var col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(h);
      sheet.getRange(1, col)
        .setFontWeight("bold")
        .setBackground("#1C2333")
        .setFontColor("#FFFFFF");
      current.push(h.toLowerCase());
    }
  });
}

// Bersihkan kolom HEADER DUPLIKAT (mis. "Tanggal" & "TANGGAL" muncul 2x).
// Menyimpan kemunculan PERTAMA saja; kolom duplikat dihapus.
// Sekaligus merapikan urutan jadi persis FIELD_MAP.headers (jika tab kontrak).
// Aman: data kolom yang dipertahankan ikut dipindah, isi tidak hilang.
function dedupeHeaders(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() === 0) return 0;

  var lastCol = sheet.getLastColumn();
  if (lastCol <= 1) return 0;

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var seen = {};
  var keepCols = []; // index kolom (0-based) yang dipertahankan

  headerRow.forEach(function (h, i) {
    var key = String(h).trim().toLowerCase();
    if (key === "") return;                 // kolom tanpa judul -> buang
    if (seen[key]) return;                  // duplikat -> buang
    seen[key] = true;
    keepCols.push(i);
  });

  if (keepCols.length === lastCol) return 0; // tidak ada duplikat

  // Ambil seluruh data, lalu tulis ulang hanya kolom yang dipertahankan.
  var data = sheet.getDataRange().getValues();
  var newRows = data.map(function (r) {
    return keepCols.map(function (i) { return r[i]; });
  });

  sheet.clear();
  sheet.getRange(1, 1, newRows.length, newRows[0].length).setValues(newRows);
  sheet.getRange(1, 1, 1, newRows[0].length)
    .setFontWeight("bold").setBackground("#1C2333").setFontColor("#FFFFFF");
  sheet.setFrozenRows(1);

  var removed = lastCol - keepCols.length;
  Logger.log("dedupeHeaders[" + sheetName + "]: hapus " + removed + " kolom duplikat.");
  return removed;
}

function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) return i + 2;
  }
  return -1;
}

function readSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const values = sheet.getDataRange().getValues();
  const headerRow = values[0];
  const rows = values.slice(1);
  // Tab kontrak: pakai FIELD_MAP agar key persis field HTML (Tahap 3).
  // Header-aware: kolom dipetakan berdasarkan NAMA, bukan posisi.
  if (FIELD_MAP[sheetName]) return rows.map(r => rowToRecord(sheetName, r, headerRow));
  const headers = values[0];
  return rows.map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[String(h).toLowerCase()] = r[idx]; });
    return obj;
  });
}

// ============== KEAMANAN: TOKEN + PROTOKOL API (STAGED / NOT YET DEPLOYED) ==============
// Protocol 2 rejects stale PWA clients that still send the legacy full-sync contract.
// This is a compatibility guard, NOT user authentication or concurrency control.
var CSK_API_PROTOCOL_VERSION = 2;

function protocolMismatchResponse() {
  return jsonResponse({
    status: "error",
    code: "CLIENT_PROTOCOL_MISMATCH",
    protocolVersion: CSK_API_PROTOCOL_VERSION,
    message: "Versi aplikasi tidak didukung. Muat ulang CSK Business OS sebelum sinkronisasi."
  });
}

var CSK_SYNC_PAYLOAD_AREAS_ = {
  leads: "Leads", clients: "Clients", projects: "Projects",
  finance: "Finance", memory: "Memory", marketingSpend: "Marketing_Spend",
  costings: "Costings", projectCosts: "Project_Costs"
};
var CSK_SYNC_MAX_RECORDS_PER_REQUEST_ = 40;

function stableRecordFingerprint_(record) {
  if (!record) return "";
  var keys = Object.keys(record).sort();
  return JSON.stringify(keys.map(function (key) { return [key, record[key]]; }));
}

function findRecordById_(ss, sheetName, id) {
  var rows = readSheetData(ss, sheetName);
  var target = String(id);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === target) return rows[i];
  }
  return null;
}

/**
 * Compare every sync_all upsert with the record version the client edited.
 * Must run while holding the script lock, immediately before the write.
 * A null expected fingerprint means the record must still be absent.
 */
function validateExpectedRecords_(ss, payload) {
  var expectedRecords = payload.expectedRecords;
  if (!expectedRecords || typeof expectedRecords !== "object" || Array.isArray(expectedRecords)) {
    return { ok: false, code: "EXPECTED_VERSION_REQUIRED",
      message: "Sinkronisasi ditolak: expectedRecords wajib dikirim." };
  }
  var missing = [];
  var conflicts = [];
  var totalRecords = 0;
  var currentBySheet = Object.create(null);
  Object.keys(CSK_SYNC_PAYLOAD_AREAS_).forEach(function (area) {
    if (!(area in payload)) return;
    var items = payload[area];
    if (!Array.isArray(items)) {
      missing.push(area + " bukan array");
      return;
    }
    if (!items.length) return;
    totalRecords += items.length;
    if (totalRecords > CSK_SYNC_MAX_RECORDS_PER_REQUEST_) return;

    var sheetName = CSK_SYNC_PAYLOAD_AREAS_[area];
    var versions = expectedRecords[sheetName];
    if (!versions || typeof versions !== "object" || Array.isArray(versions)) {
      missing.push(sheetName);
      return;
    }

    // Read each sheet once per request, then compare all records in memory.
    // This avoids a full Sheets read for every item in a large sync batch.
    if (!currentBySheet[sheetName]) {
      currentBySheet[sheetName] = Object.create(null);
      readSheetData(ss, sheetName).forEach(function (record) {
        if (record && record.id !== undefined && record.id !== null) {
          currentBySheet[sheetName][String(record.id)] = record;
        }
      });
    }
    var seenIds = Object.create(null);
    items.forEach(function (item) {
      var id = String(item && item.id != null ? item.id : "").trim();
      if (!id || !Object.prototype.hasOwnProperty.call(versions, id)) {
        missing.push(sheetName + "/" + id);
        return;
      }
      if (seenIds[id]) {
        missing.push(sheetName + "/" + id + " duplikat");
        return;
      }
      seenIds[id] = true;
      var expected = versions[id];
      var current = currentBySheet[sheetName][id] || null;
      if (expected === null) {
        if (current) conflicts.push(sheetName + "/" + id);
      } else if (typeof expected !== "string" || !expected ||
          !current || stableRecordFingerprint_(current) !== expected) {
        conflicts.push(sheetName + "/" + id);
      }
    });
  });
  if (totalRecords > CSK_SYNC_MAX_RECORDS_PER_REQUEST_) {
    return { ok: false, code: "SYNC_BATCH_LIMIT",
      message: "Maksimum " + CSK_SYNC_MAX_RECORDS_PER_REQUEST_ + " record per batch. Pecah sinkronisasi menjadi beberapa batch." };
  }
  if (missing.length) {
    return { ok: false, code: "EXPECTED_VERSION_REQUIRED",
      message: "Versi dasar record tidak lengkap atau ID duplikat. Tidak ada data yang diubah.", conflicts: missing };
  }
  if (conflicts.length) {
    return { ok: false, code: "SYNC_CONFLICT",
      message: "Data cloud berubah sejak terakhir dibaca. Tidak ada data yang diubah.", conflicts: conflicts };
  }
  return { ok: true };
}

function validateExpectedDelete_(ss, sheetName, id, expectedFingerprint) {
  if (typeof expectedFingerprint !== "string" || !expectedFingerprint) {
    return { ok: false, code: "EXPECTED_VERSION_REQUIRED",
      message: "Penghapusan ditolak: expectedFingerprint wajib dikirim." };
  }
  var current = findRecordById_(ss, sheetName, id);
  if (!current || stableRecordFingerprint_(current) !== expectedFingerprint) {
    return { ok: false, code: "SYNC_CONFLICT",
      message: "Record berubah atau sudah dihapus oleh perangkat lain. Tidak ada data yang diubah.",
      conflicts: [sheetName + "/" + String(id)] };
  }
  return { ok: true };
}

// Backward-compatible server-side helper required by the isolated LAB test
// harness; it returns only the Owner credential inside Apps Script.
function getApiToken() {
  return getApiTokens().owner;
}

// Server-side role authentication. API_TOKEN remains a temporary Owner-only
// migration fallback; setupApiTokens() replaces it with separate role secrets.
function getApiTokens() {
  var props = PropertiesService.getScriptProperties();
  return {
    owner: props.getProperty("OWNER_API_TOKEN") || props.getProperty("API_TOKEN") || "",
    team: props.getProperty("TEAM_API_TOKEN") || ""
  };
}

function generateApiToken_() {
  return Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
}

/**
 * Run once after deploying this backend. It rotates both role credentials.
 * Copy OWNER_API_TOKEN and TEAM_API_TOKEN from Project Settings > Script Properties.
 * Never store either value in source control or share the Owner token with Team.
 */
function setupApiTokens() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("OWNER_API_TOKEN", generateApiToken_());
  props.setProperty("TEAM_API_TOKEN", generateApiToken_());
  props.deleteProperty("API_TOKEN");
  Logger.log("Owner and Team API tokens generated in Script Properties. Do not share the Owner token.");
  return { ownerConfigured: true, teamConfigured: true };
}

// Legacy menu entry now rotates both credentials; update old setup instructions.
function setupApiToken() {
  return setupApiTokens();
}

function secureTokenEquals_(provided, expected) {
  provided = String(provided || "");
  expected = String(expected || "");
  if (!provided || !expected || expected.length < 20 || provided.length !== expected.length) return false;
  var diff = 0;
  for (var i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function getRequestRole(payloadOrEvent, tokenParam) {
  var tokens = getApiTokens();
  var provided = "";
  if (payloadOrEvent && typeof payloadOrEvent === "object") provided = payloadOrEvent.token || "";
  if (!provided && tokenParam) provided = tokenParam;
  if (secureTokenEquals_(provided, tokens.owner)) return "owner";
  if (secureTokenEquals_(provided, tokens.team)) return "team";
  return "";
}

function isAuthorized(payloadOrEvent, tokenParam) {
  return getRequestRole(payloadOrEvent, tokenParam) !== "";
}

function isSheetAllowedForRole_(role, sheetName) {
  var ownerSheets = Object.keys(FIELD_MAP);
  var teamSheets = ["Leads", "Clients", "Projects"];
  var allowed = role === "owner" ? ownerSheets : (role === "team" ? teamSheets : []);
  return allowed.indexOf(sheetName) !== -1;
}

function unauthorizedResponse() {
  return jsonResponse({ status: "error", code: "UNAUTHORIZED", protocolVersion: CSK_API_PROTOCOL_VERSION, message: "Tidak diizinkan: token akses tidak valid atau belum dikonfigurasi." });
}

function forbiddenResponse(message) {
  return jsonResponse({ status: "error", code: "FORBIDDEN", protocolVersion: CSK_API_PROTOCOL_VERSION, message: message || "Role ini tidak memiliki izin untuk operasi tersebut." });
}

// ============== GET — TARIK DATA SEMUA TAB ==============

function doGet(e) {
  var apiLock = null;
  var lockAcquired = false;
  try {
    // LAB-only: refuse reads unless the active spreadsheet is the verified dummy database.
    cskLabGuardRead_();
    // Authenticate before disclosing protocol details or reading cloud data.
    var tokenParam = (e && e.parameter) ? e.parameter.token : "";
    var role = getRequestRole(null, tokenParam);
    if (!role) return unauthorizedResponse();
    // Reject stale clients after authentication, before exposing any cloud data.
    var requestedProtocol = (e && e.parameter) ? e.parameter.protocolVersion : "";
    if (Number(requestedProtocol) !== CSK_API_PROTOCOL_VERSION) return protocolMismatchResponse();

    // Reads wait for an in-progress write so clients never observe a half-applied batch.
    apiLock = LockService.getScriptLock();
    apiLock.waitLock(30000);
    lockAcquired = true;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const result = {
      leads: readSheetData(ss, "Leads"),
      clients: readSheetData(ss, "Clients"),
      projects: readSheetData(ss, "Projects"),
      finance: role === "owner" ? readSheetData(ss, "Finance") : [],
      memory: role === "owner" ? readSheetData(ss, "Memory") : [],
      marketingSpend: role === "owner" ? readSheetData(ss, "Marketing_Spend") : [],
      costings: role === "owner" ? readSheetData(ss, "Costings") : [],
      projectCosts: role === "owner" ? readSheetData(ss, "Project_Costs") : [],
      lastSynced: new Date().toISOString(),
      role: role
    };
    return ContentService.createTextOutput(JSON.stringify({ status: "success", protocolVersion: CSK_API_PROTOCOL_VERSION, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", protocolVersion: CSK_API_PROTOCOL_VERSION, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (lockAcquired && apiLock) apiLock.releaseLock();
  }
}

// ============== POST — CRUD (sync_all, insert, update_status) ==============

function doPost(e) {
  var apiLock = null;
  var lockAcquired = false;
  try {
    const payload = JSON.parse(e.postData.contents);
    // LAB-only: validate synthetic IDs, allowed actions, payload fields and expected versions.
    cskLabGuardPost_(payload);
    // Authenticate before disclosing protocol details or processing a write.
    var role = getRequestRole(payload);
    if (!role) return unauthorizedResponse();
    // Reject legacy/stale write contracts before any sheet mutation.
    if (Number(payload.protocolVersion) !== CSK_API_PROTOCOL_VERSION) return protocolMismatchResponse();

    // Serialize the read-check-write section across all clients of this script.
    apiLock = LockService.getScriptLock();
    apiLock.waitLock(30000);
    lockAcquired = true;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (payload.action || "").toLowerCase();

    switch (action) {

      // --- sync_all (MERGE / UPSERT — tidak pernah menghapus data lama) ---
      // Aman: lead yang sudah ada di Sheets tetap tersimpan; hanya ditambah/diupdate.
      case "sync_all": {
        // Strict contract: reject unknown keys instead of silently ignoring typos
        // or accepting forged client-only role metadata.
        var allowedSyncKeys = ["action", "token", "protocolVersion", "expectedRecords"]
          .concat(Object.keys(CSK_SYNC_PAYLOAD_AREAS_));
        var unknownSyncKeys = Object.keys(payload).filter(function (key) {
          return allowedSyncKeys.indexOf(key) === -1;
        });
        if (unknownSyncKeys.length) return jsonResponse({
          status: "error", code: "INVALID_PAYLOAD", protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: "Field sinkronisasi tidak dikenal: " + unknownSyncKeys.join(", ")
        });
        // Team may only submit Leads, Clients, and Projects. Reject rather than
        // silently accepting private data in a forged or stale payload.
        Object.keys(CSK_SYNC_PAYLOAD_AREAS_).forEach(function (area) {
          if (Object.prototype.hasOwnProperty.call(payload, area) &&
              !isSheetAllowedForRole_(role, CSK_SYNC_PAYLOAD_AREAS_[area])) {
            throw new Error("Role " + role + " tidak boleh menyinkronkan " + CSK_SYNC_PAYLOAD_AREAS_[area] + ".");
          }
        });
        var expectedCheck = validateExpectedRecords_(ss, payload);
        if (!expectedCheck.ok) return jsonResponse({
          status: "error", code: expectedCheck.code, protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: expectedCheck.message, conflicts: expectedCheck.conflicts || []
        });
        var mergeSummary = {};
        if (payload.leads)          mergeSummary.Leads           = mergeSheet(ss, "Leads",           payload.leads);
        if (payload.clients)        mergeSummary.Clients         = mergeSheet(ss, "Clients",         payload.clients);
        if (payload.projects)       mergeSummary.Projects        = mergeSheet(ss, "Projects",        payload.projects);
        if (payload.finance)        mergeSummary.Finance         = mergeSheet(ss, "Finance",         payload.finance);
        if (payload.memory)         mergeSummary.Memory          = mergeSheet(ss, "Memory",          payload.memory);
        if (payload.marketingSpend) mergeSummary.Marketing_Spend = mergeSheet(ss, "Marketing_Spend", payload.marketingSpend);
        if (payload.costings)       mergeSummary.Costings        = mergeSheet(ss, "Costings",        payload.costings);
        if (payload.projectCosts)   mergeSummary.Project_Costs   = mergeSheet(ss, "Project_Costs",   payload.projectCosts);
        // Only an Owner write that actually contains a won lead may trigger
        // the explicitly opt-in project automation. Team edits and unrelated
        // module syncs must never activate Owner-side automation.
        var hasWonLeadInPayload = role === "owner" && Array.isArray(payload.leads) &&
          payload.leads.some(function (lead) { return isDealMenang(lead && lead.status); });
        if (hasWonLeadInPayload) autoTriggerPillars(ss);
        return jsonResponse({ status: "success", message: "Data di-merge (tidak ada yang dihapus)", summary: mergeSummary });
      }

      // --- delete: hapus 1 baris berdasarkan ID (dipakai tombol hapus di app) ---
      case "delete": {
        var allowedDeleteKeys = ["action", "token", "protocolVersion", "sheet", "id", "expectedFingerprint"];
        var unknownDeleteKeys = Object.keys(payload).filter(function (key) {
          return allowedDeleteKeys.indexOf(key) === -1;
        });
        if (unknownDeleteKeys.length) return jsonResponse({
          status: "error", code: "INVALID_PAYLOAD", protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: "Field penghapusan tidak dikenal: " + unknownDeleteKeys.join(", ")
        });
        const sheetName = payload.sheet || "Leads";
        const delId = payload.id;
        if (!isSheetAllowedForRole_(role, sheetName)) return forbiddenResponse("Role " + role + " tidak boleh menghapus data " + sheetName + ".");
        if (!delId) throw new Error("Parameter id diperlukan untuk aksi delete.");
        if (!FIELD_MAP[sheetName]) return jsonResponse({
          status: "error", code: "INVALID_SHEET", protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: "Penghapusan hanya diizinkan untuk tab Business OS yang terdaftar."
        });
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) throw new Error("Tab '" + sheetName + "' tidak ditemukan.");
        const rowNum = findRowById(sheet, delId);
        // Idempotent delete: if another device already removed this record, no write is needed.
        if (rowNum === -1) {
          return jsonResponse({
            status: "success", protocolVersion: CSK_API_PROTOCOL_VERSION,
            message: "Baris " + delId + " tidak ada (sudah terhapus)."
          });
        }
        // For an existing row, require the exact baseline fingerprint before deleting.
        var deleteCheck = validateExpectedDelete_(ss, sheetName, delId, payload.expectedFingerprint);
        if (!deleteCheck.ok) return jsonResponse({
          status: "error", code: deleteCheck.code, protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: deleteCheck.message, conflicts: deleteCheck.conflicts || []
        });
        sheet.deleteRow(rowNum);
        return jsonResponse({
          status: "success", protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: "Baris " + delId + " dihapus dari " + sheetName
        });
      }

      // --- insert: tambahkan 1 baris ke tab tertentu ---
      case "insert": {
        const sheetName = payload.sheet;
        const data = payload.data || {};
        if (!sheetName || !data.id) {
          throw new Error("Parameter sheet dan data.id diperlukan untuk aksi insert.");
        }
        if (!isSheetAllowedForRole_(role, sheetName)) return forbiddenResponse("Role " + role + " tidak boleh menambahkan data " + sheetName + ".");
        ensureSheet(ss, sheetName, FIELD_MAP[sheetName] ? FIELD_MAP[sheetName].headers : []);
        if (FIELD_MAP[sheetName]) {
          insertRecord(ss, sheetName, data);
        } else {
          // Tab di luar kontrak: ikut header Sheet apa adanya.
          const sheet = ss.getSheetByName(sheetName);
          const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          const row = headers.map(h => data[String(h).toLowerCase()] !== undefined ? data[String(h).toLowerCase()] : "");
          sheet.appendRow(row);
        }
        return jsonResponse({ status: "success", message: "Baris berhasil disisipkan di " + sheetName, id: data.id });
      }

      // --- update_status: ubah kolom Status baris berdasarkan ID ---
      case "update_status": {
        const sheetName = payload.sheet || "Leads";
        const id = payload.id;
        const status = payload.status;
        if (!isSheetAllowedForRole_(role, sheetName)) return forbiddenResponse("Role " + role + " tidak boleh mengubah data " + sheetName + ".");
        if (!id || !status) throw new Error("Parameter id dan status diperlukan.");
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) throw new Error("Tab '" + sheetName + "' tidak ditemukan.");
        const rowNum = findRowById(sheet, id);
        if (rowNum === -1) throw new Error("Baris dengan ID " + id + " tidak ditemukan di " + sheetName);
        // Kolom Status adalah kolom ke-7 untuk Leads, Projects — umum di kolom terakhir sebelum catatan
        // Kita cari indeks header "status" (case-insensitive)
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        let statusCol = headers.findIndex(h => String(h).toLowerCase() === "status");
        if (statusCol === -1) statusCol = 6; // fallback kolom G (index 7)
        sheet.getRange(rowNum, statusCol + 1).setValue(status);
        // Jika status berubah jadi deal menang → jalankan otomasi
        if ((sheetName === "Leads" || sheetName === "Leads_CRM") && isDealMenang(status)) {
          autoTriggerPillars(ss, id);
        }
        return jsonResponse({ status: "success", message: "Status diperbarui di " + sheetName, row: rowNum });
      }

      // --- send_cold_email: kirim outreach resmi via Gmail dengan batas kuota 50 & opt-out ---
      case "send_cold_email": {
        // Retired: email marketing in CSK OS is owner-reviewed mailto drafts only.
        // This endpoint must NEVER send automatically, even with a valid API token.
        throw new Error("Pengiriman cold email otomatis dinonaktifkan. Gunakan Studio Email Marketing untuk meninjau dan mengirim manual.");
      }

      default:
        throw new Error("Aksi tidak dikenal: " + action + ". Gunakan: sync_all, insert, update_status, send_cold_email.");
    }

    return jsonResponse({ status: "success", message: "Data tersinkronisasi ke Google Sheets" });

  } catch (err) {
    return jsonResponse({ status: "error", protocolVersion: CSK_API_PROTOCOL_VERSION, message: err.toString() });
  } finally {
    if (lockAcquired && apiLock) apiLock.releaseLock();
  }
}

// ============== OTOMATISASI PILLAR ==============

/**
 * Auto-create a PROJECT draft only when explicitly enabled through
 * Script Properties: AUTO_PROJECT_FROM_WON=true. Never create Finance income.
 * A signed deal is not proof of payment (DP).
 */
function autoTriggerPillars(ss, forceLeadId) {
  if (PropertiesService.getScriptProperties().getProperty("AUTO_PROJECT_FROM_WON") !== "true") {
    return { financeCreated: 0, projectCreated: 0, disabled: true };
  }
  const leadsSheet = ss.getSheetByName("Leads");
  if (!leadsSheet || leadsSheet.getLastRow() <= 1) return { financeCreated: 0, projectCreated: 0 };
  const leads = readSheetData(ss, "Leads");
  let projectCreated = 0;
  leads.forEach(lead => {
    if (!isDealMenang(lead.status)) return;
    if (forceLeadId && String(lead.id).trim() !== String(forceLeadId).trim()) return;
    const refToken = "[LEAD-" + lead.id + "]";
    if (hasTokenInSheet(ss, "Projects", refToken)) return;
    const projectRow = {
      id: "AUTO-PRJ-" + Date.now() + "-" + String(lead.id),
      title: "Proyek " + (lead.name || ""),
      client: lead.name || "",
      value: Number(lead.value) || 0,
      status: "plan",
      deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      notes: "Antrean otomatis dari Lead " + refToken,
      sopChecklist: "Brief:0;Produksi:0;Review:0;Revisi:0;Delivery:0"
    };
    insertRecord(ss, "Projects", projectRow, ["id","title","client","value","status","deadline","notes","sopChecklist"]);
    projectCreated++;
  });
  return { financeCreated: 0, projectCreated: projectCreated };
}

function hasTokenInSheet(ss, sheetName, token) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return false;
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const rowStr = values[i].toString();
    if (rowStr.indexOf(token) !== -1) return true;
  }
  return false;
}

function isDealMenang(status) {
  const s = String(status || "").toLowerCase().replace(/\s/g, "");
  return s === "won" || s === "dealmenang" || s === "deal-menang" || s === "dealwin";
}

function insertRecord(ss, sheetName, recordObj, keyOrder) {
  // Tab kontrak: tulis persis urutan header Sheet via recordToRow (Tahap 3).
  if (FIELD_MAP[sheetName]) {
    ensureSheet(ss, sheetName, FIELD_MAP[sheetName].headers);
    ss.getSheetByName(sheetName).appendRow(recordToRow(sheetName, recordObj));
    return;
  }
  const sheet = ensureSheet(ss, sheetName, []);
  const headers = sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : keyOrder || Object.keys(recordObj);
  const row = headers.map(h => {
    const val = recordObj[String(h).toLowerCase()];
    return val !== undefined && val !== null ? val : "";
  });
  sheet.appendRow(row);
}

function overwriteSheet(ss, sheetName, items, keys) {
  // Tab kontrak: header dipaksa sesuai FIELD_MAP agar kolom tak pernah bergeser.
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (FIELD_MAP[sheetName]) {
      sheet.appendRow(FIELD_MAP[sheetName].headers);
      sheet.getRange(1, 1, 1, FIELD_MAP[sheetName].headers.length)
        .setFontWeight("bold").setBackground("#1C2333").setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }
  }
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  if (items && items.length > 0) {
    // Tab kontrak selalu ditulis via recordToRow (termasuk gabungan Rating_Review).
    const rows = FIELD_MAP[sheetName]
      ? items.map(item => recordToRow(sheetName, item))
      : items.map(item => keys.map(k => item[k] !== undefined ? item[k] : ""));
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

// ============== INSTALLABLE TRIGGER (opsional) ==============
/**
 * Jalankan fungsi ini SEKALI di editor Apps Script setelah deploy awal.
 * Akan membuat trigger onEdit (langsung saat sel diedit) dan time-driven (setiap jam).
 * Trigger ini membuat autoTriggerPillars berjalan otomatis tanpa perlu menunggu sync_all.
 */
function installAutoTrigger() {
  throw new Error("LAB ONLY: automatic triggers are disabled. Do not install triggers in the isolated test project.");
}
function handleAutoTrigger(e) {
  // Jika triggered via edit, hanya proses jika sheet aktif adalah Leads dan kolom yang diedit adalah Status
  if (e && e.range && e.source) {
    const sheetName = e.range.getSheet().getName();
    const colNum = e.range.getColumn();
    // Kolom Status di tab Leads adalah kolom G (index 7)
    if (sheetName === "Leads" && colNum !== 7) return;
  }
  autoTriggerPillars(SpreadsheetApp.getActiveSpreadsheet());
}

// ============== OTOMASI CRON JAM 9 PAGI: COLD OUTREACH ==============

/**
 * Otomatis berjalan setiap hari jam 09:00 - 10:00 WIB.
 * Mengambil antrean leads dengan status 'new' yang memiliki email atau catatan email,
 * lalu mengirim cold email resmi (maks 15 per hari agar bertahap dan aman).
 */
function cronDailyOutreach() {
  // Legacy triggers, if present in an already-deployed project, are inert
  // ONLY AFTER the deployed version is updated and reviewed by its owner.
  Logger.log("Cold outreach automation disabled in CSK Business OS draft.");
  return {disabled:true, sent:0};
}

/**
 * Jalankan fungsi ini sekali dari Apps Script untuk memasang otomatis trigger jam 9 pagi.
 */
function installDailyOutreachTrigger() {
  // No automatic email trigger is installed by this draft.
  Logger.log("Daily email outreach trigger installation is disabled.");
  return {disabled:true, installed:0};
}

/** Owner-only manual maintenance for an already-deployed LAB project.
 * Never call in production without reviewing the existing triggers first.
 */
function removeLegacyOutreachTriggers() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "cronDailyOutreach") {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  return {removed:removed, emailSends:0};
}

// ============== UTILITAS RESPONS ==============

/**
 * MERGE (UPSERT) — aman, tidak pernah menghapus data lama.
 * - Baris dengan ID yang sudah ada  -> diupdate (hanya jika berubah).
 * - Baris dengan ID baru            -> ditambahkan di bawah.
 * - Baris lama yang tidak dikirim   -> DIBIARKAN (tidak dihapus).
 * - Header-aware: nilai ditulis ke kolom sesuai NAMA header, bukan posisi.
 *   Kolom baru (mis. Email/Website/Industri) otomatis ditambahkan bila belum ada.
 *
 * Mengembalikan ringkasan { inserted, updated, skipped, total }.
 */
function mergeSheet(ss, sheetName, items) {
  var map = FIELD_MAP[sheetName];
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (map) {
      sheet.appendRow(map.headers);
      sheet.getRange(1, 1, 1, map.headers.length)
        .setFontWeight("bold").setBackground("#1C2333").setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }
  }

  // Rapikan kolom duplikat dulu (mis. "TANGGAL" & "Tanggal"), lalu pastikan
  // semua kolom kontrak ada (kolom baru ditambah di kanan).
  if (map) {
    dedupeHeaders(ss, sheetName);
    ensureAllHeaders(ss, sheetName);
  }

  items = items || [];
  var result = { inserted: 0, updated: 0, skipped: 0, total: items.length };
  if (items.length === 0) return result;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  // Header aktual sheet -> posisi kolom
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  // Bangun indeks ID -> nomor baris (ID selalu kolom 1)
  var idToRow = Object.create(null);
  if (lastRow > 1) {
    var idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < idValues.length; i++) {
      var key = String(idValues[i][0]).trim();
      if (key !== "") idToRow[key] = i + 2;
    }
  }

  // Ambil seluruh data sekali (untuk perbandingan & update)
  var dataRange = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];

  // Peta nama header kontrak (lowercase) -> posisi di FIELD_MAP.headers
  var contractPos = {};
  if (map) {
    map.headers.forEach(function (h, i) { contractPos[h.toLowerCase()] = i; });
  }

  // Ubah record -> array nilai SEJAJAR dengan header AKTUAL sheet (by name, case-insensitive)
  function buildRow(item) {
    var contractRow = recordToRow(sheetName, item); // sejajar FIELD_MAP.headers
    return headerRow.map(function (h) {
      var pos = contractPos[String(h).trim().toLowerCase()];
      return pos === undefined ? "" : contractRow[pos];
    });
  }

  var rowsToAppend = [];
  var seenNewIds = Object.create(null); // cegah duplikat ID di dalam 1 payload

  items.forEach(function (item) {
    var id = String(item.id === undefined || item.id === null ? "" : item.id).trim();
    if (id === "") { result.skipped++; return; }

    var newRow = buildRow(item);

    if (idToRow[id]) {
      // Baris sudah ada di sheet -> update HANYA kolom yang berubah
      var rowIdx = idToRow[id] - 2; // index di dataRange
      var oldRow = dataRange[rowIdx] || [];
      var changed = false;
      for (var c = 0; c < newRow.length; c++) {
        // Normalisasi angka vs string agar tidak update palsu
        if (String(oldRow[c]) !== String(newRow[c])) { changed = true; break; }
      }
      if (changed) {
        sheet.getRange(idToRow[id], 1, 1, newRow.length).setValues([newRow]);
        result.updated++;
      } else {
        result.skipped++;
      }
    } else if (seenNewIds[id]) {
      // Duplikat ID di dalam payload yang sama -> cukup sekali
      result.skipped++;
    } else {
      seenNewIds[id] = true;
      rowsToAppend.push(newRow);
      result.inserted++;
    }
  });

  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length)
      .setValues(rowsToAppend);
  }

  return result;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
// ===== END apps-script/Code.gs =====

// ===== BEGIN apps-script/LabRequestGuard.gs =====
/**
 * CSK Business OS — LAB TEST ONLY, NOT PRODUCTION.
 *
 * The private Google Apps Script LAB Web App currently uses Code.gs doGet/doPost.
 * This file is an allowlist guard; copying this file ALONE does not activate it.
 * A later audited change must call cskLabGuardRead_() near the start of doGet
 * and cskLabGuardPost_(payload) after JSON.parse in doPost. Keep the LAB Web App
 * set to "Only myself" until BOTH guards and live readback checks pass.
 *
 * This code must never be copied to the production Apps Script project.
 */
var CSK_LAB_WRITE_KEYS_ = {
  leads: "Leads", clients: "Clients", projects: "Projects",
  finance: "Finance", memory: "Memory", marketingSpend: "Marketing_Spend",
  costings: "Costings", projectCosts: "Project_Costs"
};

function cskLabGuardRead_() {
  // Function defined in LAB-only LabSelfTest.gs. Checks exact Spreadsheet ID,
  // filename, dummy ID prefixes and no won leads in existing LAB data.
  if (typeof cskLabRequireDummySheet_ !== "function") {
    throw new Error("LAB guard missing: LabSelfTest.gs must be installed.");
  }
  var sheet = cskLabRequireDummySheet_();
  var token = getApiToken();
  if (!token || token.length < 20 ||
      token === "GANTI-DENGAN-TOKEN-RAHASIA-ANDA") {
    throw new Error("LAB guard: API_TOKEN LAB must be configured first.");
  }
  return sheet;
}

function cskLabGuardDummyId_(id) {
  var text = String(id == null ? "" : id).trim();
  // Both prefixes are reserved for synthetic QA data only.
  if (!/^(TEST-|QA-LAB-)[A-Za-z0-9_-]{1,120}$/.test(text)) {
    throw new Error("LAB guard: only synthetic TEST- / QA-LAB- IDs are permitted.");
  }
}

function cskLabGuardPost_(payload) {
  cskLabGuardRead_();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("LAB guard: invalid request body.");
  }
  if (Number(payload.protocolVersion) !== 2) {
    throw new Error("LAB guard: client protocol version unsupported.");
  }
  if (!isAuthorized(payload)) {
    throw new Error("LAB guard: missing or incorrect API token.");
  }
  var action = String(payload.action || "").toLowerCase();
  if (action !== "sync_all" && action !== "delete") {
    // Explicitly disables send_email, insert, update_status, and any
    // other backend action when the LAB Web App is opened to browsers.
    throw new Error("LAB guard: only sync_all and delete are allowed.");
  }
  if (action === "delete") {
    Object.keys(payload).forEach(function(k) {
      if (["action", "token", "protocolVersion", "sheet", "id", "expectedFingerprint"].indexOf(k) === -1) {
        throw new Error("LAB guard: unknown delete field.");
      }
    });
    if (Object.keys(CSK_LAB_WRITE_KEYS_).map(function(k) {
      return CSK_LAB_WRITE_KEYS_[k];
    }).indexOf(payload.sheet) === -1) {
      throw new Error("LAB guard: unsupported sheet.");
    }
    cskLabGuardDummyId_(payload.id);
    if (typeof payload.expectedFingerprint !== "string" || !payload.expectedFingerprint) {
      throw new Error("LAB guard: delete requires expectedFingerprint.");
    }
    return;
  }

  // sync_all: write only eight known domains; never allow opaque extra actions.
  var permittedKeys = ["action", "token", "protocolVersion", "expectedRecords"].concat(Object.keys(CSK_LAB_WRITE_KEYS_));
  Object.keys(payload).forEach(function(k) {
    if (permittedKeys.indexOf(k) === -1) {
      throw new Error("LAB guard: unknown sync payload key.");
    }
  });
  var expectedRecords = payload.expectedRecords;
  if (!expectedRecords || typeof expectedRecords !== "object" || Array.isArray(expectedRecords)) {
    throw new Error("LAB guard: expectedRecords is required.");
  }
  var records = 0;
  Object.keys(CSK_LAB_WRITE_KEYS_).forEach(function(area) {
    if (!(area in payload)) return;
    var rows = payload[area];
    if (!Array.isArray(rows)) {
      throw new Error("LAB guard: " + area + " must be an array.");
    }
    var versions = expectedRecords[CSK_LAB_WRITE_KEYS_[area]];
    if (rows.length && (!versions || typeof versions !== "object" || Array.isArray(versions))) {
      throw new Error("LAB guard: expected version map missing for " + area + ".");
    }
    rows.forEach(function(row) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error("LAB guard: record format invalid.");
      }
      cskLabGuardDummyId_(row.id);
      var recordId = String(row.id);
      if (!Object.prototype.hasOwnProperty.call(versions, recordId)) {
        throw new Error("LAB guard: expected version missing for " + recordId + ".");
      }
      var expected = versions[recordId];
      if (expected !== null && (typeof expected !== "string" || !expected)) {
        throw new Error("LAB guard: expected version format invalid.");
      }
      if (area === "leads") {
        var status = String(row.status || "").toLowerCase().replace(/[\s_-]/g, "");
        if (status === "won" || status === "dealmenang" || status === "dealwin") {
          // Avoid automatic Finance/Projects entries in autoTriggerPillars.
          throw new Error("LAB guard: won leads are forbidden.");
        }
      }
      records++;
    });
  });
  if (records < 1 || records > 40) {
    throw new Error("LAB guard: expected 1-40 dummy records.");
  }
}


/**
 * Manual LAB-only negative tests. Non-mutating:
 * calls the request GUARD directly, never doPost or MailApp.
 * Rejected actions are simulated without invoking backend handlers.
 */
function cskLabRunGuardNegativeTests() {
  var ss = cskLabGuardRead_();
  var token = getApiToken();
  var beforeRows = {};
  var areas = Object.keys(CSK_LAB_WRITE_KEYS_);
  areas.forEach(function (area) {
    var name = CSK_LAB_WRITE_KEYS_[area];
    beforeRows[name] = ss.getSheetByName(name).getLastRow();
  });

  // Accepted request shapes are validated, but never submitted.
  cskLabGuardPost_({
    action: "sync_all", token: token, protocolVersion: 2,
    expectedRecords: {Leads: {"QA-LAB-GUARD-PASS": null}},
    leads: [{
      id: "QA-LAB-GUARD-PASS", date: "2026-10-31",
      name: "LAB GUARD DRY RUN", status: "new"
    }]
  });
  cskLabGuardPost_({
    action: "delete", token: token, protocolVersion: 2,
    sheet: "Leads", id: "QA-LAB-GUARD-PASS", expectedFingerprint: "LAB-TEST-FINGERPRINT"
  });

  var forbidden = [
    { action: "send_email", protocolVersion: 2, token: token },
    { action: "update_status", protocolVersion: 2, token: token, id: "TEST-LEAD-001" },
    { action: "insert", protocolVersion: 2, token: token, sheet: "Leads" },
    { action: "sync_all", protocolVersion: 2, token: "",
      expectedRecords: {Leads: {"QA-LAB-INVALID-TOKEN": null}},
      leads: [{id:"QA-LAB-INVALID-TOKEN", status:"new"}] },
    { action: "sync_all", protocolVersion: 2, token: token,
      expectedRecords: {Leads: {"REAL-CLIENT-123": null}},
      leads: [{id:"REAL-CLIENT-123", status:"new"}] },
    { action: "sync_all", protocolVersion: 2, token: token,
      expectedRecords: {Leads: {"QA-LAB-FORBIDDEN-WON": null}},
      leads: [{id:"QA-LAB-FORBIDDEN-WON", status:"won"}] },
    { action: "sync_all", protocolVersion: 2, token: token,
      expectedRecords: {Leads: {"QA-LAB-FORBIDDEN-DEAL": null}},
      leads: [{id:"QA-LAB-FORBIDDEN-DEAL", status:"Deal Menang"}] },
    { action: "sync_all", protocolVersion: 2, token: token,
      expectedRecords: {Leads: {"QA-LAB-FORBIDDEN-HYPHEN": null}},
      leads: [{id:"QA-LAB-FORBIDDEN-HYPHEN", status:"deal-menang"}] },
    { action: "sync_all", protocolVersion: 2, token: token,
      expectedRecords: {Leads: {"QA-LAB-FORBIDDEN-WIN": null}},
      leads: [{id:"QA-LAB-FORBIDDEN-WIN", status:"dealwin"}] },
    { action: "sync_all", protocolVersion: 2, token: token,
      expectedRecords: {Leads: {"QA-LAB-OK": null}},
      leads: [{id:"QA-LAB-OK", status:"new"}], extra: "not_allowed" },
    { action: "delete", protocolVersion: 2, token: token, sheet:"Unknown",
      id: "QA-LAB-OK", expectedFingerprint: "LAB-TEST-FINGERPRINT" },
    { action: "delete", protocolVersion: 2, token: token, sheet:"Leads",
      id: "REAL-CLIENT-123", expectedFingerprint: "LAB-TEST-FINGERPRINT" },
    { action: "delete", protocolVersion: 2, token: token, sheet:"Leads",
      id: "QA-LAB-OK", expectedFingerprint: "LAB-TEST-FINGERPRINT", extra: "not_allowed" },
    { action: "sync_all", protocolVersion: 2, token: token, expectedRecords: {}, leads: [] },
    { action: "sync_all", protocolVersion: 2, token: token,
      expectedRecords: {Leads: {"QA-LAB-OTHER-BASELINE": null}},
      leads: [{id:"QA-LAB-MISSING-VERSION", status:"new"}] },
    { action: "sync_all", protocolVersion: 2, token: token,
      leads: [{id:"QA-LAB-MISSING-EXPECTED", status:"new"}] },
    { action: "sync_all", protocolVersion: 2, token: token,
      expectedRecords: {Leads: {}},
      leads: [{id:"QA-LAB-EXPECTED-ID-MISSING", status:"new"}] },
    { action: "delete", protocolVersion: 2, token: token,
      sheet:"Leads", id:"QA-LAB-DELETE-NO-VERSION" }
  ];
  var blocked = 0;
  forbidden.forEach(function (payload, index) {
    var denied = false;
    try {
      // No network, email or sheet mutations are made in this test.
      cskLabGuardPost_(payload);
    } catch (err) {
      denied = true;
    }
    if (!denied) {
      throw new Error("LAB GUARD GAGAL: kasus berbahaya tidak ditolak #" +
        (index + 1));
    }
    blocked++;
  });
  areas.forEach(function (area) {
    var name = CSK_LAB_WRITE_KEYS_[area];
    if (ss.getSheetByName(name).getLastRow() !== beforeRows[name]) {
      throw new Error("LAB GUARD GAGAL: jumlah baris berubah pada " + name);
    }
  });
  var result = {
    status: "LAB_GUARD_PASS",
    labIdVerified: ss.getId() === CSK_LAB_SHEET_ID,
    blockedUnsafeRequests: blocked,
    databaseWritesPerformed: 0,
    emailSendsPerformed: 0
  };
  Logger.log(JSON.stringify(result));
  return result;
}
// ===== END apps-script/LabRequestGuard.gs =====

// ===== BEGIN apps-script/LabSelfTest.gs =====
/**
 * CSK BUSINESS OS — LAB ONLY integration smoke test.
 * Paste this file only into the container-bound Apps Script project for
 * "TEST ONLY - CSK BUSINESS OS - DATA DUMMY - JANGAN PAKAI PRODUKSI".
 *
 * This file MUST NOT be deployed or copied into the production script.
 * No web app is created. No email is sent. No production data is accessed.
 */
var CSK_LAB_SHEET_ID = "19le34ltpZCMIHmjw2n_JbEvrtZBWNTKd61U-xEAoR5Y";
var CSK_LAB_TABLES = [
  "Leads", "Clients", "Projects", "Finance", "Memory", "Marketing_Spend",
  "Costings", "Project_Costs"
];

function cskLabRequireDummySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId() !== CSK_LAB_SHEET_ID) {
    throw new Error("DIBATALKAN: Bukan spreadsheet LAB CSK yang benar.");
  }
  var title = ss.getName();
  if (title.indexOf("TEST ONLY - CSK BUSINESS OS") !== 0) {
    throw new Error("DIBATALKAN: nama database uji tidak cocok.");
  }
  CSK_LAB_TABLES.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error("DIBATALKAN: tab LAB tidak ada: " + name);
    var lastRow = sheet.getLastRow();
    if (lastRow === 0) throw new Error("DIBATALKAN: tab tanpa header: " + name);
    if (lastRow > 1) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      ids.forEach(function (r) {
        var id = String(r[0] == null ? "" : r[0]).trim();
        if (id && id.indexOf("TEST-") !== 0 &&
            id.indexOf("QA-LAB-") !== 0) {
          throw new Error("DIBATALKAN: ID bukan dummy pada " + name + ".");
        }
      });
    }
  });
  // Sync_all calls autoTriggerPillars; refuse to run if ANY won leads exist.
  var leads = typeof readSheetData === "function"
    ? readSheetData(ss, "Leads") : [];
  if (leads.some(function (l) {
    var status = String(l.status || "").toLowerCase().replace(/[\s_-]/g, "");
    return status === "won" || status === "dealmenang" || status === "dealwin";
  })) {
    throw new Error("DIBATALKAN: ada Lead WON di LAB. Tidak aman untuk tes.");
  }
  return ss;
}

/** Read-only preflight; never prints or changes an API token. */
function cskLabCheckReadiness() {
  var ss = cskLabRequireDummySheet_();
  if (typeof doGet !== "function" || typeof doPost !== "function" ||
      typeof getApiToken !== "function" ||
      typeof isAuthorized !== "function" ||
      typeof findRowById !== "function") {
    throw new Error("Handler backend wajib tidak ditemukan di Code.gs.");
  }
  var tokens = getApiTokens();
  var ownerSecure = !!tokens.owner && tokens.owner.length >= 20 &&
    tokens.owner !== "GANTI-DENGAN-TOKEN-RAHASIA-ANDA";
  var teamSecure = !!tokens.team && tokens.team.length >= 20 &&
    tokens.team !== "GANTI-DENGAN-TOKEN-RAHASIA-ANDA";
  var status = {
    labIdVerified: ss.getId() === CSK_LAB_SHEET_ID,
    backendPresent: true,
    apiTokenConfigured: ownerSecure,
    ownerApiTokenConfigured: ownerSecure,
    teamApiTokenConfigured: teamSecure,
    externalWebAppRequired: false
  };
  Logger.log(JSON.stringify(status));
  return status;
}

/** Strong random LAB token, generated and stored ONLY in LAB Script Properties. */
function cskLabEnsurePrivateToken_() {
  cskLabRequireDummySheet_();
  var tokens = getApiTokens();
  var ownerReady = !!tokens.owner && tokens.owner.length >= 20;
  var teamReady = !!tokens.team && tokens.team.length >= 20;
  if (ownerReady && teamReady) {
    return { created: false, configured: true, rolesConfigured: 2 };
  }
  // Generate separate random Owner and Team credentials in LAB Script Properties.
  // setupApiTokens() never logs either secret and removes the legacy shared token.
  setupApiTokens();
  tokens = getApiTokens();
  if (!tokens.owner || tokens.owner.length < 20 || !tokens.team || tokens.team.length < 20) {
    throw new Error("DIBATALKAN: token Owner/Tim LAB belum berhasil dibuat.");
  }
  return { created: true, configured: true, rolesConfigured: 2 };
}

function cskLabParseOutput_(output) {
  if (!output || typeof output.getContent !== "function") {
    throw new Error("Apps Script tidak mengembalikan respons TextOutput.");
  }
  var value = JSON.parse(output.getContent());
  if (value.status !== "success") {
    throw new Error("API LAB menolak request: " + (value.message || "unknown"));
  }
  return value;
}

/**
 * Runs real doGet/doPost against TEST-ONLY spreadsheet, then cleans up.
 * - Ensure LAB-bound spreadsheet + all IDs dummy.
 * - Generate secret Script Property on LAB ONLY if needed.
 * - Reject unauthenticated requests.
 * - Insert, read back, update, read back, delete, read back.
 * - Finally cleanup a single QA-LAB- temporary ID even after an exception.
 * No deployment and no real client data.
 */
function cskLabRunIsolatedSmokeTest() {
  var ss = cskLabRequireDummySheet_();
  cskLabCheckReadiness();
  var tokenResult = cskLabEnsurePrivateToken_();
  var tokens = getApiTokens();
  var token = tokens.owner;
  var teamToken = tokens.team;
  if (!token || !teamToken || token === teamToken ||
      !isAuthorized({token:token}) || !isAuthorized({token:teamToken}) ||
      isAuthorized({token:""}) || isAuthorized({token:"INVALID-TEST-TOKEN"})) {
    throw new Error("DIBATALKAN: autentikasi API LAB Owner/Tim belum aman.");
  }

  // The complete view must be denied without a valid API token.
  var denied = JSON.parse(doGet({ parameter: { protocolVersion: 2 } }).getContent());
  if (denied.status !== "error") {
    throw new Error("DIBATALKAN: doGet tanpa token masih dapat membaca data.");
  }

  // Team read must never include private business modules.
  var teamRead = JSON.parse(doGet({
    parameter: {token:teamToken, protocolVersion:2}
  }).getContent());
  var privateAreas = ["finance","memory","marketingSpend","costings","projectCosts"];
  if (teamRead.status !== "success" || !teamRead.data || teamRead.data.role !== "team") {
    throw new Error("DIBATALKAN: role Team tidak diverifikasi oleh backend.");
  }
  privateAreas.forEach(function(area) {
    if (!Array.isArray(teamRead.data[area]) || teamRead.data[area].length !== 0) {
      throw new Error("DIBATALKAN: Team menerima data privat " + area + ".");
    }
  });
  if (getRequestRole({token:teamToken,role:"owner"}) !== "team") {
    throw new Error("DIBATALKAN: payload role browser dapat menaikkan hak akses.");
  }

  var id = "QA-LAB-" + new Date().getTime() + "-" +
    Utilities.getUuid().slice(0, 8);
  var first = {
    id: id, date: Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd"),
    name: "QA LAB GENERATED - BUAT", phone: "000000000",
    source: "QA LAB", value: 100, status: "new",
    notes: "SIMULASI - AUTO DELETE AFTER TEST",
    email: "", website: "", industry: "", pic: "",
    picTitle: "", linkedin: "", score: 0
  };
  var done = {inserted:false, updated:false, deleted:false, verified:false};
  var firstVersions = {}; firstVersions[id] = null;
  try {
    cskLabParseOutput_(doPost({
      postData: { contents: JSON.stringify({
        action: "sync_all", token: token, protocolVersion: 2,
        expectedRecords: {Leads: firstVersions}, leads: [first]
      }) }
    }));
    var afterInsert = cskLabParseOutput_(doGet({
      parameter: {token:token, protocolVersion:2}
    })).data.leads.filter(function (r) { return String(r.id) === id; });
    if (afterInsert.length !== 1 || afterInsert[0].name !== first.name) {
      throw new Error("Readback gagal setelah INSERT.");
    }
    done.inserted = true;

    var updated = {};
    Object.keys(first).forEach(function (key) { updated[key] = first[key]; });
    updated.name = "QA LAB GENERATED - DIPERBARUI";
    updated.notes = "QA LAB UPDATE TEST";
    var updateVersions = {}; updateVersions[id] = stableRecordFingerprint_(afterInsert[0]);
    cskLabParseOutput_(doPost({
      postData: { contents: JSON.stringify({
        action: "sync_all", token: token, protocolVersion: 2,
        expectedRecords: {Leads: updateVersions}, leads: [updated]
      }) }
    }));
    var afterUpdate = cskLabParseOutput_(doGet({
      parameter: {token:token, protocolVersion:2}
    })).data.leads.filter(function (r) { return String(r.id) === id; });
    if (afterUpdate.length !== 1 ||
        afterUpdate[0].name !== updated.name) {
      throw new Error("Readback gagal setelah UPDATE.");
    }
    done.updated = true;

    cskLabParseOutput_(doPost({
      postData: { contents: JSON.stringify({
        action: "delete", token: token, protocolVersion: 2, sheet: "Leads", id: id,
        expectedFingerprint: stableRecordFingerprint_(afterUpdate[0])
      }) }
    }));
    var afterDelete = cskLabParseOutput_(doGet({
      parameter: {token:token, protocolVersion:2}
    })).data.leads.filter(function (r) { return String(r.id) === id; });
    if (afterDelete.length) {
      throw new Error("Readback gagal setelah DELETE.");
    }
    done.deleted = true;
    done.verified = true;
    Logger.log(JSON.stringify({
      status:"LAB_TEST_PASS", labSheet:CSK_LAB_SHEET_ID,
      authenticationRequired:true, ownerAndTeamTokensConfigured:true,
      teamPrivateReadFiltered:true, tokenCreated:tokenResult.created,
      test:done
    }));
    return done;
  } finally {
    // Cleanup ONLY the newly-generated dummy ID in THIS verified LAB sheet.
    // Never delete any TEST- leads already present before the test.
    var labSheet = ss.getSheetByName("Leads");
    var rowToRemove = findRowById(labSheet, id);
    if (rowToRemove > 1) labSheet.deleteRow(rowToRemove);
  }
}


/**
 * Non-mutating Owner/Team isolation test against the actual guarded LAB handlers.
 * It checks Team read filtering and rejects Team writes/deletes to private sheets.
 */
function cskLabRunRoleIsolationTests() {
  var ss = cskLabRequireDummySheet_();
  var tokens = getApiTokens();
  if (!tokens.owner || !tokens.team || tokens.owner === tokens.team) {
    throw new Error("LAB_ROLE_TEST_FAIL: separate Owner/Team tokens are required.");
  }
  var privateSheets = ["Finance","Memory","Marketing_Spend","Costings","Project_Costs"];
  var beforeRows = {};
  privateSheets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error("LAB_ROLE_TEST_FAIL: missing sheet " + name);
    beforeRows[name] = sheet.getLastRow();
  });

  var ownerRead = JSON.parse(doGet({
    parameter:{token:tokens.owner,protocolVersion:2}
  }).getContent());
  if (ownerRead.status !== "success" || ownerRead.data.role !== "owner") {
    throw new Error("LAB_ROLE_TEST_FAIL: Owner read was not authorized.");
  }

  var teamRead = JSON.parse(doGet({
    parameter:{token:tokens.team,protocolVersion:2}
  }).getContent());
  if (teamRead.status !== "success" || teamRead.data.role !== "team") {
    throw new Error("LAB_ROLE_TEST_FAIL: Team read was not authorized.");
  }
  privateSheets.forEach(function(name) {
    var area = ({
      Finance:"finance", Memory:"memory", Marketing_Spend:"marketingSpend",
      Costings:"costings", Project_Costs:"projectCosts"
    })[name];
    if (!Array.isArray(teamRead.data[area]) || teamRead.data[area].length !== 0) {
      throw new Error("LAB_ROLE_TEST_FAIL: Team read exposed " + name + ".");
    }
  });

  var financeId = "QA-LAB-ROLE-DENY-FINANCE";
  var financeSync = JSON.parse(doPost({postData:{contents:JSON.stringify({
    action:"sync_all",token:tokens.team,protocolVersion:2,
    expectedRecords:{Finance:{}},
    finance:[{id:financeId,date:"2026-11-03",type:"income",category:"LAB",amount:1,description:"MUST NOT WRITE"}]
  })}}).getContent());
  if (financeSync.status === "success") {
    throw new Error("LAB_ROLE_TEST_FAIL: Team sync_all wrote Finance.");
  }

  var costId = "QA-LAB-ROLE-DENY-COSTING";
  var costingSync = JSON.parse(doPost({postData:{contents:JSON.stringify({
    action:"sync_all",token:tokens.team,protocolVersion:2,
    expectedRecords:{Costings:{}},
    costings:[{id:costId,client:"LAB",title:"MUST NOT WRITE",hpp:1}]
  })}}).getContent());
  if (costingSync.status === "success") {
    throw new Error("LAB_ROLE_TEST_FAIL: Team sync_all wrote Costings.");
  }

  var financeDelete = JSON.parse(doPost({postData:{contents:JSON.stringify({
    action:"delete",token:tokens.team,protocolVersion:2,
    sheet:"Finance",id:"QA-LAB-ROLE-DENY-DELETE",
    expectedFingerprint:"LAB-NEGATIVE-TEST-FINGERPRINT"
  })}}).getContent());
  if (financeDelete.status === "success") {
    throw new Error("LAB_ROLE_TEST_FAIL: Team deleted Finance.");
  }

  privateSheets.forEach(function(name) {
    if (ss.getSheetByName(name).getLastRow() !== beforeRows[name]) {
      throw new Error("LAB_ROLE_TEST_FAIL: private sheet row count changed: " + name);
    }
  });

  var result = {
    status:"LAB_ROLE_ISOLATION_PASS",
    labIdVerified:ss.getId() === CSK_LAB_SHEET_ID,
    ownerReadAllowed:true,
    teamReadAllowed:true,
    teamPrivateAreasFiltered:privateSheets.length,
    teamFinanceWriteRejected:true,
    teamCostingsWriteRejected:true,
    teamFinanceDeleteRejected:true,
    privateSheetRowsUnchanged:true
  };
  Logger.log(JSON.stringify(result));
  return result;
}
// ===== END apps-script/LabSelfTest.gs =====

// ===== BEGIN apps-script/LabHandlerVerification.gs =====
/**
 * CSK Business OS — LAB ONLY: safe handler integration check.
 * Non-mutating real doPost rejection test; no email actions and no writes.
 * DO NOT use in production Apps Script.
 */
function cskLabVerifyActiveHandlers() {
  var ss = cskLabGuardRead_();
  // Check the actual functions compiled in this Apps Script project,
  // not merely that the helper functions are defined.
  var getCode = String(doGet);
  var postCode = String(doPost);
  var readWired = getCode.indexOf("cskLabGuardRead_()") !== -1;
  var postWired = postCode.indexOf("cskLabGuardPost_(payload)") !== -1;

  if (!readWired || !postWired) {
    throw new Error(
      "LAB_HANDLER_GUARD_FAIL: doGet/doPost belum memanggil guard di Code.gs."
    );
  }

  var token = getApiToken();
  if (!token || token.length < 20) {
    throw new Error("LAB_HANDLER_GUARD_FAIL: token LAB belum siap.");
  }

  var table = ss.getSheetByName("Leads");
  var impossibleId = "GUARD-NEGATIVE-NOT-DUMMY";
  // Strictly ensure an unguarded backend would not delete anything.
  if (findRowById(table, impossibleId) !== -1) {
    throw new Error("LAB_HANDLER_GUARD_FAIL: sentinel ID ternyata ada.");
  }
  var beforeRows = table.getLastRow();

  var body = {
    action: "delete",
    token: token,
    protocolVersion: 2,
    sheet: "Leads",
    id: impossibleId
  };
  // IMPORTANT: only a delete for a verified NON-EXISTENT ID is used here.
  // Even if the guard were not active, the backend would make no changes.
  var output = doPost({ postData: { contents: JSON.stringify(body) } });
  var parsed = JSON.parse(output.getContent());

  var rejectedByLabGuard =
    parsed.status === "error" &&
    String(parsed.message || "").indexOf("LAB guard:") !== -1;
  if (!rejectedByLabGuard) {
    throw new Error(
      "LAB_HANDLER_GUARD_FAIL: doPost tidak menolak ID terlarang. " +
      "status=" + String(parsed.status || "unknown")
    );
  }

  if (table.getLastRow() !== beforeRows ||
      findRowById(table, impossibleId) !== -1) {
    throw new Error("LAB_HANDLER_GUARD_FAIL: data Leads berubah.");
  }

  var result = {
    status: "LAB_HANDLER_GUARD_PASS",
    labIdVerified: ss.getId() === CSK_LAB_SHEET_ID,
    guardReadWired: readWired,
    guardPostWired: postWired,
    unsafeDeleteRejectedByLiveHandler: true,
    leadRowCountUnchanged: true,
    externalHttpRequests: 0,
    emailSends: 0
  };
  Logger.log(JSON.stringify(result));
  return result;
}
// ===== END apps-script/LabHandlerVerification.gs =====
