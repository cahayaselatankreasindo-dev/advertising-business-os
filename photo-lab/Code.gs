/**
 * CSK Photo Reports LAB — a SEPARATE, owner-only Apps Script project.
 * Never paste this file into the production Business OS Apps Script.
 * Deployment must be "Execute as me" + "Only myself".
 */
const PHOTO_LAB = Object.freeze({
  folderName: 'LAB - Foto Laporan Proyek Business OS (DRAFT)',
  spreadsheetName: 'CSK PHOTO LAB - Business OS (DRAFT)',
  marker: 'CSK_PHOTO_LAB_ONLY_V1',
  reportTab: 'Photo_Reports',
  markerTab: '_CSK_PHOTO_LAB',
  maxBytes: 1800000,
  stages: ['Brief', 'Persetujuan Desain', 'Pembelian Bahan', 'Fabrikasi', 'Finishing', 'Quality Control', 'Pengiriman', 'Instalasi'],
  headers: ['ReportID', 'UploadedAtUTC', 'ProjectID', 'Stage', 'Caption', 'DriveFileID', 'OriginalName', 'MimeType', 'Bytes', 'OwnerEmail']
});

function labProps_() { return PropertiesService.getScriptProperties(); }

function labOwner_() {
  const owner = String(labProps_().getProperty('CSK_PHOTO_OWNER_EMAIL') || '').trim().toLowerCase();
  const active = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const effective = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  // Fail closed on a blank active identity; "execute as me" alone cannot authenticate viewers.
  if (!owner || !active || !effective || owner !== active || owner !== effective) {
    throw new Error('Akses ditolak. Gunakan akun owner CSK pada LAB privat.');
  }
  return owner;
}

function labFolder_() {
  const id = labProps_().getProperty('CSK_PHOTO_LAB_FOLDER_ID') || '';
  if (!/^[A-Za-z0-9_-]{15,}$/.test(id)) throw new Error('Folder LAB belum dikonfigurasi.');
  const folder = DriveApp.getFolderById(id);
  if (folder.getName() !== PHOTO_LAB.folderName || folder.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw new Error('Folder harus LAB khusus foto, dengan akses privat.');
  }
  if (folder.getViewers().length || folder.getEditors().length) {
    throw new Error('Folder LAB memiliki anggota lain. Hanya owner diizinkan.');
  }
  return folder;
}

function isInFolder_(file, folder) {
  const parents = file.getParents();
  while (parents.hasNext()) if (parents.next().getId() === folder.getId()) return true;
  return false;
}

function labSheet_(folder) {
  const id = labProps_().getProperty('CSK_PHOTO_LAB_SPREADSHEET_ID') || '';
  if (!/^[A-Za-z0-9_-]{15,}$/.test(id)) throw new Error('Sheet metadata LAB belum diinisialisasi.');
  const ss = SpreadsheetApp.openById(id);
  const marker = ss.getSheetByName(PHOTO_LAB.markerTab);
  const report = ss.getSheetByName(PHOTO_LAB.reportTab);
  if (ss.getName() !== PHOTO_LAB.spreadsheetName || !marker || marker.getRange('A1').getValue() !== PHOTO_LAB.marker || !report) {
    throw new Error('Sheet bukan metadata LAB resmi; penulisan diblokir.');
  }
  if (!isInFolder_(DriveApp.getFileById(id), folder)) {
    throw new Error('Sheet metadata tidak berada dalam folder LAB.');
  }
  return report;
}

/** Run ONCE by the owner from a NEW, independent Apps Script editor. */
function setupPhotoLab() {
  labOwner_();
  const folder = labFolder_();
  if (labProps_().getProperty('CSK_PHOTO_LAB_SPREADSHEET_ID')) {
    labSheet_(folder);
    return 'Sheet metadata LAB sudah ada dan valid.';
  }
  const ss = SpreadsheetApp.create(PHOTO_LAB.spreadsheetName);
  const marker = ss.getSheets()[0];
  marker.setName(PHOTO_LAB.markerTab);
  marker.getRange('A1').setValue(PHOTO_LAB.marker);
  const report = ss.insertSheet(PHOTO_LAB.reportTab);
  report.getRange(1, 1, 1, PHOTO_LAB.headers.length).setValues([PHOTO_LAB.headers]);
  report.setFrozenRows(1);
  SpreadsheetApp.flush();
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  if (!isInFolder_(DriveApp.getFileById(ss.getId()), folder)) throw new Error('Gagal memindahkan Sheet baru ke folder LAB.');
  labProps_().setProperty('CSK_PHOTO_LAB_SPREADSHEET_ID', ss.getId());
  return 'Sheet metadata LAB baru dibuat dalam folder privat. ID disimpan hanya di Script Properties.';
}

function doGet(e) {
  try {
    labOwner_();
    labFolder_();
    const tpl = HtmlService.createTemplateFromFile('Index');
    const params = e && e.parameter || {};
    tpl.initialProjectId = String(params.projectId || '').slice(0, 80);
    tpl.initialStage = String(params.stage || '').slice(0, 60);
    return tpl.evaluate().setTitle('CSK — Foto Laporan Proyek (LAB)');
  } catch (error) {
    return HtmlService.createHtmlOutput('Akses LAB ditolak. Masuk dengan akun owner CSK dan periksa konfigurasi.');
  }
}

