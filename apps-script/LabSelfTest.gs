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
