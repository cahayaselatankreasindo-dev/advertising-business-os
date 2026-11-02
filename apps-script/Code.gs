/**
 * =====================================================================
 * CSK BUSINESS OS - GOOGLE APPS SCRIPT BACKEND
 * =====================================================================
 * Skrip ini berfungsi sebagai jembatan (API) gratis untuk menghubungkan
 * aplikasi Advertising Business OS di HP/Laptop Anda ke Google Sheets.
 *
 * STRUKTUR DATABASE — 5 PILAR BISNIS TERPADU:
 * 1. Leads          -> Pilar CRM (Leads & Prospek)
 * 2. Finance        -> Pilar Jurnal Keuangan (Pendapatan & Pengeluaran)
 * 3. Projects       -> Pilar Produksi (Proyek & Antrean Kerja)
 *    + kolom SOP_Checklist otomatis ditambahkan
 * 4. Clients        -> Pilar Product-Market Fit (Rating & Review Klien)
 *    + kolom Rating_Review otomatis ditambahkan
 * 5. Marketing_Spend-> Pilar Pemasaran (Biaya & Performa Iklan) — TAB BARU
 *
 * OTOMATISASI PILLAR (autoTriggerPillars):
 * - Dipicu setelah sync_all atau update_status 'won'/'Deal Menang'
 * - Membuat/menautkan Client dan antrean Project secara idempoten
 * - Tidak membuat transaksi Finance; pendapatan hanya dicatat setelah pembayaran diterima
 *
 * CARA PEMASANGAN (HANYA 2 MENIT):
 * 1. Buat Google Spreadsheet baru di Google Drive Anda (Beri nama: "Database CSK Business OS").
 * 2. Klik menu "Extensions" (Ekstensi) -> "Apps Script".
 * 3. Hapus semua kode yang ada di editor Apps Script, lalu PASTE seluruh kode ini.
 * 4. Klik tombol simpan (ikon disket / Ctrl+S).
 * 5. Jalankan fungsi "setupSheet" sekali dengan memilih "setupSheet" di dropdown atas, lalu klik "Run".
 *    (Berikan izin akses akun Google Anda jika diminta).
 * 6. Klik tombol "Deploy" (Terapkan) di kanan atas -> "New deployment" (Penerapan baru).
 * 7. Pilih tipe: "Web app" (Aplikasi Web).
 * 8. Konfigurasi:
 *    - Description: "CSK OS API"
 *    - Execute as: "Me" (Email Google Anda)
 *    - Who has access: "Anyone" (Siapa saja)
 * 9. Klik "Deploy", lalu SALIN URL Web App yang dihasilkan.
 * 10. Buka aplikasi CSK Business OS -> Menu Settings -> Tempelkan URL tersebut ke kolom "Google Sheets Web App URL".
 * 11. (Opsional) Pasang trigger otomatis: jalankan fungsi "installAutoTrigger" sekali agar
 *     autoTriggerPillars juga berjalan saat Anda mengedit status langsung di Sheets.
 * =====================================================================
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
    headers: ["ID", "Tanggal", "Tipe", "Kategori", "Nominal", "Keterangan"],
    fields:  ["id", "date", "type", "category", "amount", "description"]
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

  // Tab Commercial Engine dan Project Cost Ledger — tab lama tidak diubah.
  ensureSheet(ss, "Costings", FIELD_MAP.Costings.headers);
  ensureSheet(ss, "Project_Costs", FIELD_MAP.Project_Costs.headers);

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

// ============== KEAMANAN: TOKEN API & ROLE SERVER ==============
// Token disimpan di Script Properties, bukan di source code atau repository.
// OWNER_API_TOKEN memiliki akses penuh; TEAM_API_TOKEN hanya boleh mengakses
// Leads, Clients, dan Projects. Tidak ada akses jika token belum dikonfigurasi.
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
 * Jalankan sekali dari Apps Script Editor setelah deployment.
 * Salin kedua token dari Execution log ke perangkat Owner dan Tim masing-masing.
 * Fungsi ini merotasi token lama dan menghapus API_TOKEN legacy.
 */
