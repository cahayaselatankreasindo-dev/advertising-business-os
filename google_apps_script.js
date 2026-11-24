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
 * - Tidak mencatat pemasukan Finance; status Deal Won bukan bukti pembayaran diterima
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
              "Email", "Website", "Industri", "PIC", "JabatanPIC", "LinkedIn", "SkorPrioritas", "NextFollowUp", "LastContactAt", "FollowUpNote"],
    fields:  ["id", "date", "name", "phone", "source", "value", "status", "notes",
              "email", "website", "industry", "pic", "picTitle", "linkedin", "score", "nextFollowUp", "lastContactAt", "followUpNote"]
    // Kolom follow-up ditambahkan di kanan; delapan kolom lama tidak digeser.
  },
  Clients: {
    headers: ["ID", "NamaKlien", "WhatsApp", "TotalProyek", "TotalBelanja", "Catatan", "Rating_Review"],
    fields:  ["id", "name", "phone", "projectsCount", "totalSpend", "notes", "rating", "review"]
    // NB: fields 8 item vs headers 7 kolom — rating+review digabung ke Rating_Review.
  },
  Projects: {
    headers: ["ID", "NamaProyek", "Klien", "NilaiProyek", "Status", "Deadline", "Catatan", "SOP_Checklist", "PIC_Tim", "SuggestedPrice", "SourceQuotationID", "SourceInvoiceID"],
    fields:  ["id", "title", "client", "value", "status", "deadline", "notes", "sopChecklist", "pic", "suggestedPrice", "sourceQuotationId", "sourceInvoiceId"]
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
    // Kolom lama dipertahankan di posisi awal; atribut costing ditambahkan di kanan.
    // unit = satuan pemakaian; unitPrice = harga per satuan pemakaian (kompatibel dengan HPP lama).
    headers: ["ID", "Nama", "Satuan", "HargaSatuan", "UpdatedAt", "SKU", "Kategori", "Subkategori", "Merek", "Grade", "Spesifikasi", "Warna", "KetebalanMm", "LebarMm", "PanjangMm", "DiameterMm", "SatuanBeli", "HargaBeli", "FaktorKonversi", "MetodeCosting", "SupplierID", "SupplierNama", "MinimumOrder", "WasteRate", "SumberHarga", "TanggalHarga", "Status", "Catatan", "RollLengthM"],
    fields: ["id", "name", "unit", "unitPrice", "updatedAt", "sku", "category", "subcategory", "brand", "grade", "spec", "color", "thicknessMm", "widthMm", "lengthMm", "diameterMm", "purchaseUnit", "purchasePrice", "conversionFactor", "costingMethod", "supplierId", "supplierName", "minimumOrder", "wasteRate", "priceSource", "priceDate", "status", "notes", "rollLengthM"]
  },
  Cost_Sheets: {
    headers: ["ID", "ProjectID", "NamaProyek", "ItemsJSON", "MaterialTotal", "TenagaKerja", "BiayaLain", "Margin", "TotalHPP", "HargaPenawaran", "EstimasiLaba", "UpdatedAt"],
    fields: ["id", "projectId", "projectName", "itemsJson", "materialTotal", "labor", "other", "margin", "total", "price", "profit", "updatedAt"]
  },
  Services: {
    headers: ["ID", "NamaLayanan", "Kategori", "Spesifikasi", "HargaDasar", "UpdatedAt", "SKU", "Satuan", "MetodeCosting", "BiayaDasar", "SupplierID", "SupplierNama", "Status", "Catatan", "Jenis"],
    fields: ["id", "name", "category", "spec", "basePrice", "updatedAt", "sku", "unit", "costingMethod", "costPrice", "supplierId", "supplierName", "status", "notes", "recordType"]
  },
  Purchase_Orders: {
    headers: ["ID", "ProjectID", "NamaProyek", "Supplier", "Tanggal", "ItemsJSON", "Total", "Status", "CreatedAt", "UpdatedAt", "InventoryControlVersion"],
    fields: ["id", "projectId", "projectName", "supplier", "date", "itemsJson", "total", "status", "createdAt", "updatedAt", "inventoryControlVersion"]
  },
  Sales_Orders: {
    headers: ["ID", "NomorSO", "QuotationID", "NomorQuotation", "ProjectID", "NamaProyek", "Klien", "WhatsAppKlien", "EmailKlien", "TanggalOrder", "TanggalPengiriman", "ItemsJSON", "Total", "DPPersen", "DPWajib", "Status", "RiwayatJSON", "Catatan", "CreatedAt", "UpdatedAt", "MaterialRequirementsJSON"],
    fields: ["id", "orderNo", "quotationId", "quotationNo", "projectId", "projectName", "client", "clientPhone", "clientEmail", "orderDate", "deliveryDate", "itemsJson", "total", "dpPercent", "dpRequiredAmount", "status", "historyJson", "notes", "createdAt", "updatedAt", "materialRequirementsJson"]
  },
  Inventory_Transactions: {
    headers: ["ID", "NomorTransaksi", "MaterialID", "NamaMaterial", "JenisPergerakan", "Qty", "Satuan", "Tanggal", "ProjectID", "NamaProyek", "PurchaseOrderID", "Supplier", "Referensi", "Catatan", "CreatedAt", "CreatedBy"],
    fields: ["id", "transactionNo", "materialId", "materialName", "movement", "qty", "unit", "date", "projectId", "projectName", "purchaseOrderId", "supplier", "reference", "notes", "createdAt", "createdBy"]
  },
  Quotations: {
    headers: ["ID", "ProjectID", "NamaProyek", "Klien", "Deadline", "Catatan", "LinesJSON", "Total", "SourceCostSheetID", "SourceCostSheetUpdatedAt", "DPPersen", "Status", "CreatedAt", "UpdatedAt"],
    fields: ["id", "projectId", "projectName", "client", "deadline", "notes", "linesJson", "total", "sourceCostSheetId", "sourceCostSheetUpdatedAt", "dpPercent", "status", "createdAt", "updatedAt"]
  },
  Commercial_Quotations: {
    headers: ["ID", "ProjectID", "LeadID", "NamaProyek", "Klien", "WhatsAppKlien", "EmailKlien", "AlamatKlien", "PICKlien", "NomorDokumen", "TanggalDokumen", "JatuhTempo", "LinesJSON", "Subtotal", "Diskon", "PajakPersen", "PajakNominal", "Total", "DPPersen", "SyaratKetentuan", "KetentuanPembayaran", "Catatan", "Status", "ConvertedInvoiceID", "CreatedAt", "UpdatedAt", "DeadlineProyek"],
    fields: ["id", "projectId", "leadId", "projectName", "client", "clientPhone", "clientEmail", "clientAddress", "contactPerson", "docNo", "date", "dueDate", "linesJson", "subtotal", "discount", "taxRate", "taxAmount", "total", "dpPercent", "terms", "paymentTerms", "notes", "status", "convertedInvoiceId", "createdAt", "updatedAt", "projectDeadline"]
  },
  Invoices: {
    headers: ["ID", "ProjectID", "LeadID", "QuotationID", "SourceQuotationID", "NamaProyek", "Klien", "WhatsAppKlien", "EmailKlien", "AlamatKlien", "PICKlien", "NomorDokumen", "TanggalDokumen", "JatuhTempo", "LinesJSON", "Subtotal", "Diskon", "PajakPersen", "PajakNominal", "Total", "DPPersen", "KetentuanPembayaran", "SyaratKetentuan", "Catatan", "Status", "CreatedAt", "UpdatedAt", "DeadlineProyek"],
    fields: ["id", "projectId", "leadId", "quotationId", "sourceQuotationId", "projectName", "client", "clientPhone", "clientEmail", "clientAddress", "contactPerson", "docNo", "date", "dueDate", "linesJson", "subtotal", "discount", "taxRate", "taxAmount", "total", "dpPercent", "paymentTerms", "terms", "notes", "status", "createdAt", "updatedAt", "projectDeadline"]
  },
  Invoice_Payments: {
    headers: ["ID", "InvoiceID", "NomorInvoice", "TanggalPembayaran", "JenisPembayaran", "Nominal", "Metode", "Referensi", "Catatan", "FinanceID", "CreatedAt", "CreatedBy"],
    fields: ["id", "invoiceId", "invoiceNo", "paymentDate", "paymentType", "amount", "method", "reference", "notes", "financeId", "createdAt", "createdBy"]
  }
};
// Legacy finance/cost tabs are read-only. Their schemas are intentionally not part of FIELD_MAP,
// setupSheet, or sync_all so existing costing history cannot be rewritten by the current HPP module.
var LEGACY_READ_MAP = {
  Costings: {
    id: "id", tanggal: "date", klien: "client", namapekerjaan: "jobName",
    modelproduksi: "productionModel", leadid: "leadId", itemsjson: "itemsJson",
    biayalangsung: "directCost", overheadpersen: "overheadPercent",
    overheadnominal: "overheadAmount", cadanganpersen: "reservePercent",
    cadangannominal: "reserveAmount", hpp: "hpp", marginpersen: "marginPercent",
    hargapenawaran: "quotedPrice", status: "status", projectid: "projectId",
    catatan: "notes", nomorquotation: "quotationNo", versiquotation: "quotationVersion",
    masaberlakuhari: "validityDays", waktupengerjaanhari: "productionDays",
    syaratpembayaran: "paymentTerms", ruanglingkup: "scope", disetujuipada: "approvedAt",
    poconfirmedat: "poConfirmedAt", riwayatquotationjson: "quotationHistoryJson",
    dikirimpada: "sentAt"
  },
  Project_Costs: {
    id: "id", tanggal: "date", projectid: "projectId", kategori: "category",
    sumber: "source", deskripsi: "description", vendor: "vendor", qty: "qty",
    hargasatuan: "unitPrice", nominal: "amount", statuspembayaran: "paymentStatus",
    referensi: "reference", catatan: "notes"
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

  // Preflight seluruh tab yang sudah ada. Header ambigu menghentikan setup
  // sebelum tab atau kolom baru dibuat maupun struktur lama diubah.
  Object.keys(FIELD_MAP).forEach(function (name) {
    const existingSheet = ss.getSheetByName(name);
    if (existingSheet && existingSheet.getLastRow() > 0) dedupeHeaders(ss, name);
  });

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
  ensureSheet(ss, "Sales_Orders", FIELD_MAP.Sales_Orders.headers);
  ensureSheet(ss, "Inventory_Transactions", FIELD_MAP.Inventory_Transactions.headers);
  ensureSheet(ss, "Quotations", FIELD_MAP.Quotations.headers);
  ensureSheet(ss, "Commercial_Quotations", FIELD_MAP.Commercial_Quotations.headers);
  ensureSheet(ss, "Invoices", FIELD_MAP.Invoices.headers);
  ensureSheet(ss, "Invoice_Payments", FIELD_MAP.Invoice_Payments.headers);

  // Validasi header tanpa menghapus kolom; kolom kontrak yang belum ada ditambahkan di kanan.
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

// Validasi keunikan header tanpa perubahan destruktif.
// Header duplikat/ambigu dihentikan agar pemilik data dapat menggabungkan kolom secara manual.
function dedupeHeaders(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() === 0) return 0;
  var lastCol = sheet.getLastColumn();
  if (lastCol <= 1) return 0;

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var data = sheet.getDataRange().getValues();
  var seen = {};
  var issues = [];

  headerRow.forEach(function (h, i) {
    var key = String(h == null ? "" : h).trim().toLowerCase();
    var hasData = data.slice(1).some(function (row) {
      return row[i] !== "" && row[i] !== null && row[i] !== undefined;
    });
    if (!key) {
      if (hasData) issues.push("kolom " + (i + 1) + " memiliki data tetapi header kosong");
      return;
    }
    if (Object.prototype.hasOwnProperty.call(seen, key)) {
      issues.push("header duplikat '" + h + "' pada kolom " + (seen[key] + 1) + " dan " + (i + 1));
    } else {
      seen[key] = i;
    }
  });

  if (issues.length) {
    throw new Error("Validasi header " + sheetName + " gagal; tidak ada data yang diubah. " + issues.join("; "));
  }
  Logger.log("dedupeHeaders[" + sheetName + "]: valid; tidak ada kolom yang dihapus.");
  return 0;
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

// Read legacy Costings and Project_Costs without changing their source tabs.
function readLegacySheetData_(ss, sheetName) {
  var fieldMap = LEGACY_READ_MAP[sheetName];
  if (!fieldMap) return [];
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var indexByName = {};
  headers.forEach(function(header, index) {
    var key = String(header == null ? "" : header).trim().toLowerCase();
    if (key && !Object.prototype.hasOwnProperty.call(indexByName, key)) indexByName[key] = index;
  });
  return values.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== "" && value !== null && value !== undefined; });
  }).map(function(row) {
    var record = { legacySource: sheetName, readOnly: true };
    Object.keys(fieldMap).forEach(function(headerKey) {
      var index = indexByName[headerKey];
      record[fieldMap[headerKey]] = index === undefined ? "" : row[index];
    });
    if (sheetName === "Costings") {
      try {
        var items = JSON.parse(record.itemsJson || "[]");
        record.items = Array.isArray(items) ? items : [];
      } catch (error) {
        record.items = [];
      }
      try {
        var history = JSON.parse(record.quotationHistoryJson || "[]");
        record.quotationHistory = Array.isArray(history) ? history : [];
      } catch (error) {
        record.quotationHistory = [];
      }
    }
    return record;
  });
}


