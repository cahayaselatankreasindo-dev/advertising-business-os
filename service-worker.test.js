const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('sw.js','utf8');
assert.match(source,/csk-business-os-optimization-v4-20261103/);
assert.match(source,/const THIRD_PARTY_STATIC_HOSTS = new Set/);
for (const host of ['cdn.tailwindcss.com','cdn.jsdelivr.net','fonts.googleapis.com','fonts.gstatic.com']) {
  assert.ok(source.includes("'" + host + "'"),'missing static cache host ' + host);
}
assert.doesNotMatch(source,/['"]script\\.google\\.com['"]/,
  'Apps Script must never enter the static CDN cache allowlist');
assert.doesNotMatch(source,/['"]script\\.googleusercontent\\.com['"]/,
  'Apps Script redirected responses must never enter the static CDN cache allowlist');
assert.match(source,/if \\(url\\.origin !== self\\.location\\.origin\\)/);
assert.match(source,/THIRD_PARTY_STATIC_HOSTS\\.has\\(url\\.hostname\\)/);
assert.match(source,/\\['script', 'style', 'font'\\]\\.includes\\(event\\.request\\.destination\\)/);
assert.match(source,/if \\(url\\.origin !== self\\.location\\.origin\\)[\\s\\S]*?return;[\\s\\S]*?const isHTML/,
  'cross-origin API requests must bypass the same-origin navigation cache handler');
console.log('Service worker cache contract passed');
