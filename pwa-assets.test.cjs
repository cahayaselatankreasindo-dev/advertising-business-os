'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const assetBlock = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
assert.ok(assetBlock, 'service worker declares a static asset list');
const cached = new Set(Array.from(assetBlock[1].matchAll(/['"]([^'"]+)['"]/g), match => match[1]));

const localScripts = Array.from(html.matchAll(/<script[^>]+src=["'](\.\/[^"']+)["']/gi), match => match[1]);
const localStyles = Array.from(html.matchAll(/<link[^>]+href=["'](\.\/[^"']+\.css[^"']*)["']/gi), match => match[1]);
const requiredData = ['./data/advertising-catalog-seed.json', './data/csk-material-master-seed.json'];

for (const asset of [...localScripts, ...localStyles, ...requiredData]) {
  assert.ok(fs.existsSync(asset.replace(/^\.\//, '')), 'referenced local asset exists: ' + asset);
  assert.ok(cached.has(asset), 'PWA precache includes local app asset: ' + asset);
}

assert.ok(cached.has('./index.html'), 'PWA precache includes the application shell');
assert.ok(cached.has('./material-master.js'), 'PWA precache includes Master Material UI');
assert.ok(cached.has('./data/csk-material-master-seed.json'), 'PWA precache includes the 101-SKU import seed');

const cacheName = sw.match(/const CACHE_NAME = ['"]([^'"]+)['"]/);
assert.ok(cacheName, 'service worker cache version is declared');
assert.equal(cacheName[1], 'csk-business-os-v' + manifest.version, 'service worker and manifest versions stay aligned');
assert.equal(manifest.version, '3.2.30', 'asset changes increment the installed PWA version');

console.log('CSK PWA asset cache integrity tests passed (' + localScripts.length + ' scripts, ' + localStyles.length + ' stylesheets, ' + requiredData.length + ' data seeds).');

const staticAssetHandler = sw.slice(sw.indexOf('// CACHE-FIRST untuk aset statis'));
assert.ok(staticAssetHandler.length > 0, 'static asset handler exists');
assert.ok(staticAssetHandler.includes('Response.error()'), 'offline static asset misses fail as network errors');
assert.ok(!staticAssetHandler.includes("caches.match('./index.html')"), 'HTML navigation fallback is not returned for JavaScript/CSS/data requests');