// ============== KEAMANAN: EMAIL + PIN + SESSION RBAC ==============
// Semua hak akses divalidasi di server. PIN tidak pernah disimpan sebagai teks biasa.
// Sesi disimpan di CacheService dan hanya ID sesi yang dikirim browser.

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var identity = cskRequireSession_(params.sessionId);
    var action = String(params.action || "get_data").toLowerCase();
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
      costSheets: readSheetData(ss, "Cost_Sheets").map(function(x){ try { x.items = JSON.parse(x.itemsJson || "[]"); } catch(e) { x.items = []; } return x; }),
      // Legacy finance archives are not even read for Team sessions.
      legacyCostings: identity.role === "owner" ? readLegacySheetData_(ss, "Costings") : [],
      projectCosts: identity.role === "owner" ? readLegacySheetData_(ss, "Project_Costs") : [],
      services: readSheetData(ss, "Services"),
      purchaseOrders: readSheetData(ss, "Purchase_Orders").map(function(x){ try { x.items = JSON.parse(x.itemsJson || "[]"); } catch(e) { x.items = []; } return x; }),
      salesOrders: readSheetData(ss, "Sales_Orders").map(function(x){ try { x.items = JSON.parse(x.itemsJson || "[]"); } catch(e) { x.items = []; } try { x.history = JSON.parse(x.historyJson || "[]"); } catch(e) { x.history = []; } try { x.materialRequirements = JSON.parse(x.materialRequirementsJson || "[]"); } catch(e) { x.materialRequirements = []; } return x; }),
      inventoryTransactions: readSheetData(ss, "Inventory_Transactions"),
      quotationSnapshots: readSheetData(ss, "Quotations").map(function(x){ try { x.lines = JSON.parse(x.linesJson || "[]"); } catch(e) { x.lines = []; } return x; }),
      quotations: readSheetData(ss, "Commercial_Quotations").map(function(x){ try { x.lines = JSON.parse(x.linesJson || "[]"); } catch(e) { x.lines = []; } return x; }),
      invoices: readSheetData(ss, "Invoices").map(function(x){ try { x.lines = JSON.parse(x.linesJson || "[]"); } catch(e) { x.lines = []; } return x; }),
      invoicePayments: readSheetData(ss, "Invoice_Payments"),
      lastSynced: new Date().toISOString()
    };
    return jsonResponse({ status: "success", identity: identity, data: cskFilterDataForRole_(result, identity.role) });
  } catch (err) {
    return jsonResponse({ status: "error", code: String(err && err.message || err), message: "Akses ditolak atau sesi berakhir." });
  }
}

function assertPaidInvoiceChangesAllowed_(ss, incomingInvoices) {
  var existingInvoices = readSheetData(ss, "Invoices");
  var paymentRows = readSheetData(ss, "Invoice_Payments");
  var paidIds = {};
  paymentRows.forEach(function(payment) {
    var invoiceId = String(payment.invoiceId || "").trim();
    if (invoiceId) paidIds[invoiceId] = true;
  });
  (incomingInvoices || []).forEach(function(incoming) {
    if (!incoming || !incoming.id) return;
    var id = String(incoming.id).trim();
    if (!paidIds[id]) return;
    var existing = existingInvoices.find(function(invoice) { return String(invoice.id) === id; });
    if (!existing) throw new Error("INVOICE_PAYMENT_ORPHANED");
    var oldTotal = Number(existing.total);
    var newTotal = Number(incoming.total);
    if (!Number.isFinite(oldTotal) || !Number.isFinite(newTotal) || Math.round(oldTotal) !== Math.round(newTotal)) throw new Error("PAID_INVOICE_TOTAL_IMMUTABLE");
    var immutableFields = ["docNo","date","leadId","client","clientPhone","clientEmail","clientAddress","contactPerson","projectName","subtotal","discount","taxRate","taxAmount","dpPercent","quotationId","sourceQuotationId","terms","paymentTerms"];
    immutableFields.forEach(function(field) {
      var oldValue = existing[field] === undefined || existing[field] === null ? "" : String(existing[field]);
      var newValue = incoming[field] === undefined || incoming[field] === null ? "" : String(incoming[field]);
      if (oldValue !== newValue) throw new Error("PAID_INVOICE_DOCUMENT_IMMUTABLE");
    });
    var oldLines = existing.linesJson === undefined || existing.linesJson === null ? "" : String(existing.linesJson);
    var newLines = Array.isArray(incoming.lines)
      ? JSON.stringify(incoming.lines)
      : (incoming.linesJson === undefined || incoming.linesJson === null ? "" : String(incoming.linesJson));
    if (oldLines !== newLines) throw new Error("PAID_INVOICE_DOCUMENT_IMMUTABLE");
    var oldStatus = String(existing.status || "").trim().toLowerCase();
    var newStatus = String(incoming.status || "").trim().toLowerCase();
    if (newStatus === "cancelled" && oldStatus !== "cancelled") throw new Error("PAID_INVOICE_CANNOT_CANCEL");
  });
  return true;
}

function assertCommercialRecordDeletionAllowed_(ss, sheetName, recordId) {
  var id = String(recordId || "").trim();
  if (sheetName === "Invoices") {
    var hasPayments = readSheetData(ss, "Invoice_Payments").some(function(payment) { return String(payment.invoiceId || "") === id; });
    if (hasPayments) throw new Error("INVOICE_HAS_PAYMENTS");
  }
  if (sheetName === "Commercial_Quotations") {
    var hasInvoice = readSheetData(ss, "Invoices").some(function(invoice) {
      return String(invoice.sourceQuotationId || invoice.quotationId || "") === id;
    });
    if (hasInvoice) throw new Error("QUOTATION_HAS_INVOICE");
  }
  if (sheetName === "Finance") {
    var linkedPayment = id.toUpperCase().indexOf("FIN-PAY-") === 0 || readSheetData(ss, "Invoice_Payments").some(function(payment) { return String(payment.financeId || "") === id; });
    if (linkedPayment) throw new Error("PAYMENT_FINANCE_LEDGER_PROTECTED");
  }
  return true;
}

function assertUniqueCommercialDocumentNumbers_(ss, sheetName, incomingRows) {
  var currentRows = readSheetData(ss, sheetName);
  var incoming = Array.isArray(incomingRows) ? incomingRows : [];
  var incomingIds = {};
  incoming.forEach(function(row) {
    if (row && row.id !== undefined && row.id !== null) incomingIds[String(row.id)] = true;
  });
  var currentByNumber = {};
  currentRows.forEach(function(row) {
    var number = String(row.docNo || "").trim().toLowerCase();
    if (!number) return;
    if (!currentByNumber[number]) currentByNumber[number] = [];
    currentByNumber[number].push(String(row.id));
  });
  var incomingByNumber = {};
  incoming.forEach(function(row) {
    if (!row || !String(row.id || "").trim()) throw new Error("DOCUMENT_ID_REQUIRED");
    var number = String(row.docNo || "").trim();
    if (!number) throw new Error("DOCUMENT_NUMBER_REQUIRED");
    var key = number.toLowerCase();
    var id = String(row.id);
    if (incomingByNumber[key] && incomingByNumber[key] !== id) throw new Error("DUPLICATE_DOCUMENT_NUMBER");
    incomingByNumber[key] = id;
    var conflicts = (currentByNumber[key] || []).filter(function(existingId) {
      return existingId !== id && !incomingIds[existingId];
    });
    if (conflicts.length) throw new Error("DUPLICATE_DOCUMENT_NUMBER");
  });
  return true;
}

