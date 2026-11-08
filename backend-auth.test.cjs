'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

for (const path of ['google_apps_script.js', 'apps-script/Code.gs']) {
  const source = fs.readFileSync(path, 'utf8');
  assert.match(source, /function cskLoginWithPin_\(/, path + ': PIN login handler exists');
  assert.match(source, /function cskRequireSession_\(/, path + ': session is required for protected requests');
  assert.match(source, /function cskAssertPayloadAllowed_\(/, path + ': server-side role authorization exists');
  assert.match(source, /function cskFilterDataForRole_\(/, path + ': GET data is filtered by role');
  assert.match(source, /CacheService\.getScriptCache\(\)/, path + ': sessions and login throttling use server cache');
  assert.match(source, /CSK_LOGIN_MAX_FAILURES_\s*=\s*5/, path + ': failed logins are rate-limited');
  assert.match(source, /CSK_SESSION_TTL_SECONDS_\s*=\s*1800/, path + ': sessions have a bounded lifetime');
  assert.match(source, /CSK_PIN_HASH_ROUNDS_\s*=\s*3000/, path + ': PIN hash uses repeated SHA-256');
  assert.match(source, /setProperties\([\s\S]*?,\s*false\)/, path + ': PIN setup preserves unrelated Script Properties');
  assert.doesNotMatch(source, /setProperties\([\s\S]*?,\s*true\)/, path + ': PIN setup never clears all Script Properties');
  assert.doesNotMatch(source, /function getApiToken|function isAuthorized|API_TOKEN/, path + ': shared API token is not used');
  assert.match(source, /if \(identity\.role === "team"\) cskAssertTeamLeadTransitions_/, path + ': team cannot promote a lead to won');
  assert.match(source, /if \(identity\.role === "owner"\) autoTriggerPillars\(ss\)/, path + ': automated finance/project trigger is owner-controlled');

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

const guard = fs.readFileSync('security/guard.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const appScript = [...html.matchAll(/<script([^>]*)>([\\s\\S]*?)<\\/script>/gi)]
  .map(match => match[2])
  .find(source => source.includes("const DB_KEY"));
assert.ok(appScript, 'frontend: main application script exists');
assert.doesNotThrow(() => new Function(appScript), 'frontend: main application JavaScript parses without syntax errors');
assert.doesNotMatch(appScript, /function\\s+addService\\(\\)\\s+function\\s+addService\\(/, 'frontend: no duplicate addService declaration');

assert.match(guard, /legacyOwnerCache/, 'frontend: legacy Owner migration is memory-only');
assert.doesNotMatch(guard, /safeLocalSet\(OWNER_KEY/, 'frontend: Owner database is not persisted in localStorage');
assert.match(guard, /localStorage\.removeItem\(OWNER_KEY\)/, 'frontend: old persistent Owner cache is cleared');
assert.match(guard, /safeLocalSet\(TEAM_KEY/, 'frontend: Team operational cache remains separately scoped');
assert.match(guard, /normalizeSyncValue/, 'frontend: cloud sync verification compares field values');
assert.match(guard, /mismatches\.join/, 'frontend: sync reports field-level mismatches');
assert.match(html, /security\/guard\.js/, 'frontend: authentication guard is loaded');
assert.doesNotMatch(html, /getApiToken|setting-api-token|API token|\?token=/i, 'frontend: no shared API token flow remains');

console.log('CSK PIN authentication, server-side RBAC, safe migration, and outbound-email safety checks passed.');