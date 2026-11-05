'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/function calculateInvoiceAmounts\(totalValue, invoiceType\) \{[\s\S]*?\n    \}/);
assert.ok(match, 'invoice amount calculator exists');
const calculateInvoiceAmounts = vm.runInNewContext('(' + match[0] + ')');

assert.deepStrictEqual({ ...calculateInvoiceAmounts(1000000, 'dp') }, {
  total: 1000000, dpAmount: 500000, amount: 500000, balance: 500000
});
assert.deepStrictEqual({ ...calculateInvoiceAmounts(1000000, 'pelunasan') }, {
  total: 1000000, dpAmount: 500000, amount: 500000, balance: 0
});
assert.deepStrictEqual({ ...calculateInvoiceAmounts(1000000, 'penawaran') }, {
  total: 1000000, dpAmount: 0, amount: 1000000, balance: 1000000
});
assert.deepStrictEqual({ ...calculateInvoiceAmounts(1000001, 'dp') }, {
  total: 1000001, dpAmount: 500001, amount: 500001, balance: 500000
});
assert.deepStrictEqual({ ...calculateInvoiceAmounts(1000001, 'pelunasan') }, {
  total: 1000001, dpAmount: 500001, amount: 500000, balance: 0
});
assert.equal(calculateInvoiceAmounts(-100, 'dp').amount, 0);
assert.ok(html.includes('Sisa Pelunasan: '));
assert.ok(html.includes('Invoice Pelunasan (Sisa 50%)'));
assert.ok(html.includes('escapeInvoiceHtml(itemTitle)'));
assert.ok(html.includes('escapeInvoiceHtml(p.notes)'));

assert.ok(html.includes("id=\"page-documents\""), 'dedicated documents page exists');
assert.ok(html.includes("nav('documents')"), 'documents navigation exists');
assert.ok(html.includes("function renderDocuments()"), 'documents project list renderer exists');
assert.ok(html.includes("switchInvoiceType('penawaran')"), 'quotation action exists in document center');
assert.ok(html.includes("switchInvoiceType('pelunasan')"), 'settlement invoice action exists in document center');
console.log('CSK invoice and document-center checks passed.');