function validateCommercialDocumentsBeforeMerge_(ss, sheetName, incomingRows) {
  if (!Array.isArray(incomingRows)) throw new Error("INVALID_COMMERCIAL_DOCUMENTS");
  var currentRows = readSheetData(ss, sheetName);
  var currentById = {};
  currentRows.forEach(function(row) { currentById[String(row.id || "")] = row; });
  incomingRows.forEach(function(row) {
    if (!row || !String(row.id || "").trim()) throw new Error("DOCUMENT_ID_REQUIRED");
    var existing = currentById[String(row.id)];
    var lines = Array.isArray(row.lines) ? row.lines : null;
    if (!lines) {
      try { lines = JSON.parse(String(row.linesJson || "[]")); } catch (parseError) { throw new Error("INVALID_COMMERCIAL_DOCUMENT_LINES"); }
    }
    var incomingLinesJson = JSON.stringify(lines);
    var existingLinesJson = String(existing && existing.linesJson || "");
    var financialFields = ["subtotal", "discount", "taxRate", "taxAmount", "total", "dpPercent"];
    var financialChanged = !existing || incomingLinesJson !== existingLinesJson || financialFields.some(function(field) {
      var oldValue = existing[field] === undefined || existing[field] === null ? "" : String(existing[field]);
      var newValue = row[field] === undefined || row[field] === null ? "" : String(row[field]);
      return oldValue !== newValue;
    });
    if (!financialChanged) return;
    if (!Array.isArray(lines) || !lines.length || lines.length > 500) throw new Error("INVALID_COMMERCIAL_DOCUMENT_LINES");
    var subtotalRaw = 0;
    lines.forEach(function(line) {
      if (!line || !String(line.name || "").trim()) throw new Error("COMMERCIAL_DOCUMENT_LINE_NAME_REQUIRED");
      var qty = Number(line.qty);
      var unitPrice = Number(line.unitPrice);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("INVALID_COMMERCIAL_DOCUMENT_QUANTITY");
      if (line.unitPrice === undefined || line.unitPrice === null || String(line.unitPrice).trim() === "" || !Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error("INVALID_COMMERCIAL_DOCUMENT_UNIT_PRICE");
      }
      var lineTotal = qty * unitPrice;
      if (!Number.isFinite(lineTotal)) throw new Error("INVALID_COMMERCIAL_DOCUMENT_LINE_TOTAL");
      subtotalRaw += lineTotal;
    });
    if (!Number.isFinite(subtotalRaw)) throw new Error("INVALID_COMMERCIAL_DOCUMENT_SUBTOTAL");
    var discount = row.discount === undefined || row.discount === null || row.discount === "" ? 0 : Number(row.discount);
    var taxRate = row.taxRate === undefined || row.taxRate === null || row.taxRate === "" ? 0 : Number(row.taxRate);
    var dpPercent = row.dpPercent === undefined || row.dpPercent === null || row.dpPercent === "" ? 50 : Number(row.dpPercent);
    if (!Number.isFinite(discount) || discount < 0) throw new Error("INVALID_COMMERCIAL_DOCUMENT_DISCOUNT");
    if (discount > subtotalRaw + 0.000001) throw new Error("COMMERCIAL_DISCOUNT_EXCEEDS_SUBTOTAL");
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error("INVALID_COMMERCIAL_DOCUMENT_TAX_RATE");
    if (!Number.isFinite(dpPercent) || dpPercent < 1 || dpPercent > 99) throw new Error("INVALID_COMMERCIAL_DOCUMENT_DP_PERCENT");
    var expected = {
      subtotal: Math.round(subtotalRaw),
      discount: Math.round(discount),
      taxAmount: Math.round((subtotalRaw - discount) * taxRate / 100),
      total: Math.round(subtotalRaw - discount + Math.round((subtotalRaw - discount) * taxRate / 100))
    };
    Object.keys(expected).forEach(function(field) {
      var actual = Number(row[field]);
      if (!Number.isFinite(actual) || Math.round(actual) !== expected[field]) throw new Error("COMMERCIAL_DOCUMENT_TOTAL_MISMATCH_" + field.toUpperCase());
    });
  });
  return true;
}

function mergeCommercialQuotationsSafely_(ss, incomingQuotations) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    validateCommercialDocumentsBeforeMerge_(ss, "Commercial_Quotations", incomingQuotations);
    assertUniqueCommercialDocumentNumbers_(ss, "Commercial_Quotations", incomingQuotations);
    var normalized = (incomingQuotations || []).map(function(item) {
      var copy = Object.assign({}, item);
      copy.linesJson = JSON.stringify(item.lines || []);
      return copy;
    });
    return mergeSheet(ss, "Commercial_Quotations", normalized);
  } finally {
    lock.releaseLock();
  }
}


// Finance rows generated by invoice payments are derived from the immutable payment ledger.
function mergeFinanceSafely_(ss, incomingFinance) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var incoming = Array.isArray(incomingFinance) ? incomingFinance : [];
    var payments = readSheetData(ss, "Invoice_Payments");
    var existingFinanceRows = readSheetData(ss, "Finance");
    var paymentsByFinanceId = Object.create(null);
    var financeById = Object.create(null);
    existingFinanceRows.forEach(function(row) { financeById[String(row.id || "")] = row; });
    payments.forEach(function(payment) {
      var paymentId = String(payment.id || "").trim();
      if (!paymentId) return;
      var financeId = String(payment.financeId || ("FIN-PAY-" + paymentId)).trim();
      if (financeId !== "FIN-PAY-" + paymentId) throw new Error("PAYMENT_FINANCE_LINK_CONFLICT");
      if (paymentsByFinanceId[financeId]) throw new Error("DUPLICATE_PAYMENT_FINANCE_LINK");
      paymentsByFinanceId[financeId] = payment;
    });
    incoming.forEach(function(row) {
      var id = String(row && row.id || "").trim();
      if (!id) return;
      var isPaymentFinance = id.toUpperCase().indexOf("FIN-PAY-") === 0 || Object.prototype.hasOwnProperty.call(paymentsByFinanceId, id);
      if (!isPaymentFinance) return;
      var payment = paymentsByFinanceId[id];
      if (!payment) throw new Error("PAYMENT_FINANCE_ORPHANED");
      var type = String(payment.paymentType || "").toLowerCase();
      var typeLabel = type === "dp" ? "DP" : type === "settlement" ? "Pelunasan" : "Cicilan";
      var invoiceNo = String(payment.invoiceNo || payment.invoiceId || "");
      var reference = String(payment.reference || "").trim();
      var expected = {
        date: String(payment.paymentDate || ""),
        type: "income",
        category: "Pembayaran Invoice",
        amount: Number(payment.amount),
        description: "Pembayaran invoice " + invoiceNo + " · " + typeLabel + (reference ? " · Ref " + reference : "")
      };
      var existing = financeById[id];
      if (existing && (
        String(existing.date) !== expected.date ||
        String(existing.type).toLowerCase() !== expected.type ||
        String(existing.category) !== expected.category ||
        Number(existing.amount) !== expected.amount ||
        String(existing.description) !== expected.description
      )) throw new Error("PAYMENT_FINANCE_CONFLICT");
      if (
        String(row.date) !== expected.date ||
        String(row.type).toLowerCase() !== expected.type ||
        String(row.category) !== expected.category ||
        Number(row.amount) !== expected.amount ||
        String(row.description) !== expected.description
      ) throw new Error("PAYMENT_FINANCE_LEDGER_IMMUTABLE");
    });
    return mergeSheet(ss, "Finance", incoming);
  } finally {
    lock.releaseLock();
  }
}

function assertUniqueInvoiceQuotationSources_(ss, incomingInvoices) {
  var currentRows = readSheetData(ss, "Invoices");
  var incoming = Array.isArray(incomingInvoices) ? incomingInvoices : [];
  var incomingIds = {};
  incoming.forEach(function(row) {
    if (row && row.id !== undefined && row.id !== null) incomingIds[String(row.id)] = true;
  });
  var currentBySource = {};
  currentRows.forEach(function(row) {
    var sourceId = String(row.sourceQuotationId || row.quotationId || "").trim();
    if (!sourceId) return;
    if (!currentBySource[sourceId]) currentBySource[sourceId] = [];
    currentBySource[sourceId].push(String(row.id));
  });
  var incomingBySource = {};
  incoming.forEach(function(row) {
    if (!row) return;
    var sourceId = String(row.sourceQuotationId || row.quotationId || "").trim();
    if (!sourceId) return;
    var id = String(row.id || "").trim();
    if (!id) throw new Error("DOCUMENT_ID_REQUIRED");
    if (incomingBySource[sourceId] && incomingBySource[sourceId] !== id) {
      throw new Error("DUPLICATE_QUOTATION_CONVERSION");
    }
    incomingBySource[sourceId] = id;
    var conflicts = (currentBySource[sourceId] || []).filter(function(existingId) {
      return existingId !== id && !incomingIds[existingId];
    });
    if (conflicts.length) throw new Error("DUPLICATE_QUOTATION_CONVERSION");
  });
  return true;
}

function mergeInvoicesSafely_(ss, incomingInvoices) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    validateCommercialDocumentsBeforeMerge_(ss, "Invoices", incomingInvoices);
    assertUniqueCommercialDocumentNumbers_(ss, "Invoices", incomingInvoices);
    assertUniqueInvoiceQuotationSources_(ss, incomingInvoices);
    assertPaidInvoiceChangesAllowed_(ss, incomingInvoices);
    var normalized = (incomingInvoices || []).map(function(item) {
      var copy = Object.assign({}, item);
      copy.linesJson = JSON.stringify(item.lines || []);
      return copy;
    });
    return mergeSheet(ss, "Invoices", normalized);
  } finally {
    lock.releaseLock();
  }
}
function parseSalesOrderMaterialRequirements_(order) {
  if (Array.isArray(order && order.materialRequirements)) return order.materialRequirements;
  var raw = order && order.materialRequirementsJson;
  if (Array.isArray(raw)) return raw;
  try { var parsed = JSON.parse(raw || "[]"); return Array.isArray(parsed) ? parsed : []; } catch (e) { return []; }
}

function calculateHppMaterialRequirements_(ss, projectId) {
  var materials = readSheetData(ss, "Materials");
  var sheet = readSheetData(ss, "Cost_Sheets").find(function(row) { return String(row.projectId) === String(projectId); });
  if (!sheet) return {requirements:[],errors:["HPP proyek belum tersedia."]};
  var items = [];
  try { items = JSON.parse(sheet.itemsJson || "[]"); } catch (e) { items = []; }
  if (!Array.isArray(items)) items = [];
  var grouped = Object.create(null), errors = [];
  items.forEach(function(item, index) {
    if (!item || item.serviceId || item.itemType === "service" || !item.materialId) return;
    var material = materials.find(function(row) { return String(row.id) === String(item.materialId); });
    if (!material) { errors.push("Material HPP tidak ditemukan: " + String(item.materialId)); return; }
    var qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty <= 0) { errors.push("Kuantitas HPP tidak valid untuk " + String(material.name || item.materialId)); return; }
    var lineUnit = String(item.unit || "").trim().toLowerCase();
    var stockUnit = String(material.unit || "").trim();
    var purchaseUnit = String(material.purchaseUnit || "").trim().toLowerCase();
    var stockQty = 0;
    if (lineUnit === stockUnit.toLowerCase()) stockQty = qty;
    else if (purchaseUnit && lineUnit === purchaseUnit) {
      var factor = Number(material.conversionFactor);
      if (!Number.isFinite(factor) || factor <= 0) { errors.push("Faktor konversi tidak valid untuk " + String(material.name || item.materialId)); return; }
      stockQty = qty * factor;
    } else {
      errors.push("Satuan HPP tidak cocok untuk " + String(material.name || item.materialId));
      return;
    }
    var key = String(material.id);
    if (!grouped[key]) grouped[key] = {materialId:material.id,name:String(material.name || ""),unit:stockUnit,required:0};
    grouped[key].required += stockQty;
  });
  var requirements = Object.keys(grouped).map(function(key) { return grouped[key]; })
    .sort(function(a,b) { return String(a.name).localeCompare(String(b.name)); });
  if (!requirements.length && !errors.length) errors.push("HPP belum memiliki baris material.");
  return {requirements:requirements,errors:errors};
}

function normalizeMaterialRequirementSnapshot_(rows) {
  return (Array.isArray(rows) ? rows : []).map(function(row) {
    return {materialId:String(row.materialId || ""),name:String(row.name || ""),unit:String(row.unit || ""),required:Number(row.required)};
  }).sort(function(a,b) { return a.materialId.localeCompare(b.materialId); });
}

