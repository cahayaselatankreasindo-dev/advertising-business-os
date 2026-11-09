'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { calculateCommercialTotals, nextDocumentNumber, findExistingProjectForDocument } = require('./commercial-documents.js');
const html = fs.readFileSync('index.html', 'utf8');
const source = fs.readFileSync('commercial-documents.js', 'utf8');
const guard = fs.readFileSync('security/guard.js', 'utf8');
const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const mirror = fs.readFileSync('google_apps_script.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/csk-security-tests.yml', 'utf8');

assert.deepEqual(
  calculateCommercialTotals([{ qty: 2, unitPrice: 100000 }, { qty: 1, unitPrice: 50000 }], 10000, 11),
  { subtotal: 250000, discount: 10000, taxRate: 11, taxAmount: 26400, total: 266400 }
);
assert.equal(
  nextDocumentNumber('quotation', [{ docNo: 'QUO-CSK-2026-00002' }, { docNo: 'QUO-CSK-2026-00007' }], '2026-11-09'),
  'QUO-CSK-2026-00008'
);
assert.equal(nextDocumentNumber('invoice', [], '2026-11-09'), 'INV-CSK-2026-00001');
const leadQueueProject = { id: 'P-LEAD', notes: 'Antrean otomatis dari Lead [LEAD-L1]' };
assert.equal(findExistingProjectForDocument([leadQueueProject], { id: 'INV1', leadId: 'L1' }, '', 'INV1'), leadQueueProject);
assert.equal(findExistingProjectForDocument([leadQueueProject], { id: 'INV2', leadId: 'L2' }, '', 'INV2'), null);
const quoteProject = { id: 'P-QUOTE', sourceQuotationId: 'CQ1' };
assert.equal(findExistingProjectForDocument([quoteProject], { id: 'INV3' }, 'CQ1', 'INV3'), quoteProject);
assert.ok(html.includes('<script src="./commercial-documents.js"></script>'));
assert.ok(html.includes('db.quotations = parsed.quotations || []'));
assert.ok(html.includes('db.invoices = parsed.invoices || []'));
assert.ok(html.includes("if (page === 'documents') (window.renderDocuments || renderDocuments)();"));
assert.ok(html.includes('db.quotationSnapshots = parsed.quotationSnapshots || []'));
assert.ok(!source.includes('delete db.quotationSnapshots'));
assert.ok(source.includes('db.quotationSnapshots=Array.isArray(db.quotationSnapshots)?db.quotationSnapshots:[]'));
assert.ok(!source.includes('Array.isArray(db.quotationSnapshots)?db.quotationSnapshots:[]);try{delete'));
for (const name of [
  'createProjectFromDocument', 'createProjectFromQuotation', 'createProjectFromInvoice',
  'createInvoiceFromQuotation', 'selectCommercialLead', 'addCommercialMasterItem',
  'saveCommercialDocument', 'printCommercialDocument', 'copyCommercialDocumentWA'
]) assert.ok(source.includes('function ' + name + '(') || source.includes('w.' + name + '='));
assert.ok(source.includes('sourceInvoiceId:sourceI'));
assert.match(source, /data-kind="'\+k\+'"/);
assert.ok(source.includes('Dokumen komersial hanya dapat dikelola Owner.'));
for (const s of [backend, mirror]) {
  assert.match(s, /Commercial_Quotations:\s*\{/);
  assert.match(s, /Invoices:\s*\{/);
  assert.match(s, /sourceInvoiceId/);
  assert.match(s, /if \(payload\.invoices\)/);
  assert.match(s, /if \(payload\.quotations\)/);
  assert.match(s, /quotations: readSheetData\(ss, "Commercial_Quotations"\)/);
  assert.match(s, /invoices: readSheetData\(ss, "Invoices"\)/);
  assert.match(s, /quotationSnapshots: readSheetData\(ss, "Quotations"\)/);
}
assert.equal(backend.trimEnd(), mirror.trimEnd());
assert.match(guard, /'quotationSnapshots','quotations','invoices'/);
assert.match(guard, /Commercial_Quotations:'quotations',Invoices:'invoices'/);
assert.match(sw, /commercial-documents\.js/);
assert.match(workflow, /node commercial-documents\.test\.cjs/);
const inline = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
  .map(x => x[2]).find(x => x.includes('const DB_KEY'));
assert.ok(inline, 'main inline script exists');
assert.doesNotThrow(() => new Function(inline));
assert.doesNotThrow(() => new Function(source));
assert.doesNotThrow(() => new Function(guard));
assert.doesNotThrow(() => new Function(backend));
console.log('Commercial Document Center tests passed.');
