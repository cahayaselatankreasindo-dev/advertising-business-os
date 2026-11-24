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
assert.equal(pdf.makeFilename(normalized), 'QUO-CSK-2026-00001-PT-Maju-Bersama.pdf');
assert.equal(
  pdf.makeFilename({ kind: 'invoice', docNo: 'INV-CSK-2026-00009', client: 'CV Sumber Karya' }),
  'INV-CSK-2026-00009-CV-Sumber-Karya.pdf'
);
assert.equal(pdf.formatRupiah(1250000), 'Rp 1.250.000');
const normalizedPicking = pdf.normalizePickingList({
  orderNo: 'SO-CSK-2026-00042',
  projectId: 'PRJ-BOOTH-042',
  projectName: 'Booth Slowmove Bazaar',
  date: '2026-11-25',
  lines: [
    { name: 'Akrilik Clear 3mm', unit: 'm2', required: 5, issued: 2, outstanding: 3 },
    { name: 'Hollow 2x2', unit: 'm', required: 10, issued: 10, outstanding: 0 }
  ]
});
assert.equal(normalizedPicking.lines.length, 1, 'fully issued materials are excluded from the open picking list');
assert.equal(normalizedPicking.lines[0].outstanding, 3);
assert.equal(pdf.pickingListFilename(normalizedPicking), 'PICKLIST-PRJ-BOOTH-042-SO-CSK-2026-00042.pdf');
assert.throws(() => pdf.generatePickingListPdf({ lines: [] }, function() {}), /Tidak ada material/);
function MockPdf() {
  this.pages = 1;
  this.saved = '';
  this.internal = {
    pageSize: { getWidth: () => 210, getHeight: () => 297 },
    getNumberOfPages: () => this.pages
  };
}
MockPdf.prototype.setProperties = function() {};
MockPdf.prototype.setFont = function() {};
MockPdf.prototype.setFontSize = function() {};
MockPdf.prototype.setTextColor = function() {};
MockPdf.prototype.setFillColor = function() {};
MockPdf.prototype.setDrawColor = function() {};
MockPdf.prototype.rect = function() {};
MockPdf.prototype.roundedRect = function() {};
MockPdf.prototype.line = function() {};
MockPdf.prototype.text = function() {};
MockPdf.prototype.splitTextToSize = function(text, width) {
  const charsPerLine = Math.max(8, Math.floor(width * 1.45));
  const words = String(text).split(/\\s+/);
  const lines = [];
  let line = '';
  words.forEach(word => {
    const next = line ? line + ' ' + word : word;
    if (next.length > charsPerLine && line) { lines.push(line); line = word; }
    else line = next;
  });
  if (line) lines.push(line);
  return lines;
};
MockPdf.prototype.addPage = function() { this.pages += 1; };
MockPdf.prototype.setPage = function() {};
MockPdf.prototype.save = function(name) { this.saved = name; };
const longDoc = {
  kind: 'quotation',
  docNo: 'QUO-CSK-2026-00099',
  client: 'PT Contoh Industri',
  projectName: 'Rak display custom multi lokasi',
  date: '2026-11-20',
  dueDate: '2026-12-04',
  paymentTerms: 'Pembayaran DP 50 persen setelah quotation disetujui.',
  terms: 'Spesifikasi dan ruang lingkup mengikuti persetujuan tertulis.',
  bankDetails: 'Bank Jago Syariah | 508705048143 | a.n. Zefry Dany Adi Syahputra',
  lines: Array.from({ length: 55 }, (_, i) => ({
    name: 'Komponen fabrikasi display nomor ' + (i + 1),
    description: 'Material dan proses produksi sesuai spesifikasi pekerjaan yang telah disetujui oleh pelanggan.',
    qty: 2,
    unit: 'pcs',
    unitPrice: 125000
  }))
};
const generated = pdf.generatePdf(longDoc, MockPdf);
assert.ok(generated.pages > 1, 'long item tables paginate across A4 pages');
assert.equal(generated.internal.getNumberOfPages(), generated.pages);
const generatedPicking = pdf.generatePickingListPdf({
  docNo: 'PICK-SO-CSK-2026-00042',
  orderNo: 'SO-CSK-2026-00042',
  projectId: 'PRJ-BOOTH-042',
  projectName: 'Booth Slowmove Bazaar',
  date: '2026-11-25',
  lines: Array.from({ length: 36 }, (_, i) => ({
    name: 'Material fabrikasi display dan booth komponen nomor ' + (i + 1) + ' dengan spesifikasi panjang khusus',
    unit: 'lembar',
    required: 5,
    issued: 1,
    outstanding: 4
  }))
}, MockPdf);
assert.ok(generatedPicking.pages > 1, 'long picking lists paginate across A4 pages');
assert.equal(generatedPicking.internal.getNumberOfPages(), generatedPicking.pages);


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
const inventory = fs.readFileSync('inventory.js', 'utf8');
assert.ok(inventory.includes('data-inv-action="pdf-picklist"'), 'project picking list exposes a PDF download action');
assert.ok(inventory.includes('downloadPickingListPdf'), 'inventory UI builds a project-specific picking list PDF');
assert.ok(pdf.downloadPickingList && pdf.generatePickingListPdf, 'PDF engine exports picking list generation and download functions');
console.log('CSK PDF tests passed.');
