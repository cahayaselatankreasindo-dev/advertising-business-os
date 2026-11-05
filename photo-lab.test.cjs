'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const code = fs.readFileSync('photo-lab/Code.gs', 'utf8');
const html = fs.readFileSync('photo-lab/Index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('photo-lab/appsscript.json', 'utf8'));
const app = fs.readFileSync('index.html', 'utf8');

new vm.Script(code, { filename: 'photo-lab/Code.gs' });
const scriptStart = html.indexOf('<script>');
const scriptEnd = html.indexOf('</script>', scriptStart);
assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, 'Photo LAB browser script exists');
new vm.Script(html.slice(scriptStart + 8, scriptEnd), { filename: 'photo-lab/Index.html inline script' });

assert.equal(manifest.webapp.access, 'MYSELF');
assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
assert.ok(code.includes('Session.getActiveUser().getEmail()'));
assert.ok(code.includes('DriveApp.Access.PRIVATE'));
assert.ok(code.includes('function uploadPhoto('));
assert.ok(code.includes('function listProjectPhotos('));
assert.ok(!code.includes('AnyoneWithLink') && !code.includes('ANYONE_WITH_LINK') && !code.includes('setSharing('));
assert.ok(html.includes('type="file"'));
assert.ok(html.includes('multiple required'));
assert.ok(app.includes('csk_photo_lab_uploader_url_v1'));
assert.ok(app.includes('function openProjectPhotoReport('));
assert.ok(app.includes('Foto Laporan</button>'));
assert.ok(app.includes("deleteOnCloud('Finance', id);"));
assert.ok(app.includes("deleteOnCloud('Marketing_Spend', id);"));
assert.ok(app.includes("deleteOnCloud('Memory', id);"));
console.log('CSK private Photo Reports source checks passed.');
