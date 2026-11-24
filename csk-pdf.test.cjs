'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
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
  this.roundedRects = [];
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
MockPdf.prototype.roundedRect = function(x,y,width,height) { this.roundedRects.push({x,y,width,height}); };
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
MockPdf.prototype.output = function(type) { this.outputType=type; return new Blob(['mock-pdf'],{type:'application/pdf'}); };

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

const longAddress = pdf.generatePdf({
  kind:'quotation',docNo:'QUO-CSK-2026-00100',client:'PT Alamat Panjang',
  clientAddress:Array.from({length:20},()=> 'Jl. Industri Raya Blok A Nomor 123 Kecamatan Serpong').join(', '),
  lines:[{name:'Pekerjaan display',qty:1,unit:'lot',unitPrice:500000}],
  paymentTerms:'Pembayaran sesuai persetujuan tertulis.',bankDetails:'Bank Jago Syariah | 508705048143'
},MockPdf);
const longAddressCard=longAddress.roundedRects.find(rect=>rect.x===14);
assert.ok(longAddressCard&&longAddressCard.height>42,'client information card expands to fit long multi-line addresses');

const veryLongTerms = 'Ketentuan pembayaran dan pelaksanaan pekerjaan wajib mengikuti persetujuan tertulis para pihak. '.repeat(900);
const paginatedTerms = pdf.generatePdf({
  kind:'quotation',docNo:'QUO-CSK-2026-00101',client:'PT Ketentuan Panjang',
  lines:[{name:'Pekerjaan custom',qty:1,unit:'lot',unitPrice:1000000}],
  paymentTerms:veryLongTerms,
  terms:veryLongTerms,
  bankDetails:'Bank Jago Syariah | 508705048143'
},MockPdf);
assert.ok(paginatedTerms.pages>=3,'long payment terms and conditions continue across additional A4 pages without overflowing a single page');



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
assert.ok(pdfSource.includes("w.open('about:blank', '_blank')"), 'iOS opens a preview tab synchronously during the original user gesture');
assert.ok(pdfSource.includes('previewWindow.location.href = url'), 'generated PDF is delivered into the already-open iOS preview tab');
assert.ok(pdfSource.includes("anchor.target = appleMobile ? '_blank' : '_self'"), 'fallback anchor retains platform-specific download behavior');
assert.ok(pdfSource.includes('Bagikan lalu Simpan ke File'), 'iOS users receive explicit Save to Files instructions');
assert.ok(pdfSource.includes('300000'), 'PDF preview URL remains available long enough for mobile sharing');
console.log('CSK PDF tests passed.');

function createPdfWindow(userAgent,popupAllowed){
  const opened=[],anchors=[],timers=[],messages=[];
  const preview={location:{href:'about:blank'},document:{title:''},closed:false,close(){this.closed=true;}};
  const window={
    navigator:{userAgent:userAgent,platform:'',maxTouchPoints:0},
    jspdf:{jsPDF:MockPdf},
    URL:{createObjectURL(){return 'blob:mock-csk-pdf';},revokeObjectURL(url){window.revokedUrl=url;}},
    document:{
      head:{appendChild(){}},
      body:{appendChild(node){anchors.push(node);}},
      createElement(){const node={style:{},click(){this.clicked=true;},remove(){this.removed=true;}};anchors.push(node);return node;}
    },
    setTimeout(fn,delay){timers.push({fn,delay});},
    open(url,target){opened.push({url,target});return popupAllowed?preview:null;},
    location:{href:'https://csk.test/index.html'},
    showToast(message,isError){messages.push({message,isError:!!isError});}
  };
  const sandbox={window,module:{exports:{}},Number,String,Math,Date,Object,Array,Promise,RegExp,Blob};
  vm.runInNewContext(fs.readFileSync('csk-pdf.js','utf8'),sandbox,{filename:'csk-pdf.js'});
  return{window,opened,anchors,timers,messages,preview,api:window.CSKPDF};
}
(async function mobilePdfRegression(){
  const mobile=createPdfWindow('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',true);
  const mobilePromise=mobile.api.downloadDocument(longDoc);
  assert.equal(mobile.opened.length,1,'iOS preview window is opened synchronously before PDF generation awaits');
  assert.equal(mobile.opened[0].url,'about:blank');
  const mobileResult=await mobilePromise;
  assert.equal(mobileResult.ok,true);
  assert.equal(mobileResult.method,'ios-pdf-preview');
  assert.equal(mobile.preview.location.href,'blob:mock-csk-pdf');
  assert.equal(mobile.preview.document.title,'Menyiapkan PDF');
  assert.equal(mobile.anchors.length,0,'iOS preview uses the already-open tab rather than a delayed popup anchor');
  assert.equal(mobile.timers[0].delay,300000);
  assert.match(mobile.messages[0].message,/Simpan ke File/);

  const blocked=createPdfWindow('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',false);
  const blockedResult=await blocked.api.downloadDocument(longDoc);
  assert.equal(blockedResult.method,'ios-pdf-current-tab','blocked iOS popups fall back to opening the PDF in the current tab');
  assert.equal(blocked.window.location.href,'blob:mock-csk-pdf');

  const desktop=createPdfWindow('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130',false);
  const desktopResult=await desktop.api.downloadDocument(longDoc);
  assert.equal(desktopResult.method,'blob-download');
  assert.equal(desktop.opened.length,0,'desktop download does not open an unnecessary tab');
  const desktopAnchor=desktop.anchors[0];
  assert.equal(desktopAnchor.target,'_self');
  assert.equal(desktopAnchor.download,pdf.makeFilename(longDoc));
  assert.equal(desktopAnchor.clicked,true);
  assert.equal(desktopAnchor.removed,true);
  console.log('CSK PDF mobile and desktop download regression tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
