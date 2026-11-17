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
  assert.ok(source.includes('PAID_INVOICE_DOCUMENT_IMMUTABLE'), path + ': paid invoice identity, line items, and terms are immutable');
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

assert.match(guard, /async function downloadDesignFile\(leadId, key\)/, 'frontend: private file download uses active authenticated session');
assert.match(guard, /api\/design-download[\s\S]*?sessionId: sessionId, leadId: leadId, key: key/, 'frontend: design download sends active session and Lead-linked file reference to private endpoint');
assert.match(guard, /downloadDesignFile: downloadDesignFile/, 'frontend: authenticated download is exposed to CRM');
assert.match(appScript, /data-csk-design-download/, 'frontend: CRM renders controlled private file download controls');
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
assert.ok(canonicalBackend.includes('function authorizeDesignDownload_('), 'private design download authorization handler exists');
assert.match(canonicalBackend, /var identity = cskRequireSession_\(payload\.sessionId\);[\s\S]*?if \(action === "authorize_design_download"\)[\s\S]*?authorizeDesignDownload_\(payload, identity\)/, 'private design download is authorized only after session validation');
assert.match(canonicalBackend, /function authorizeDesignDownload_\([\s\S]*?files\.some\(function\(file\)[\s\S]*?file\.key[\s\S]*?DESIGN_FILE_NOT_LINKED_TO_LEAD/, 'private design download requires file key to be linked to the requested Lead');
assert.ok(canonicalBackend.includes('function publicLeadIntake_('), 'public website intake handler exists');
assert.ok(canonicalBackend.includes('action === "public_lead_intake"'), 'public intake is routed before session authentication');
assert.ok(canonicalBackend.includes('CSK_PUBLIC_INTAKE_SECRET'), 'public intake requires a server-side secret');
assert.ok(canonicalBackend.includes('source: "Website"'), 'public intake source is server-controlled');
assert.ok(canonicalBackend.includes('status: "new"'), 'public intake status is server-controlled');
assert.ok(canonicalBackend.includes('submissionId: submissionId'), 'public intake stores idempotency key');
assert.ok(canonicalBackend.includes('LockService.getScriptLock()'), 'public intake writes are serialized');
assert.ok(canonicalBackend.includes('"DesignFiles"'), 'Lead contract includes design file references');
assert.ok(canonicalBackend.includes('"DesignLinks"'), 'Lead contract includes design link references');
assert.ok(canonicalBackend.includes('"SubmissionID"'), 'Lead contract includes submission id');
assert.ok(canonicalBackend.includes('Setup Secret Website Intake'), 'secret setup is available from the security menu');
assert.ok(canonicalBackend.includes('"UtmSource"') && canonicalBackend.includes('"Msclkid"'), 'Lead contract stores UTM and paid-click attribution fields');
assert.ok(canonicalBackend.includes('"PrivacyConsentAt"') && canonicalBackend.includes('"PrivacyPolicyVersion"'), 'Lead contract stores privacy consent audit fields');
assert.ok(canonicalBackend.includes('if (input.privacyConsent !== true) throw new Error("PRIVACY_CONSENT_REQUIRED")'), 'public intake requires explicit privacy consent');
assert.ok(canonicalBackend.includes('privacyConsentAt: privacyConsentAt'), 'public intake records server-side consent timestamp');
assert.ok(canonicalBackend.includes('privacyPolicyVersion: privacyPolicyVersion'), 'public intake records the policy version');
assert.ok(canonicalBackend.includes('UNSAFE_SPREADSHEET_VALUE'), 'public intake blocks spreadsheet formula injection');
assert.ok(canonicalBackend.includes('utmCampaign: utmCampaign'), 'public intake persists campaign attribution');
assert.ok(canonicalBackend.includes('INVALID_LANDING_PAGE'), 'public intake validates landing page path');
assert.ok(canonicalBackend.includes('function cleanClickId(value, field)'), 'public intake validates click IDs using a strict allowlist');

const intakeSandbox = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'CSK_PUBLIC_INTAKE_SECRET' ? 'x'.repeat(40) : '' }) },
  cskConstantTimeEquals_: (a, b) => a === b
};
vm.runInNewContext(extractBackendFunction('publicLeadIntake_') + '\nthis.publicLeadIntake = publicLeadIntake_;', intakeSandbox);
assert.throws(() => intakeSandbox.publicLeadIntake({ secret: 'wrong', lead: {} }), /PUBLIC_INTAKE_UNAUTHORIZED/);
assert.throws(() => intakeSandbox.publicLeadIntake({ secret: 'x'.repeat(40), lead: {
  submissionId: 'submission-id-123456', name: 'PT Contoh', phone: 'abc', intakeType: 'quick_contact'
} }), /INVALID_LEAD_PHONE/);
assert.throws(() => intakeSandbox.publicLeadIntake({ secret: 'x'.repeat(40), lead: {
  submissionId: 'submission-id-123456', name: 'PT Contoh', phone: '08123456789', intakeType: 'invalid'
} }), /INVALID_INTAKE_TYPE/);
assert.throws(() => intakeSandbox.publicLeadIntake({ secret: 'x'.repeat(40), lead: {
  submissionId: 'submission-id-123456', name: 'PT Contoh', phone: '08123456789', intakeType: 'quick_contact', projectType: 'Booth', privacyConsent: false
} }), /PRIVACY_CONSENT_REQUIRED/);
assert.throws(() => intakeSandbox.publicLeadIntake({ secret: 'x'.repeat(40), lead: {
  submissionId: 'submission-id-123456', name: '=HYPERLINK("https://evil.example","click")', phone: '08123456789', intakeType: 'quick_contact', projectType: 'Booth', privacyConsent: true
} }), /UNSAFE_SPREADSHEET_VALUE:name/);

