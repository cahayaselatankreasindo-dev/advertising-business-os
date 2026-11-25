/**
 * CSK BUSINESS OS — Backup Google Sheets harian.
 *
 * KODE PERSIAPAN. Belum aktif sampai file ini di-push ke Apps Script
 * yang terhubung dengan DATABASE UTAMA dan fungsi
 * installCskBusinessOsDailyBackup() dijalankan satu kali oleh pemilik.
 *
 * Tidak mengubah data, tidak menghapus backup, dan tidak membuat endpoint API.
 * Ditulis terpisah dari Code.gs agar kontrak sync produksi tidak berubah.
 */

var CSK_BACKUP_CONFIG = {
  databasePrefix: 'CSK BUSINESS OS - DATABASE UTAMA',
  activeFolderName: '00 - BUSINESS OS - DATABASE AKTIF',
  parentFolderName: 'Manajerial Internal CSK',
  backupFolderName: '99 - BACKUP BUSINESS OS - JANGAN HAPUS',
  backupPrefix: 'BACKUP HARIAN CSK BUSINESS OS',
  timezone: 'Asia/Jakarta',
  sourceProperty: 'CSK_BACKUP_SOURCE_SPREADSHEET_ID',
  folderProperty: 'CSK_BACKUP_TARGET_FOLDER_ID',
  latestProperty: 'CSK_BACKUP_LATEST_RESULT'
};

/**
 * SETUP SATU KALI (jalankan dari editor Apps Script milik spreadsheet utama).
 * Validasi struktur Drive -> simpan ID privat di Script Properties ->
 * buat backup saat ini -> pasang trigger harian jika belum ada.
 * Trigger Apps Script pada jam 02.00-03.00 WIB (waktu tidak presisi).
 */
function installCskBusinessOsDailyBackup() {
  var config = CSK_BACKUP_CONFIG;
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Buka Apps Script dari spreadsheet database UTAMA (bound script).');
  }

  var sourceFile = DriveApp.getFileById(spreadsheet.getId());
  if (sourceFile.getName().indexOf(config.databasePrefix) !== 0) {
    throw new Error('Batal: spreadsheet aktif bukan DATABASE UTAMA CSK Business OS.');
  }

  var sourceParents = sourceFile.getParents();
  if (!sourceParents.hasNext()) {
    throw new Error('Batal: lokasi spreadsheet utama di Google Drive tidak ditemukan.');
  }
  var activeFolder = sourceParents.next();
  if (activeFolder.getName() !== config.activeFolderName) {
    throw new Error('Batal: folder database aktif tidak sesuai.');
  }

  var activeParents = activeFolder.getParents();
  if (!activeParents.hasNext()) {
    throw new Error('Batal: folder induk Manajerial Internal CSK tidak ditemukan.');
  }
  var parentFolder = activeParents.next();
  if (parentFolder.getName() !== config.parentFolderName) {
    throw new Error('Batal: folder induk bukan Manajerial Internal CSK.');
  }

  var backupFolders = parentFolder.getFoldersByName(config.backupFolderName);
  if (!backupFolders.hasNext()) {
    throw new Error('Batal: folder backup belum ditemukan. Jangan buat folder baru diam-diam.');
  }
  var backupFolder = backupFolders.next();
  if (backupFolders.hasNext()) {
    throw new Error('Batal: ada beberapa folder backup dengan nama sama. Periksa manual.');
  }

  var props = PropertiesService.getScriptProperties();
  var values = {};
  values[config.sourceProperty] = spreadsheet.getId();
  values[config.folderProperty] = backupFolder.getId();
  props.setProperties(values);

  // Buat satu backup awal dan pastikan salinan berhasil dibuat sebelum scheduling.
  var result = backupCskBusinessOsDaily();

  var triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'backupCskBusinessOsDaily';
  });
  if (triggers.length === 0) {
    ScriptApp.newTrigger('backupCskBusinessOsDaily')
      .timeBased()
      .atHour(2)
      .everyDays(1)
      .inTimezone(config.timezone)
      .create();
  }
  Logger.log('CSK backup siap; trigger terdeteksi: ' + Math.max(triggers.length, 1));
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Fungsi trigger harian. Idempoten berdasarkan TANGGAL WIB,
 * tidak menghapus backup lama. Lock mencegah dua eksekusi bersamaan.
 */
function backupCskBusinessOsDaily() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Backup sedang berjalan. Coba ulang di eksekusi berikutnya.');
  }

  try {
    var c = CSK_BACKUP_CONFIG;
    var props = PropertiesService.getScriptProperties();
    var spreadsheetId = props.getProperty(c.sourceProperty);
    var folderId = props.getProperty(c.folderProperty);
    if (!spreadsheetId || !folderId) {
      throw new Error('Backup belum diinstal: jalankan installCskBusinessOsDailyBackup dulu.');
    }

    var source = DriveApp.getFileById(spreadsheetId);
    var target = DriveApp.getFolderById(folderId);
    if (source.getName().indexOf(c.databasePrefix) !== 0 ||
        target.getName() !== c.backupFolderName) {
      throw new Error('Backup dibatalkan: nama sumber atau tujuan tidak cocok.');
    }

    var date = Utilities.formatDate(new Date(), c.timezone, 'yyyy-MM-dd');
    var backupName = c.backupPrefix + ' - ' + date + ' - JANGAN HAPUS';
    var existing = target.getFilesByName(backupName);
    var result;

    if (existing.hasNext()) {
      var previous = existing.next();
      result = { status: 'already_exists', date: date, backupId: previous.getId() };
    } else {
      var copy = source.makeCopy(backupName, target);
      if (!copy || !copy.getId()) {
        throw new Error('Google Drive tidak mengembalikan ID salinan backup.');
      }
      // Pastikan file hasil copy bisa dibuka dengan akun pemilik.
      var check = DriveApp.getFileById(copy.getId());
      if (check.getName() !== backupName) {
        throw new Error('Salinan ada tetapi verifikasi nama backup tidak cocok.');
      }
      result = { status: 'created', date: date, backupId: copy.getId() };
    }

    props.setProperty(c.latestProperty, JSON.stringify(result));
    Logger.log(JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

/** Audit cepat tanpa mengedit file: cek trigger dan metadata backup terakhir. */
function checkCskBusinessOsBackupStatus() {
  var c = CSK_BACKUP_CONFIG;
  var props = PropertiesService.getScriptProperties();
  var triggerCount = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'backupCskBusinessOsDaily';
  }).length;
  var summary = {
    configured: !!props.getProperty(c.sourceProperty) &&
      !!props.getProperty(c.folderProperty),
    dailyTriggerCount: triggerCount,
    latestResult: props.getProperty(c.latestProperty) || null
  };
  Logger.log(JSON.stringify(summary));
  return summary;
}
