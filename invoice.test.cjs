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

assert.ok(html.includes('id="page-services"'), 'services catalog page exists');
assert.ok(html.includes('function addService()'), 'service create handler exists');
assert.ok(html.includes('id="page-purchasing"'), 'purchasing page exists');
assert.ok(html.includes('function createPurchaseOrder()'), 'purchase order create handler exists');
assert.ok(html.includes('function updatePoStatus(id,status)'), 'purchase order status workflow exists');
assert.ok(html.includes('services: db.services || []'), 'services included in sync payload');
assert.ok(html.includes('purchaseOrders: db.purchaseOrders || []'), 'purchase orders included in sync payload');

const hppMatch = html.match(/function calculateHppTotals\(items, labor, other, margin\) \{[\s\S]*?\n    \}/);
assert.ok(hppMatch, 'pure HPP total calculator exists');
const calculateHppTotals = vm.runInNewContext('(' + hppMatch[0] + ')');
assert.deepStrictEqual({ ...calculateHppTotals([{qty:2,unitPrice:100000},{qty:3,unitPrice:50000}],100000,50000,30) }, {
  materialTotal:350000, labor:100000, other:50000, margin:30, total:500000, price:714286, profit:214286
});
assert.deepStrictEqual({ ...calculateHppTotals([],0,0,0) }, {
  materialTotal:0, labor:0, other:0, margin:0, total:0, price:0, profit:0
});
assert.throws(() => calculateHppTotals([],0,0,100), /margin/i);
assert.throws(() => calculateHppTotals([], -1,0,30), /non-negatif/i);
assert.ok(html.includes('onchange="loadHppProject(this.value)"'), 'selecting a project loads its saved HPP');
assert.ok(html.includes('function loadHppProject(projectId)'), 'saved HPP editor hydration exists');
assert.ok(html.includes('function editHppMaterial(id)'), 'material edit workflow exists');
assert.ok(html.includes('function deleteHppMaterial(id)'), 'material delete workflow exists');
assert.ok(html.includes('price=total===0?0:Math.ceil(total/(1-margin/100))'), 'margin is calculated as a percentage of selling price');
assert.ok(html.includes('purchaseOrders: db.purchaseOrders || []'), 'purchase orders included in sync payload');

const backend = fs.readFileSync('google_apps_script.js', 'utf8');
assert.ok(backend.includes('if (payload.services) mergeSummary.Services'), 'Apps Script sync_all upserts services');
assert.ok(backend.includes('if (payload.purchaseOrders) mergeSummary.Purchase_Orders'), 'Apps Script sync_all upserts purchase orders');
assert.ok(backend.includes('purchaseOrders: readSheetData(ss, "Purchase_Orders")'), 'Apps Script reads purchase orders from Sheets');
assert.ok(backend.includes('services: readSheetData(ss, "Services")'), 'Apps Script reads services from Sheets');

const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
for (const [index, script] of inlineScripts.entries()) {
  if (script[1].trim()) new vm.Script(script[1], { filename: 'index.inline.' + index + '.js' });
}
console.log('CSK invoice, HPP calculations, saved-project editing, backend sync contracts, and inline JavaScript syntax checks passed.');