function calculateInventoryBalancesServer_(materials, transactions) {
  var directions = {opening:1,receipt:1,return:1,issue:-1,adjustment_in:1,adjustment_out:-1};
  var materialMap = Object.create(null), balances = Object.create(null);
  (materials || []).forEach(function(row) { materialMap[String(row.id)] = row; });
  (transactions || []).slice().sort(function(a,b) {
    var date = String(a.date || "").localeCompare(String(b.date || ""));
    if (date) return date;
    var created = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    return created || String(a.id || "").localeCompare(String(b.id || ""));
  }).forEach(function(tx) {
    var materialId = String(tx.materialId || ""), direction = directions[String(tx.movement || "")];
    if (!materialMap[materialId] || !direction) return;
    balances[materialId] = Number(balances[materialId] || 0) + (Number(tx.qty) || 0) * direction;
  });
  return balances;
}

function calculateActiveProjectReservations_(ss, orders, transactions) {
  var activeStatuses = {ready_production:true,in_production:true};
  var materials = readSheetData(ss, "Materials");
  var groups = Object.create(null), errors = [], byMaterial = Object.create(null), byProject = Object.create(null);
  (orders || []).forEach(function(order) {
    var status = String(order.status || "").toLowerCase(), projectId = String(order.projectId || "");
    if (!activeStatuses[status] || !projectId) return;
    if (!groups[projectId]) groups[projectId] = {projectId:projectId,projectName:String(order.projectName || ""),orders:[]};
    groups[projectId].orders.push(order);
  });
  Object.keys(groups).forEach(function(projectId) {
    var project = groups[projectId], snapshotOrder = project.orders.find(function(order) { return parseSalesOrderMaterialRequirements_(order).length > 0; });
    var requirements = [];
    if (snapshotOrder) {
      requirements = normalizeMaterialRequirementSnapshot_(parseSalesOrderMaterialRequirements_(snapshotOrder));
      project.orders.forEach(function(order) {
        var snapshot = parseSalesOrderMaterialRequirements_(order);
        if (snapshot.length && JSON.stringify(normalizeMaterialRequirementSnapshot_(snapshot)) !== JSON.stringify(requirements)) {
          errors.push("Snapshot kebutuhan material antar Sales Order proyek " + (project.projectName || projectId) + " berbeda.");
        }
      });
    } else {
      var hpp = calculateHppMaterialRequirements_(ss, projectId);
      if (hpp.errors.length) { hpp.errors.forEach(function(error) { errors.push((project.projectName || projectId) + ": " + error); }); return; }
      requirements = hpp.requirements;
    }
    var issued = Object.create(null);
    (transactions || []).forEach(function(tx) {
      if (String(tx.projectId || "") !== projectId) return;
      var materialId = String(tx.materialId || "");
      if (tx.movement === "issue") issued[materialId] = (issued[materialId] || 0) + (Number(tx.qty) || 0);
      else if (tx.movement === "return") issued[materialId] = (issued[materialId] || 0) - (Number(tx.qty) || 0);
    });
    var lines = [];
    requirements.forEach(function(line) {
      var material = materials.find(function(row) { return String(row.id) === String(line.materialId); });
      if (!material || String(material.unit || "") !== String(line.unit || "")) { errors.push("Material atau satuan snapshot reservasi tidak valid pada proyek " + (project.projectName || projectId)); return; }
      var netIssued = Math.max(0, issued[String(line.materialId)] || 0);
      var outstanding = Math.max(0, Number(line.required) - netIssued);
      var row = {projectId:projectId,projectName:project.projectName || projectId,orderNo:String(snapshotOrder && (snapshotOrder.orderNo || snapshotOrder.id) || project.orders[0].orderNo || ""),materialId:line.materialId,name:line.name || material.name,unit:line.unit,required:Number(line.required),issued:netIssued,outstanding:outstanding};
      lines.push(row);
      if (!byMaterial[String(line.materialId)]) byMaterial[String(line.materialId)] = {materialId:line.materialId,name:row.name,unit:row.unit,committed:0,projects:[]};
      byMaterial[String(line.materialId)].committed += outstanding;
      byMaterial[String(line.materialId)].projects.push(row);
    });
    byProject[projectId] = lines;
  });
  return {byMaterial:byMaterial,byProject:byProject,errors:errors};
}

// Validasi server-side Sales Order: quotation approved, satu SO per quotation,
// transisi status terkendali, dan pelepasan produksi berdasarkan pembayaran DP terverifikasi.
function validateSalesOrdersBeforeMerge_(ss, incomingOrders, incomingTransactions) {
  if (!Array.isArray(incomingOrders)) throw new Error("INVALID_SALES_ORDERS");
  ensureSheet(ss, "Sales_Orders", FIELD_MAP.Sales_Orders.headers);
  var existingOrders = readSheetData(ss, "Sales_Orders");
  var quotations = readSheetData(ss, "Commercial_Quotations");
  var invoices = readSheetData(ss, "Invoices");
  var payments = readSheetData(ss, "Invoice_Payments");
  var projects = readSheetData(ss, "Projects");
  var seenIds = {};
  var seenQuotes = {};
  var seenNumbers = {};
  var allowedStatuses = ["awaiting_dp","awaiting_material","ready_production","in_production","quality_check","ready_delivery","delivered","closed","cancelled"];
  var transitions = {
    awaiting_dp:["awaiting_material","ready_production","cancelled"],
    awaiting_material:["ready_production","cancelled"],
    ready_production:["in_production","cancelled"],
    in_production:["quality_check"],
    quality_check:["in_production","ready_delivery"],
    ready_delivery:["delivered"],
    delivered:["closed"],
    closed:[],
    cancelled:[]
  };
  incomingOrders.forEach(function(order) {
    if (!order || !/^SO-[A-Za-z0-9_-]{8,100}$/.test(String(order.id || ""))) throw new Error("INVALID_SALES_ORDER_ID");
    var id = String(order.id);
    var quoteId = String(order.quotationId || "");
    if (!quoteId) throw new Error("SALES_ORDER_QUOTATION_REQUIRED");
    if (seenIds[id]) throw new Error("DUPLICATE_SALES_ORDER_ID");
    seenIds[id] = true;
    var quote = quotations.find(function(q) { return String(q.id) === quoteId; });
    if (!quote || String(quote.status || "").toLowerCase() !== "approved") throw new Error("SALES_ORDER_REQUIRES_APPROVED_QUOTATION");
    if (!/^SO-CSK-\d{4}-\d{5}$/.test(String(order.orderNo || ""))) throw new Error("INVALID_SALES_ORDER_NUMBER");
    if (seenNumbers[String(order.orderNo)]) throw new Error("DUPLICATE_SALES_ORDER_NUMBER");
    seenNumbers[String(order.orderNo)] = true;
    var projectId = String(order.projectId || "");
    if (!projectId || !projects.some(function(p) { return String(p.id) === projectId; })) throw new Error("SALES_ORDER_PROJECT_REQUIRED");
    var total = Math.round(Number(order.total));
    var dpPercent = Number(order.dpPercent);
    var dpRequired = Math.round(total * dpPercent / 100);
    if (!Number.isSafeInteger(total) || total <= 0 || !Number.isFinite(dpPercent) || dpPercent < 0 || dpPercent > 99) throw new Error("INVALID_SALES_ORDER_VALUE");
    if (Math.round(Number(order.dpRequiredAmount)) !== dpRequired) throw new Error("SALES_ORDER_DP_SNAPSHOT_MISMATCH");
    if (allowedStatuses.indexOf(String(order.status || "")) < 0) throw new Error("INVALID_SALES_ORDER_STATUS");
    var items = Array.isArray(order.items) ? order.items : [];
    if (!items.length || items.length > 500) throw new Error("INVALID_SALES_ORDER_ITEMS");
    var existing = existingOrders.find(function(x) { return String(x.id) === id; });
    var duplicate = existingOrders.find(function(x) { return String(x.quotationId) === quoteId && String(x.id) !== id; });
    if (duplicate) throw new Error("QUOTATION_ALREADY_HAS_SALES_ORDER");
    if (seenQuotes[quoteId] && seenQuotes[quoteId] !== id) throw new Error("DUPLICATE_SALES_ORDER_FOR_QUOTATION");
    seenQuotes[quoteId] = id;
    var itemsJson = JSON.stringify(items);
    var quotationLines = [];
    try { quotationLines = JSON.parse(quote.linesJson || "[]"); } catch (parseError) { quotationLines = []; }
    if (!Array.isArray(quotationLines)) quotationLines = [];
    if (!existing) {
      var expectedInitial = dpRequired > 0 ? ["awaiting_dp"] : ["ready_production","awaiting_material"];
      if (expectedInitial.indexOf(String(order.status)) < 0) throw new Error("INVALID_INITIAL_SALES_ORDER_STATUS");
      if (String(order.quotationNo || "") !== String(quote.docNo || quote.id)) throw new Error("SALES_ORDER_QUOTATION_SNAPSHOT_MISMATCH");
      if (total !== Math.round(Number(quote.total)) || dpPercent !== Number(quote.dpPercent || 0)) throw new Error("SALES_ORDER_QUOTATION_VALUE_MISMATCH");
      if (itemsJson !== JSON.stringify(quotationLines)) throw new Error("SALES_ORDER_ITEMS_SNAPSHOT_MISMATCH");
    } else {
      var currentSnapshot = parseSalesOrderMaterialRequirements_(existing);
      var incomingSnapshot = parseSalesOrderMaterialRequirements_(order);
      if (currentSnapshot.length && incomingSnapshot.length &&
          JSON.stringify(normalizeMaterialRequirementSnapshot_(currentSnapshot)) !== JSON.stringify(normalizeMaterialRequirementSnapshot_(incomingSnapshot))) {
        throw new Error("SALES_ORDER_MATERIAL_RESERVATION_IMMUTABLE");
      }
      if (currentSnapshot.length && !incomingSnapshot.length) {
        order.materialRequirementsJson = JSON.stringify(currentSnapshot);
      }
      var currentItems = String(existing.itemsJson || "[]");
      var immutableChanged = String(existing.quotationId) !== quoteId ||
        String(existing.orderNo) !== String(order.orderNo) ||
        String(existing.projectId) !== projectId ||
        Math.round(Number(existing.total)) !== total ||
        Number(existing.dpPercent) !== dpPercent ||
        Math.round(Number(existing.dpRequiredAmount)) !== dpRequired ||
        String(existing.orderDate) !== String(order.orderDate) ||
        currentItems !== itemsJson;
      if (immutableChanged) throw new Error("SALES_ORDER_SNAPSHOT_IMMUTABLE");
      if (String(existing.status) !== String(order.status)) {
        var nextAllowed = transitions[String(existing.status)] || [];
        if (nextAllowed.indexOf(String(order.status)) < 0) throw new Error("INVALID_SALES_ORDER_STATUS_TRANSITION");
      }
    }
    var invoiceIds = {};
    invoices.forEach(function(invoice) {
      if (String(invoice.sourceQuotationId || invoice.quotationId || "") === quoteId) invoiceIds[String(invoice.id)] = true;
    });
    if (quote.convertedInvoiceId) invoiceIds[String(quote.convertedInvoiceId)] = true;
    var paid = payments.filter(function(payment) { return !!invoiceIds[String(payment.invoiceId)]; })
      .reduce(function(sum,payment) { return sum + Math.max(0,Number(payment.amount) || 0); },0);
    var invoiceTotal = invoices.filter(function(invoice) { return !!invoiceIds[String(invoice.id)]; })
      .reduce(function(sum,invoice) { return sum + Math.max(0,Number(invoice.total) || 0); },0);
    var status = String(order.status);
    if (status !== "awaiting_dp" && status !== "cancelled" && paid < dpRequired) throw new Error("SALES_ORDER_DP_NOT_VERIFIED");
    if (status === "closed" && (invoiceTotal <= 0 || paid < invoiceTotal)) throw new Error("SALES_ORDER_CANNOT_CLOSE_WITH_UNPAID_INVOICE");
    var wasReserved = !!(existing && ["ready_production","in_production"].indexOf(String(existing.status || "")) >= 0);
    var willBeReserved = ["ready_production","in_production"].indexOf(status) >= 0;
    var enteringReservation = willBeReserved && !wasReserved;
    if (enteringReservation) {
      var snapshot = parseSalesOrderMaterialRequirements_(order);
      if (!snapshot.length) {
        var expectedSnapshot = calculateHppMaterialRequirements_(ss, projectId);
        if (expectedSnapshot.errors.length) throw new Error("SALES_ORDER_MATERIAL_PLAN_INVALID");
        snapshot = expectedSnapshot.requirements;
        order.materialRequirementsJson = JSON.stringify(snapshot);
      } else {
        var expected = calculateHppMaterialRequirements_(ss, projectId);
        if (expected.errors.length) throw new Error("SALES_ORDER_MATERIAL_PLAN_INVALID");
        if (JSON.stringify(normalizeMaterialRequirementSnapshot_(snapshot)) !== JSON.stringify(normalizeMaterialRequirementSnapshot_(expected.requirements))) {
          throw new Error("SALES_ORDER_MATERIAL_SNAPSHOT_MISMATCH");
        }
        order.materialRequirementsJson = JSON.stringify(normalizeMaterialRequirementSnapshot_(snapshot));
      }
    }
  });
  var incomingById = Object.create(null);
  incomingOrders.forEach(function(order) { incomingById[String(order.id)] = order; });
  var mergedOrders = existingOrders.map(function(order) { return incomingById[String(order.id)] || order; });
  incomingOrders.forEach(function(order) { if (!existingOrders.some(function(row) { return String(row.id) === String(order.id); })) mergedOrders.push(order); });
  var reservationTriggered = incomingOrders.some(function(order) {
    var old = existingOrders.find(function(row) { return String(row.id) === String(order.id); });
    var wasReserved = !!(old && ["ready_production","in_production"].indexOf(String(old.status || "")) >= 0);
    return ["ready_production","in_production"].indexOf(String(order.status || "")) >= 0 && !wasReserved;
  });
  if (reservationTriggered) {
    var txMap = Object.create(null);
    readSheetData(ss, "Inventory_Transactions").concat(Array.isArray(incomingTransactions) ? incomingTransactions : []).forEach(function(tx) {
      if (tx && tx.id) txMap[String(tx.id)] = tx;
    });
    var ledger = Object.keys(txMap).map(function(id) { return txMap[id]; });
    var reservations = calculateActiveProjectReservations_(ss, mergedOrders, ledger);
    if (reservations.errors.length) throw new Error("SALES_ORDER_MATERIAL_RESERVATION_INVALID: " + reservations.errors.join(" "));
    var balances = calculateInventoryBalancesServer_(readSheetData(ss, "Materials"), ledger);
    Object.keys(reservations.byMaterial).forEach(function(materialId) {
      var row = reservations.byMaterial[materialId];
      if (row.committed > Number(balances[materialId] || 0) + 0.000001) throw new Error("SALES_ORDER_INSUFFICIENT_MATERIAL_STOCK: " + row.name);
    });
  }
  return true;
}

