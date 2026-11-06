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
 * - Dipicu setelah setiap sync_all atau update_status 'won'/'Deal Menang'
 * - Menulis baris Pendapatan ke Finance (kategori DP Proyek, token [LEAD-{id}])
 * - Menulis baris Antrean ke Projects (status plan, token [LEAD-{id}])
 * - Idempoten: tidak membuat duplikat jika dijalankan berulang
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
  Materials: {
    headers: ["ID", "Nama", "Satuan", "HargaSatuan", "UpdatedAt"],
    fields: ["id", "name", "unit", "unitPrice", "updatedAt"]
  },
  Cost_Sheets: {
    headers: ["ID", "ProjectID", "NamaProyek", "ItemsJSON", "MaterialTotal", "TenagaKerja", "BiayaLain", "Margin", "TotalHPP", "HargaPenawaran", "EstimasiLaba", "UpdatedAt"],
    fields: ["id", "projectId", "projectName", "itemsJson", "materialTotal", "labor", "other", "margin", "total", "price", "profit", "updatedAt"]
  },
  Services: {
    headers: ["ID", "NamaLayanan", "Kategori", "Spesifikasi", "HargaDasar", "UpdatedAt"],
    fields: ["id", "name", "category", "spec", "basePrice", "updatedAt"]
  },
  Purchase_Orders: {
    headers: ["ID", "ProjectID", "NamaProyek", "Supplier", "Tanggal", "ItemsJSON", "Total", "Status", "CreatedAt", "UpdatedAt"],
    fields: ["id", "projectId", "projectName", "supplier", "date", "itemsJson", "total", "status", "createdAt", "updatedAt"]
  },
  Quotations: {
    headers: ["ID", "ProjectID", "NamaProyek", "Klien", "Deadline", "Catatan", "LinesJSON", "Total", "SourceCostSheetID", "SourceCostSheetUpdatedAt", "DPPersen", "Status", "CreatedAt", "UpdatedAt"],
    fields: ["id", "projectId", "projectName", "client", "deadline", "notes", "linesJson", "total", "sourceCostSheetId", "sourceCostSheetUpdatedAt", "dpPercent", "status", "createdAt", "updatedAt"]
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
  ensureSheet(ss, "Materials", FIELD_MAP.Materials.headers);
  ensureSheet(ss, "Cost_Sheets", FIELD_MAP.Cost_Sheets.headers);
  ensureSheet(ss, "Services", FIELD_MAP.Services.headers);
  ensureSheet(ss, "Purchase_Orders", FIELD_MAP.Purchase_Orders.headers);
  ensureSheet(ss, "Quotations", FIELD_MAP.Quotations.headers);

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

// ============== KEAMANAN: GOOGLE IDENTITY + SESSION RBAC ==============
// OAuth ID token is exchanged server-side for a short-lived opaque session.

// ============== GET — TARIK DATA SEMUA TAB ==============

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var identity = cskRequireSession_(params.sessionId);
    var action = String(params.action || "get_data").toLowerCase();
    if (action === "list_pending_approvals") {
      return jsonResponse({status:"success", identity:identity, approvals:cskListPendingApprovals_(identity)});
    }
    if (action === "list_my_approvals") {
      return jsonResponse({status:"success", identity:identity, approvals:cskListMyApprovals_(identity)});
    }
    if (action !== "get_data") throw new Error("ACTION_NOT_ALLOWED");
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result = {
      leads: readSheetData(ss, "Leads"),
      clients: readSheetData(ss, "Clients"),
      projects: readSheetData(ss, "Projects"),
      finance: readSheetData(ss, "Finance"),
      memory: readSheetData(ss, "Memory"),
      marketingSpend: readSheetData(ss, "Marketing_Spend"),
      materials: readSheetData(ss, "Materials"),
      costSheets: readSheetData(ss, "Cost_Sheets").map(function(x){try{x.items=JSON.parse(x.itemsJson||"[]");}catch(e){x.items=[];}return x;}),
      services: readSheetData(ss, "Services"),
      purchaseOrders: readSheetData(ss, "Purchase_Orders").map(function(x){try{x.items=JSON.parse(x.itemsJson||"[]");}catch(e){x.items=[];}return x;}),
      quotationSnapshots: readSheetData(ss, "Quotations").map(function(x){try{x.lines=JSON.parse(x.linesJson||"[]");}catch(e){x.lines=[];}return x;}),
      lastSynced: new Date().toISOString()
    };
    return jsonResponse({status:"success",identity:identity,data:cskFilterDataForRole_(result,identity.role)});
  } catch (err) {
    return jsonResponse({status:"error",code:String(err && err.message || err),message:"Akses ditolak atau sesi berakhir."});
  }
}

