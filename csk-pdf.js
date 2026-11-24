(function(w){
'use strict';

var loadPromise = null;
var COMPANY = {
  name: 'CAHAYA SELATAN KREASINDO',
  tagline: 'PRODUCTION PARTNER UNTUK BRAND & BISNIS',
  address: 'Jl. Doel Silem No. 45, Rawa Mekar Jaya, Serpong',
  city: 'Kota Tangerang Selatan, Banten 15317',
  contact: 'WA 0888-8533-488 | halo@cahayaselatankreasindo.my.id',
  bank: 'Bank Jago Syariah | 508705048143 | a.n. Zefry Dany Adi Syahputra',
  owner: 'Zefry Dany Adi Syahputra'
};
var COLORS = {
  ink: [27, 31, 38],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  paper: [248, 250, 252],
  orange: [229, 107, 24],
  paleOrange: [255, 241, 230],
  green: [22, 133, 107],
  white: [255, 255, 255]
};

function number(value) {
  var parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function cleanText(value) {
  return String(value == null ? '' : value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}
function formatRupiah(value) {
  return 'Rp ' + Math.round(number(value)).toLocaleString('id-ID');
}
function formatDate(value) {
  if (!value) return '-';
  var date = value instanceof Date ? value : new Date(String(value).slice(0, 10) + 'T12:00:00');
  if (!Number.isFinite(date.getTime())) return cleanText(value);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}
function normalizeDocument(input) {
  input = input || {};
  var lines = Array.isArray(input.lines) ? input.lines.map(function(line) {
    var qty = Math.max(0, number(line.qty));
    var unitPrice = Math.max(0, number(line.unitPrice));
    return {
      name: cleanText(line.name || line.description || 'Item'),
      description: cleanText(line.description || ''),
      qty: qty,
      unit: cleanText(line.unit || 'unit'),
      unitPrice: unitPrice,
      lineTotal: Math.round(qty * unitPrice)
    };
  }) : [];
  var subtotal = Math.round(lines.reduce(function(sum, line) { return sum + line.lineTotal; }, 0));
  var discount = Math.min(subtotal, Math.max(0, Math.round(number(input.discount))));
  var taxRate = Math.min(100, Math.max(0, number(input.taxRate)));
  var taxAmount = Math.round((subtotal - discount) * taxRate / 100);
  var computedTotal = subtotal - discount + taxAmount;
  var total = input.total == null ? computedTotal : Math.max(0, Math.round(number(input.total)));
  return {
    kind: input.kind || input.documentType || 'quotation',
    title: cleanText(input.title || ''),
    docNo: cleanText(input.docNo || input.documentNumber || 'DRAFT'),
    date: input.date || '',
    dueDate: input.dueDate || '',
    projectDeadline: input.projectDeadline || '',
    client: cleanText(input.client || ''),
    clientPhone: cleanText(input.clientPhone || ''),
    clientEmail: cleanText(input.clientEmail || ''),
    clientAddress: cleanText(input.clientAddress || ''),
    contactPerson: cleanText(input.contactPerson || ''),
    projectName: cleanText(input.projectName || ''),
    projectId: cleanText(input.projectId || ''),
    lines: lines,
    subtotal: subtotal,
    discount: discount,
    taxRate: taxRate,
    taxAmount: taxAmount,
    total: total,
    paymentTerms: cleanText(input.paymentTerms || ''),
    terms: cleanText(input.terms || ''),
    notes: cleanText(input.notes || ''),
    status: cleanText(input.status || ''),
    contractTotal: input.contractTotal == null ? null : Math.max(0, Math.round(number(input.contractTotal))),
    paymentSummary: input.paymentSummary ? cleanText(input.paymentSummary) : '',
    bankDetails: cleanText(input.bankDetails || COMPANY.bank)
  };
}
function makeFilename(input) {
  var d = normalizeDocument(input);
  var client = d.client.normalize ? d.client.normalize('NFKD') : d.client;
  client = client.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'PELANGGAN';
  var numberPart = (d.docNo || 'DRAFT').replace(/[^a-zA-Z0-9_-]+/g, '-');
  return numberPart + '-' + client + '.pdf';
}
function notify(message, isError) {
  if (typeof w.showToast === 'function') w.showToast(message, !!isError);
}
function loadJsPdf() {
  if (w.jspdf && w.jspdf.jsPDF) return Promise.resolve(w.jspdf.jsPDF);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise(function(resolve, reject) {
    var script = w.document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = function() {
      if (w.jspdf && w.jspdf.jsPDF) resolve(w.jspdf.jsPDF);
      else reject(new Error('Library PDF termuat tetapi tidak tersedia.'));
    };
    script.onerror = function() {
      loadPromise = null;
      reject(new Error('Library PDF tidak dapat dimuat. Periksa koneksi internet lalu coba lagi.'));
    };
    w.document.head.appendChild(script);
  });
  return loadPromise;
}
function setColor(pdf, method, color) {
  pdf[method].apply(pdf, color);
}
function drawText(pdf, text, x, y, size, style, color, width) {
  pdf.setFont('helvetica', style || 'normal');
  pdf.setFontSize(size || 8);
  setColor(pdf, 'setTextColor', color || COLORS.ink);
  var value = cleanText(text);
  var lines = width ? pdf.splitTextToSize(value, width) : [value];
  pdf.text(lines, x, y);
  return lines.length * (size || 8) * 0.42;
}
function drawHeader(pdf, d, continuation) {
  var pageWidth = pdf.internal.pageSize.getWidth();
  setColor(pdf, 'setFillColor', COLORS.orange);
  pdf.rect(0, 0, pageWidth, 4, 'F');
  if (continuation) {
    drawText(pdf, COMPANY.name, 14, 15, 10, 'bold', COLORS.ink);
    drawText(pdf, d.docNo + ' - Lanjutan', pageWidth - 14, 15, 8, 'normal', COLORS.muted);
    pdf.setDrawColor.apply(pdf, COLORS.line);
    pdf.line(14, 20, pageWidth - 14, 20);
    return 27;
  }
  drawText(pdf, COMPANY.name, 14, 17, 15, 'bold', COLORS.ink);
  drawText(pdf, COMPANY.tagline, 14, 23, 7, 'bold', COLORS.orange);
  drawText(pdf, COMPANY.address, 14, 30, 7, 'normal', COLORS.muted);
  drawText(pdf, COMPANY.city, 14, 34, 7, 'normal', COLORS.muted);
  drawText(pdf, COMPANY.contact, 14, 38, 7, 'normal', COLORS.muted);

  var boxX = 132, boxY = 11, boxW = 64, boxH = 34;
  setColor(pdf, 'setFillColor', COLORS.ink);
  pdf.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'F');
  drawText(pdf, d.title || (d.kind === 'invoice' ? 'INVOICE / TAGIHAN' : 'QUOTATION / PENAWARAN'), boxX + 5, boxY + 8, 8, 'bold', COLORS.white, boxW - 10);
  drawText(pdf, d.docNo, boxX + 5, boxY + 16, 9, 'bold', COLORS.white, boxW - 10);
  drawText(pdf, 'Tanggal: ' + formatDate(d.date), boxX + 5, boxY + 23, 6.5, 'normal', COLORS.white, boxW - 10);
  drawText(pdf, 'Jatuh tempo / berlaku: ' + formatDate(d.dueDate), boxX + 5, boxY + 29, 6.1, 'normal', COLORS.white, boxW - 10);
  return 53;
}
function drawInfoCard(pdf, x, y, width, title, rows) {
  setColor(pdf, 'setFillColor', COLORS.paper);
  pdf.roundedRect(x, y, width, 42, 2, 2, 'F');
  drawText(pdf, title, x + 4, y + 6, 6.5, 'bold', COLORS.orange);
  var cursor = y + 12;
  rows.forEach(function(row, index) {
    if (!row || !row.value) return;
    var text = (row.label ? row.label + ': ' : '') + row.value;
    var h = drawText(pdf, text, x + 4, cursor, index === 0 ? 8 : 7, index === 0 ? 'bold' : 'normal', index === 0 ? COLORS.ink : COLORS.muted, width - 8);
    cursor += Math.max(4, h + 1);
  });
}
function drawTableHeader(pdf, y) {
  var x = [14, 23, 99, 114, 131, 162, 196];
  var labels = ['No', 'Deskripsi pekerjaan / produk', 'Qty', 'Satuan', 'Harga satuan', 'Jumlah'];
  setColor(pdf, 'setFillColor', COLORS.ink);
  pdf.rect(14, y - 6, 182, 10, 'F');
  setColor(pdf, 'setTextColor', COLORS.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.8);
  pdf.text(labels[0], x[0] + 2, y);
  pdf.text(labels[1], x[1] + 2, y);
  pdf.text(labels[2], x[2] + 2, y, { align: 'center' });
  pdf.text(labels[3], x[3] + 2, y);
  pdf.text(labels[4], x[4] + 2, y);
  pdf.text(labels[5], x[6] - 2, y, { align: 'right' });
  return x;
}
function drawRow(pdf, row, index, y, x) {
  var nameLines = pdf.splitTextToSize(row.name || 'Item', 72);
  var descLines = row.description ? pdf.splitTextToSize(row.description, 72) : [];
  var height = Math.max(11, 3 + nameLines.length * 4 + descLines.length * 3.2);
  pdf.setDrawColor.apply(pdf, COLORS.line);
  pdf.line(14, y + height, 196, y + height);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  setColor(pdf, 'setTextColor', COLORS.muted);
  pdf.text(String(index + 1), x[0] + 2, y + 4);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  setColor(pdf, 'setTextColor', COLORS.ink);
  pdf.text(nameLines, x[1] + 2, y + 4);
  if (descLines.length) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.8);
    setColor(pdf, 'setTextColor', COLORS.muted);
    pdf.text(descLines, x[1] + 2, y + 4 + nameLines.length * 4);
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.2);
  setColor(pdf, 'setTextColor', COLORS.ink);
  pdf.text(String(row.qty), x[2] + 2, y + 4, { align: 'center' });
  pdf.text(row.unit || '-', x[3] + 2, y + 4);
  pdf.text(formatRupiah(row.unitPrice), x[5] - 2, y + 4, { align: 'right' });
  pdf.setFont('helvetica', 'bold');
  pdf.text(formatRupiah(row.lineTotal), x[6] - 2, y + 4, { align: 'right' });
  return height;
}
function addFooter(pdf) {
  var count = pdf.internal.getNumberOfPages();
  var pageWidth = pdf.internal.pageSize.getWidth();
  var pageHeight = pdf.internal.pageSize.getHeight();
  for (var i = 1; i <= count; i++) {
    pdf.setPage(i);
    pdf.setDrawColor.apply(pdf, COLORS.line);
    pdf.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
    drawText(pdf, COMPANY.contact, 14, pageHeight - 10, 6.2, 'normal', COLORS.muted);
    drawText(pdf, 'Halaman ' + i + ' / ' + count, pageWidth - 14, pageHeight - 10, 6.2, 'normal', COLORS.muted);
  }
}
function generatePdf(input, jsPDF) {
  var d = normalizeDocument(input);
  var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  var pageWidth = pdf.internal.pageSize.getWidth();
  var pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setProperties({
    title: d.title + ' - ' + d.docNo,
    subject: 'Dokumen komersial Cahaya Selatan Kreasindo',
    author: COMPANY.name,
    creator: 'CSK Business OS'
  });
  var y = drawHeader(pdf, d, false);
  drawInfoCard(pdf, 14, y, 88, 'DITUJUKAN KEPADA', [
    { value: d.client || 'Nama pelanggan belum diisi' },
    { value: d.contactPerson, label: 'PIC' },
    { value: d.clientPhone, label: 'Telepon' },
    { value: d.clientEmail, label: 'Email' },
    { value: d.clientAddress, label: 'Alamat' }
  ]);
  drawInfoCard(pdf, 108, y, 88, 'INFORMASI PEKERJAAN', [
    { value: d.projectName || '-' },
    { value: d.projectId, label: 'Project ID' },
    { value: d.projectDeadline ? formatDate(d.projectDeadline) : '', label: 'Deadline proyek' },
    { value: d.status ? d.status.toUpperCase() : '', label: 'Status' }
  ]);
  y += 51;
  drawText(pdf, 'RINCIAN PRODUK DAN JASA', 14, y, 8, 'bold', COLORS.ink);
  y += 8;
  var x = drawTableHeader(pdf, y);
  y += 5;
  d.lines.forEach(function(row, index) {
    var rowHeight = 3 + Math.max(1, pdf.splitTextToSize(row.name || 'Item', 72).length) * 4 + (row.description ? pdf.splitTextToSize(row.description, 72).length * 3.2 : 0);
    rowHeight = Math.max(11, rowHeight);
    if (y + rowHeight > pageHeight - 34) {
      pdf.addPage();
      y = drawHeader(pdf, d, true);
      x = drawTableHeader(pdf, y);
      y += 5;
    }
    y += drawRow(pdf, row, index, y, x);
  });
  if (!d.lines.length) {
    drawText(pdf, 'Tidak ada rincian item.', 16, y + 4, 7.5, 'normal', COLORS.muted);
    y += 12;
  }
  y += 7;
  var totalsHeight = 34;
  if (y + totalsHeight > pageHeight - 32) {
    pdf.addPage();
    y = drawHeader(pdf, d, true) + 4;
  }
  var tx = 112, tw = 84;
  setColor(pdf, 'setFillColor', COLORS.paper);
  pdf.roundedRect(tx, y, tw, totalsHeight, 2, 2, 'F');
  var totals = [
    ['Subtotal', formatRupiah(d.subtotal)],
    ['Diskon', '- ' + formatRupiah(d.discount)],
    ['Pajak (' + d.taxRate + '%)', formatRupiah(d.taxAmount)]
  ];
  totals.forEach(function(item, i) {
    drawText(pdf, item[0], tx + 4, y + 7 + i * 6, 7, 'normal', COLORS.muted);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text(item[1], tx + tw - 4, y + 7 + i * 6, { align: 'right' });
  });
  setColor(pdf, 'setFillColor', COLORS.orange);
  pdf.rect(tx, y + 23, tw, 11, 'F');
  drawText(pdf, 'TOTAL', tx + 4, y + 30, 8, 'bold', COLORS.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  setColor(pdf, 'setTextColor', COLORS.white);
  pdf.text(formatRupiah(d.total), tx + tw - 4, y + 30, { align: 'right' });
  y += totalsHeight + 8;

  if (d.contractTotal != null || d.paymentSummary) {
    if (y + 17 > pageHeight - 30) { pdf.addPage(); y = drawHeader(pdf, d, true) + 4; }
    setColor(pdf, 'setFillColor', COLORS.paleOrange);
    pdf.roundedRect(14, y, 182, 15, 2, 2, 'F');
    var summary = d.paymentSummary || ('Nilai kontrak: ' + formatRupiah(d.contractTotal));
    drawText(pdf, summary, 18, y + 9, 7.2, 'bold', COLORS.ink, 174);
    y += 21;
  }
  var leftWidth = 94, rightX = 128;
  var terms = [];
  if (d.paymentTerms) terms.push({ label: 'KETENTUAN PEMBAYARAN', text: d.paymentTerms });
  if (d.terms) terms.push({ label: 'SYARAT DAN KETENTUAN', text: d.terms });
  if (d.notes) terms.push({ label: 'CATATAN', text: d.notes });
  var termsHeight = terms.reduce(function(sum, item) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7);
    return sum + 7 + pdf.splitTextToSize(item.text, leftWidth).length * 3.6;
  }, 0);
  if (y + Math.max(termsHeight, 37) > pageHeight - 25) {
    pdf.addPage();
    y = drawHeader(pdf, d, true) + 5;
  }
  terms.forEach(function(item) {
    drawText(pdf, item.label, 14, y + 4, 6.5, 'bold', COLORS.orange);
    var h = drawText(pdf, item.text, 14, y + 9, 7, 'normal', COLORS.ink, leftWidth);
    y += h + 13;
  });
  if (d.bankDetails) {
    if (y + 14 > pageHeight - 25) { pdf.addPage(); y = drawHeader(pdf, d, true) + 5; }
    drawText(pdf, 'INFORMASI PEMBAYARAN', 14, y + 4, 6.5, 'bold', COLORS.orange);
    var bankHeight = drawText(pdf, d.bankDetails, 14, y + 9, 7, 'normal', COLORS.ink, leftWidth);
    y += bankHeight + 13;
  }
  var signY = Math.max(y, pageHeight - 62);
  if (signY + 42 > pageHeight - 18) {
    pdf.addPage();
    signY = drawHeader(pdf, d, true) + 10;
  }
  drawText(pdf, 'Hormat kami,', rightX, signY, 7.5, 'normal', COLORS.ink);
  drawText(pdf, COMPANY.name, rightX, signY + 6, 7, 'bold', COLORS.ink, 66);
  pdf.setDrawColor.apply(pdf, COLORS.line);
  pdf.line(rightX, signY + 29, 194, signY + 29);
  drawText(pdf, COMPANY.owner, rightX, signY + 34, 7.5, 'bold', COLORS.ink, 66);
  drawText(pdf, 'Owner', rightX, signY + 39, 7, 'normal', COLORS.muted);
  addFooter(pdf);
  return pdf;
}
function isAppleMobile() {
  var userAgent = String(w && w.navigator && w.navigator.userAgent || '');
  return /iPhone|iPad|iPod/.test(userAgent) ||
    (String(w && w.navigator && w.navigator.platform || '') === 'MacIntel' && Number(w && w.navigator && w.navigator.maxTouchPoints || 0) > 1);
}
function downloadBlob(blob, filename, previewWindow) {
  if (!blob || !w || !w.URL || typeof w.URL.createObjectURL !== 'function') {
    throw new Error('Browser tidak mendukung penyimpanan PDF. Gunakan Cetak lalu Simpan sebagai PDF.');
  }
  var url = w.URL.createObjectURL(blob);
  var appleMobile = isAppleMobile();
  if (appleMobile && previewWindow && !previewWindow.closed && previewWindow.location) {
    previewWindow.location.href = url;
    if (typeof w.setTimeout === 'function') w.setTimeout(function() { w.URL.revokeObjectURL(url); }, 300000);
    return 'ios-pdf-preview';
  }
  if (appleMobile && w.location) {
    w.location.href = url;
    if (typeof w.setTimeout === 'function') w.setTimeout(function() { w.URL.revokeObjectURL(url); }, 300000);
    return 'ios-pdf-current-tab';
  }
  var anchor = w.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.target = appleMobile ? '_blank' : '_self';
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  w.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (typeof w.setTimeout === 'function') w.setTimeout(function() { w.URL.revokeObjectURL(url); }, 300000);
  return 'blob-download';
}
async function downloadDocument(input) {
  var previewWindow = null;
  if (isAppleMobile() && typeof w.open === 'function') {
    try {
      previewWindow = w.open('about:blank', '_blank');
      if (previewWindow && previewWindow.document) previewWindow.document.title = 'Menyiapkan PDF';
    } catch (openError) {
      previewWindow = null;
    }
  }
  try {
    var jsPDF = await loadJsPdf();
    var pdf = generatePdf(input, jsPDF);
    var filename = makeFilename(input);
    var blob = pdf.output('blob');
    var method = downloadBlob(blob, filename, previewWindow);
    notify(method === 'ios-pdf-preview' || method === 'ios-pdf-current-tab'
      ? 'PDF dibuka untuk pratinjau. Di iPhone/iPad, pilih Bagikan lalu Simpan ke File.'
      : 'PDF disiapkan untuk diunduh: ' + filename, false);
    return { ok: true, filename: filename, method: method };
  } catch (error) {
    if (previewWindow && !previewWindow.closed && typeof previewWindow.close === 'function') previewWindow.close();
    notify('PDF belum dapat diunduh. ' + String(error && error.message || error) + ' Gunakan Cetak lalu pilih Simpan sebagai PDF.', true);
    return { ok: false, error: String(error && error.message || error) };
  }
}

var api = {
  normalizeDocument: normalizeDocument,
  makeFilename: makeFilename,
  formatRupiah: formatRupiah,
  downloadDocument: downloadDocument,
  generatePdf: generatePdf
};
if (w) w.CSKPDF = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
