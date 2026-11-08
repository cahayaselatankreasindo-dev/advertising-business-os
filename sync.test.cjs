'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const guard = fs.readFileSync('security/guard.js', 'utf8');
const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const noCorsPosts = [...guard.matchAll(/mode: 'no-cors',[\s\S]{0,180}?headers: \{ 'Content-Type': '([^']+)' \}/g)];

assert.equal(noCorsPosts.length, 2, 'delete and sync POST calls remain; cold email POST is disabled');
for (const match of noCorsPosts) {
  assert.equal(match[1], 'text/plain;charset=utf-8', 'no-cors POST uses a CORS-safelisted content type');
}
assert.ok(backend.includes('JSON.parse((e && e.postData && e.postData.contents) || "{}")'), 'Apps Script parses the JSON request body independent of Content-Type');

assert.ok(guard.includes('async function verifySync(payload)'), 'cloud writes are followed by authenticated read-back verification');
assert.ok(guard.includes('var verified = await verifySync(payload);'), 'sync success waits for server verification');
assert.ok(guard.includes('Sinkronisasi terverifikasi: '), 'success message is shown only after verification');
assert.ok(html.includes('Cloud terverifikasi'), 'cloud indicator distinguishes verified sync from configured URL');
assert.ok(html.includes('Cloud belum diuji'), 'cloud indicator does not claim connection before verification');
assert.ok(html.includes('Pengiriman cold email dinonaktifkan sementara'), 'cold email UI is disabled pending server-side authorization and approval controls');
assert.ok(guard.includes('var mismatches = fields.filter'), 'read-back verification compares actual field values');
assert.ok(guard.includes('Nilai berbeda pada:'), 'mismatched cloud values prevent a verified-sync success state');
assert.ok(html.includes('Mode Tampilan'), 'owner/team selector is described as a display mode, not server authorization');
console.log('CSK Apps Script transport, verified read-back sync, and honest access-mode UI checks passed.');