// ============== POST — CRUD (sync_all, insert, update_status) ==============

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(payload.action || "").toLowerCase();
    if (action === "auth_session") {
      return jsonResponse(cskCreateSession_(payload.idToken, payload.sessionId));
    }
    const identity = cskRequireSession_(payload.sessionId);
    if (action === "logout") {
      cskRevokeSession_(payload.sessionId);
      return jsonResponse({status:"success",message:"Session revoked."});
    }
    cskAssertPayloadAllowed_(identity, payload);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {

      // --- sync_all (MERGE / UPSERT — tidak pernah menghapus data lama) ---
      // Aman: lead yang sudah ada di Sheets tetap tersimpan; hanya ditambah/diupdate.
      case "sync_all": {
        var mergeSummary = {};
        if (payload.leads)          mergeSummary.Leads           = mergeSheet(ss, "Leads",           payload.leads);
        if (payload.clients)        mergeSummary.Clients         = mergeSheet(ss, "Clients",         payload.clients);
        if (payload.projects)       mergeSummary.Projects        = mergeSheet(ss, "Projects",        payload.projects);
        if (payload.finance)        mergeSummary.Finance         = mergeSheet(ss, "Finance",         payload.finance);
        if (payload.memory)         mergeSummary.Memory          = mergeSheet(ss, "Memory",          payload.memory);
        if (payload.marketingSpend) mergeSummary.Marketing_Spend = mergeSheet(ss, "Marketing_Spend", payload.marketingSpend);
        if (payload.materials) mergeSummary.Materials = mergeSheet(ss, "Materials", payload.materials);
        if (payload.costSheets) mergeSummary.Cost_Sheets = mergeSheet(ss, "Cost_Sheets", payload.costSheets.map(function(x){ var y=Object.assign({},x); y.itemsJson=JSON.stringify(x.items || []); return y; }));
        if (payload.services) mergeSummary.Services = mergeSheet(ss, "Services", payload.services);
        if (payload.purchaseOrders) mergeSummary.Purchase_Orders = mergeSheet(ss, "Purchase_Orders", payload.purchaseOrders.map(function(x){ var y=Object.assign({},x); y.itemsJson=JSON.stringify(x.items || []); return y; }));
        if (payload.quotationSnapshots) mergeSummary.Quotations = mergeSheet(ss, "Quotations", payload.quotationSnapshots.map(function(x){ var y=Object.assign({},x); y.linesJson=JSON.stringify(x.lines || []); return y; }));
        // Setelah sinkronisasi, cek apakah ada lead baru yang won
        if (identity.role === "owner") autoTriggerPillars(ss);
        return jsonResponse({ status: "success", message: "Data di-merge (tidak ada yang dihapus)", summary: mergeSummary });
      }

      // --- delete: hapus 1 baris berdasarkan ID (dipakai tombol hapus di app) ---
      case "delete": {
        const sheetName = payload.sheet || "Leads";
        const delId = payload.id;
        if (!delId) throw new Error("Parameter id diperlukan untuk aksi delete.");
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) throw new Error("Tab '" + sheetName + "' tidak ditemukan.");
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
        if (identity.role === "owner" && (sheetName === "Leads" || sheetName === "Leads_CRM") && isDealMenang(status)) {
          autoTriggerPillars(ss, id);
        }
        return jsonResponse({ status: "success", message: "Status diperbarui di " + sheetName, row: rowNum });
      }

      // --- Legacy direct-send is deliberately disabled. ---
      case "send_cold_email":
        throw new Error("COLD_EMAIL_APPROVAL_REQUIRED");

      case "request_cold_email":
        return jsonResponse(cskRequestColdEmail_(identity, payload));

      case "approve_cold_email":
        return jsonResponse(cskApproveColdEmail_(identity, payload.approvalId));

      case "reject_cold_email":
        return jsonResponse(cskRejectColdEmail_(identity, payload.approvalId));

      case "send_approved_cold_email":
        return jsonResponse(cskSendApprovedColdEmail_(identity, payload.approvalId));

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
 * Menelusuri tab Leads untuk baris dengan status 'won' / 'Deal Menang' yang
 * belum pernah ditandai dengan token [LEAD-{id}]. Baris tersebut akan:
 *   1. Ditulis sebagai Pendapatan di tab Finance (kategori "DP Proyek")
 *   2. Ditulis sebagai antrean proyek baru di tab Projects (status "plan")
 * Fungsi ini IDEMPOTEN: baris yang sudah punya token tidak akan diduplikasi.
 */