function setupApiTokens() {
  var props = PropertiesService.getScriptProperties();
  var ownerToken = generateApiToken_();
  var teamToken = generateApiToken_();
  props.setProperty("OWNER_API_TOKEN", ownerToken);
  props.setProperty("TEAM_API_TOKEN", teamToken);
  props.deleteProperty("API_TOKEN");
  Logger.log("OWNER TOKEN (akses penuh): " + ownerToken);
  Logger.log("TEAM TOKEN (Leads, Clients, Projects): " + teamToken);
  return { ownerToken: ownerToken, teamToken: teamToken };
}

function setupApiToken() {
  return setupApiTokens();
}

function secureTokenEquals_(provided, expected) {
  provided = String(provided || "");
  expected = String(expected || "");
  if (!provided || !expected || provided.length !== expected.length) return false;
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
  return jsonResponse({ status: "error", message: "Tidak diizinkan: token akses tidak valid atau belum dikonfigurasi." });
}

function forbiddenResponse(message) {
  return jsonResponse({ status: "error", message: message || "Role ini tidak memiliki izin untuk operasi tersebut." });
}

// ============== SOFT DELETE / TOMBSTONE LEDGER ==============
var DELETION_LEDGER_SHEET = "_CSK_Deleted";
var DELETION_LEDGER_HEADERS = ["Sheet", "ID", "DeletedAt"];

function ensureDeletionLedger_(ss) {
  return ensureSheet(ss, DELETION_LEDGER_SHEET, DELETION_LEDGER_HEADERS);
}

function readDeletedRecords_(ss, role) {
  var sheet = ss.getSheetByName(DELETION_LEDGER_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var rows = sheet.getDataRange().getValues();
  var allowed = role === "owner" ? Object.keys(FIELD_MAP) : ["Leads", "Clients", "Projects"];
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    var sheetName = String(rows[i][0] || "").trim();
    var id = String(rows[i][1] || "").trim();
    if (!sheetName || !id || allowed.indexOf(sheetName) === -1) continue;
    result.push({ sheet: sheetName, id: id, deletedAt: rows[i][2] || "" });
  }
  return result;
}

function recordDeletedRecord_(ss, sheetName, id) {
  if (!FIELD_MAP[sheetName]) throw new Error("Tab tidak dikenal untuk penghapusan: " + sheetName);
  id = String(id === undefined || id === null ? "" : id).trim();
  if (!id) throw new Error("ID penghapusan tidak boleh kosong.");
  var ledger = ensureDeletionLedger_(ss);
  var values = ledger.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === sheetName && String(values[i][1]).trim() === id) {
      return { inserted: false, sheet: sheetName, id: id };
    }
  }
  ledger.appendRow([sheetName, id, new Date().toISOString()]);
  return { inserted: true, sheet: sheetName, id: id };
}

function getDeletedRecordSet_(ss, sheetName) {
  var records = readDeletedRecords_(ss, "owner");
  var deleted = {};
  records.forEach(function (record) {
    if (record.sheet === sheetName) deleted[String(record.id)] = true;
  });
  return deleted;
}

// ============== GET — TARIK DATA SEMUA TAB ==============