// PO cannot be marked received until every ordered material quantity has a matching
// receipt in the append-only inventory ledger. A PO with any receipt cannot be cancelled.
function validatePurchaseOrderReceiptStatuses_(ss, incomingPurchaseOrders, incomingTransactions) {
  if (!Array.isArray(incomingPurchaseOrders)) return true;
  var currentPOs = readSheetData(ss, "Purchase_Orders");
  var transactions = readSheetData(ss, "Inventory_Transactions");
  var incomingTx = Array.isArray(incomingTransactions) ? incomingTransactions : [];
  var txMap = {};
  transactions.concat(incomingTx).forEach(function(tx) { if (tx && tx.id) txMap[String(tx.id)] = tx; });
  var ledger = Object.keys(txMap).map(function(id) { return txMap[id]; });
  incomingPurchaseOrders.forEach(function(incomingPO) {
    var status = String(incomingPO.status || "").toLowerCase();
    var poId = String(incomingPO.id || "");
    if (!poId) throw new Error("PURCHASE_ORDER_ID_REQUIRED");
    var existing = currentPOs.find(function(po) { return String(po.id) === poId; });
    var items = Array.isArray(incomingPO.items) ? incomingPO.items : [];
    if (!items.length) {
      try { items = JSON.parse(incomingPO.itemsJson || (existing && existing.itemsJson) || "[]"); } catch (parseError) { items = []; }
    }
    var received = ledger.filter(function(tx) { return String(tx.purchaseOrderId || "") === poId && String(tx.movement) === "receipt"; });
    if (status === "cancelled" && received.length) throw new Error("PURCHASE_ORDER_CANNOT_CANCEL_AFTER_RECEIPT");
    var existingVersion = Number(existing && existing.inventoryControlVersion || 0);
    var incomingVersion = Number(incomingPO.inventoryControlVersion || existingVersion || 0);
    if (status === "received" && incomingVersion >= 1) {
      if (!items.length) throw new Error("PURCHASE_ORDER_RECEIPT_INCOMPLETE");
      var expected = {};
      items.forEach(function(item) {
        var materialId = String(item.materialId || "");
        expected[materialId] = (expected[materialId] || 0) + Math.max(0,Number(item.qty) || 0);
      });
      Object.keys(expected).forEach(function(materialId) {
        var actual = received.filter(function(tx) { return String(tx.materialId) === materialId; })
          .reduce(function(sum,tx) { return sum + Math.max(0,Number(tx.qty) || 0); },0);
        if (actual + 0.000001 < expected[materialId]) throw new Error("PURCHASE_ORDER_RECEIPT_INCOMPLETE");
      });
    }
  });
  return true;
}

