const fs = require('node:fs');
const assert = require('node:assert/strict');

const code = fs.readFileSync('apps-script/Code.gs','utf8');
const guard = fs.readFileSync('apps-script/LabRequestGuard.gs','utf8');
const self = fs.readFileSync('apps-script/LabSelfTest.gs','utf8');
const verify = fs.readFileSync('apps-script/LabHandlerVerification.gs','utf8');
const backend = fs.readFileSync('google_apps_script.js','utf8');
const manifest = JSON.parse(fs.readFileSync('apps-script/appsscript.json','utf8'));
const photoLabManifest = JSON.parse(fs.readFileSync('photo-lab/appsscript.json','utf8'));

function fn(source, name, nextName) {
  const start = source.indexOf('function ' + name + '(');
  const end = nextName ? source.indexOf('function ' + nextName + '(', start + 1) : source.length;
  assert.ok(start >= 0 && end > start, 'missing function ' + name);
  return source.slice(start, end);
}

const get = fn(code,'doGet','doPost');
const post = fn(code,'doPost');
const setup = fn(code,'setupSheet','ensureSheet');
const trigger = fn(code,'installAutoTrigger','handleAutoTrigger');

assert.ok(get.includes('cskLabGuardRead_()'), 'LAB doGet must call the real read guard');
assert.ok(post.includes('cskLabGuardPost_(payload)'), 'LAB doPost must call the real write guard');
assert.ok(setup.includes('cskLabRequireDummySheet_()'), 'setupSheet must be bound to the exact LAB spreadsheet');
assert.match(trigger,/automatic triggers are disabled/i);
assert.ok(code.includes('function setupApiTokens()'), 'separate role token setup exists');
assert.ok(code.includes('function isSheetAllowedForRole_'), 'server role allowlist exists');
assert.ok(code.includes('LockService.getScriptLock()'), 'script lock protects read/write');
assert.ok(code.includes('validateExpectedRecords_'), 'compare-and-set is wired');

for (const [key,sheet] of Object.entries({
  leads:'Leads',clients:'Clients',projects:'Projects',finance:'Finance',
  memory:'Memory',marketingSpend:'Marketing_Spend',costings:'Costings',projectCosts:'Project_Costs'
})) {
  assert.ok(guard.includes(key + ': "' + sheet + '"'), 'LAB guard missing ' + sheet);
  assert.ok(self.includes('"' + sheet + '"'), 'LAB self test missing ' + sheet);
  assert.ok(backend.includes(key + ': "' + sheet + '"'), 'backend sync map missing ' + sheet);
}

assert.ok(self.includes('function cskLabRunRoleIsolationTests()'), 'live LAB role isolation test exists');
assert.ok(guard.includes(String.raw`replace(/[\s_-]/g`), 'LAB guard normalizes whitespace, underscore and hyphen status aliases');
assert.ok(self.includes(String.raw`replace(/[\s_-]/g`), 'LAB preflight normalizes won status aliases');
assert.ok(guard.includes('status === "dealwin"'), 'LAB guard blocks dealwin status alias');
assert.ok(self.includes('teamPrivateReadFiltered:true'), 'smoke test reports Team read filtering');
assert.ok(verify.includes('cskLabGuardRead_()') && verify.includes('cskLabGuardPost_(payload)'), 'handler verifier checks real guard wiring');
assert.doesNotMatch(self,/Logger\.log\([^\n]*tokens?\.(?:owner|team)/i,'role tokens must never be logged');


assert.equal(manifest.webapp && manifest.webapp.access, 'MYSELF', 'Apps Script LAB Web App must be owner-only; public anonymous access is forbidden');
assert.equal(manifest.webapp && manifest.webapp.executeAs, 'USER_DEPLOYING', 'Apps Script LAB must execute as the deploying owner');
assert.equal(photoLabManifest.webapp && photoLabManifest.webapp.access, 'MYSELF', 'Photo LAB Web App must remain owner-only');
assert.equal(photoLabManifest.webapp && photoLabManifest.webapp.executeAs, 'USER_DEPLOYING', 'Photo LAB must execute as the deploying owner');

console.log('LAB source contract passed');
