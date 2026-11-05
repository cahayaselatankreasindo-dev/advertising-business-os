'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/function calculateInvoiceAmounts\(totalValue, invoiceType, dpPercent\) \{[\s\S]*?\n    \}/);
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
assert.ok(html.includes('Invoice Pelunasan'), 'settlement invoice option exists');
assert.ok(html.includes('escapeInvoiceHtml(itemTitle)'));
assert.ok(html.includes('escapeInvoiceHtml(p.notes)'));

assert.ok(html.includes("id=\"page-documents\""), 'dedicated documents page exists');
assert.ok(html.includes("nav('documents')"), 'documents navigation exists');
assert.ok(html.includes("function renderDocuments()"), 'documents project list renderer exists');
assert.ok(html.includes("switchInvoiceType('penawaran')"), 'quotation action exists in document center');
assert.ok(html.includes("switchInvoiceType('pelunasan')"), 'settlement invoice action exists in document center');

assert.deepStrictEqual({ ...calculateInvoiceAmounts(1000000, 'dp', 30) }, {
  total: 1000000, dpAmount: 300000, amount: 300000, balance: 700000
});
assert.deepStrictEqual({ ...calculateInvoiceAmounts(1000000, 'pelunasan', 30) }, {
  total: 1000000, dpAmount: 300000, amount: 700000, balance: 0
});
assert.deepStrictEqual({ ...calculateInvoiceAmounts(1000000, 'dp', 70) }, {
  total: 1000000, dpAmount: 700000, amount: 700000, balance: 300000
});
assert.ok(html.includes('id="inv-dp-percent"'), 'editable DP percentage input exists');
assert.ok(html.includes('onInvoiceDpPercentChange(this.value)'), 'percentage input recalculates invoice');
assert.ok(html.includes('currentInvoiceDpPercent'), 'selected percentage is used in invoice rendering');
console.log('CSK invoice, editable DP percentage, and document-center checks passed.');