// Inventory ledger is append-only. Every stock movement is checked against master data
// and the full dated ledger before any new row is merged.
function validateInventoryTransactionsBeforeMerge_(ss, incomingTransactions, incomingPurchaseOrders) {
  if (!Array.isArray(incomingTransactions)) throw new Error("INVALID_INVENTORY_TRANSACTIONS");
  ensureSheet(ss, "Inventory_Transactions", FIELD_MAP.Inventory_Transactions.headers);
  var existing = readSheetData(ss, "Inventory_Transactions");
  var materials = readSheetData(ss, "Materials");
  var projects = readSheetData(ss, "Projects");
  var purchaseOrders = readSheetData(ss, "Purchase_Orders");
  (incomingPurchaseOrders || []).forEach(function(incomingPO) {
    var copy = Object.assign({}, incomingPO);
    if (Array.isArray(incomingPO.items)) copy.itemsJson = JSON.stringify(incomingPO.items);
    var index = purchaseOrders.findIndex(function(po) { return String(po.id) === String(copy.id); });
    if (index >= 0) purchaseOrders[index] = copy; else purchaseOrders.push(copy);
  });
  var movementDirection = {opening:1,receipt:1,return:1,issue:-1,adjustment_in:1,adjustment_out:-1};
  var seenIds = {};
  var seenNumbers = {};
  var newRows = [];
  var immutableFields = ["transactionNo","materialId","materialName","movement","qty","unit","date","projectId","projectName","purchaseOrderId","supplier","reference","notes","createdAt","createdBy"];
  incomingTransactions.forEach(function(tx) {
    if (!tx || !/^ITX-[A-Za-z0-9_-]{8,100}$/.test(String(tx.id || ""))) throw new Error("INVALID_INVENTORY_TRANSACTION_ID");
    var id = String(tx.id);
    if (seenIds[id]) throw new Error("DUPLICATE_INVENTORY_TRANSACTION_ID");
    seenIds[id] = true;
    if (!/^STK-CSK-\d{4}-\d{5}$/.test(String(tx.transactionNo || ""))) throw new Error("INVALID_INVENTORY_TRANSACTION_NUMBER");
    if (seenNumbers[String(tx.transactionNo)]) throw new Error("DUPLICATE_INVENTORY_TRANSACTION_NUMBER");
    seenNumbers[String(tx.transactionNo)] = true;
    var material = materials.find(function(m) { return String(m.id) === String(tx.materialId || ""); });
    if (!material) throw new Error("INVENTORY_MATERIAL_NOT_FOUND");
    if (!Object.prototype.hasOwnProperty.call(movementDirection, String(tx.movement || ""))) throw new Error("INVALID_INVENTORY_MOVEMENT");
    var qty = Number(tx.qty);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(Number(tx.qty))) throw new Error("INVALID_INVENTORY_QUANTITY");
    if (String(tx.unit || "") !== String(material.unit || "")) throw new Error("INVENTORY_UNIT_MISMATCH");
    var date = String(tx.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("INVALID_INVENTORY_DATE");
    var parsedDate = new Date(date + "T00:00:00Z");
    if (isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== date) throw new Error("INVALID_INVENTORY_DATE");
    var projectId = String(tx.projectId || "");
    if (["issue","return"].indexOf(String(tx.movement)) >= 0 && !projects.some(function(p) { return String(p.id) === projectId; })) throw new Error("INVENTORY_PROJECT_REQUIRED");
    if (["adjustment_in","adjustment_out"].indexOf(String(tx.movement)) >= 0 && !String(tx.notes || "").trim()) throw new Error("INVENTORY_ADJUSTMENT_REASON_REQUIRED");
    var current = existing.find(function(row) { return String(row.id) === id; });
    if (!current && String(tx.movement) === "receipt") {
      var poId = String(tx.purchaseOrderId || "");
      var supplier = String(tx.supplier || "").trim();
      if (!poId && !supplier) throw new Error("INVENTORY_RECEIPT_SOURCE_REQUIRED");
      if (poId) {
        var po = purchaseOrders.find(function(p) { return String(p.id) === poId; });
        var poStatus = String(po && po.status || "").toLowerCase();
        if (!po || ["ordered","received"].indexOf(poStatus) < 0) throw new Error("INVENTORY_PURCHASE_ORDER_NOT_READY_FOR_RECEIPT");
        var poItems = [];
        try { poItems = JSON.parse(po.itemsJson || "[]"); } catch (parseError) { poItems = []; }
        var poItem = poItems.find(function(item) { return String(item.materialId) === String(tx.materialId); });
        if (!poItem) throw new Error("INVENTORY_MATERIAL_NOT_IN_PURCHASE_ORDER");
        if (String(poItem.unit || "") !== String(tx.unit || "")) throw new Error("INVENTORY_PO_UNIT_MISMATCH");
        var orderedQty = poItems.filter(function(item) { return String(item.materialId) === String(tx.materialId); })
          .reduce(function(sum,item) { return sum + Math.max(0,Number(item.qty) || 0); },0);
        var receivedQty = existing.concat(newRows).filter(function(row) {
          return String(row.purchaseOrderId || "") === poId && String(row.materialId) === String(tx.materialId) && String(row.movement) === "receipt";
        }).reduce(function(sum,row) { return sum + Math.max(0,Number(row.qty) || 0); },0);
        if (receivedQty + qty > orderedQty + 0.000001) throw new Error("INVENTORY_RECEIPT_EXCEEDS_PURCHASE_ORDER");
      }
    }
    if (current) {
      var changed = immutableFields.some(function(field) { return String(current[field] == null ? "" : current[field]) !== String(tx[field] == null ? "" : tx[field]); });
      if (changed) throw new Error("INVENTORY_TRANSACTION_IMMUTABLE");
    } else {
      var duplicateNumber = existing.find(function(row) { return String(row.transactionNo) === String(tx.transactionNo) && String(row.id) !== id; });
      if (duplicateNumber) throw new Error("DUPLICATE_INVENTORY_TRANSACTION_NUMBER");
      newRows.push(tx);
    }
  });
  var ledger = existing.concat(newRows).slice().sort(function(a,b) {
    var dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
    if (dateCompare) return dateCompare;
    var createdCompare = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    if (createdCompare) return createdCompare;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
  var balances = {};
  var openingSeen = {};
  var movementSeen = {};
  ledger.forEach(function(tx) {
    var materialId = String(tx.materialId || "");
    var direction = movementDirection[String(tx.movement || "")];
    var before = Number(balances[materialId] || 0);
    if (String(tx.movement) === "opening") {
      if (openingSeen[materialId]) throw new Error("INVENTORY_OPENING_ALREADY_EXISTS");
      if (movementSeen[materialId]) throw new Error("INVENTORY_OPENING_MUST_BE_FIRST");
      openingSeen[materialId] = true;
    }
    movementSeen[materialId] = true;
    var after = before + Number(tx.qty) * direction;
    if (after < -0.000001) throw new Error("INVENTORY_INSUFFICIENT_STOCK");
    balances[materialId] = Math.max(0, after);
  });
  return true;
}

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var action = String(payload.action || "").toLowerCase();

    // Login adalah satu-satunya aksi yang tidak memerlukan sesi aktif.
    if (action === "login") {
      return jsonResponse(cskLoginWithPin_(payload.email, payload.pin, payload.sessionId));
    }

    var identity = cskRequireSession_(payload.sessionId);
    if (action === "logout") {
      cskRevokeSession_(payload.sessionId);
      return jsonResponse({ status: "success", message: "Sesi ditutup." });
    }

    cskAssertPayloadAllowed_(identity, payload);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {
      case "sync_all": {
        if (identity.role === "team") cskAssertTeamLeadTransitions_(ss, payload.leads || []);
        var mergeSummary = {};
        if (payload.leads)          mergeSummary.Leads           = mergeSheet(ss, "Leads", payload.leads);
        if (payload.clients)        mergeSummary.Clients         = mergeSheet(ss, "Clients", payload.clients);
        if (payload.projects)       mergeSummary.Projects        = mergeSheet(ss, "Projects", payload.projects);
        if (payload.finance)        mergeSummary.Finance         = mergeFinanceSafely_(ss, payload.finance);
        if (payload.memory)         mergeSummary.Memory          = mergeSheet(ss, "Memory", payload.memory);
        if (payload.marketingSpend) mergeSummary.Marketing_Spend = mergeSheet(ss, "Marketing_Spend", payload.marketingSpend);
        if (payload.materials)      mergeSummary.Materials       = mergeSheet(ss, "Materials", payload.materials);
        if (payload.costSheets) mergeSummary.Cost_Sheets = mergeSheet(ss, "Cost_Sheets", payload.costSheets.map(function(x){ var y = Object.assign({}, x); y.itemsJson = JSON.stringify(x.items || []); return y; }));
        if (payload.services) mergeSummary.Services = mergeSheet(ss, "Services", payload.services);
        var inventoryLock = LockService.getScriptLock();
        inventoryLock.waitLock(30000);
        try {
          if (payload.materials) mergeSummary.Materials = mergeSheet(ss, "Materials", payload.materials);
          if (payload.costSheets) mergeSummary.Cost_Sheets = mergeSheet(ss, "Cost_Sheets", payload.costSheets.map(function(x){ var y = Object.assign({}, x); y.itemsJson = JSON.stringify(x.items || []); return y; }));
          if (payload.services) mergeSummary.Services = mergeSheet(ss, "Services", payload.services);
          if (payload.purchaseOrders) validatePurchaseOrderReceiptStatuses_(ss, payload.purchaseOrders, payload.inventoryTransactions || []);
          if (payload.salesOrders) validateSalesOrdersBeforeMerge_(ss, payload.salesOrders, payload.inventoryTransactions || []);
          if (payload.inventoryTransactions) validateInventoryTransactionsBeforeMerge_(ss, payload.inventoryTransactions, payload.purchaseOrders || [], payload.salesOrders || []);
          if (payload.purchaseOrders) mergeSummary.Purchase_Orders = mergeSheet(ss, "Purchase_Orders", payload.purchaseOrders.map(function(x){ var y = Object.assign({}, x); y.itemsJson = JSON.stringify(x.items || []); return y; }));
          if (payload.salesOrders) {
            mergeSummary.Sales_Orders = mergeSheet(ss, "Sales_Orders", payload.salesOrders.map(function(x){ var y = Object.assign({}, x); y.itemsJson = JSON.stringify(x.items || []); y.historyJson = JSON.stringify(x.history || []); y.materialRequirementsJson = JSON.stringify(x.materialRequirements || []); return y; }));
          }
          if (payload.inventoryTransactions) mergeSummary.Inventory_Transactions = mergeSheet(ss, "Inventory_Transactions", payload.inventoryTransactions);
        } finally {
          inventoryLock.releaseLock();
        }
        if (payload.quotationSnapshots) mergeSummary.Quotations = mergeSheet(ss, "Quotations", payload.quotationSnapshots.map(function(x){ var y = Object.assign({}, x); y.linesJson = JSON.stringify(x.lines || []); return y; }));
        if (payload.quotations) mergeSummary.Commercial_Quotations = mergeCommercialQuotationsSafely_(ss, payload.quotations);
        if (payload.invoices) mergeSummary.Invoices = mergeInvoicesSafely_(ss, payload.invoices);
        if (identity.role === "owner") autoTriggerPillars(ss);
        return jsonResponse({ status: "success", message: "Data di-merge; data lama yang tidak dikirim tetap dipertahankan.", summary: mergeSummary });
      }

      case "record_invoice_payment": {
        var paymentResult = recordInvoicePayment_(ss, payload.payment, identity);
        return jsonResponse({ status: "success", result: paymentResult });
      }

      case "delete": {
        var sheetName = String(payload.sheet || "Leads");
        var delId = payload.id;
        if (!delId) throw new Error("ID_REQUIRED");
        var deletionLock = null;
        if (sheetName === "Invoices" || sheetName === "Finance") {
          deletionLock = LockService.getScriptLock();
          deletionLock.waitLock(30000);
        }
        try {
          var delSheet = ss.getSheetByName(sheetName);
          if (!delSheet) throw new Error("SHEET_NOT_FOUND");
          var rowNum = findRowById(delSheet, delId);
          if (rowNum === -1) return jsonResponse({ status: "success", message: "Data sudah tidak ada." });
          assertCommercialRecordDeletionAllowed_(ss, sheetName, delId);
          delSheet.deleteRow(rowNum);
          return jsonResponse({ status: "success", message: "Data dihapus.", sheet: sheetName, id: delId });
        } finally {
          if (deletionLock) deletionLock.releaseLock();
        }
      }

      case "insert": {
        var insertSheetName = String(payload.sheet || "");
        var data = payload.data || {};
        if (!insertSheetName || !data.id) throw new Error("SHEET_AND_ID_REQUIRED");
        ensureSheet(ss, insertSheetName, FIELD_MAP[insertSheetName].headers);
        insertRecord(ss, insertSheetName, data);
        return jsonResponse({ status: "success", message: "Data ditambahkan.", id: data.id });
      }

      case "update_status": {
        var statusSheetName = String(payload.sheet || "Leads");
        var id = payload.id;
        var status = payload.status;
        if (!id || !status) throw new Error("ID_AND_STATUS_REQUIRED");
        if (identity.role === "team" && statusSheetName === "Leads" && isDealMenang(status)) throw new Error("OWNER_APPROVAL_REQUIRED_FOR_WON");
        var statusSheet = ss.getSheetByName(statusSheetName);
        if (!statusSheet) throw new Error("SHEET_NOT_FOUND");
        var statusRow = findRowById(statusSheet, id);
        if (statusRow === -1) throw new Error("RECORD_NOT_FOUND");
        var headers = statusSheet.getRange(1, 1, 1, statusSheet.getLastColumn()).getValues()[0];
        var statusCol = headers.findIndex(function(h){ return String(h).trim().toLowerCase() === "status"; });
        if (statusCol < 0) throw new Error("STATUS_COLUMN_NOT_FOUND");
        statusSheet.getRange(statusRow, statusCol + 1).setValue(status);
        if (identity.role === "owner" && (statusSheetName === "Leads" || statusSheetName === "Leads_CRM") && isDealMenang(status)) autoTriggerPillars(ss, id);
        return jsonResponse({ status: "success", message: "Status diperbarui.", row: statusRow });
      }

      case "send_cold_email":
        throw new Error("COLD_EMAIL_DISABLED");

      default:
        throw new Error("ACTION_NOT_ALLOWED");
    }
  } catch (err) {
    return jsonResponse({ status: "error", code: String(err && err.message || err), message: "Permintaan ditolak atau gagal diproses." });
  }
}

