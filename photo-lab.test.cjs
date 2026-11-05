'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const code = fs.readFileSync('photo-lab/Code.gs', 'utf8');
const html = fs.readFileSync('photo-lab/Index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('photo-lab/appsscript.json', 'utf8'));
const app = fs.readFileSync('index.html', 'utf8');

new vm.Script(code, { filename: 'photo-lab/Code.gs' });
const inline = html.match(/<script>([\\s\\S]*?)<\\/script>/);
assert.ok(inline, 'Photo LAB browser script exists');
new vm.Script(inline[1], { filename: 'photo-lab/Index.html inline script' });

assert.equal(manifest.webapp.access, 'MYSELF');
assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
assert.match(code, /Session\\.getActiveUser\\(\\)\\.getEmail\\(\\)/);
assert.match(code, /DriveApp\\.Access\\.PRIVATE/);
assert.match(code, /function uploadPhoto\\(/);
assert.match(code, /function listProjectPhotos\\(/);
assert.doesNotMatch(code, /AnyoneWithLink|ANYONE_WITH_LINK|setSharing\\s*\\(/);
assert.match(html, /type="file"/);
assert.match(html, /multiple required/);
assert.match(app, /csk_photo_lab_uploader_url_v1/);
assert.match(app, /function openProjectPhotoReport\\(/);
assert.match(app, /Foto Laporan<\\/button>/);
console.log('CSK private Photo Reports source checks passed.');
