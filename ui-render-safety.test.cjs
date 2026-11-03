'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const helper = html.match(/function escapeHTML\(value\) \{[\s\S]*?\n    \}/);
assert.ok(helper, 'index.html must define the shared HTML escaping helper');

const sandbox = {};
vm.runInNewContext(helper[0] + '\nglobalThis.escapeHTML = escapeHTML;', sandbox);
assert.equal(
  sandbox.escapeHTML('<img src=x onerror=alert(1)> "quoted" & text'),
  '&lt;img src=x onerror=alert(1)&gt; &quot;quoted&quot; &amp; text'
);

const protectedViews = [
  {
    label: 'CRM lead priority score',
    safe: "Skor ' + escapeHTML(l.score)",
    unsafe: "Skor ' + l.score"
  },
  {
    label: 'client project count',
    safe: "+ escapeHTML(c.projectsCount || 0) +",
    unsafe: "+ (c.projectsCount || 0) +"
  },
  {
    label: 'marketing lead count',
    safe: "+ escapeHTML(m.leadsGenerated || 0) +",
    unsafe: "+ (m.leadsGenerated || 0) +"
  }
];

for (const view of protectedViews) {
  assert.ok(html.includes(view.safe), view.label + ' must escape imported values before HTML rendering');
  assert.ok(!html.includes(view.unsafe), view.label + ' must not interpolate untrusted values directly');
}

process.stdout.write('UI render safety: HTML escaping and imported CRM/marketing fields passed.\n');
