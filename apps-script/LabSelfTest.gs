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
  "Leads", "Clients", "Projects", "Finance", "Memory", "Marketing_Spend"
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
    var status = String(l.status || "").toLowerCase();
    return status === "won" || status === "deal menang";
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
  var token = getApiToken();
  var secure = token.length >= 20 &&
    token !== "GANTI-DENGAN-TOKEN-RAHASIA-ANDA";
  var status = {
    labIdVerified: ss.getId() === CSK_LAB_SHEET_ID,
    backendPresent: true,
    apiTokenConfigured: secure,
    externalWebAppRequired: false
  };
  Logger.log(JSON.stringify(status));
  return status;
}

/** Strong random LAB token, generated and stored ONLY in LAB Script Properties. */
function cskLabEnsurePrivateToken_() {
  cskLabRequireDummySheet_();
  var existing = getApiToken();
  if (existing && existing.length >= 20 &&
      existing !== "GANTI-DENGAN-TOKEN-RAHASIA-ANDA") {
    return { created: false, configured: true };
  }
  var newToken = "LAB-" +
    Utilities.getUuid().replace(/-/g, "") +
    Utilities.getUuid().replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty("API_TOKEN", newToken);
  // Deliberately DO NOT log the token: no secrets in public logs.
  return { created: true, configured: true };
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
  var token = getApiToken();
  if (!token || !isAuthorized({token:token}) ||
      isAuthorized({token:""}) ||
      isAuthorized({token:"INVALID-TEST-TOKEN"})) {
    throw new Error("DIBATALKAN: autentikasi API LAB belum aman.");
  }

  // The complete view must be denied without a valid API token.
  var denied = JSON.parse(doGet({ parameter: { protocolVersion: 2 } }).getContent());
  if (denied.status !== "error") {
    throw new Error("DIBATALKAN: doGet tanpa token masih dapat membaca data.");
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
  try {
    cskLabParseOutput_(doPost({
      postData: { contents: JSON.stringify({
        action: "sync_all", token: token, protocolVersion: 2, leads: [first]
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
    cskLabParseOutput_(doPost({
      postData: { contents: JSON.stringify({
        action: "sync_all", token: token, protocolVersion: 2, leads: [updated]
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
        action: "delete", token: token, protocolVersion: 2, sheet: "Leads", id: id
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
      authenticationRequired:true, tokenCreated:tokenResult.created,
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
