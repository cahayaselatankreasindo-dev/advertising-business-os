'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const noCorsPosts = [...html.matchAll(/mode: 'no-cors',[\s\S]{0,180}?headers: \{ 'Content-Type': '([^']+)' \}/g)];

assert.equal(noCorsPosts.length, 3, 'all three Apps Script POST calls are covered');
for (const match of noCorsPosts) {
  assert.equal(match[1], 'text/plain;charset=utf-8', 'no-cors POST uses a CORS-safelisted content type');
}
assert.ok(backend.includes('JSON.parse(e.postData.contents)'), 'Apps Script parses the JSON request body independent of Content-Type');
console.log('CSK Apps Script POST transport checks passed.');
