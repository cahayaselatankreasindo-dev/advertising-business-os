/**
 * CSK Business OS — LAB ONLY: safe handler integration check.
 * Non-mutating real doPost rejection test; no email actions and no writes.
 * DO NOT use in production Apps Script.
 */
function cskLabVerifyActiveHandlers() {
  var ss = cskLabGuardRead_();
  // Check the actual functions compiled in this Apps Script project,
  // not merely that the helper functions are defined.
  var getCode = String(doGet);
  var postCode = String(doPost);
  var readWired = getCode.indexOf("cskLabGuardRead_()") !== -1;
  var postWired = postCode.indexOf("cskLabGuardPost_(payload)") !== -1;

  if (!readWired || !postWired) {
    throw new Error(
      "LAB_HANDLER_GUARD_FAIL: doGet/doPost belum memanggil guard di Code.gs."
    );
  }

  var token = getApiToken();
  if (!token || token.length < 20) {
    throw new Error("LAB_HANDLER_GUARD_FAIL: token LAB belum siap.");
  }

  var table = ss.getSheetByName("Leads");
  var impossibleId = "GUARD-NEGATIVE-NOT-DUMMY";
  // Strictly ensure an unguarded backend would not delete anything.
  if (findRowById(table, impossibleId) !== -1) {
    throw new Error("LAB_HANDLER_GUARD_FAIL: sentinel ID ternyata ada.");
  }
  var beforeRows = table.getLastRow();

  var body = {
    action: "delete",
    token: token,
    sheet: "Leads",
    id: impossibleId
  };
  // IMPORTANT: only a delete for a verified NON-EXISTENT ID is used here.
  // Even if the guard were not active, the backend would make no changes.
  var output = doPost({ postData: { contents: JSON.stringify(body) } });
  var parsed = JSON.parse(output.getContent());

  var rejectedByLabGuard =
    parsed.status === "error" &&
    String(parsed.message || "").indexOf("LAB guard:") !== -1;
  if (!rejectedByLabGuard) {
    throw new Error(
      "LAB_HANDLER_GUARD_FAIL: doPost tidak menolak ID terlarang. " +
      "status=" + String(parsed.status || "unknown")
    );
  }

  if (table.getLastRow() !== beforeRows ||
      findRowById(table, impossibleId) !== -1) {
    throw new Error("LAB_HANDLER_GUARD_FAIL: data Leads berubah.");
  }

  var result = {
    status: "LAB_HANDLER_GUARD_PASS",
    labIdVerified: ss.getId() === CSK_LAB_SHEET_ID,
    guardReadWired: readWired,
    guardPostWired: postWired,
    unsafeDeleteRejectedByLiveHandler: true,
    leadRowCountUnchanged: true,
    externalHttpRequests: 0,
    emailSends: 0
  };
  Logger.log(JSON.stringify(result));
  return result;
}
