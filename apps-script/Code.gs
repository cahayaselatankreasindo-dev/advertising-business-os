/**
 * CSK BUSINESS OS — APPS SCRIPT LAB BACKEND (TEST ONLY).
 *
 * This file is ONLY for the spreadsheet:
 * TEST ONLY - CSK BUSINESS OS - DATA DUMMY - JANGAN PAKAI PRODUKSI
 *
 * Requires LabSelfTest.gs, LabRequestGuard.gs and LabHandlerVerification.gs.
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

  // Normalisasi header, deduplikasi, dan migrasi kolom kontrak dalam satu pass.
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
  if (!map) return [];
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(map.headers);
    sheet.getRange(1, 1, 1, map.headers.length)
      .setFontWeight("bold").setBackground("#1C2333").setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
    return map.headers.slice();
  }

  var lastCol = sheet.getLastColumn();
  var headerRow = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    : [];
  var seen = Object.create(null);
  var keepCols = [];

  headerRow.forEach(function (h, i) {
    var key = String(h).trim().toLowerCase();
    if (key === "" || Object.prototype.hasOwnProperty.call(seen, key)) return;
    seen[key] = true;
    keepCols.push(i);
  });

  // Deduplicate/compact headers and their data in one pass.
  if (keepCols.length !== lastCol) {
    var data = sheet.getDataRange().getValues();
    var newRows = data.map(function (row) {
      return keepCols.map(function (index) { return row[index]; });
    });
    sheet.clear();
    if (newRows.length && newRows[0].length) {
      sheet.getRange(1, 1, newRows.length, newRows[0].length).setValues(newRows);
      sheet.getRange(1, 1, 1, newRows[0].length)
        .setFontWeight("bold").setBackground("#1C2333").setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }
    headerRow = newRows[0] || [];
  }

  var current = headerRow.map(function (h) { return String(h).trim().toLowerCase(); });
  map.headers.forEach(function (h) {
    if (current.indexOf(h.toLowerCase()) === -1) {
      var col = headerRow.length + 1;
      sheet.getRange(1, col).setValue(h);
      sheet.getRange(1, col)
        .setFontWeight("bold")
        .setBackground("#1C2333")
        .setFontColor("#FFFFFF");
      headerRow.push(h);
      current.push(h.toLowerCase());
    }
  });
  return headerRow.map(function (h) { return String(h).trim(); });
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
      if (Object.prototype.hasOwnProperty.call(seenIds, id)) {
        // Preserve legacy idempotent behavior for exact duplicate payload rows,
        // but reject ambiguous duplicates that disagree about the desired record.
        if (stableRecordFingerprint_(seenIds[id]) !== stableRecordFingerprint_(item)) {
          missing.push(sheetName + "/" + id + " duplikat berbeda");
        }
        return;
      }
      seenIds[id] = item;
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

function validateExpectedUpdate_(ss, sheetName, id, expectedFingerprint) {
  if (typeof expectedFingerprint !== "string" || !expectedFingerprint) {
    return { ok: false, code: "EXPECTED_VERSION_REQUIRED",
      message: "Pembaruan status ditolak: expectedFingerprint wajib dikirim." };
  }
  var current = findRecordById_(ss, sheetName, id);
  if (!current || stableRecordFingerprint_(current) !== expectedFingerprint) {
    return { ok: false, code: "SYNC_CONFLICT",
      message: "Record berubah atau sudah dihapus oleh perangkat lain. Tidak ada data yang diubah.",
      conflicts: [sheetName + "/" + String(id)] };
  }
  return { ok: true, record: current };
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
        var allowedInsertKeys = ["action", "token", "protocolVersion", "sheet", "data", "expectedAbsent"];
        var unknownInsertKeys = Object.keys(payload).filter(function (key) {
          return allowedInsertKeys.indexOf(key) === -1;
        });
        if (unknownInsertKeys.length) return jsonResponse({
          status: "error", code: "INVALID_PAYLOAD", protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: "Field insert tidak dikenal: " + unknownInsertKeys.join(", ")
        });
        const sheetName = payload.sheet;
        const data = payload.data || {};
        if (!sheetName || !data.id) {
          throw new Error("Parameter sheet dan data.id diperlukan untuk aksi insert.");
        }
        if (!FIELD_MAP[sheetName]) return jsonResponse({
          status: "error", code: "INVALID_SHEET", protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: "Insert hanya diizinkan untuk tab Business OS yang terdaftar."
        });
        if (!isSheetAllowedForRole_(role, sheetName)) return forbiddenResponse("Role " + role + " tidak boleh menambahkan data " + sheetName + ".");
        if (payload.expectedAbsent !== true) return jsonResponse({
          status: "error", code: "EXPECTED_VERSION_REQUIRED", protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: "Insert ditolak: expectedAbsent:true wajib dikirim."
        });
        if (findRecordById_(ss, sheetName, data.id)) return jsonResponse({
          status: "error", code: "SYNC_CONFLICT", protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: "ID sudah ada. Tidak ada baris yang ditambahkan.",
          conflicts: [sheetName + "/" + String(data.id)]
        });
        ensureSheet(ss, sheetName, FIELD_MAP[sheetName].headers);
        insertRecord(ss, sheetName, data);
        return jsonResponse({ status: "success", protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: "Baris berhasil disisipkan di " + sheetName, id: data.id });
      }

      case "update_status": {
        var allowedUpdateKeys = ["action", "token", "protocolVersion", "sheet", "id", "status", "expectedFingerprint"];
        var unknownUpdateKeys = Object.keys(payload).filter(function (key) {
          return allowedUpdateKeys.indexOf(key) === -1;
        });
        if (unknownUpdateKeys.length) return jsonResponse({
          status: "error", code: "INVALID_PAYLOAD", protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: "Field update_status tidak dikenal: " + unknownUpdateKeys.join(", ")
        });
        const sheetName = payload.sheet || "Leads";
        const id = payload.id;
        const status = payload.status;
        if (!isSheetAllowedForRole_(role, sheetName)) return forbiddenResponse("Role " + role + " tidak boleh mengubah data " + sheetName + ".");
        if (["Leads", "Projects"].indexOf(sheetName) === -1) return jsonResponse({
          status: "error", code: "INVALID_SHEET", protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: "update_status hanya diizinkan untuk Leads dan Projects."
        });
        if (!id || !status) throw new Error("Parameter id dan status diperlukan.");
        var updateCheck = validateExpectedUpdate_(ss, sheetName, id, payload.expectedFingerprint);
        if (!updateCheck.ok) return jsonResponse({
          status: "error", code: updateCheck.code, protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: updateCheck.message, conflicts: updateCheck.conflicts || []
        });
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) throw new Error("Tab '" + sheetName + "' tidak ditemukan.");
        const rowNum = findRowById(sheet, id);
        if (rowNum === -1) throw new Error("Baris dengan ID " + id + " tidak ditemukan di " + sheetName);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        let statusCol = headers.findIndex(h => String(h).toLowerCase() === "status");
        if (statusCol === -1) statusCol = 6;
        sheet.getRange(rowNum, statusCol + 1).setValue(status);
        // Only an Owner can trigger project automation; Team status changes remain data-only.
        if (role === "owner" && sheetName === "Leads" && isDealMenang(status)) {
          autoTriggerPillars(ss, id);
        }
        return jsonResponse({ status: "success", protocolVersion: CSK_API_PROTOCOL_VERSION,
          message: "Status diperbarui di " + sheetName, row: rowNum });
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
  const s = String(status || "").toLowerCase().replace(/[\s_-]/g, "");
  return s === "won" || s === "dealmenang" || s === "dealwin";
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

  items = items || [];
  var result = { inserted: 0, updated: 0, skipped: 0, total: items.length };
  if (items.length === 0) return result;

  // Normalize headers once and reuse the returned header row for mapping.
  var headerRow = map
    ? ensureAllHeaders(ss, sheetName)
    : sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        .map(function (h) { return String(h).trim(); });
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  // One full data read supplies both the ID index and update comparison rows.
  var dataRange = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()
    : [];
  var idToRow = Object.create(null);
  for (var i = 0; i < dataRange.length; i++) {
    var key = String(dataRange[i][0]).trim();
    if (key !== "") idToRow[key] = i + 2;
  }

  var contractPos = Object.create(null);
  if (map) {
    map.headers.forEach(function (h, i) {
      contractPos[String(h).trim().toLowerCase()] = i;
    });
  }

  function buildRow(item) {
    if (!map) {
      return headerRow.map(function (h) {
        return item[String(h).trim().toLowerCase()] === undefined
          ? "" : item[String(h).trim().toLowerCase()];
      });
    }
    var contractRow = recordToRow(sheetName, item);
    return headerRow.map(function (h) {
      var pos = contractPos[String(h).trim().toLowerCase()];
      return pos === undefined ? "" : contractRow[pos];
    });
  }

  var rowsToUpdate = [];
  var rowsToAppend = [];
  var seenPayloadIds = Object.create(null);

  items.forEach(function (item) {
    var id = String(item && item.id !== undefined && item.id !== null ? item.id : "").trim();
    if (id === "") { result.skipped++; return; }
    if (Object.prototype.hasOwnProperty.call(seenPayloadIds, id)) {
      result.skipped++;
      return;
    }
    seenPayloadIds[id] = true;

    var newRow = buildRow(item);
    if (Object.prototype.hasOwnProperty.call(idToRow, id)) {
      var rowIdx = idToRow[id] - 2;
      var oldRow = dataRange[rowIdx] || [];
      var changed = false;
      for (var c = 0; c < newRow.length; c++) {
        if (String(oldRow[c]) !== String(newRow[c])) { changed = true; break; }
      }
      if (changed) {
        rowsToUpdate.push({ row: idToRow[id], values: newRow });
        result.updated++;
      } else {
        result.skipped++;
      }
    } else {
      rowsToAppend.push(newRow);
      result.inserted++;
    }
  });

  // Coalesce adjacent row updates into a single Sheets write per contiguous range.
  rowsToUpdate.sort(function (a, b) { return a.row - b.row; });
  for (var u = 0; u < rowsToUpdate.length;) {
    var startRow = rowsToUpdate[u].row;
    var groupedRows = [rowsToUpdate[u].values];
    var next = u + 1;
    while (next < rowsToUpdate.length &&
        rowsToUpdate[next].row === startRow + groupedRows.length) {
      groupedRows.push(rowsToUpdate[next].values);
      next++;
    }
    sheet.getRange(startRow, 1, groupedRows.length, headerRow.length).setValues(groupedRows);
    u = next;
  }

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
