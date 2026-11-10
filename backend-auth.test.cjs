'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const path of ['google_apps_script.js', 'apps-script/Code.gs']) {
  const source = fs.readFileSync(path, 'utf8');
  assert.match(source, /function cskLoginWithPin_\(/, path + ': PIN login handler exists');
  assert.match(source, /function cskRequireSession_\(/, path + ': session is required for protected requests');
  assert.match(source, /function cskAssertPayloadAllowed_\(/, path + ': server-side role authorization exists');
  assert.ok(source.includes('record_invoice_payment'), path + ': payment endpoint is registered');
  assert.match(source, /function recordInvoicePayment_\(/, path + ': payment writes use server-side ledger handler');
  assert.ok(source.includes('FORBIDDEN_PAYMENT_WRITE'), path + ': payment recording is Owner-only');
  assert.ok(source.includes('PAYMENT_LEDGER_SERVER_ONLY'), path + ': payment ledger cannot use generic CRUD');
  assert.match(source, /function assertPaidInvoiceChangesAllowed_\(/, path + ': paid invoice totals are protected server-side');
  assert.match(source, /function mergeInvoicesSafely_\(/, path + ': invoice updates are serialized with payment writes');
  assert.match(source, /function mergeFinanceSafely_\(/, path + ': payment-linked Finance rows are validated against the ledger');
  assert.match(source, /mergeFinanceSafely_\(ss, payload\.finance\)/, path + ': generic sync uses protected Finance merging');
  assert.match(source, /function assertCommercialRecordDeletionAllowed_\(/, path + ': payment-linked records cannot be deleted generically');
  assert.match(source, /assertCommercialRecordDeletionAllowed_\(ss, sheetName, delId\)/, path + ': delete endpoint enforces payment-ledger integrity');
  assert.ok(source.includes('LockService.getScriptLock()'), path + ': payment writes use a script lock');
  assert.match(source, /if \(action === "delete" && role !== "owner"\) throw new Error\("FORBIDDEN_DELETE"\)/, path + ': Team cannot delete shared records through the API');
  assert.match(source, /function cskFilterDataForRole_\(/, path + ': GET data is filtered by role');
  assert.match(source, /CacheService\.getScriptCache\(\)/, path + ': sessions and login throttling use server cache');
  assert.match(source, /CSK_LOGIN_MAX_FAILURES_\s*=\s*5/, path + ': failed logins are rate-limited');
  assert.match(source, /CSK_SESSION_TTL_SECONDS_\s*=\s*1800/, path + ': sessions have a bounded lifetime');
  assert.match(source, /CSK_PIN_HASH_ROUNDS_\s*=\s*3000/, path + ': PIN hash uses repeated SHA-256');
  assert.match(source, /setProperties\([\s\S]*?,\s*false\)/, path + ': PIN setup preserves unrelated Script Properties');
  assert.doesNotMatch(source, /setProperties\([\s\S]*?,\s*true\)/, path + ': PIN setup never clears all Script Properties');
  assert.doesNotMatch(source, /function getApiToken|function isAuthorized|API_TOKEN/, path + ': shared API token is not used');
  assert.match(source, /if \(identity\.role === "team"\) cskAssertTeamLeadTransitions_/, path + ': team cannot promote a lead to won');
  assert.match(source, /if \(identity\.role === "owner"\) autoTriggerPillars\(ss\)/, path + ': automated project-queue trigger is owner-controlled');
  const autoTrigger = source.match(/function autoTriggerPillars\(ss, forceLeadId\)[\s\S]*?\n\}/);
  assert.ok(autoTrigger, path + ': Deal Won automation exists');
  assert.doesNotMatch(autoTrigger[0], /insertRecord\(ss,\s*"Finance"/, path + ': Deal Won never records Finance income');
  assert.match(autoTrigger[0], /insertRecord\(ss,\s*"Projects"/, path + ': Deal Won only creates a project queue');

  const dedupe = source.match(/function dedupeHeaders[\s\S]*?\n\}/);
  assert.ok(dedupe, path + ': header validation function exists');
  assert.match(dedupe[0], /issues\.push/, path + ': ambiguous headers stop setup');
  assert.doesNotMatch(dedupe[0], /sheet\.clear\(|deleteColumn|deleteColumns/, path + ': header validation is non-destructive');

  const cron = source.match(/function cronDailyOutreach\(\)[\s\S]*?\n\}/);
  assert.ok(cron, path + ': scheduled outreach function exists');
  assert.match(cron[0], /dinonaktifkan/i, path + ': scheduled outreach is disabled');
  assert.doesNotMatch(cron[0], /GmailApp\.sendEmail/, path + ': cron cannot send mail');

  const installer = source.match(/function installDailyOutreachTrigger\(\)[\s\S]*?\n\}/);
  assert.ok(installer, path + ': outreach trigger installer exists');
  assert.match(installer[0], /throw new Error/i, path + ': outreach trigger installation is blocked');

  const sendCase = source.match(/case "send_cold_email"[\s\S]*?\n\s*default:/);
  assert.ok(sendCase, path + ': manual cold email action exists');
  assert.match(sendCase[0], /COLD_EMAIL_DISABLED/, path + ': manual cold email is disabled');
}

const canonicalBackend = fs.readFileSync('google_apps_script.js', 'utf8').trimEnd();
const claspBackend = fs.readFileSync('apps-script/Code.gs', 'utf8').trimEnd();
assert.equal(canonicalBackend, claspBackend, 'backend: canonical source and Apps Script upload copy stay identical');
assert.match(canonicalBackend, /function onOpen\(e\)[\s\S]*?createMenu\("CSK Security"\)[\s\S]*?addToUi\(\)/, 'backend: spreadsheet menu exposes PIN setup and rotation');

const guard = fs.readFileSync('security/guard.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const appScript = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
  .map(match => match[2])
  .find(source => source.includes("const DB_KEY"));
assert.ok(appScript, 'frontend: main application script exists');
assert.doesNotThrow(() => new Function(appScript), 'frontend: main application JavaScript parses without syntax errors');
assert.doesNotMatch(appScript, /function\s+addService\(\)\s+function\s+addService\(/, 'frontend: no duplicate addService declaration');
assert.match(appScript, /function getAuthenticatedRole\(\)[\s\S]*?window\.CSKAuth\.getIdentity\(\)/, 'frontend: displayed role comes from authenticated server identity');
assert.match(appScript, /if \(!requireOwnerForDelete\(\)/, 'frontend: shared record delete handlers require Owner');
assert.match(appScript, /isOwnerSession\(\) \? '<button onclick="deleteLead/, 'frontend: Team does not see the Leads delete button');
assert.match(appScript, /isOwnerSession\(\)\?'<button onclick="deleteClient/, 'frontend: Team does not see the Clients delete button');
assert.match(appScript, /isOwnerSession\(\) \? '<button onclick="deleteProject/, 'frontend: Team does not see the Projects delete button');

assert.match(guard, /legacyOwnerCache/, 'frontend: legacy Owner migration uses a temporary recovery cache');
assert.doesNotMatch(guard, /safeLocalSet\(OWNER_KEY/, 'frontend: Owner database is not written to a persistent Owner cache');
const ownerSave = guard.match(/function saveScoped\(\)[\s\S]*?\n  }/);
assert.ok(ownerSave, 'frontend: scoped save handler exists');
assert.doesNotMatch(ownerSave[0], /removeItem\(DB_KEY|removeItem\(OWNER_KEY/, 'frontend: legacy data is not deleted during local save');
const migration = guard.match(/function migrateLegacyStorage\(\)[\s\S]*?\n  }/);
assert.ok(migration, 'frontend: legacy migration handler exists');
assert.doesNotMatch(migration[0], /removeItem\(DB_KEY|removeItem\(OWNER_KEY/, 'frontend: migration preserves the original copy until cloud verification');
const sync = guard.match(/async function syncNow\(silent\)[\s\S]*?\n  }/);
assert.ok(sync, 'frontend: cloud sync handler exists');
assert.match(sync[0], /legacyOwnerCache = null;[\s\S]*?localStorage\.removeItem\(DB_KEY\)/, 'frontend: legacy data is removed only after verified cloud sync');
assert.match(guard, /beforeunload/, 'frontend: pending Owner changes warn before leaving');
assert.match(guard, /safeLocalSet\(TEAM_KEY/, 'frontend: Team operational cache remains separately scoped');
assert.match(guard, /window\.deleteOnCloud = async function \(sheet, id\)[\s\S]*?identity\.role !== 'owner'[\s\S]*?return false/, 'frontend: Team cloud deletion is blocked before sending a request');
assert.match(guard, /if \(!Array\.isArray\(rows\)\) throw new Error\('Data penghapusan tidak dapat diverifikasi\.'\)/, 'frontend: deletion requires a valid cloud read-back');
assert.match(guard, /return true;[\s\S]*?return false;/, 'frontend: deletion result is explicit for the caller');
assert.match(guard, /normalizeSyncValue/, 'frontend: cloud sync verification compares field values');
assert.match(guard, /mismatches\.join/, 'frontend: sync reports field-level mismatches');
assert.match(html, /security\/guard\.js/, 'frontend: authentication guard is loaded');
assert.doesNotMatch(html, /getApiToken|setting-api-token|API token|\?token=/i, 'frontend: no shared API token flow remains');


const backendForRoleTests = fs.readFileSync('apps-script/Code.gs', 'utf8');
function extractBackendFunction(name) {
  const match = backendForRoleTests.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}'));
  assert.ok(match, 'backend role helper exists: ' + name);
  return match[0];
}
const roleSandbox = {
  FIELD_MAP: {
    Leads: {}, Clients: {}, Projects: {}, Invoices: {},
    Commercial_Quotations: {}, Finance: {}, Invoice_Payments: {}
  }
};
vm.runInNewContext(
  extractBackendFunction('cskAssertPayloadAllowed_') +
  '\nthis.authorizePayload = cskAssertPayloadAllowed_;',
  roleSandbox
);
vm.runInNewContext(
  extractBackendFunction('cskFilterDataForRole_') +
  '\nthis.filterData = cskFilterDataForRole_;',
  roleSandbox
);

assert.equal(roleSandbox.authorizePayload({ role: 'owner' }, {
  action: 'sync_all', quotations: [], invoices: []
}), true, 'Owner may sync commercial quotations and invoices');
assert.equal(roleSandbox.authorizePayload({ role: 'team' }, {
  action: 'sync_all', leads: [], clients: [], projects: []
}), true, 'Team retains operational CRM sync access');
assert.throws(() => roleSandbox.authorizePayload({ role: 'team' }, {
  action: 'sync_all', invoices: []
}), /FORBIDDEN_COLLECTION:invoices/, 'Team cannot write invoices through generic sync');
assert.throws(() => roleSandbox.authorizePayload({ role: 'team' }, {
  action: 'sync_all', quotations: []
}), /FORBIDDEN_COLLECTION:quotations/, 'Team cannot write quotations through generic sync');
assert.throws(() => roleSandbox.authorizePayload({ role: 'team' }, {
  action: 'record_invoice_payment', payment: { id: 'PAY-TEST-0001' }
}), /FORBIDDEN_PAYMENT_WRITE/, 'Team cannot record invoice payments');
assert.equal(roleSandbox.authorizePayload({ role: 'owner' }, {
  action: 'record_invoice_payment', payment: { id: 'PAY-TEST-0001' }
}), true, 'Owner may record invoice payments');
assert.throws(() => roleSandbox.authorizePayload({ role: 'team' }, {
  action: 'insert', sheet: 'Invoices'
}), /FORBIDDEN_SHEET/, 'Team cannot bypass RBAC with direct invoice insert');
assert.throws(() => roleSandbox.authorizePayload({ role: 'owner' }, {
  action: 'insert', sheet: 'Invoices', data: { id: 'INV-DIRECT' }
}), /COMMERCIAL_DOCUMENT_REQUIRES_SYNC/, 'Owner must use guarded sync for invoice creation');
assert.throws(() => roleSandbox.authorizePayload({ role: 'owner' }, {
  action: 'insert', sheet: 'Commercial_Quotations', data: { id: 'QUO-DIRECT' }
}), /COMMERCIAL_DOCUMENT_REQUIRES_SYNC/, 'Owner must use guarded sync for quotation creation');
assert.throws(() => roleSandbox.authorizePayload({ role: 'owner' }, {
  action: 'insert', sheet: 'Finance', data: { id: 'FIN-PAY-FORGED' }
}), /PAYMENT_FINANCE_SERVER_ONLY/, 'payment Finance rows cannot be forged through generic insert');
assert.equal(roleSandbox.authorizePayload({ role: 'owner' }, {
  action: 'insert', sheet: 'Finance', data: { id: 'FIN-EXP-001' }
}), true, 'Owner may still add ordinary Finance records');
assert.throws(() => roleSandbox.authorizePayload({ role: 'owner' }, {
  action: 'sync_all', invoicePayments: []
}), /PAYMENT_LEDGER_SERVER_ONLY/, 'payment ledger cannot be overwritten by generic sync');
const roleData = {
  leads: [1], clients: [2], projects: [3],
  quotations: [4], invoices: [5], invoicePayments: [6], finance: [7]
};
const teamData = roleSandbox.filterData(roleData, 'team');
assert.deepEqual(Object.keys(teamData).sort(), ['clients', 'lastSynced', 'leads', 'projects']);
assert.equal(teamData.invoices, undefined, 'Team does not receive commercial invoices');
assert.equal(teamData.quotations, undefined, 'Team does not receive commercial quotations');
assert.equal(teamData.invoicePayments, undefined, 'Team does not receive payment ledger');
assert.equal(roleSandbox.filterData(roleData, 'owner'), roleData, 'Owner receives the full authorized dataset');

console.log('CSK PIN authentication, server-side RBAC, safe migration, and outbound-email safety checks passed.');