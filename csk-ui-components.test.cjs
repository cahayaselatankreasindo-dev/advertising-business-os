'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('csk-ui-components.css', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

assert.match(html, /<link rel="stylesheet" href="\.\/csk-ui-components\.css">/,
  'the reusable component stylesheet must be loaded after the visual foundation');

const pageIds = [
  'page-leads', 'page-clients', 'page-projects', 'page-services',
  'page-purchasing', 'page-hpp', 'page-documents', 'page-sales-orders',
  'page-inventory', 'page-finance', 'page-marketing', 'page-memory',
  'page-analysis', 'page-settings'
];

for (const id of pageIds) {
  assert.ok(html.includes('id="' + id + '"'), 'missing expected module: ' + id);
  assert.ok(css.includes('#' + id), 'missing module colour identity: ' + id);
}

for (const token of [
  '--csk-page-accent', '--csk-page-accent-strong', '--csk-page-wash',
  '--csk-page-border'
]) {
  assert.ok(css.includes(token), 'missing page design token: ' + token);
}

for (const required of [
  '#modal-lead', '#modal-client', '#modal-project', '#modal-finance',
  '#modal-marketing', '#modal-memory', '#modal-invoice',
  '#csk-mobile-more', 'nav.pillar-mobile-nav', '#toast',
  '#csk-auth-gate', '#csk-auth-card', '#csk-auth-login', '#csk-session-badge',
  'table thead th', 'input:focus'
]) {
  assert.ok(css.includes(required), 'missing shared component styling: ' + required);
}

assert.match(css, /prefers-reduced-motion/, 'reduced motion support must remain available');
assert.match(css, /@media print/, 'print styles must remain explicit');
const cacheVersion = (sw.match(/const CACHE_NAME = 'csk-business-os-v([^']+)'/) || [])[1];
assert.ok(cacheVersion, 'PWA service worker cache version must be declared');
assert.equal(manifest.version, cacheVersion, 'PWA manifest and service worker versions must stay aligned');
assert.match(sw, /csk-business-os-v3\.2\.13/, 'PWA cache version must be bumped for the stock reservation update');
assert.match(sw, /'\.\/csk-visual-refresh\.css'/, 'the visual foundation must be cached for offline use');
assert.match(sw, /'\.\/csk-ui-components\.css'/, 'the shared component styles must be cached for offline use');

console.log('CSK shared UI component checks passed.');
