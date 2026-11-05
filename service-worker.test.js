const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('sw.js','utf8');
assert.ok(source.includes('csk-business-os-optimization-v4-20261103'));
assert.ok(source.includes('const THIRD_PARTY_STATIC_HOSTS = new Set'));
for (const host of ['cdn.tailwindcss.com','cdn.jsdelivr.net','fonts.googleapis.com','fonts.gstatic.com']) {
  assert.ok(source.includes("'" + host + "'"),'missing static cache host ' + host);
}
assert.ok(!source.includes("'script.google.com'"),
  'Apps Script must never enter the static CDN cache allowlist');
assert.ok(!source.includes("'script.googleusercontent.com'"),
  'Apps Script redirected responses must never enter the static CDN cache allowlist');
assert.ok(source.includes('if (url.origin !== self.location.origin)'));
assert.ok(source.includes('THIRD_PARTY_STATIC_HOSTS.has(url.hostname)'));
assert.ok(source.includes("['script', 'style', 'font'].includes(event.request.destination)"));
assert.ok(source.includes('return;\n  }\n  const isHTML'),
  'cross-origin API requests must bypass the same-origin navigation cache handler');
console.log('Service worker cache contract passed');