function photoLabStatus() {
  labOwner_();
  const folder = labFolder_();
  labSheet_(folder);
  return {ready: labProps_().getProperty('CSK_PHOTO_ENABLE_WRITE') === 'true', maxBytes: PHOTO_LAB.maxBytes};
}

function validatePhoto_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Data foto tidak valid.');
  const projectId = String(payload.projectId || '').trim();
  const stage = String(payload.stage || '');
  const caption = String(payload.caption || '').trim();
  const mime = String(payload.mime || '');
  const base64 = String(payload.base64 || '');
  const requestId = String(payload.requestId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new Error('Identitas unggahan tidak valid.');
  const originalName = String(payload.originalName || 'foto').replace(/[\x00-\x1F\x7F]/g, '').slice(0, 120);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(projectId)) throw new Error('ID proyek tidak valid.');
  if (!PHOTO_LAB.stages.includes(stage)) throw new Error('Tahap proyek tidak dikenal.');
  if (!caption || caption.length > 500 || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(caption)) throw new Error('Catatan wajib diisi (maksimal 500 karakter).');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error('Tipe gambar tidak diperbolehkan.');
  if (!base64 || base64.length > Math.ceil(PHOTO_LAB.maxBytes / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Foto terlalu besar atau rusak.');
  return {requestId, projectId, stage, caption, mime, base64, originalName};
}

function verifyImageBytes_(bytes, mime) {
  if (!bytes || !bytes.length || bytes.length > PHOTO_LAB.maxBytes) throw new Error('Foto melebihi 1,8 MB.');
  const u = n => bytes[n] & 255;
  const jpg = bytes.length >= 3 && u(0) === 255 && u(1) === 216 && u(2) === 255;
  const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((x,i)=>u(i)===x);
  const webp = bytes.length >= 12 && [82,73,70,70].every((x,i)=>u(i)===x) && [87,69,66,80].every((x,i)=>u(i+8)===x);
  if (!((mime === 'image/jpeg' && jpg) || (mime === 'image/png' && png) || (mime === 'image/webp' && webp))) {
    throw new Error('Isi file tidak sesuai format gambar.');
  }
}

function safeCell_(value) {
  const s = String(value == null ? '' : value);
  return /^[\s]*[=+\-@]/.test(s) ? "'" + s : s;
}

function uploadPhoto(payload) {
  const owner = labOwner_();
  if (labProps_().getProperty('CSK_PHOTO_ENABLE_WRITE') !== 'true') throw new Error('Unggah LAB belum diaktifkan owner.');
  const folder = labFolder_();
  const sheet = labSheet_(folder); // Verify metadata target BEFORE writing a Drive file.
  const data = validatePhoto_(payload);
  const bytes = Utilities.base64Decode(data.base64);
  verifyImageBytes_(bytes, data.mime);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Server sedang sibuk. Coba kembali.');
  try {
    const id = data.requestId;
    // Stable upload ID avoids creating another Drive file after a timed-out response.
    const existing = sheet.getDataRange().getValues().slice(1).find(r => String(r[0]) === id);
    if (existing) {
      if (String(existing[2]) !== data.projectId || String(existing[7]) !== data.mime) throw new Error('Identitas unggahan sudah dipakai untuk proyek lain.');
      return {ok:true, id, fileId:String(existing[5]), duplicate:true, message:'Foto ini sudah tercatat; tidak diunggah ulang.'};
    }
    const extension = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[data.mime];
    const date = new Date().toISOString();
    const name = 'LAB-' + id + '.' + extension;
    const orphaned = folder.getFilesByName(name);
    if (orphaned.hasNext()) {
      const orphan = orphaned.next();
      return {ok:false, needsReview:true, fileId:orphan.getId(), message:'Foto sudah ada di Drive LAB tetapi metadata belum tercatat. Periksa sebelum mencoba lagi.'};
    }
    const blob = Utilities.newBlob(bytes, data.mime, name);
    const file = folder.createFile(blob); // File inherits private folder; NEVER set public link sharing.
    try {
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, PHOTO_LAB.headers.length).setValues([[
        id, date, data.projectId, data.stage, safeCell_(data.caption), file.getId(), safeCell_(data.originalName), data.mime, bytes.length, owner
      ]]);
    } catch (error) {
      console.error('PHOTO_LAB_METADATA_FAILED: ' + file.getId() + ': ' + String(error));
      return {ok:false, needsReview:true, fileId:file.getId(), message:'Foto ada di Drive LAB, tetapi catatan metadata gagal. Periksa folder dan hubungi owner; jangan unggah ulang dahulu.'};
    }
    return {ok:true, id, fileId:file.getId(), message:'Foto tersimpan secara privat dan metadata laporan tercatat.'};
  } finally { lock.releaseLock(); }
}

function listProjectPhotos(projectId) {
  labOwner_();
  const folder = labFolder_();
  const sheet = labSheet_(folder);
  const id = String(projectId || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(id)) throw new Error('Pilih ID proyek valid.');
  const rows = sheet.getDataRange().getValues();
  return rows.slice(1).filter(r => String(r[2]) === id).slice(-100).reverse().map(r => ({
    uploadedAt: String(r[1]), stage:String(r[3]), caption:String(r[4]),
    fileUrl:'https://drive.google.com/file/d/' + encodeURIComponent(String(r[5])) + '/view',
    originalName:String(r[6]), bytes:Number(r[8])
  }));
}
