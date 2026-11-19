'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pdf = require('./csk-pdf.js');

const normalized = pdf.normalizeDocument({
  kind: 'quotation',
  docNo: 'QUO-CSK-2026-00001',
  client: 'PT Maju Bersama',
  lines: [
    { name: 'Akrilik 3 mm', description: 'Clear cast acrylic', qty: 2, unit: 'lembar', unitPrice: 250000 },
    { name: 'Laser cutting', qty: 1.5, unit: 'jam', unitPrice: 100000 }
  ],
  discount: 20000,
  taxRate: 11
});
assert.equal(normalized.subtotal, 650000);
assert.equal(normalized.discount, 20000);
assert.equal(normalized.taxAmount, 69300);
assert.equal(normalized.total, 699300);
assert.equal(normalized.lines.length, 2);
assert.equal(normalized.lines[0].lineTotal, 500000);
assert.equal(pdf.makeFilename(normalized), 'QUOTATION-CSK-QUO-CSK-2026-00001-PT-Maju-Bersama.pdf');
assert.equal(
  pdf.makeFilename({ kind: 'invoice', docNo: 'INV-CSK-2026-00009', client: 'CV Sumber Karya' }),
  'INVOICE-CSK-INV-CSK-2026-00009-CV-Sumber-Karya.pdf'
);
assert.equal(pdf.formatRupiah(1250000), 'Rp 1.250.000');

const html = fs.readFileSync('index.html', 'utf8');
const commercial = fs.readFileSync('commercial-documents.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
assert.ok(html.includes('<script src="./csk-pdf.js"></script>'), 'PDF engine is loaded before commercial document module');
assert.ok(html.includes('downloadLegacyInvoicePdf()'), 'legacy project invoice has a direct PDF download action');
assert.ok(html.includes('fa-download'), 'legacy invoice toolbar exposes a download action');
assert.ok(commercial.includes('function downloadCommercialDocumentPdf()'), 'commercial document editor has a direct PDF download handler');
assert.ok(commercial.includes("data-action=\"download-existing\""), 'saved document cards expose direct PDF download');
assert.ok(commercial.includes('w.downloadCommercialDocumentPdf=downloadCommercialDocumentPdf'), 'PDF handler is available to the document UI');
assert.ok(sw.includes('./csk-pdf.js'), 'service worker precaches the PDF engine');
console.log('CSK PDF tests passed.');