function doGet(e) {
  try {
    var tokenParam = (e && e.parameter) ? e.parameter.token : "";
    var role = getRequestRole(null, tokenParam);
    if (!role) return unauthorizedResponse();

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
      deletedRecords: readDeletedRecords_(ss, role),
      lastSynced: new Date().toISOString(),
      role: role
    };
    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: result, role: role }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============== POST — CRUD (sync_all, insert, update_status) ==============

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    var role = getRequestRole(payload);
    if (!role) return unauthorizedResponse();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (payload.action || "").toLowerCase();

    switch (action) {

      // --- sync_all (MERGE / UPSERT — tidak pernah menghapus data lama) ---
      // Aman: lead yang sudah ada di Sheets tetap tersimpan; hanya ditambah/diupdate.
      case "sync_all": {
        var mergeSummary = {};
        var deletionSummary = { inserted: 0, skipped: 0 };
        (payload.deletedRecords || []).forEach(function (record) {
          if (!record || !record.sheet || record.id === undefined || record.id === null) {
            deletionSummary.skipped++;
            return;
          }
          if (!isSheetAllowedForRole_(role, record.sheet)) {
            deletionSummary.skipped++;
            return;
          }
          var saved = recordDeletedRecord_(ss, record.sheet, record.id);
          if (saved.inserted) deletionSummary.inserted++;
          else deletionSummary.skipped++;
          var targetSheet = ss.getSheetByName(record.sheet);
          if (targetSheet) {
            var targetRow = findRowById(targetSheet, record.id);
            if (targetRow > 1) targetSheet.deleteRow(targetRow);
          }
        });
        if (payload.leads)    mergeSummary.Leads    = mergeSheet(ss, "Leads", payload.leads);
        if (payload.clients)  mergeSummary.Clients  = mergeSheet(ss, "Clients", payload.clients);
        if (payload.projects) mergeSummary.Projects = mergeSheet(ss, "Projects", payload.projects);
        if (role === "owner") {
          if (payload.finance)        mergeSummary.Finance         = mergeSheet(ss, "Finance", payload.finance);
          if (payload.memory)         mergeSummary.Memory          = mergeSheet(ss, "Memory", payload.memory);
          if (payload.marketingSpend) mergeSummary.Marketing_Spend = mergeSheet(ss, "Marketing_Spend", payload.marketingSpend);
          if (payload.costings)      mergeSummary.Costings       = mergeSheet(ss, "Costings", payload.costings);
          if (payload.projectCosts)  mergeSummary.Project_Costs  = mergeSheet(ss, "Project_Costs", payload.projectCosts);
        }
        // Otomasi hanya membuat Client/Project; tidak pernah mencatat pendapatan.
        autoTriggerPillars(ss);
        return jsonResponse({ status: "success", message: "Data di-merge sesuai hak akses; penghapusan dilindungi tombstone.", role: role, summary: mergeSummary, deletions: deletionSummary });
      }

      // --- delete: hapus 1 baris berdasarkan ID (dipakai tombol hapus di app) ---
      case "delete": {
        const sheetName = payload.sheet || "Leads";
        const delId = payload.id;
        if (!isSheetAllowedForRole_(role, sheetName)) return forbiddenResponse("Role " + role + " tidak boleh menghapus data " + sheetName + ".");
        if (!delId) throw new Error("Parameter id diperlukan untuk aksi delete.");
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) throw new Error("Tab '" + sheetName + "' tidak ditemukan.");
        // Simpan tombstone SEBELUM menghapus baris agar stale sync tidak dapat memulihkannya.
        recordDeletedRecord_(ss, sheetName, delId);
        const rowNum = findRowById(sheet, delId);
        if (rowNum === -1) {
          return jsonResponse({ status: "success", message: "Baris " + delId + " tidak ada (sudah terhapus)." });
        }
        sheet.deleteRow(rowNum);
        return jsonResponse({ status: "success", message: "Baris " + delId + " dihapus dari " + sheetName });
      }

      // --- insert: tambahkan 1 baris ke tab tertentu ---
      case "insert": {
        const sheetName = payload.sheet;
        const data = payload.data || {};
        if (!sheetName || !data.id) {
          throw new Error("Parameter sheet dan data.id diperlukan untuk aksi insert.");
        }
        if (!isSheetAllowedForRole_(role, sheetName)) return forbiddenResponse("Role " + role + " tidak boleh menambahkan data " + sheetName + ".");
        if (FIELD_MAP[sheetName] && getDeletedRecordSet_(ss, sheetName)[String(data.id)]) {
          throw new Error("ID ini sudah dihapus. Gunakan ID baru untuk membuat record baru.");
        }
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
        if (role !== "owner") return forbiddenResponse("Pengiriman email outreach hanya dapat dilakukan Owner.");
        const toEmail = (payload.toEmail || "").trim();
        const name = (payload.name || "Kak").trim();
        const brand = (payload.brand || "Brand").trim();

        if (!toEmail) throw new Error("Email tujuan tidak boleh kosong");

        // 1. Cek sisa kuota Gmail Google
        const remainingGmailQuota = MailApp.getRemainingDailyQuota();
        if (remainingGmailQuota < 5) {
          throw new Error("Sisa kuota harian Gmail akun ini hampir habis. Pengiriman ditunda demi keamanan.");
        }

        // 2. Proteksi batas harian internal CSK (Max 50 email/hari)
        const props = PropertiesService.getScriptProperties();
        const todayStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
        const lastDate = props.getProperty("COLD_EMAIL_DATE") || "";
        let countToday = parseInt(props.getProperty("COLD_EMAIL_COUNT") || "0", 10);

        if (lastDate !== todayStr) {
          countToday = 0;
          props.setProperty("COLD_EMAIL_DATE", todayStr);
        }

        if (countToday >= 50) {
          throw new Error("Batas aman harian tercapai (50/hari) untuk menjaga reputasi email. Coba lagi besok.");
        }

        // 3. Draft email dengan kalimat opt-out
        const subject = "Vendor Produksi Booth & Display POSM — Cahaya Selatan Kreasindo";
        const body = "Halo Kak " + name + " / Tim " + brand + ",\n\n" +
          "Salam kenal, saya Zefry dari Cahaya Selatan Kreasindo (CSK).\n\n" +
          "Kebetulan workshop fabrikasi kami di Serpong spesialis handle:\n" +
          "- Booth pameran, backdrop event, & sewa equipment\n" +
          "- POSM, rak display, & akrilik custom\n\n" +
          "Beberapa project sebelumnya kami support untuk brand seperti J&T Cargo, Hanasui, Line Friends, sampai Teh Pucuk.\n\n" +
          "Kalau di " + brand + " lagi ada agenda event, pameran, atau kebutuhan display toko yang butuh vendor produksi langsung tangan pertama, boleh saya kirimkan PDF portfolio ringkas kami?\n\n" +
          "Terima kasih, Kak.\n\n" +
          "Zefry Dany\n" +
          "Cahaya Selatan Kreasindo\n" +
          "WhatsApp: 0888-8533-488\n" +
          "Portofolio: cahayaselatankreasindo.my.id\n\n" +
          "---\n" +
          "Jika Kakak/tim tidak berkenan menerima info ini, cukup balas email ini dengan 'Stop' ya Kak. Terima kasih banyak.";

        GmailApp.sendEmail(toEmail, subject, body, {
          name: "Zefry Dany (Cahaya Selatan Kreasindo)"
        });

        // 4. Update counter terkirim
        countToday++;
        props.setProperty("COLD_EMAIL_COUNT", String(countToday));

        return jsonResponse({
          status: "success",
          message: "Cold email terkirim (" + countToday + "/50 hari ini) ke " + toEmail,
          countToday: countToday
        });
      }

      default:
        throw new Error("Aksi tidak dikenal: " + action + ". Gunakan: sync_all, insert, update_status, send_cold_email.");
    }

    return jsonResponse({ status: "success", message: "Data tersinkronisasi ke Google Sheets" });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// ============== OTOMATISASI PILLAR ==============

