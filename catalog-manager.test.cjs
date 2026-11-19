'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const manager = fs.readFileSync('catalog-manager.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const backend = fs.readFileSync('google_apps_script.js', 'utf8');
const clasp = fs.readFileSync('apps-script/Code.gs', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

assert.equal(backend, clasp, 'Apps Script canonical and deployment copies remain identical');
assert.ok(html.includes('<script src="./catalog-manager.js"></script>'), 'catalog manager is loaded by the application');
assert.ok(html.includes("openCskCatalogManager('material')"), 'material reference catalog can be opened');
assert.ok(html.includes("openCskCatalogManager('service')"), 'service reference catalog can be opened');
assert.ok(manager.includes('function saveMaterialFromCatalog()'), 'material activation handler exists');
assert.ok(manager.includes('function saveServiceFromCatalog()'), 'service activation handler exists');
assert.ok(manager.includes("price<=0"), 'zero-priced materials cannot be activated');
assert.ok(manager.includes("!supplier||!source||!date"), 'material activation requires supplier, price source, and price date');
assert.ok(manager.includes('unitPrice= purchasePrice/factor') || manager.includes('unitPrice=purchasePrice/factor'), 'usage-unit price is derived from purchase price and conversion factor');
assert.ok(backend.includes('"HargaBeli"') && backend.includes('"FaktorKonversi"'), 'Materials schema stores purchase price and conversion factor');
assert.ok(backend.includes('"SatuanBeli"') && backend.includes('"MetodeCosting"'), 'Materials schema stores purchase unit and costing method');
assert.ok(backend.includes('"BiayaDasar"') && backend.includes('"Satuan"'), 'Services schema stores cost basis and unit');
assert.ok(sw.includes("'./catalog-manager.js'"), 'service worker caches catalog manager');
assert.ok(sw.includes("'./data/advertising-catalog-seed.json'"), 'service worker caches catalog seed');
console.log('CSK catalog manager integration tests passed.');
