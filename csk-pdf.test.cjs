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
const pdfSource = fs.readFileSync('csk-pdf.js', 'utf8');
assert.ok(pdfSource.includes("pdf.output('blob')"), 'PDF download creates a browser-compatible Blob');
assert.ok(pdfSource.includes('URL.createObjectURL'), 'PDF download uses a Blob URL for mobile browser compatibility');
assert.match(pdfSource,/anchor\.download\s*=\s*filename/, 'PDF download uses a real file download anchor');
assert.ok(pdfSource.includes("anchor.target = isAppleMobile ? '_blank' : '_self'"), 'iPhone and iPad open the generated PDF in a saveable preview tab');
assert.ok(pdfSource.includes('Bagikan lalu Simpan ke File'), 'iOS users receive explicit Save to Files instructions');
assert.ok(pdfSource.includes('300000'), 'PDF preview URL remains available long enough for mobile sharing');
console.log('CSK PDF tests passed.');