function autoTriggerPillars(ss, forceLeadId) {
  const leadsSheet = ss.getSheetByName("Leads");
  if (!leadsSheet || leadsSheet.getLastRow() <= 1) return { financeCreated: 0, projectCreated: 0 };

  const leads = readSheetData(ss, "Leads");
  let financeCreated = 0;
  let projectCreated = 0;

  leads.forEach(lead => {
    if (!isDealMenang(lead.status)) return;
    // Lewati jika ini bukan baris yang difokuskan (kalau forceLeadId diberikan)
    if (forceLeadId && String(lead.id).trim() !== String(forceLeadId).trim()) return;

    const refToken = "[LEAD-" + lead.id + "]";

    // Cek duplikat di Finance
    const financeAlreadyExists = hasTokenInSheet(ss, "Finance", refToken);
    // Cek duplikat di Projects
    const projectAlreadyExists = hasTokenInSheet(ss, "Projects", refToken);

    // Tulis ke Finance jika belum ada
    if (!financeAlreadyExists) {
      const financeRow = {
        id: "AUTO-FIN-" + Date.now(),
        date: new Date().toISOString().slice(0, 10),
        type: "income",
        category: "DP Proyek",
        amount: Number(lead.value) || 0,
        description: "Auto (Deal Menang) " + (lead.name || "") + " " + refToken
      };
      insertRecord(ss, "Finance", financeRow, ["id","date","type","category","amount","description"]);
      financeCreated++;
    }

    // Tulis ke Projects jika belum ada
    if (!projectAlreadyExists) {
      const deadlineDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const projectRow = {
        id: "AUTO-PRJ-" + Date.now(),
        title: "Proyek " + (lead.name || ""),
        client: lead.name || "",
        value: Number(lead.value) || 0,
        status: "plan",
        deadline: deadlineDate,
        notes: "Antrean otomatis dari Lead [LEAD-" + lead.id + "]",
        sopChecklist: "Brief:0;Produksi:0;Review:0;Revisi:0;Delivery:0"
      };
      insertRecord(ss, "Projects", projectRow, ["id","title","client","value","status","deadline","notes","sopChecklist"]);
      projectCreated++;
    }
  });

  return { financeCreated: financeCreated, projectCreated: projectCreated };
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
  // Disabled by security policy. Cold email requires an explicit Owner approval
  // and a separate Owner send action. Existing triggers are harmless no-ops.
  Logger.log("CSK security: automatic cold outreach is disabled.");
  return;
}

/**
 * Remove any legacy daily outreach trigger. Do not install a replacement.
 * Run manually only after reviewing the security migration.
 */
function installDailyOutreachTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "cronDailyOutreach") ScriptApp.deleteTrigger(t);
  });
  Logger.log("Legacy cold outreach triggers removed; no automatic sender installed.");
  return "Automatic cold outreach disabled.";
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


// ============== CSK SECURITY HELPERS (kept inline for one-file Apps Script import) ==============
/**
 * CSK Business OS security layer — draft integration helper.
 * Configure Script Properties:
 * CSK_GOOGLE_OAUTH_CLIENT_ID, CSK_OWNER_EMAIL, CSK_TEAM_EMAILS
 * No API token or OAuth client secret belongs in the browser.
 */
