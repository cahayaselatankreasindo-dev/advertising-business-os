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
