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
assert.ok(html.includes('escapeInvoiceHtml(line.name)'), 'quotation rows render line descriptions safely');
assert.ok(html.includes('escapeInvoiceHtml(p.notes)'), 'project notes remain escaped in quotation');

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


assert.ok(html.includes('function setHppLineField(index, field, value)'), 'HPP line fields have edit handler');
for (const field of ['name','unit','qty','unitPrice']) {
  assert.ok(html.includes("'"+field+"'"), 'HPP supports editing '+field);
}
assert.ok(html.includes('function deleteHppEstimate(projectId)'), 'saved HPP can be deleted with confirmation');
assert.ok(html.includes('onchange="setHppLineField('), 'HPP line editor inputs invoke update handler');
assert.ok(html.includes('id="hpp-labor" type="number"'), 'labor cost is editable');
assert.ok(html.includes('id="hpp-other" type="number"'), 'other cost is editable');
assert.ok(html.includes('id="hpp-margin" type="number"'), 'profit margin is editable');

assert.ok(html.includes('--csk-paper:#F8F7F4'), 'professional off-white design tokens exist');
assert.ok(html.includes('--csk-orange:#FF8A3D'), 'CSK orange accent token exists');
assert.ok(html.includes("family=Inter"), 'Inter typography is loaded');
assert.ok(html.includes('id="csk-mobile-more"'), 'mobile More navigation panel exists');
assert.ok(html.includes("function toggleMobileMore(open)"), 'mobile More navigation is functional');
assert.ok(html.includes("function mobileGo(page)"), 'mobile module navigation handler exists');
assert.ok(html.includes("mobileGo('documents')"), 'quotation and invoice accessible from mobile More');
assert.ok(html.includes("mobileGo('purchasing')"), 'purchasing accessible from mobile More');

assert.ok(html.includes('function renderLeads()'), 'CRM renderer exists');
assert.ok(html.includes('break-words'), 'CRM cards wrap long customer data on mobile');
assert.ok(html.includes('escapeInvoiceHtml(l.name||\'Tanpa nama\')'), 'CRM customer names are HTML-escaped');
assert.ok(html.includes('escapeInvoiceHtml(l.notes)'), 'CRM notes are HTML-escaped');
assert.ok(html.includes('rel="noopener noreferrer"'), 'external CRM links use safe opener isolation');
assert.ok(html.includes('function renderProjects()'), 'project renderer exists');
assert.ok(html.includes('escapeInvoiceHtml(p.title||\'Tanpa nama proyek\')'), 'project titles are HTML-escaped');
assert.ok(html.includes('escapeInvoiceHtml(p.notes)'), 'project notes are HTML-escaped');
assert.ok(html.includes('grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-end gap-2'), 'project actions use touch-friendly mobile grid');

assert.ok(html.includes('function editPoLine(index)'), 'purchase order line items can be edited');
assert.ok(html.includes('onclick="editPoLine('), 'purchase order edit action is wired');
assert.ok(html.includes('bg-stone-50/70 p-3 flex flex-col gap-2'), 'HPP material cards use mobile-first layout');
assert.ok(html.includes('function renderPoList()'), 'purchase order renderer exists');
assert.ok(html.includes('rounded-2xl p-4 sm:p-5 shadow-sm space-y-3'), 'purchase orders use responsive cards');
assert.ok(html.includes('function renderFinance()'), 'finance renderer exists');
assert.ok(html.includes('escapeInvoiceHtml(f.description||\'Transaksi\')'), 'finance descriptions are escaped');
assert.ok(html.includes('sm:flex-row sm:items-center sm:justify-between gap-3'), 'finance transactions adapt to mobile cards');

assert.ok(html.includes("escapeInvoiceHtml(c.name||'Tanpa nama')"), 'client names are escaped');
assert.ok(html.includes('escapeInvoiceHtml(review)'), 'client reviews are escaped');
assert.ok(html.includes('function editService(id)'), 'service catalog supports editing');
assert.ok(html.includes('onclick="editService('), 'service edit action is wired');
assert.ok(html.includes("rows.length+' dari '+db.services.length"), 'service catalog count is shown');
assert.ok(html.includes("escapeInvoiceHtml(m.campaign||'Campaign')"), 'marketing campaign names are escaped');
assert.ok(html.includes('Sisa <b'), 'marketing campaign cards show remaining budget');

assert.ok(html.includes('function renderMemory()'), 'strategy notes renderer exists');
assert.ok(html.includes('escapeInvoiceHtml(m.category||\'Catatan\')'), 'strategy note categories are escaped');
assert.ok(html.includes('escapeInvoiceHtml(m.content||m.note||\'\')'), 'strategy note content is escaped');
assert.ok(html.includes('escapeInvoiceHtml(p.title || \'Tanpa nama proyek\')'), 'dashboard project titles are escaped');
assert.ok(html.includes('escapeInvoiceHtml(p.client || \'-\')'), 'dashboard client names are escaped');

assert.ok(html.includes('const netProfit = totalIncome - totalExpense - totalMktSpend;'), 'dashboard net profit includes separately tracked marketing spend');
assert.ok(html.includes('const marginPct = totalIncome ? Math.round((netProfit / totalIncome) * 100) : 0;'), 'dashboard margin uses corrected net profit');

const waStart = html.indexOf('function copyInvoiceWA()');
const waEnd = html.indexOf('function submitFinance(e)', waStart);
assert.ok(waStart >= 0 && waEnd > waStart, 'WhatsApp invoice action exists');
const waFunction = html.slice(waStart, waEnd);
assert.ok(waFunction.includes("const quotationSnapshot = currentInvoiceType === 'penawaran' ? getActiveQuotationSnapshot() : null;"), 'WhatsApp quotation reads the saved quotation snapshot');
assert.ok(waFunction.includes("const costSheet = getProjectCostSheet(p.id);"), 'WhatsApp invoice reads the project HPP sheet');
assert.ok(waFunction.includes("const totalVal = Number(quotationSnapshot ? quotationSnapshot.total : (costSheet ? costSheet.price : (p.value || 0)));"), 'WhatsApp and printable document use the same project total source');

const navStart = html.indexOf('    function nav(page) {');
const navEnd = html.indexOf('    // Explicit global binding keeps inline navigation working across browsers.', navStart);
assert.ok(navStart >= 0 && navEnd > navStart, 'navigation controller exists');
const navSource = html.slice(navStart, navEnd);
assert.ok(navSource.includes("document.getElementById('page-' + page)"), 'navigation resolves target section by page id');
assert.ok(navSource.includes("section.style.display = 'none'"), 'navigation explicitly hides inactive pages');
assert.ok(navSource.includes("target.style.display = 'block'"), 'navigation explicitly shows selected page');
assert.ok(html.includes('window.nav = nav;'), 'inline sidebar navigation has explicit global binding');
console.log('CSK navigation, invoice/quotation parity, CRM, HPP, purchasing, finance, marketing, strategy notes, profit consistency and responsive design checks passed.');

