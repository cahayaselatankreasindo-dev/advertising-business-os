/**
 * CSK Business OS — LAB ONLY. Never copy into production.
 * Requires LabSelfTest.gs and getApiToken()/isAuthorized() from Code.gs.
 */
var CSK_LAB_WRITE_KEYS_ = {
  leads:"Leads", clients:"Clients", projects:"Projects",
  finance:"Finance", memory:"Memory", marketingSpend:"Marketing_Spend"
};
function cskLabGuardRead_() {
  if (typeof cskLabRequireDummySheet_ !== "function") {
    throw new Error("LAB guard missing: LabSelfTest.gs must be installed.");
  }
  var ss = cskLabRequireDummySheet_();
  var token = getApiToken();
  if (!token || token.length < 20 || token === "GANTI-DENGAN-TOKEN-RAHASIA-ANDA") {
    throw new Error("LAB guard: API_TOKEN LAB must be configured.");
  }
  return ss;
}
function cskLabGuardDummyId_(id) {
  if (!/^(TEST-|QA-LAB-)[A-Za-z0-9_-]{1,120}$/.test(String(id == null ? "" : id).trim())) {
    throw new Error("LAB guard: only synthetic TEST-/QA-LAB- IDs are permitted.");
  }
}
function cskLabGuardPost_(payload) {
  cskLabGuardRead_();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("LAB guard: invalid body.");
  if (!isAuthorized(payload)) throw new Error("LAB guard: missing or incorrect API token.");
  var action = String(payload.action || "").toLowerCase();
  if (action !== "sync_all" && action !== "delete") throw new Error("LAB guard: only sync_all and delete are allowed.");
  if (action === "delete") {
    Object.keys(payload).forEach(function(k) {
      if (["action","token","sheet","id"].indexOf(k) < 0) throw new Error("LAB guard: unknown delete field.");
    });
    var sheets = Object.keys(CSK_LAB_WRITE_KEYS_).map(function(k) { return CSK_LAB_WRITE_KEYS_[k]; });
    if (sheets.indexOf(payload.sheet) < 0) throw new Error("LAB guard: unsupported sheet.");
    cskLabGuardDummyId_(payload.id);
    return;
  }
  var allowed = ["action","token"].concat(Object.keys(CSK_LAB_WRITE_KEYS_));
  Object.keys(payload).forEach(function(k) {
    if (allowed.indexOf(k) < 0) throw new Error("LAB guard: unknown sync payload key.");
  });
  var count = 0;
  Object.keys(CSK_LAB_WRITE_KEYS_).forEach(function(area) {
    if (!(area in payload)) return;
    if (!Array.isArray(payload[area])) throw new Error("LAB guard: " + area + " must be an array.");
    payload[area].forEach(function(row) {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("LAB guard: invalid record.");
      cskLabGuardDummyId_(row.id);
      if (area === "leads") {
        var status = String(row.status || "").toLowerCase().replace(/[\s_-]+/g, "");
        if (["won","dealmenang","dealwin"].indexOf(status) >= 0) throw new Error("LAB guard: won leads are forbidden.");
      }
      count++;
    });
  });
  if (count < 1 || count > 40) throw new Error("LAB guard: expected 1-40 dummy records.");
}
function cskLabRunGuardNegativeTests() {
  var ss = cskLabGuardRead_(), token = getApiToken(), before = {};
  Object.keys(CSK_LAB_WRITE_KEYS_).forEach(function(k) {
    var name = CSK_LAB_WRITE_KEYS_[k]; before[name] = ss.getSheetByName(name).getLastRow();
  });
  cskLabGuardPost_({action:"sync_all",token:token,leads:[{id:"QA-LAB-GUARD-PASS",status:"new"}]});
  cskLabGuardPost_({action:"delete",token:token,sheet:"Leads",id:"QA-LAB-GUARD-PASS"});
  var bad = [
    {action:"send_email",token:token},
    {action:"update_status",token:token,id:"TEST-LEAD-001"},
    {action:"insert",token:token,sheet:"Leads"},
    {action:"sync_all",token:"",leads:[{id:"QA-LAB-X"}]},
    {action:"sync_all",token:token,leads:[{id:"REAL-CLIENT-123"}]},
    {action:"sync_all",token:token,leads:[{id:"QA-LAB-WON",status:"won"}]},
    {action:"sync_all",token:token,leads:[{id:"QA-LAB-WON",status:"Deal Menang"}]},
    {action:"sync_all",token:token,leads:[{id:"QA-LAB-WON",status:"DealMenang"}]},
    {action:"sync_all",token:token,leads:[{id:"QA-LAB-WON",status:"deal-win"}]},
    {action:"sync_all",token:token,leads:[{id:"QA-LAB-X"}],extra:"no"},
    {action:"delete",token:token,sheet:"Unknown",id:"QA-LAB-X"},
    {action:"delete",token:token,sheet:"Leads",id:"REAL-CLIENT-123"},
    {action:"delete",token:token,sheet:"Leads",id:"QA-LAB-X",extra:"no"},
    {action:"sync_all",token:token,leads:[]}
  ];
  bad.forEach(function(p,i) {
    var rejected=false; try { cskLabGuardPost_(p); } catch(e) { rejected=true; }
    if (!rejected) throw new Error("Unsafe request was not rejected #" + (i+1));
  });
  Object.keys(CSK_LAB_WRITE_KEYS_).forEach(function(k) {
    var name=CSK_LAB_WRITE_KEYS_[k];
    if (ss.getSheetByName(name).getLastRow() !== before[name]) throw new Error("Row count changed: "+name);
  });
  return {status:"LAB_GUARD_PASS",labIdVerified:ss.getId()===CSK_LAB_SHEET_ID,blockedUnsafeRequests:bad.length,databaseWritesPerformed:0,emailSendsPerformed:0};
}
