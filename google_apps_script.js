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
    headers: ["ID", "Tanggal", "Nama", "WhatsApp", "Sumber", "EstimasiNilai", "Status", "Catatan"],
    fields:  ["id", "date", "name", "phone", "source", "value", "status", "notes"]
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
function rowToRecord(sheetName, row) {
  var map = FIELD_MAP[sheetName];
  var rec = {};
  if (!map) return rec;
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
  const rows = values.slice(1);
  // Tab kontrak: pakai FIELD_MAP agar key persis field HTML (Tahap 3).
  if (FIELD_MAP[sheetName]) return rows.map(r => rowToRecord(sheetName, r));
  const headers = values[0];
  return rows.map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[String(h).toLowerCase()] = r[idx]; });
    return obj;
  });
}

// ============== GET — TARIK DATA SEMUA TAB ==============

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const result = {
      leads: readSheetData(ss, "Leads"),
      clients: readSheetData(ss, "Clients"),
      projects: readSheetData(ss, "Projects"),
      finance: readSheetData(ss, "Finance"),
      memory: readSheetData(ss, "Memory"),
      marketingSpend: readSheetData(ss, "Marketing_Spend"),
      lastSynced: new Date().toISOString()
    };
    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: result }))
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (payload.action || "").toLowerCase();

    switch (action) {

      // --- sync_all (kompatibel dengan aplikasi lama) ---
      case "sync_all":
        if (payload.leads)         overwriteSheet(ss, "Leads",           payload.leads,         FIELD_MAP.Leads.fields);
        if (payload.clients)       overwriteSheet(ss, "Clients",         payload.clients,       null); // Clients: rating+review digabung via recordToRow
        if (payload.projects)      overwriteSheet(ss, "Projects",        payload.projects,      FIELD_MAP.Projects.fields);
        if (payload.finance)       overwriteSheet(ss, "Finance",         payload.finance,       FIELD_MAP.Finance.fields);
        if (payload.memory)        overwriteSheet(ss, "Memory",          payload.memory,        FIELD_MAP.Memory.fields);
        if (payload.marketingSpend)overwriteSheet(ss, "Marketing_Spend",  payload.marketingSpend, FIELD_MAP.Marketing_Spend.fields);
        // Setelah sinkronisasi, cek apakah ada lead baru yang won
        autoTriggerPillars(ss);
        break;

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
        if ((sheetName === "Leads" || sheetName === "Leads_CRM") && isDealMenang(status)) {
          autoTriggerPillars(ss, id);
        }
        return jsonResponse({ status: "success", message: "Status diperbarui di " + sheetName, row: rowNum });
      }

      default:
        throw new Error("Aksi tidak dikenal: " + action + ". Gunakan: sync_all, insert, update_status.");
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

// ============== UTILITAS RESPONS ==============

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
