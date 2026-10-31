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
  finance: "Finance", memory: "Memory", marketingSpend: "Marketing_Spend"
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
      if (["action", "token", "sheet", "id"].indexOf(k) === -1) {
        throw new Error("LAB guard: unknown delete field.");
      }
    });
    if (Object.keys(CSK_LAB_WRITE_KEYS_).map(function(k) {
      return CSK_LAB_WRITE_KEYS_[k];
    }).indexOf(payload.sheet) === -1) {
      throw new Error("LAB guard: unsupported sheet.");
    }
    cskLabGuardDummyId_(payload.id);
    return;
  }

  // sync_all: write only six known domains; never allow opaque extra actions.
  var permittedKeys = ["action", "token"].concat(Object.keys(CSK_LAB_WRITE_KEYS_));
  Object.keys(payload).forEach(function(k) {
    if (permittedKeys.indexOf(k) === -1) {
      throw new Error("LAB guard: unknown sync payload key.");
    }
  });
  var records = 0;
  Object.keys(CSK_LAB_WRITE_KEYS_).forEach(function(area) {
    if (!(area in payload)) return;
    var rows = payload[area];
    if (!Array.isArray(rows)) {
      throw new Error("LAB guard: " + area + " must be an array.");
    }
    rows.forEach(function(row) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error("LAB guard: record format invalid.");
      }
      cskLabGuardDummyId_(row.id);
      if (area === "leads") {
        var status = String(row.status || "").toLowerCase().trim();
        if (status === "won" || status === "deal menang" ||
            status === "deal_menang") {
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
