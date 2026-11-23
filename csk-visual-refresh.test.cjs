'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('csk-visual-refresh.css', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

assert.match(html, /<link rel="stylesheet" href="\.\/csk-visual-refresh\.css">/,
  'the visual refresh stylesheet must be loaded by the app');
assert.equal(manifest.theme_color, '#F97316', 'the installed PWA should use the CSK orange accent');
assert.equal(manifest.background_color, '#F5F7FC', 'the installed PWA splash should use the new canvas colour');
assert.match(html, /<meta name="theme-color" content="#F97316">/,
  'the PWA browser chrome should use the CSK orange accent');

for (const token of [
  '--csk-ui-canvas', '--csk-ui-orange', '--csk-ui-violet', '--csk-ui-blue',
  '--csk-ui-cyan', '--csk-ui-green', '--csk-ui-pink', '--csk-ui-yellow'
]) {
  assert.ok(css.includes(token), 'missing design token: ' + token);
}

assert.match(css, /body > aside[\s\S]*linear-gradient/,
  'desktop sidebar must use the new colour system');
assert.match(css, /#page-dashboard > div:first-child[\s\S]*linear-gradient/,
  'dashboard hero must use the vibrant gradient treatment');
assert.match(css, /#page-dashboard > \.grid\.grid-cols-2 > div:nth-child\(5\)/,
  'all five dashboard KPIs must receive deliberate accent styling');
assert.match(css, /nav\.pillar-mobile-nav/,
  'mobile navigation must be included in the visual system');
assert.match(css, /:focus-visible/,
  'keyboard focus must remain visible');
assert.match(css, /prefers-reduced-motion/,
  'motion-sensitive users must be respected');
assert.match(css, /@media print/,
  'print output must retain an explicit print treatment');

console.log('CSK colorful UI visual-system checks passed.');