/**
 * autoTriggerPillars()
 * Membuat Client dan antrean Project untuk Lead berstatus won.
 * ID dan token lead stabil sehingga proses aman dijalankan berulang kali.
 *
 * PENTING: Deal menang bukan bukti pembayaran. Fungsi ini TIDAK membuat
 * transaksi Finance. Owner mencatat DP/pelunasan hanya setelah dana diterima.
 */
function autoTriggerPillars(ss, forceLeadId) {
  const leadsSheet = ss.getSheetByName("Leads");
  if (!leadsSheet || leadsSheet.getLastRow() <= 1) {
    return { clientCreated: 0, projectCreated: 0, projectLinked: 0, projectAmbiguous: 0, financeCreated: 0 };
  }

  const leads = readSheetData(ss, "Leads");
  const clients = readSheetData(ss, "Clients");
  const projects = readSheetData(ss, "Projects");
  const projectsSheet = ss.getSheetByName("Projects");
  let clientCreated = 0, projectCreated = 0, projectLinked = 0, projectAmbiguous = 0;

  leads.forEach(lead => {
    if (!isDealMenang(lead.status)) return;
    if (forceLeadId && String(lead.id).trim() !== String(forceLeadId).trim()) return;

    const leadId = String(lead.id).trim();
    const token = "[LEAD-" + leadId + "]";
    const name = String(lead.name || "").trim();
    if (!name) return;
    const normalizedName = name.toLowerCase();

    if (!clients.some(c => String(c.name || "").trim().toLowerCase() === normalizedName)) {
      const client = {
        id: "AUTO-CLI-" + leadId, name: name, phone: lead.phone || "",
        projectsCount: 1, totalSpend: 0, notes: "Dibuat otomatis dari Lead " + token,
        rating: 0, review: ""
      };
      insertRecord(ss, "Clients", client);
      clients.push(client);
      clientCreated++;
    }

    let projectExists = hasTokenInSheet(ss, "Projects", token);
    if (!projectExists) {
      // Adopsi satu proyek manual yang cocok agar tidak membuat proyek kedua.
      const targetValue = Number(lead.value) || 0;
      const candidates = projects.filter(p =>
        String(p.client || "").trim().toLowerCase() === normalizedName &&
        Number(p.value || 0) === targetValue &&
        String(p.notes || "").indexOf("[LEAD-") === -1
      );

      if (candidates.length === 1 && projectsSheet) {
        const candidate = candidates[0];
        const rowNum = findRowById(projectsSheet, candidate.id);
        const headers = projectsSheet.getRange(1, 1, 1, projectsSheet.getLastColumn()).getValues()[0];
        const notesCol = headers.findIndex(h => String(h).trim().toLowerCase() === "catatan") + 1;
        if (rowNum > 1 && notesCol > 0) {
          candidate.notes = (String(candidate.notes || "").trim() + " " + token).trim();
          projectsSheet.getRange(rowNum, notesCol).setValue(candidate.notes);
          projectExists = true;
          projectLinked++;
        }
      } else if (candidates.length > 1) {
        projectAmbiguous++;
        Logger.log("Beberapa proyek cocok untuk Lead " + leadId + "; pembuatan baru dilewati.");
        projectExists = true;
      }
    }

    if (!projectExists) {
      const project = {
        id: "AUTO-PRJ-" + leadId,
        title: "Proyek " + name,
        client: name,
        value: Number(lead.value) || 0,
        status: "plan",
        deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        notes: "Antrean otomatis dari Lead " + token,
        sopChecklist: "Brief:0;Produksi:0;Review:0;Revisi:0;Delivery:0"
      };
      insertRecord(ss, "Projects", project);
      projects.push(project);
      projectCreated++;
    }
  });

  return { clientCreated, projectCreated, projectLinked, projectAmbiguous, financeCreated: 0 };
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Hapus trigger lama agar tidak tumpang tindih
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === "handleAutoTrigger") ScriptApp.deleteTrigger(t);
  });
  // Trigger onEdit
  ScriptApp.newTrigger("handleAutoTrigger")
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  // Trigger time-driven tiap jam
  ScriptApp.newTrigger("handleAutoTrigger")
    .timeBased()
    .everyHours(1)
    .create();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Leads");
  if (!sheet || sheet.getLastRow() <= 1) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  
  const statusIdx = headers.indexOf("status");
  const nameIdx = headers.indexOf("nama");
  const notesIdx = headers.indexOf("catatan");
  
  if (statusIdx === -1 || nameIdx === -1) return;

  // Cek kuota sisa Gmail
  if (MailApp.getRemainingDailyQuota() < 5) {
    Logger.log("Kuota Gmail menipis, cron dibatalkan.");
    return;
  }

  let sentToday = 0;
  const maxPerBatch = 15; // Kirim santai 15 lead per pagi

  for (let i = 1; i < data.length; i++) {
    if (sentToday >= maxPerBatch) break;

    const row = data[i];
    const status = String(row[statusIdx] || "").toLowerCase().trim();
    const name = String(row[nameIdx] || "").trim();
    const notes = String(row[notesIdx] || "").trim();

    // Cari pola email dari kolom catatan atau teks
    const emailMatch = notes.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    
    if (status === "new" && emailMatch) {
      const toEmail = emailMatch[0];
      
      try {
        const subject = "Vendor Produksi Booth & Display POSM — Cahaya Selatan Kreasindo";
        const body = "Halo Kak " + name + ",\n\n" +
          "Salam kenal, saya Zefry dari Cahaya Selatan Kreasindo (CSK).\n\n" +
          "Kebetulan workshop fabrikasi kami di Serpong spesialis handle:\n" +
          "- Booth pameran, backdrop event, & sewa equipment\n" +
          "- POSM, rak display, & akrilik custom\n\n" +
          "Beberapa project sebelumnya kami support untuk brand seperti J&T Cargo, Hanasui, Line Friends, sampai Teh Pucuk.\n\n" +
          "Kalau di tim Kakak lagi ada agenda event, pameran, atau kebutuhan display toko yang butuh vendor produksi langsung tangan pertama, boleh saya kirimkan PDF portfolio ringkas kami?\n\n" +
          "Terima kasih, Kak.\n\n" +
          "Zefry Dany\n" +
          "Cahaya Selatan Kreasindo\n" +
          "WhatsApp: 0888-8533-488\n" +
          "Portofolio: cahayaselatankreasindo.my.id\n\n" +
          "---\n" +
          "Jika tidak berkenan menerima info ini, cukup balas email ini dengan 'Stop' ya Kak. Terima kasih banyak.";

        GmailApp.sendEmail(toEmail, subject, body, {
          name: "Zefry Dany (Cahaya Selatan Kreasindo)"
        });

        // Update status di sheet jadi 'contacted'
        sheet.getRange(i + 1, statusIdx + 1).setValue("contacted");
        
        // Tambahkan stempel tanggal di catatan
        const todayStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
        sheet.getRange(i + 1, notesIdx + 1).setValue(notes + " | Auto-email 9am " + todayStr);

        sentToday++;
        Utilities.sleep(1500); // Jeda aman 1.5 detik antar email
      } catch (err) {
        Logger.log("Gagal kirim ke " + toEmail + ": " + err.toString());
      }
    }
  }

  Logger.log("Selesai cron jam 9 pagi. Total terkirim: " + sentToday);
}