function cskVerifyGoogleIdToken_(idToken) {
  if (!idToken || typeof idToken !== "string" || idToken.length > 10000) throw new Error("AUTH_REQUIRED");
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty("CSK_GOOGLE_OAUTH_CLIENT_ID") || "";
  if (!clientId) throw new Error("AUTH_NOT_CONFIGURED");
  var response = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken), {muteHttpExceptions:true});
  if (response.getResponseCode() !== 200) throw new Error("AUTH_INVALID_TOKEN");
  var c;
  try { c = JSON.parse(response.getContentText()); } catch (e) { throw new Error("AUTH_INVALID_TOKEN"); }
  var now = Math.floor(Date.now()/1000);
  var email = String(c.email || "").trim().toLowerCase();
  if (String(c.aud || "") !== clientId) throw new Error("AUTH_WRONG_AUDIENCE");
  if (!["accounts.google.com","https://accounts.google.com"].includes(String(c.iss || ""))) throw new Error("AUTH_WRONG_ISSUER");
  if (Number(c.exp || 0) <= now + 60) throw new Error("AUTH_EXPIRED");
  if (String(c.email_verified).toLowerCase() !== "true" || !email) throw new Error("AUTH_EMAIL_UNVERIFIED");
  var owner = String(props.getProperty("CSK_OWNER_EMAIL") || "").trim().toLowerCase();
  var team = String(props.getProperty("CSK_TEAM_EMAILS") || "").split(/[;,\n]/).map(function(x){return x.trim().toLowerCase();}).filter(Boolean);
  if (email === owner && owner) return {email:email, role:"owner", expiresAt:Number(c.exp)};
  if (team.indexOf(email) >= 0) return {email:email, role:"team", expiresAt:Number(c.exp)};
  throw new Error("AUTH_EMAIL_NOT_ALLOWED");
}
function cskSessionKey_(sessionId) {
  if (!sessionId || !/^[A-Za-z0-9_-]{40,100}$/.test(String(sessionId))) throw new Error("AUTH_REQUIRED");
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(sessionId), Utilities.Charset.UTF_8);
  return "CSK_SESSION_" + bytes.map(function(b){var v=(b+256)%256;return ("0"+v.toString(16)).slice(-2);}).join("");
}
function cskCreateSession_(idToken, sessionId) {
  var identity = cskVerifyGoogleIdToken_(idToken);
  var ttl = Math.min(3300, identity.expiresAt - Math.floor(Date.now()/1000) - 60);
  if (ttl < 60) throw new Error("AUTH_EXPIRED");
  CacheService.getScriptCache().put(cskSessionKey_(sessionId), JSON.stringify({email:identity.email,role:identity.role}), ttl);
  return {status:"success",identity:{email:identity.email,role:identity.role},expiresIn:ttl};
}
function cskRequireSession_(sessionId) {
  var key = cskSessionKey_(sessionId);
  var raw = CacheService.getScriptCache().get(key);
  if (!raw) throw new Error("SESSION_EXPIRED");
  var session = JSON.parse(raw);
  var props = PropertiesService.getScriptProperties();
  var owner = String(props.getProperty("CSK_OWNER_EMAIL") || "").trim().toLowerCase();
  var team = String(props.getProperty("CSK_TEAM_EMAILS") || "").split(/[;,\n]/).map(function(x){return x.trim().toLowerCase();}).filter(Boolean);
  if (session.email === owner && owner) return {email:session.email,role:"owner"};
  if (team.indexOf(session.email) >= 0) return {email:session.email,role:"team"};
  CacheService.getScriptCache().remove(key);
  throw new Error("AUTH_EMAIL_NOT_ALLOWED");
}
function cskRevokeSession_(sessionId) {
  CacheService.getScriptCache().remove(cskSessionKey_(sessionId));
}
function cskFilterDataForRole_(data, role) {
  if (role === "owner") return data;
  if (role !== "team") throw new Error("FORBIDDEN");
  return {leads:data.leads||[],clients:data.clients||[],projects:data.projects||[],lastSynced:data.lastSynced||new Date().toISOString()};
}
function cskAssertPayloadAllowed_(identity, payload) {
  var role=identity.role, action=String(payload.action||"").toLowerCase();
  if (action==="send_cold_email") throw new Error("COLD_EMAIL_APPROVAL_REQUIRED");
  if (action==="request_cold_email") return true;
  if (["approve_cold_email","reject_cold_email","send_approved_cold_email"].includes(action)) {
    if(role!=="owner") throw new Error("OWNER_ONLY"); return true;
  }
  if(action==="sync_all") {
    var teamKeys=["leads","clients","projects"];
    var ownerKeys=["leads","clients","projects","finance","memory","marketingSpend","materials","costSheets","services","purchaseOrders","quotationSnapshots"];
    var allowed=role==="owner"?ownerKeys:teamKeys;
    ownerKeys.forEach(function(k){if(Object.prototype.hasOwnProperty.call(payload,k)&&allowed.indexOf(k)<0)throw new Error("FORBIDDEN_COLLECTION:"+k);});
    return true;
  }
  if(["insert","delete","update_status"].includes(action)) {
    var teamSheets=["Leads","Clients","Projects"];
    var ownerSheets=Object.keys(FIELD_MAP||{});
    var sheet=String(payload.sheet||(action==="insert"?"":"Leads"));
    if((role==="owner"?ownerSheets:teamSheets).indexOf(sheet)<0) throw new Error("FORBIDDEN_SHEET");
    return true;
  }
  throw new Error("ACTION_NOT_ALLOWED");
}
function cskSecuritySheet_(name, headers) {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), sh=ss.getSheetByName(name);
  if(!sh){sh=ss.insertSheet(name);sh.appendRow(headers);sh.setFrozenRows(1);}
  return sh;
}
function cskApprovalRow_(sh,id) {
  if(!id||sh.getLastRow()<2)return -1;
  var ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
  for(var i=0;i<ids.length;i++)if(String(ids[i][0])===String(id))return i+2;
  return -1;
}
function cskIsSuppressed_(email) {
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Cold_Email_Suppression");
  if(!sh||sh.getLastRow()<2)return false;
  var target=String(email||"").trim().toLowerCase();
  return sh.getRange(2,1,sh.getLastRow()-1,1).getValues().some(function(r){return String(r[0]||"").trim().toLowerCase()===target;});
}
function cskRequestColdEmail_(identity,payload) {
  var email=String(payload.toEmail||"").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("INVALID_RECIPIENT");
  if(cskIsSuppressed_(email))throw new Error("RECIPIENT_SUPPRESSED");
  var sh=cskSecuritySheet_("Cold_Email_Approvals",["ApprovalID","ToEmail","Name","Brand","RequestedBy","RequestedAt","Status","ApprovedBy","ApprovedAt","SentAt","Result"]);
  var id=Utilities.getUuid();
  sh.appendRow([id,email,String(payload.name||"Kak").slice(0,120),String(payload.brand||"Brand").slice(0,160),identity.email,new Date(),"PENDING","","","",""]);
  return {status:"PENDING",approvalId:id};
}
function cskApproveColdEmail_(identity,id) {
  if(identity.role!=="owner")throw new Error("OWNER_ONLY");
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try {var sh=cskSecuritySheet_("Cold_Email_Approvals",["ApprovalID","ToEmail","Name","Brand","RequestedBy","RequestedAt","Status","ApprovedBy","ApprovedAt","SentAt","Result"]);
    var row=cskApprovalRow_(sh,id);if(row<0)throw new Error("APPROVAL_NOT_FOUND");
    if(String(sh.getRange(row,7).getValue())!=="PENDING")throw new Error("INVALID_APPROVAL_STATE");
    sh.getRange(row,7,1,3).setValues([["APPROVED",identity.email,new Date()]]);
    return {status:"APPROVED",approvalId:id};
  } finally {lock.releaseLock();}
}
function cskRejectColdEmail_(identity,id) {
  if(identity.role!=="owner")throw new Error("OWNER_ONLY");
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    var sh=cskSecuritySheet_("Cold_Email_Approvals",["ApprovalID","ToEmail","Name","Brand","RequestedBy","RequestedAt","Status","ApprovedBy","ApprovedAt","SentAt","Result"]);
    var row=cskApprovalRow_(sh,id);if(row<0)throw new Error("APPROVAL_NOT_FOUND");
    if(String(sh.getRange(row,7).getValue())!=="PENDING")throw new Error("INVALID_APPROVAL_STATE");
    sh.getRange(row,7).setValue("REJECTED");
    sh.getRange(row,11).setValue("Rejected by "+identity.email);
    return {status:"REJECTED",approvalId:id};
  } finally {lock.releaseLock();}
}

