/**
 * CSK Business OS security layer — draft integration helper.
 * Configure Script Properties:
 * CSK_GOOGLE_OAUTH_CLIENT_ID, CSK_OWNER_EMAIL, CSK_TEAM_EMAILS
 * No API token or OAuth client secret belongs in the browser.
 */
function cskVerifyGoogleIdToken_(idToken) {
  if (!idToken || typeof idToken !== "string" || idToken.length > 10000) throw new Error("AUTH_REQUIRED");
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty("CSK_GOOGLE_OAUTH_CLIENT_ID") || "";
  if (!clientId) throw new Error("AUTH_NOT_CONFIGURED");
  var response = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken), {muteHttpExceptions:true});
  if (response.getResponseCode() !== 200) throw new Error("AUTH_INVALID_TOKEN");
  var c;
  try { c = JSON.parse(response.getContentText()); } catch (e) { throw new Error("AUTH_INVALID_TOKEN"); }
  var now = Math.floor(Date.now()/1000);
  var email = String(c.email || "").trim().toLowerCase();
  if (String(c.aud || "") !== clientId) throw new Error("AUTH_WRONG_AUDIENCE");
  if (!["accounts.google.com","https://accounts.google.com"].includes(String(c.iss || ""))) throw new Error("AUTH_WRONG_ISSUER");
  if (Number(c.exp || 0) <= now + 60) throw new Error("AUTH_EXPIRED");
  if (String(c.email_verified).toLowerCase() !== "true" || !email) throw new Error("AUTH_EMAIL_UNVERIFIED");
  var owner = String(props.getProperty("CSK_OWNER_EMAIL") || "").trim().toLowerCase();
  var team = String(props.getProperty("CSK_TEAM_EMAILS") || "").split(/[;,\\n]/).map(function(x){return x.trim().toLowerCase();}).filter(Boolean);
  if (email === owner && owner) return {email:email, role:"owner", expiresAt:Number(c.exp)};
  if (team.indexOf(email) >= 0) return {email:email, role:"team", expiresAt:Number(c.exp)};
  throw new Error("AUTH_EMAIL_NOT_ALLOWED");
}
function cskSessionKey_(sessionId) {
  if (!sessionId || !/^[A-Za-z0-9_-]{40,100}$/.test(String(sessionId))) throw new Error("AUTH_REQUIRED");
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(sessionId), Utilities.Charset.UTF_8);
  return "CSK_SESSION_" + bytes.map(function(b){var v=(b+256)%256;return ("0"+v.toString(16)).slice(-2);}).join("");
}
function cskCreateSession_(idToken, sessionId) {
  var identity = cskVerifyGoogleIdToken_(idToken);
  var ttl = Math.min(3300, identity.expiresAt - Math.floor(Date.now()/1000) - 60);
  if (ttl < 60) throw new Error("AUTH_EXPIRED");
  CacheService.getScriptCache().put(cskSessionKey_(sessionId), JSON.stringify({email:identity.email,role:identity.role}), ttl);
  return {status:"success",identity:{email:identity.email,role:identity.role},expiresIn:ttl};
}
function cskRequireSession_(sessionId) {
  var key = cskSessionKey_(sessionId);
  var raw = CacheService.getScriptCache().get(key);
  if (!raw) throw new Error("SESSION_EXPIRED");
  var session = JSON.parse(raw);
  var props = PropertiesService.getScriptProperties();
  var owner = String(props.getProperty("CSK_OWNER_EMAIL") || "").trim().toLowerCase();
  var team = String(props.getProperty("CSK_TEAM_EMAILS") || "").split(/[;,\\n]/).map(function(x){return x.trim().toLowerCase();}).filter(Boolean);
  if (session.email === owner && owner) return {email:session.email,role:"owner"};
  if (team.indexOf(session.email) >= 0) return {email:session.email,role:"team"};
  CacheService.getScriptCache().remove(key);
  throw new Error("AUTH_EMAIL_NOT_ALLOWED");
}
function cskRevokeSession_(sessionId) {
  CacheService.getScriptCache().remove(cskSessionKey_(sessionId));
}
function cskFilterDataForRole_(data, role) {
  if (role === "owner") return data;
  if (role !== "team") throw new Error("FORBIDDEN");
  return {leads:data.leads||[],clients:data.clients||[],projects:data.projects||[],lastSynced:data.lastSynced||new Date().toISOString()};
}
function cskAssertPayloadAllowed_(identity, payload) {
  var role=identity.role, action=String(payload.action||"").toLowerCase();
  if (action==="send_cold_email") throw new Error("COLD_EMAIL_APPROVAL_REQUIRED");
  if (action==="request_cold_email") return true;
  if (["approve_cold_email","reject_cold_email","send_approved_cold_email"].includes(action)) {
    if(role!=="owner") throw new Error("OWNER_ONLY"); return true;
  }
  if(action==="sync_all") {
    var teamKeys=["leads","clients","projects"];
    var ownerKeys=["leads","clients","projects","finance","memory","marketingSpend","materials","costSheets","services","purchaseOrders","quotationSnapshots"];
    var allowed=role==="owner"?ownerKeys:teamKeys;
    ownerKeys.forEach(function(k){if(Object.prototype.hasOwnProperty.call(payload,k)&&allowed.indexOf(k)<0)throw new Error("FORBIDDEN_COLLECTION:"+k);});
    return true;
  }
  if(["insert","delete","update_status"].includes(action)) {
    var teamSheets=["Leads","Clients","Projects"];
    var ownerSheets=Object.keys(FIELD_MAP||{});
    var sheet=String(payload.sheet||(action==="insert"?"":"Leads"));
    if((role==="owner"?ownerSheets:teamSheets).indexOf(sheet)<0) throw new Error("FORBIDDEN_SHEET");
    return true;
  }
  throw new Error("ACTION_NOT_ALLOWED");
}
function cskSecuritySheet_(name, headers) {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), sh=ss.getSheetByName(name);
  if(!sh){sh=ss.insertSheet(name);sh.appendRow(headers);sh.setFrozenRows(1);}
  return sh;
}
function cskApprovalRow_(sh,id) {
  if(!id||sh.getLastRow()<2)return -1;
  var ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
  for(var i=0;i<ids.length;i++)if(String(ids[i][0])===String(id))return i+2;
  return -1;
}
function cskIsSuppressed_(email) {
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Cold_Email_Suppression");
  if(!sh||sh.getLastRow()<2)return false;
  var target=String(email||"").trim().toLowerCase();
  return sh.getRange(2,1,sh.getLastRow()-1,1).getValues().some(function(r){return String(r[0]||"").trim().toLowerCase()===target;});
}
function cskRequestColdEmail_(identity,payload) {
  var email=String(payload.toEmail||"").trim().toLowerCase();
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))throw new Error("INVALID_RECIPIENT");
  if(cskIsSuppressed_(email))throw new Error("RECIPIENT_SUPPRESSED");
  var sh=cskSecuritySheet_("Cold_Email_Approvals",["ApprovalID","ToEmail","Name","Brand","RequestedBy","RequestedAt","Status","ApprovedBy","ApprovedAt","SentAt","Result"]);
  var id=Utilities.getUuid();
  sh.appendRow([id,email,String(payload.name||"Kak").slice(0,120),String(payload.brand||"Brand").slice(0,160),identity.email,new Date(),"PENDING","","","",""]);
  return {status:"PENDING",approvalId:id};
}
function cskApproveColdEmail_(identity,id) {
  if(identity.role!=="owner")throw new Error("OWNER_ONLY");
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try {var sh=cskSecuritySheet_("Cold_Email_Approvals",["ApprovalID","ToEmail","Name","Brand","RequestedBy","RequestedAt","Status","ApprovedBy","ApprovedAt","SentAt","Result"]);
    var row=cskApprovalRow_(sh,id);if(row<0)throw new Error("APPROVAL_NOT_FOUND");
    if(String(sh.getRange(row,7).getValue())!=="PENDING")throw new Error("INVALID_APPROVAL_STATE");
    sh.getRange(row,7,1,3).setValues([["APPROVED",identity.email,new Date()]]);
    return {status:"APPROVED",approvalId:id};
  } finally {lock.releaseLock();}
}
function cskRejectColdEmail_(identity,id) {
  if(identity.role!=="owner")throw new Error("OWNER_ONLY");
  var sh=cskSecuritySheet_("Cold_Email_Approvals",["ApprovalID","ToEmail","Name","Brand","RequestedBy","RequestedAt","Status","ApprovedBy","ApprovedAt","SentAt","Result"]);
  var row=cskApprovalRow_(sh,id);if(row<0)throw new Error("APPROVAL_NOT_FOUND");
  if(String(sh.getRange(row,7).getValue())!=="PENDING")throw new Error("INVALID_APPROVAL_STATE");
  sh.getRange(row,7).setValue("REJECTED");return {status:"REJECTED",approvalId:id};
}
function cskSendApprovedColdEmail_(identity,id) {
  if(identity.role!=="owner")throw new Error("OWNER_ONLY");
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  var sh,row;
  try {
    sh=cskSecuritySheet_("Cold_Email_Approvals",["ApprovalID","ToEmail","Name","Brand","RequestedBy","RequestedAt","Status","ApprovedBy","ApprovedAt","SentAt","Result"]);
    row=cskApprovalRow_(sh,id);if(row<0)throw new Error("APPROVAL_NOT_FOUND");
    var r=sh.getRange(row,1,1,11).getValues()[0];
    if(String(r[6])!=="APPROVED")throw new Error("EMAIL_NOT_APPROVED");
    var email=String(r[1]||"").trim().toLowerCase();
    if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))throw new Error("INVALID_RECIPIENT");
    if(cskIsSuppressed_(email))throw new Error("RECIPIENT_SUPPRESSED");
    var props=PropertiesService.getScriptProperties(),today=Utilities.formatDate(new Date(),"Asia/Jakarta","yyyy-MM-dd");
    var count=props.getProperty("COLD_EMAIL_DATE")===today?Number(props.getProperty("COLD_EMAIL_COUNT")||0):0;
    if(count>=50)throw new Error("DAILY_LIMIT_REACHED");
    if(MailApp.getRemainingDailyQuota()<1)throw new Error("GMAIL_QUOTA_EXHAUSTED");
    sh.getRange(row,7).setValue("SENDING");
    var body="Halo Kak "+String(r[2]||"Kak")+" / Tim "+String(r[3]||"Brand")+",\\n\\n"+
      "Salam kenal, saya Zefry dari Cahaya Selatan Kreasindo (CSK).\\n\\n"+
      "Jika ada kebutuhan booth pameran, backdrop event, POSM, rak display, atau akrilik custom, kami siap membantu.\\n\\n"+
      "Terima kasih,\\nZefry Dany\\nCahaya Selatan Kreasindo\\n\\n"+
      "Jika tidak berkenan menerima informasi berikutnya, balas email ini dengan 'Stop'.";
    GmailApp.sendEmail(email,"Vendor Produksi Booth & Display POSM — Cahaya Selatan Kreasindo",body,{name:"Zefry Dany (Cahaya Selatan Kreasindo)"});
    count++;props.setProperty("COLD_EMAIL_DATE",today);props.setProperty("COLD_EMAIL_COUNT",String(count));
    sh.getRange(row,7).setValue("SENT");sh.getRange(row,10).setValue(new Date());sh.getRange(row,11).setValue("Sent by "+identity.email);
    return {status:"SENT",approvalId:id,countToday:count};
  } finally {lock.releaseLock();}
}
function cskListPendingApprovals_(identity) {
  if(identity.role!=="owner")throw new Error("OWNER_ONLY");
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Cold_Email_Approvals");
  if(!sh||sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,11).getValues().filter(function(r){return ["PENDING","APPROVED","SENDING"].indexOf(String(r[6]))>=0;})
    .map(function(r){return {approvalId:String(r[0]),toEmail:String(r[1]),name:String(r[2]),brand:String(r[3]),requestedBy:String(r[4]),requestedAt:r[5],status:String(r[6])};});
}
function cskSetupSecuritySheets() {
  cskSecuritySheet_("Cold_Email_Approvals",["ApprovalID","ToEmail","Name","Brand","RequestedBy","RequestedAt","Status","ApprovedBy","ApprovedAt","SentAt","Result"]);
  cskSecuritySheet_("Cold_Email_Suppression",["Email","AddedAt","Source","Notes"]);
  return "Security sheets ready.";
}
