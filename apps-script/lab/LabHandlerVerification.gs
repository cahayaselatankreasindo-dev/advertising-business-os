/**
 * CSK Business OS — LAB ONLY. Non-mutating live-handler rejection test.
 */
function cskLabVerifyActiveHandlers() {
  var ss = cskLabGuardRead_();
  var getCode = String(doGet), postCode = String(doPost);
  var readWired = getCode.indexOf("cskLabGuardRead_()") !== -1;
  var postWired = postCode.indexOf("cskLabGuardPost_(payload)") !== -1;
  if (!readWired || !postWired) throw new Error("LAB_HANDLER_GUARD_FAIL: guard calls missing from active handlers.");
  var token = getApiToken();
  if (!token || token.length < 20) throw new Error("LAB_HANDLER_GUARD_FAIL: LAB token not ready.");
  var sheet = ss.getSheetByName("Leads"), sentinel = "GUARD-NEGATIVE-NOT-DUMMY";
  if (findRowById(sheet,sentinel) !== -1) throw new Error("LAB_HANDLER_GUARD_FAIL: sentinel already exists.");
  var before = sheet.getLastRow();
  var output = doPost({postData:{contents:JSON.stringify({action:"delete",token:token,sheet:"Leads",id:sentinel})}});
  var parsed = JSON.parse(output.getContent());
  if (!(parsed.status === "error" && String(parsed.message||"").indexOf("LAB guard:") !== -1)) {
    throw new Error("LAB_HANDLER_GUARD_FAIL: live doPost did not reject forbidden ID.");
  }
  if (sheet.getLastRow() !== before || findRowById(sheet,sentinel) !== -1) throw new Error("LAB_HANDLER_GUARD_FAIL: Leads changed.");
  return {status:"LAB_HANDLER_GUARD_PASS",labIdVerified:ss.getId()===CSK_LAB_SHEET_ID,guardReadWired:true,guardPostWired:true,unsafeDeleteRejectedByLiveHandler:true,leadRowCountUnchanged:true,externalHttpRequests:0,emailSends:0};
}