const writeState = {};
const writeSandbox = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'CSK_PUBLIC_INTAKE_SECRET' ? 'x'.repeat(40) : '' }) },
  cskConstantTimeEquals_: (a, b) => a === b,
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({}) },
  Utilities: { getUuid: () => '12345678-1234-1234-1234-123456789abc' },
  readSheetData: () => [],
  mergeSheet: (ss, sheetName, leads) => { writeState.sheetName = sheetName; writeState.lead = leads[0]; }
};
vm.runInNewContext(extractBackendFunction('publicLeadIntake_') + '\nthis.publicLeadIntake = publicLeadIntake_;', writeSandbox);
const writeResult = writeSandbox.publicLeadIntake({ secret: 'x'.repeat(40), lead: {
  submissionId: 'submission-id-123456', name: 'PT Contoh', phone: '08123456789',
  intakeType: 'quick_contact', projectType: 'Booth', pic: 'Budi Santoso',
  privacyConsent: true, privacyConsentAt: '1999-01-01T00:00:00.000Z', privacyPolicyVersion: 'spoofed'
} });
assert.equal(writeResult.status, 'success');
assert.equal(writeState.sheetName, 'Leads');
assert.equal(writeState.lead.privacyConsent, true);
assert.ok(!Number.isNaN(Date.parse(writeState.lead.privacyConsentAt)), 'consent timestamp is generated server-side');
assert.notEqual(writeState.lead.privacyConsentAt, '1999-01-01T00:00:00.000Z', 'client timestamp is ignored');
assert.equal(writeState.lead.privacyPolicyVersion, '2026-11-18', 'server controls the policy version');

const downloadKey = 'incoming/submission-id-123456/12345678-1234-1234-1234-123456789abc.pdf';
const downloadSandbox = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ({}) },
  readSheetData: () => [{ id: 'WEB-1234567890ABCDEF1234', submissionId: 'submission-id-123456', designFiles: JSON.stringify([{ key: downloadKey }]) }]
};
vm.runInNewContext(extractBackendFunction('authorizeDesignDownload_') + '\nthis.authorize = authorizeDesignDownload_;', downloadSandbox);
const authorizedDownload = downloadSandbox.authorize({
  leadId: 'WEB-1234567890ABCDEF1234', key: downloadKey
}, { role: 'team' });
assert.equal(authorizedDownload.authorized, true, 'active Team session may download a file attached to its Lead');
assert.throws(() => downloadSandbox.authorize({
  leadId: 'WEB-1234567890ABCDEF1234', key: 'incoming/submission-id-123456/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.pdf'
}, { role: 'team' }), /DESIGN_FILE_NOT_LINKED_TO_LEAD/, 'file key cannot be downloaded from an unrelated Lead');
assert.throws(() => downloadSandbox.authorize({
  leadId: 'WEB-1234567890ABCDEF1234', key: 'incoming/other-submission-123456/12345678-1234-1234-1234-123456789abc.pdf'
}, { role: 'team' }), /DESIGN_FILE_SUBMISSION_MISMATCH/, 'file key must match the Lead submission ID');

// Attachment downloads can be switched to a Cloudflare Preview endpoint for staging.
// Only the official production host and this project's Pages subdomains are accepted.
const authClient = fs.readFileSync('security/guard.js', 'utf8');
assert.ok(authClient.includes("var DESIGN_DOWNLOAD_URL_KEY = 'csk_design_download_api_url'"), 'download endpoint override uses a dedicated local setting');
assert.ok(authClient.includes("var DEFAULT_DESIGN_DOWNLOAD_API_URL = 'https://cahayaselatankreasindo.my.id/api/design-download'"), 'production download endpoint remains the safe default');
assert.match(authClient, /function validDesignDownloadApiUrl\([\s\S]*?u\.hostname === 'cahayaselatankreasindo\.my\.id'[\s\S]*?pages\.dev[\s\S]*?u\.pathname === '\/api\/design-download'/, 'download endpoint is restricted to CSK production and Pages preview hosts');
assert.match(authClient, /function designDownloadApiUrl\([\s\S]*?validDesignDownloadApiUrl\(saved\)[\s\S]*?DEFAULT_DESIGN_DOWNLOAD_API_URL/, 'invalid stored endpoints fall back to production');
assert.match(authClient, /fetch\(designDownloadApiUrl\(\),\s*\{/, 'private download uses the validated endpoint selector');
assert.ok(authClient.includes('id="csk-design-download-url"'), 'login gate exposes the optional staging endpoint field');
assert.ok(authClient.includes('id="csk-auth-save-download-url"'), 'login gate exposes an explicit save action for the staging endpoint');

console.log('CSK PIN authentication, server-side RBAC, safe migration, private design access, and outbound-email safety checks passed.');