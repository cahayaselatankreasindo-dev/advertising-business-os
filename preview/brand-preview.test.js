/**
 * CSK Business OS branded preview contract tests.
 * Completely offline: checks the HTML/JS without loading any external service.
 * Run: node preview/brand-preview.test.js
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, 'CSK-Business-OS-Brand-Preview.html'), 'utf8');

test('preview is a single-file offline design with no external API references', () => {
  assert.match(html, /<html lang="id">/);
  assert.match(html, /<meta name="viewport"/);
  assert.doesNotMatch(html, /<script[^>]+src\s*=/i);
  assert.doesNotMatch(html, /<link[^>]+(?:href="https?:|href="\/\/)/i);
  assert.doesNotMatch(html, /<iframe\b/i);
  assert.doesNotMatch(html, /https?:\/\/script\.google\.com\/macros/i);
  assert.doesNotMatch(html, /\bfetch\s*\(/i);
  assert.doesNotMatch(html, /\b(XMLHttpRequest|WebSocket)\s*\(/i);
  assert.doesNotMatch(html, /\blocalStorage\./i);
  assert.doesNotMatch(html, /API_TOKEN|apiToken|googleSheetUrl/i);
});

test('preview follows CSK brand and highlights simulation-only data', () => {
  for (const color of ['#0B0B0B', '#F8F7F4', '#FF8A3D', '#4B4B4B'])
    assert.ok(html.includes(color), 'Missing CSK color ' + color);
  assert.match(html, /Cahaya Selatan Kreasindo/);
  assert.match(html, /font-family:Montserrat/);
  assert.match(html, /Offline • Simulasi/);
  assert.match(html, /tidak terhubung/i);
  assert.match(html, /bukan laba bersih/i);
});

test('preview has functional section targets and keyboard-safe interaction controls', () => {
  const sections=['dashboard','leads','production','finance','marketing','settings'];
  for (const name of sections) {
    assert.ok(html.includes('id="'+name+'"'), 'Missing section '+name);
    assert.ok(html.includes('data-view="'+name+'"'), 'Missing route button '+name);
  }
  assert.match(html, /<dialog\b/);
  assert.match(html, /<form id="leadForm"/);
  assert.match(html, /id="leadSearch"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /@media\(max-width:740px\)/);
});

test('preview inline JavaScript parses, with no external executable script', () => {
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,1);
  assert.doesNotThrow(() => new vm.Script(scripts[0][1], {filename:'CSK-Business-OS-Brand-Preview.html'}));
});

test('preview demo has no real client names or raw contact secrets', () => {
  for (const domain of ['Brand Fiktif', 'EO Simulasi', 'Retail Contoh', 'DEMO-001'])
    assert.ok(html.includes(domain), 'Missing obvious synthetic data '+domain);
  assert.doesNotMatch(html, /\b(?:08|\+628)[0-9]{8,13}\b/);
});
