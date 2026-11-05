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
  total: 1000000, dpPercent: 50, dpAmount: 0, amount: 1000000, balance: 1000000
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
assert.ok(html.includes("penawaran"), 'quotation action exists in document center');
assert.ok(html.includes("pelunasan"), 'settlement invoice action exists in document center');

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

assert.ok(html.includes("let currentInvoiceDpPercent = 50;"), 'DP percentage state is declared as executable JavaScript');
assert.ok(!html.includes("penawaran'\\\\n    let currentInvoiceDpPercent"), 'DP percentage declaration is not swallowed by a line comment');
assert.ok(html.includes("currentInvoiceDpPercent = Number.isFinite(Number(p.dpPercent))"), 'saved project DP percentage is loaded when opening invoice');
assert.ok(html.includes("inv-dp-percent').value = currentInvoiceDpPercent"), 'editable percentage input reflects the selected project value');
assert.ok(html.includes("'INVOICE PELUNASAN (SISA ' + (100 - currentInvoiceDpPercent) + '%)'"), 'settlement label reflects remaining percentage');

assert.ok(html.includes('id="page-hpp"'), 'HPP calculator page exists');
assert.ok(html.includes('function addHppMaterial()'), 'material master create handler exists');
assert.ok(html.includes('function calculateHpp()'), 'HPP calculation handler exists');
assert.ok(html.includes('function saveHppEstimate()'), 'project HPP save handler exists');
assert.ok(html.includes('db.materials = parsed.materials || []'), 'materials local persistence migration exists');
assert.ok(html.includes('db.costSheets = parsed.costSheets || []'), 'cost sheet local persistence migration exists');
assert.ok(html.includes('materials: db.materials || []'), 'materials included in sync payload');
assert.ok(html.includes('costSheets: db.costSheets || []'), 'cost sheets included in sync payload');
console.log('CSK invoice, HPP calculator, material and project cost-sheet checks passed.');
