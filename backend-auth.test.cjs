'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

for (const path of ['google_apps_script.js', 'apps-script/Code.gs']) {
  const source = fs.readFileSync(path, 'utf8');
  assert.match(source, /function getApiToken\(\)[\s\S]*?getProperty\("API_TOKEN"\)/, path + ': token stored in Script Properties');
  assert.match(source, /if \(!\/\^\[a-f0-9\]\{64\}\$\/i\.test\(expected\)\) return false;/, path + ': missing/invalid server token fails closed');
  assert.doesNotMatch(source, /if \(expected === ""\) return true/, path + ': no unauthenticated compatibility mode');
  assert.match(source, /function setupApiToken\(\)[\s\S]*?if \(props\.getProperty\("API_TOKEN"\)\)[\s\S]*?throw new Error/, path + ': setup does not silently rotate existing token');
  assert.match(source, /function rotateApiToken\(\)/, path + ': explicit token rotation exists');
  assert.match(source, /function doGet\(e\)[\s\S]*?isAuthorized\(null, tokenParam\)/, path + ': GET protected');
  assert.match(source, /function doPost\(e\)[\s\S]*?isAuthorized\(payload\)/, path + ': POST protected');
}
for (const path of ['google_apps_script.js', 'apps-script/Code.gs']) {
  const source = fs.readFileSync(path, 'utf8');
  const cron = source.match(/function cronDailyOutreach\(\)[\s\S]*?\n\}/);
  assert.ok(cron, path + ': scheduled outreach function exists');
  assert.match(cron[0], /dinonaktifkan/i, path + ': scheduled outreach is disabled by default');
  assert.doesNotMatch(cron[0], /GmailApp\.sendEmail/, path + ': cron cannot send mail');
  const installer = source.match(/function installDailyOutreachTrigger\(\)[\s\S]*?\n\}/);
  assert.ok(installer, path + ': trigger installer exists');
  assert.match(installer[0], /throw new Error/i, path + ': trigger installation is blocked');
  const sendCase = source.match(/case "send_cold_email": \{[\s\S]*?\n      \}/);
  assert.ok(sendCase, path + ': manual cold email action exists');
  assert.match(sendCase[0], /dinonaktifkan sementara/i, path + ': manual cold email is disabled');
  assert.doesNotMatch(sendCase[0], /GmailApp\.sendEmail/, path + ': manual action cannot send mail');
}
console.log('CSK backend fail-closed API token and outbound-email safety checks passed.');