// Catat pembayaran secara idempoten: satu baris ledger dan satu jurnal Finance.
function recordInvoicePayment_(ss, rawPayment, identity) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var p = rawPayment || {};
    var id = String(p.id || "").trim();
    var invoiceId = String(p.invoiceId || "").trim();
    var paymentDate = String(p.paymentDate || "").trim();
    var paymentType = String(p.paymentType || "").trim().toLowerCase();
    var method = String(p.method || "").trim().toLowerCase();
    var amount = Number(p.amount);
    var reference = String(p.reference || "").trim();
    var notes = String(p.notes || "").trim();
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) throw new Error("INVALID_PAYMENT_ID");
    if (!invoiceId) throw new Error("INVOICE_ID_REQUIRED");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) throw new Error("INVALID_PAYMENT_DATE");
    var parsedDate = new Date(paymentDate + "T00:00:00Z");
    if (isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== paymentDate) throw new Error("INVALID_PAYMENT_DATE");
    if (["dp", "installment", "settlement"].indexOf(paymentType) < 0) throw new Error("INVALID_PAYMENT_TYPE");
    if (["transfer", "cash", "qris", "ewallet", "other"].indexOf(method) < 0) throw new Error("INVALID_PAYMENT_METHOD");
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("INVALID_PAYMENT_AMOUNT");
    if (reference.length > 120 || notes.length > 500) throw new Error("PAYMENT_TEXT_TOO_LONG");
    ensureSheet(ss, "Invoices", FIELD_MAP.Invoices.headers);
    ensureSheet(ss, "Invoice_Payments", FIELD_MAP.Invoice_Payments.headers);
    ensureSheet(ss, "Finance", FIELD_MAP.Finance.headers);
    var invoice = readSheetData(ss, "Invoices").find(function(x) { return String(x.id) === invoiceId; });
    if (!invoice) throw new Error("INVOICE_NOT_FOUND");
    if (String(invoice.status || "").toLowerCase() === "cancelled") throw new Error("INVOICE_CANCELLED");
    var paymentRows = readSheetData(ss, "Invoice_Payments");
    var existing = paymentRows.find(function(x) { return String(x.id) === id; });
    var invoiceNo = String(existing && existing.invoiceNo || invoice.docNo || invoice.id);
    var typeLabel = paymentType === "dp" ? "DP" : paymentType === "settlement" ? "Pelunasan" : "Cicilan";
    var financeId = "FIN-PAY-" + id;
    var financeDescription = "Pembayaran invoice " + invoiceNo + " · " + typeLabel + (reference ? " · Ref " + reference : "");
    var financeRows = readSheetData(ss, "Finance");
    var existingFinance = financeRows.find(function(x) { return String(x.id) === financeId; });
    if (existing) {
      var same = String(existing.invoiceId) === invoiceId &&
        String(existing.paymentDate) === paymentDate &&
        String(existing.paymentType).toLowerCase() === paymentType &&
        Number(existing.amount) === amount &&
        String(existing.method).toLowerCase() === method &&
        String(existing.reference || "") === reference &&
        String(existing.notes || "") === notes;
      if (!same) throw new Error("PAYMENT_ID_CONFLICT");
      if (existing.financeId && String(existing.financeId) !== financeId) throw new Error("PAYMENT_FINANCE_LINK_CONFLICT");
      existing.financeId = financeId;
      mergeSheet(ss, "Invoice_Payments", [existing]);
      if (existingFinance) {
        if (String(existingFinance.date) !== paymentDate ||
            String(existingFinance.type).toLowerCase() !== "income" ||
            String(existingFinance.category) !== "Pembayaran Invoice" ||
            Number(existingFinance.amount) !== amount ||
            String(existingFinance.description) !== financeDescription) throw new Error("PAYMENT_FINANCE_CONFLICT");
      } else {
        insertRecord(ss, "Finance", { id: financeId, date: paymentDate, type: "income", category: "Pembayaran Invoice", amount: amount, description: financeDescription });
      }
      return { duplicate: true, payment: existing, financeId: financeId };
    }
    if (existingFinance) throw new Error("PAYMENT_FINANCE_ORPHANED");
    var total = Math.round(Number(invoice.total) || 0);
    if (!Number.isSafeInteger(total) || total <= 0) throw new Error("INVALID_INVOICE_TOTAL");
    var paidBefore = paymentRows.filter(function(x) { return String(x.invoiceId) === invoiceId; }).reduce(function(sum, x) { return sum + Math.max(0, Number(x.amount) || 0); }, 0);
    var balance = total - paidBefore;
    if (balance <= 0) throw new Error("INVOICE_ALREADY_PAID");
    if (amount > balance) throw new Error("PAYMENT_EXCEEDS_BALANCE");
    if (paymentType === "dp" && paidBefore > 0) throw new Error("DP_ALREADY_RECORDED");
    if (paymentType === "dp" && amount >= balance) throw new Error("DP_CANNOT_SETTLE_INVOICE");
    if (paymentType === "settlement" && amount !== balance) throw new Error("SETTLEMENT_MUST_MATCH_BALANCE");
    var payment = {
      id: id, invoiceId: invoiceId, invoiceNo: invoiceNo, paymentDate: paymentDate,
      paymentType: paymentType, amount: amount, method: method, reference: reference,
      notes: notes, financeId: financeId, createdAt: new Date().toISOString(),
      createdBy: String(identity && identity.email || "")
    };
    insertRecord(ss, "Invoice_Payments", payment);
    // Jika Finance gagal setelah ledger tersimpan, retry ID yang sama memperbaiki jurnal.
    insertRecord(ss, "Finance", { id: financeId, date: paymentDate, type: "income", category: "Pembayaran Invoice", amount: amount, description: financeDescription });
    return { duplicate: false, payment: payment, financeId: financeId };
  } finally {
    lock.releaseLock();
  }
}

// ============== PIN, RATE LIMIT, DAN SESSION HELPERS ==============

var CSK_SESSION_TTL_SECONDS_ = 1800;
var CSK_LOGIN_LOCK_SECONDS_ = 900;
var CSK_LOGIN_MAX_FAILURES_ = 5;
var CSK_PIN_HASH_ROUNDS_ = 3000;

function cskHex_(bytes) {
  return bytes.map(function(b) {
    var v = (b + 256) % 256;
    return ("0" + v.toString(16)).slice(-2);
  }).join("");
}

function cskHashPin_(pin, salt) {
  var value = String(salt) + "|" + String(pin);
  for (var i = 0; i < CSK_PIN_HASH_ROUNDS_; i++) {
    value = cskHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8));
  }
  return value;
}

function cskConstantTimeEquals_(a, b) {
  a = String(a || "");
  b = String(b || "");
  var diff = a.length ^ b.length;
  var max = Math.max(a.length, b.length);
  for (var i = 0; i < max; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function setupCSKPinCredentialsFromPrompt() {
  var ui = SpreadsheetApp.getUi();
  var owner = ui.prompt("CSK Security Setup", "Masukkan PIN Owner (8-12 digit):", ui.ButtonSet.OK_CANCEL);
  if (owner.getSelectedButton() !== ui.Button.OK) return "Setup dibatalkan.";
  var team = ui.prompt("CSK Security Setup", "Masukkan PIN Tim (8-12 digit), harus berbeda:", ui.ButtonSet.OK_CANCEL);
  if (team.getSelectedButton() !== ui.Button.OK) return "Setup dibatalkan.";
  var result = setupCSKPinCredentials(owner.getResponseText(), team.getResponseText());
  owner = null;
  team = null;
  ui.alert("Setup login selesai", result, ui.ButtonSet.OK);
  return result;
}

function rotateCSKPinCredentialsFromPrompt() {
  var ui = SpreadsheetApp.getUi();
  var owner = ui.prompt("CSK PIN Rotation", "Masukkan PIN Owner baru (8-12 digit):", ui.ButtonSet.OK_CANCEL);
  if (owner.getSelectedButton() !== ui.Button.OK) return "Rotasi dibatalkan.";
  var team = ui.prompt("CSK PIN Rotation", "Masukkan PIN Tim baru (8-12 digit), harus berbeda:", ui.ButtonSet.OK_CANCEL);
  if (team.getSelectedButton() !== ui.Button.OK) return "Rotasi dibatalkan.";
  var result = cskStorePinCredentials_(owner.getResponseText(), team.getResponseText(), true);
  owner = null;
  team = null;
  ui.alert("Rotasi PIN selesai", result, ui.ButtonSet.OK);
  return result;
}

function setupCSKPinCredentials(ownerPin, teamPin) {
  return cskStorePinCredentials_(ownerPin, teamPin, false);
}

function cskStorePinCredentials_(ownerPin, teamPin, allowReplace) {
  ownerPin = String(ownerPin || "");
  teamPin = String(teamPin || "");
  if (!/^\d{8,12}$/.test(ownerPin) || !/^\d{8,12}$/.test(teamPin)) throw new Error("PIN harus terdiri dari 8-12 digit.");
  if (ownerPin === teamPin) throw new Error("PIN Owner dan Tim harus berbeda.");

  var props = PropertiesService.getScriptProperties();
  if (!allowReplace && (props.getProperty("CSK_OWNER_PIN_HASH") || props.getProperty("CSK_TEAM_PIN_HASH"))) {
    throw new Error("PIN sudah pernah disetel. Gunakan rotateCSKPinCredentialsFromPrompt() untuk menggantinya.");
  }

  var ownerSalt = Utilities.getUuid() + Utilities.getUuid();
  var teamSalt = Utilities.getUuid() + Utilities.getUuid();
  props.setProperties({
    CSK_OWNER_EMAIL: "cahayaselatankreasindo@gmail.com",
    CSK_TEAM_EMAILS: "zefdas@gmail.com",
    CSK_OWNER_PIN_SALT: ownerSalt,
    CSK_OWNER_PIN_HASH: cskHashPin_(ownerPin, ownerSalt),
    CSK_TEAM_PIN_SALT: teamSalt,
    CSK_TEAM_PIN_HASH: cskHashPin_(teamPin, teamSalt)
  }, false);

  return "PIN Owner dan Tim tersimpan sebagai hash. Properti Apps Script lainnya tetap dipertahankan; sesi lama akan kedaluwarsa saat masa aktifnya habis.";
}

function cskLoginWithPin_(email, pin, sessionId) {
  email = String(email || "").trim().toLowerCase();
  pin = String(pin || "");
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(String(sessionId || ""))) throw new Error("LOGIN_INVALID");
  if (!/^\d{8,12}$/.test(pin)) throw new Error("LOGIN_INVALID");

  var props = PropertiesService.getScriptProperties();
  var ownerEmail = String(props.getProperty("CSK_OWNER_EMAIL") || "").trim().toLowerCase();
  var teamEmails = String(props.getProperty("CSK_TEAM_EMAILS") || "").split(/[;,\n]/).map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean);
  var role = email && email === ownerEmail ? "owner" : (teamEmails.indexOf(email) >= 0 ? "team" : null);
  var cache = CacheService.getScriptCache();
  var failKey = "CSK_LOGIN_FAIL_" + cskHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email, Utilities.Charset.UTF_8)).slice(0, 32);
  var failures = Number(cache.get(failKey) || 0);
  if (failures >= CSK_LOGIN_MAX_FAILURES_) throw new Error("LOGIN_LOCKED_15_MIN");

  var prefix = role === "owner" ? "CSK_OWNER" : "CSK_TEAM";
  var salt = role ? String(props.getProperty(prefix + "_PIN_SALT") || "") : "unknown-account-salt";
  var expected = role ? String(props.getProperty(prefix + "_PIN_HASH") || "") : "";
  var actual = cskHashPin_(pin, salt);
  if (!role || !salt || !expected || !cskConstantTimeEquals_(actual, expected)) {
    cache.put(failKey, String(failures + 1), CSK_LOGIN_LOCK_SECONDS_);
    throw new Error("LOGIN_INVALID");
  }

  cache.remove(failKey);
  var session = { email: email, role: role, credentialHash: expected, issuedAt: new Date().toISOString() };
  cache.put(cskSessionKey_(sessionId), JSON.stringify(session), CSK_SESSION_TTL_SECONDS_);
  return { status: "success", identity: { email: email, role: role }, expiresIn: CSK_SESSION_TTL_SECONDS_ };
}

function cskSessionKey_(sessionId) {
  if (!sessionId || !/^[A-Za-z0-9_-]{40,100}$/.test(String(sessionId))) throw new Error("AUTH_REQUIRED");
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(sessionId), Utilities.Charset.UTF_8);
  return "CSK_SESSION_" + cskHex_(digest);
}