function cskSendApprovedColdEmail_(identity,id) {
  if(identity.role!=="owner")throw new Error("OWNER_ONLY");
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  var sh,row;
  try {
    sh=cskSecuritySheet_("Cold_Email_Approvals",["ApprovalID","ToEmail","Name","Brand","RequestedBy","RequestedAt","Status","ApprovedBy","ApprovedAt","SentAt","Result"]);
    row=cskApprovalRow_(sh,id);if(row<0)throw new Error("APPROVAL_NOT_FOUND");
    var r=sh.getRange(row,1,1,11).getValues()[0];
    if(String(r[6])!=="APPROVED")throw new Error("EMAIL_NOT_APPROVED");
    var email=String(r[1]||"").trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("INVALID_RECIPIENT");
    if(cskIsSuppressed_(email))throw new Error("RECIPIENT_SUPPRESSED");
    var props=PropertiesService.getScriptProperties(),today=Utilities.formatDate(new Date(),"Asia/Jakarta","yyyy-MM-dd");
    var count=props.getProperty("COLD_EMAIL_DATE")===today?Number(props.getProperty("COLD_EMAIL_COUNT")||0):0;
    if(count>=50)throw new Error("DAILY_LIMIT_REACHED");
    if(MailApp.getRemainingDailyQuota()<1)throw new Error("GMAIL_QUOTA_EXHAUSTED");
    sh.getRange(row,7).setValue("SENDING");
    var body="Halo Kak "+String(r[2]||"Kak")+" / Tim "+String(r[3]||"Brand")+",\n\n"+
      "Salam kenal, saya Zefry dari Cahaya Selatan Kreasindo (CSK).\n\n"+
      "Jika ada kebutuhan booth pameran, backdrop event, POSM, rak display, atau akrilik custom, kami siap membantu.\n\n"+
      "Terima kasih,\nZefry Dany\nCahaya Selatan Kreasindo\n\n"+
      "Jika tidak berkenan menerima informasi berikutnya, balas email ini dengan 'Stop'.";
    GmailApp.sendEmail(email,"Vendor Produksi Booth & Display POSM — Cahaya Selatan Kreasindo",body,{name:"Zefry Dany (Cahaya Selatan Kreasindo)"});
    count++;props.setProperty("COLD_EMAIL_DATE",today);props.setProperty("COLD_EMAIL_COUNT",String(count));
    sh.getRange(row,7).setValue("SENT");sh.getRange(row,10).setValue(new Date());sh.getRange(row,11).setValue("Sent by "+identity.email);
    return {status:"SENT",approvalId:id,countToday:count};
  } finally {lock.releaseLock();}
}
function cskListPendingApprovals_(identity) {
  if(identity.role!=="owner")throw new Error("OWNER_ONLY");
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Cold_Email_Approvals");
  if(!sh||sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,11).getValues().slice(-100).reverse()
    .map(function(r){return {approvalId:String(r[0]),toEmail:String(r[1]),name:String(r[2]),brand:String(r[3]),requestedBy:String(r[4]),requestedAt:r[5],status:String(r[6]),approvedBy:String(r[7]||""),approvedAt:r[8]||"",sentAt:r[9]||"",result:String(r[10]||"")};});
}
function cskListMyApprovals_(identity) {
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Cold_Email_Approvals");
  if(!sh||sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,11).getValues()
    .filter(function(r){return String(r[4]||"").trim().toLowerCase()===identity.email.toLowerCase();})
    .slice(-50).reverse()
    .map(function(r){return {approvalId:String(r[0]),toEmail:String(r[1]),name:String(r[2]),brand:String(r[3]),requestedAt:r[5],status:String(r[6])};});
}
function cskSetupSecuritySheets() {
  cskSecuritySheet_("Cold_Email_Approvals",["ApprovalID","ToEmail","Name","Brand","RequestedBy","RequestedAt","Status","ApprovedBy","ApprovedAt","SentAt","Result"]);
  cskSecuritySheet_("Cold_Email_Suppression",["Email","AddedAt","Source","Notes"]);
  return "Security sheets ready.";
}