/**
 * Jalankan fungsi ini sekali dari Apps Script untuk memasang otomatis trigger jam 9 pagi.
 */
function installDailyOutreachTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === "cronDailyOutreach") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("cronDailyOutreach")
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .inTimezone("Asia/Jakarta")
    .create();

  Logger.log("Pemicu jam 9 pagi berhasil dipasang.");
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
  var result = { inserted: 0, updated: 0, skipped: 0, deleted: 0, total: items.length };
  var deletedIds = getDeletedRecordSet_(ss, sheetName);

  // Hapus baris lama yang sudah memiliki tombstone, termasuk jika payload kosong.
  var existingLastRow = sheet.getLastRow();
  if (existingLastRow > 1 && Object.keys(deletedIds).length) {
    var existingIds = sheet.getRange(2, 1, existingLastRow - 1, 1).getValues();
    for (var di = existingIds.length - 1; di >= 0; di--) {
      var existingId = String(existingIds[di][0] || "").trim();
      if (deletedIds[existingId]) {
        sheet.deleteRow(di + 2);
        result.deleted++;
      }
    }
  }
  if (items.length === 0) return result;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  // Header aktual sheet -> posisi kolom
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  // Bangun indeks ID -> nomor baris (ID selalu kolom 1)
  var idToRow = {};
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
  var seenNewIds = {}; // cegah duplikat ID di dalam 1 payload

  items.forEach(function (item) {
    var id = String(item.id === undefined || item.id === null ? "" : item.id).trim();
    if (id === "") { result.skipped++; return; }
    if (deletedIds[id]) { result.skipped++; return; }

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