function cskRequireSession_(sessionId) {
  var cache = CacheService.getScriptCache();
  var key = cskSessionKey_(sessionId);
  var raw = cache.get(key);
  if (!raw) throw new Error("SESSION_EXPIRED");
  var session = JSON.parse(raw);
  var props = PropertiesService.getScriptProperties();
  var ownerEmail = String(props.getProperty("CSK_OWNER_EMAIL") || "").trim().toLowerCase();
  var teamEmails = String(props.getProperty("CSK_TEAM_EMAILS") || "").split(/[;,\n]/).map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean);
  var prefix = session.email === ownerEmail ? "CSK_OWNER" : (teamEmails.indexOf(session.email) >= 0 ? "CSK_TEAM" : "");
  if (!prefix) {
    cache.remove(key);
    throw new Error("AUTH_EMAIL_NOT_ALLOWED");
  }
  var currentHash = String(props.getProperty(prefix + "_PIN_HASH") || "");
  if (!currentHash || !cskConstantTimeEquals_(currentHash, session.credentialHash)) {
    cache.remove(key);
    throw new Error("SESSION_REVOKED");
  }
  var identity = { email: session.email, role: prefix === "CSK_OWNER" ? "owner" : "team" };
  cache.put(key, JSON.stringify(session), CSK_SESSION_TTL_SECONDS_);
  return identity;
}

function cskRevokeSession_(sessionId) {
  CacheService.getScriptCache().remove(cskSessionKey_(sessionId));
}

function cskFilterDataForRole_(data, role) {
  if (role === "owner") return data;
  if (role !== "team") throw new Error("FORBIDDEN");
  return {
    leads: data.leads || [],
    clients: data.clients || [],
    projects: data.projects || [],
    lastSynced: data.lastSynced || new Date().toISOString()
  };
}

function cskAssertTeamLeadTransitions_(ss, leads) {
  var sheet = ss.getSheetByName("Leads");
  var statusCol = -1;
  if (sheet && sheet.getLastRow() > 0) {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    statusCol = headers.findIndex(function(h){ return String(h).trim().toLowerCase() === "status"; });
  }
  (leads || []).forEach(function(lead) {
    if (!lead || !isDealMenang(lead.status)) return;
    var row = sheet ? findRowById(sheet, lead.id) : -1;
    if (row < 0 || statusCol < 0) throw new Error("OWNER_APPROVAL_REQUIRED_FOR_WON");
    var currentStatus = sheet.getRange(row, statusCol + 1).getValue();
    if (!isDealMenang(currentStatus)) throw new Error("OWNER_APPROVAL_REQUIRED_FOR_WON");
  });
}

function cskAssertPayloadAllowed_(identity, payload) {
  var role = identity && identity.role;
  var action = String(payload.action || "").toLowerCase();
  if (role !== "owner" && role !== "team") throw new Error("FORBIDDEN");

  // Team members may create and update shared operational records, but deletion is Owner-only.
  // Enforce this on the server so hiding a button cannot be bypassed from the browser.
  if (action === "delete" && role !== "owner") throw new Error("FORBIDDEN_DELETE");
  if ((action === "insert" || action === "delete") && String(payload.sheet || "") === "Invoice_Payments") throw new Error("PAYMENT_LEDGER_SERVER_ONLY");
  if (String(payload.sheet || "") === "Inventory_Transactions" && action !== "sync_all") throw new Error("INVENTORY_LEDGER_SERVER_ONLY");
  if (action === "record_invoice_payment") {
    if (role !== "owner") throw new Error("FORBIDDEN_PAYMENT_WRITE");
    if (!payload.payment || typeof payload.payment !== "object") throw new Error("PAYMENT_REQUIRED");
    return true;
  }

  if (action === "sync_all") {
    if (Object.prototype.hasOwnProperty.call(payload, "invoicePayments")) throw new Error("PAYMENT_LEDGER_SERVER_ONLY");
    if (Object.prototype.hasOwnProperty.call(payload, "legacyCostings") ||
        Object.prototype.hasOwnProperty.call(payload, "projectCosts")) {
      throw new Error("LEGACY_COST_DATA_READ_ONLY");
    }
    var ownerCollections = ["leads","clients","projects","finance","memory","marketingSpend","materials","costSheets","services","purchaseOrders","quotationSnapshots","quotations","invoices","salesOrders","inventoryTransactions"];
    var teamCollections = ["leads","clients","projects"];
    var allowed = role === "owner" ? ownerCollections : teamCollections;
    Object.keys(payload).forEach(function(key) {
      if (ownerCollections.indexOf(key) >= 0 && allowed.indexOf(key) < 0) throw new Error("FORBIDDEN_COLLECTION:" + key);
    });
    allowed.forEach(function(key) {
      if (Object.prototype.hasOwnProperty.call(payload, key) && !Array.isArray(payload[key])) throw new Error("INVALID_COLLECTION:" + key);
    });
    return true;
  }

  if (["insert","delete","update_status"].indexOf(action) >= 0) {
    var ownerSheets = Object.keys(FIELD_MAP || {});
    var teamSheets = ["Leads","Clients","Projects"];
    var sheet = String(payload.sheet || (action === "insert" ? "" : "Leads"));
    var allowedSheets = role === "owner" ? ownerSheets : teamSheets;
    if (allowedSheets.indexOf(sheet) < 0) throw new Error("FORBIDDEN_SHEET");
    if (action === "insert") {
      if (["Invoices","Commercial_Quotations"].indexOf(sheet) >= 0) throw new Error("COMMERCIAL_DOCUMENT_REQUIRES_SYNC");
      var data = payload.data || {};
      if (sheet === "Finance" && /^FIN-PAY-/i.test(String(data.id || ""))) throw new Error("PAYMENT_FINANCE_SERVER_ONLY");
    }
    if (action === "update_status" && ["Leads","Projects"].indexOf(sheet) < 0) throw new Error("FORBIDDEN_SHEET");
    return true;
  }

  if (action === "send_cold_email") throw new Error("COLD_EMAIL_DISABLED");
  throw new Error("ACTION_NOT_ALLOWED");
}

// ============== OTOMATISASI PILLAR ==============

/**
 * autoTriggerPillars()
 * Menelusuri tab Leads untuk baris dengan status 'won' / 'Deal Menang' yang
 * belum memiliki antrean proyek bertanda token [LEAD-{id}].
 * Deal Won hanya membuat antrean proyek. Fungsi ini TIDAK menulis pemasukan
 * Finance; pemasukan hanya dicatat setelah pembayaran benar-benar dikonfirmasi.
 * Fungsi ini IDEMPOTEN: antrean yang sudah punya token tidak akan diduplikasi.
 */
function stableLeadEntityId_(prefix, leadId) {
  const safeId = String(leadId == null ? "" : leadId).trim()
    .replace(/[^A-Za-z0-9._:-]/g, "-")
    .slice(0, Math.max(1, 80 - prefix.length));
  return safeId ? prefix + safeId : "";
}
function leadReferenceToken_(leadId) {
  return "[LEAD-" + String(leadId == null ? "" : leadId).trim() + "]";
}
function normalizedClientName_(value) {
  return String(value == null ? "" : value).trim().toLowerCase().replace(/\s+/g, " ");
}
function ensureLeadClient_(ss, lead, refToken) {
  const clientName = String(lead.name == null ? "" : lead.name).trim();
  const normalizedName = normalizedClientName_(clientName);
  if (!normalizedName) return false;
  const clients = readSheetData(ss, "Clients");
  const existingClient = clients.find(client => normalizedClientName_(client.name) === normalizedName);
  const clientProjects = readSheetData(ss, "Projects").filter(project => normalizedClientName_(project.client) === normalizedName);
  const totalSpend = clientProjects.reduce((sum, project) => sum + (Number(project.value) || 0), 0);
  if (existingClient) {
    const updatedClient = Object.assign({}, existingClient, {
      phone: existingClient.phone || lead.phone || "",
      projectsCount: clientProjects.length,
      totalSpend: totalSpend
    });
    // Header-aware upsert preserves custom columns and non-standard column order.
    mergeSheet(ss, "Clients", [updatedClient]);
    return false;
  }
  insertRecord(ss, "Clients", {
    id: stableLeadEntityId_("AUTO-CLI-LEAD-", lead.id),
    name: clientName, phone: lead.phone || "", projectsCount: clientProjects.length,
    totalSpend: totalSpend, notes: "Dikonversi dari Lead " + refToken, rating: 0, review: ""
  });
  return true;
}
/**
 * Deal Won creates one linked project and ensures one client record.
 * It deliberately does NOT create Finance income: a won contract is not cash received.
 */
function autoTriggerPillars(ss, forceLeadId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const leadsSheet = ss.getSheetByName("Leads");
    if (!leadsSheet || leadsSheet.getLastRow() <= 1) return { financeCreated: 0, projectCreated: 0, clientCreated: 0 };
    const leads = readSheetData(ss, "Leads");
    const projectsSheet = ss.getSheetByName("Projects");
    let projectCreated = 0, clientCreated = 0;
    leads.forEach(lead => {
      if (!isDealMenang(lead.status)) return;
      if (forceLeadId && String(lead.id).trim() !== String(forceLeadId).trim()) return;
      const leadId = String(lead.id == null ? "" : lead.id).trim();
      if (!leadId) return;
      const refToken = leadReferenceToken_(leadId);
      const projectId = stableLeadEntityId_("AUTO-PRJ-LEAD-", leadId);
      const projectAlreadyExists = hasTokenInSheet(ss, "Projects", refToken) ||
        (projectsSheet && findRowById(projectsSheet, projectId) !== -1);
      if (!projectAlreadyExists) {
        const deadlineDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        insertRecord(ss, "Projects", {
          id: projectId, title: "Proyek " + (lead.name || ""), client: lead.name || "",
          value: Number(lead.value) || 0, status: "plan", deadline: deadlineDate,
          notes: "Konversi otomatis dari Lead " + refToken,
          sopChecklist: "Brief:0;Produksi:0;Review:0;Revisi:0;Delivery:0"
        });
        projectCreated++;
      }
      if (ensureLeadClient_(ss, lead, refToken)) clientCreated++;
    });
    return { financeCreated: 0, projectCreated: projectCreated, clientCreated: clientCreated };
  } finally {
    lock.releaseLock();
  }
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
  Logger.log("Cold outreach otomatis dinonaktifkan. Tidak ada email yang dikirim.");
  return { status: "disabled", sent: 0 };
}

function installDailyOutreachTrigger() {
  throw new Error("Trigger cold outreach otomatis dinonaktifkan. Pengiriman hanya boleh diaktifkan kembali setelah persetujuan Owner dan kontrol akses server tersedia.");
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

  // Validasi header terlebih dahulu; header ambigu menghentikan proses tanpa menghapus data.
  // Kolom kontrak yang belum ada ditambahkan di kanan.
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
      // Preserve user-owned columns outside FIELD_MAP during header-aware upserts.
      for (var c = 0; c < newRow.length; c++) {
        var headerKey = String(headerRow[c] || "").trim().toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(contractPos, headerKey)) newRow[c] = oldRow[c];
      }
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

/** Menu untuk menjalankan dialog PIN dari konteks Google Sheets. */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu("CSK Security")
    .addItem("Setup PIN Owner & Tim", "setupCSKPinCredentialsFromPrompt")
    .addItem("Rotasi PIN Owner & Tim", "rotateCSKPinCredentialsFromPrompt")
    .addToUi();
}
