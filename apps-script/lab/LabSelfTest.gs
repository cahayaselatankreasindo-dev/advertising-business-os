/**
 * CSK Business OS — LAB ONLY.
 * Bind this Apps Script project to the dedicated dummy spreadsheet.
 * Never copy this file into production.
 */
var CSK_LAB_SHEET_ID = "REPLACE_WITH_LAB_SPREADSHEET_ID";
var CSK_LAB_SPREADSHEET_NAME = "CSK Business OS LAB - DUMMY";
var CSK_LAB_REQUIRED_SHEETS_ = [
  "Leads", "Clients", "Projects", "Finance", "Memory", "Marketing_Spend"
];

function cskLabRequireDummySheet_() {
  var expectedId = String(CSK_LAB_SHEET_ID || "").trim();
  if (!expectedId || expectedId === "REPLACE_WITH_LAB_SPREADSHEET_ID") {
    throw new Error("LAB: spreadsheet ID is not configured.");
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId() !== expectedId) {
    throw new Error("LAB: spreadsheet ID mismatch.");
  }
  if (ss.getName() !== CSK_LAB_SPREADSHEET_NAME) {
    throw new Error("LAB: spreadsheet name mismatch.");
  }
  var token = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
  if (!token || token.length < 20 || token === "GANTI-DENGAN-TOKEN-RAHASIA-ANDA") {
    throw new Error("LAB: API_TOKEN is not configured.");
  }
  var idPattern = /^(TEST-|QA-LAB-)[A-Za-z0-9_-]{1,120}$/;
  CSK_LAB_REQUIRED_SHEETS_.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error("LAB: missing sheet " + name);
    if (sheet.getLastRow() <= 1) return;
    var values = sheet.getDataRange().getValues();
    var headers = values[0].map(function(h) { return String(h).trim().toLowerCase(); });
    var idIndex = headers.indexOf("id");
    if (idIndex < 0) throw new Error("LAB: missing ID column in " + name);
    var statusIndex = headers.indexOf("status");
    if (name === "Leads" && statusIndex < 0) throw new Error("LAB: missing Leads Status column.");
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (!row.some(function(v) { return String(v == null ? "" : v).trim() !== ""; })) continue;
      var id = String(row[idIndex] || "").trim();
      if (!idPattern.test(id)) throw new Error("LAB: non-dummy ID in " + name + " row " + (i + 1));
      if (name === "Leads") {
        var status = String(row[statusIndex] || "").toLowerCase().replace(/[\s_-]+/g, "");
        if (["won", "dealmenang", "dealwin"].indexOf(status) !== -1) {
          throw new Error("LAB: Deal Won rows are forbidden.");
        }
      }
    }
  });
  return ss;
}
