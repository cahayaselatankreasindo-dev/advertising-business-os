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
async function downloadDocument(input) {
  try {
    var jsPDF = await loadJsPdf();
    var pdf = generatePdf(input, jsPDF);
    var filename = makeFilename(input);
    pdf.save(filename);
    notify('PDF berhasil dibuat: ' + filename, false);
    return { ok: true, filename: filename };
  } catch (error) {
    notify('PDF belum berhasil dibuat. ' + String(error && error.message || error) + ' Anda masih dapat mencoba Cetak.', true);
    return { ok: false, error: String(error && error.message || error) };
  }
}


function normalizePickingList(input) {
  input = input || {};
  var lines = Array.isArray(input.lines) ? input.lines.map(function(line) {
    return {
      name: cleanText(line.name || line.materialName || 'Material'),
      unit: cleanText(line.unit || '-'),
      required: Math.max(0, number(line.required)),
      issued: Math.max(0, number(line.issued)),
      outstanding: Math.max(0, number(line.outstanding))
    };
  }).filter(function(line) { return line.outstanding > 0; }) : [];
  return {
    title: cleanText(input.title || 'MATERIAL PICKING LIST'),
    docNo: cleanText(input.docNo || input.orderNo || 'DRAFT'),
    orderNo: cleanText(input.orderNo || '-'),
    projectId: cleanText(input.projectId || ''),
    projectName: cleanText(input.projectName || '-'),
    date: input.date || '',
    preparedBy: cleanText(input.preparedBy || ''),
    lines: lines
  };
}
function pickingListFilename(input) {
  var d = normalizePickingList(input);
  var project = (d.projectId || d.projectName || 'PROJECT').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28);
  var order = (d.orderNo || 'DRAFT').replace(/[^a-zA-Z0-9_-]+/g, '-');
  return 'PICKLIST-' + project + '-' + order + '.pdf';
}
function drawPickingHeader(pdf, d, continuation) {
  var pageWidth = pdf.internal.pageSize.getWidth();
  setColor(pdf, 'setFillColor', COLORS.orange);
  pdf.rect(0, 0, pageWidth, 4, 'F');
  drawText(pdf, COMPANY.name, 14, 16, 13, 'bold', COLORS.ink);
  drawText(pdf, COMPANY.tagline, 14, 22, 6.8, 'bold', COLORS.orange);
  drawText(pdf, COMPANY.contact, 14, 30, 6.6, 'normal', COLORS.muted);
  setColor(pdf, 'setFillColor', COLORS.ink);
  pdf.roundedRect(139, 10, 57, 27, 2, 2, 'F');
  drawText(pdf, continuation ? 'PICKING LIST - LANJUTAN' : d.title, 143, 18, 7.2, 'bold', COLORS.white, 49);
  drawText(pdf, d.docNo, 143, 26, 8.2, 'bold', COLORS.white, 49);
  drawText(pdf, 'Tanggal: ' + formatDate(d.date), 143, 32, 6.2, 'normal', COLORS.white, 49);
  pdf.setDrawColor.apply(pdf, COLORS.line);
  pdf.line(14, 42, 196, 42);
  return 49;
}
function drawPickingTableHeader(pdf, y) {
  var x = [14, 23, 96, 112, 133, 153, 174, 196];
  var labels = ['No', 'Material', 'Satuan', 'Rencana HPP', 'Sudah keluar', 'Sisa diambil', 'Cek'];
  setColor(pdf, 'setFillColor', COLORS.ink);
  pdf.rect(14, y - 6, 182, 10, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  setColor(pdf, 'setTextColor', COLORS.white);
  pdf.text(labels[0], x[0] + 2, y);
  pdf.text(labels[1], x[1] + 2, y);
  pdf.text(labels[2], x[2] + 2, y);
  pdf.text(labels[3], x[4] - 2, y, { align: 'right' });
  pdf.text(labels[4], x[5] - 2, y, { align: 'right' });
  pdf.text(labels[5], x[6] - 2, y, { align: 'right' });
  pdf.text(labels[6], x[7] - 5, y, { align: 'right' });
  return x;
}
function drawPickingRow(pdf, line, index, y, x) {
  var nameLines = pdf.splitTextToSize(line.name || 'Material', 69);
  var height = Math.max(11, 4 + nameLines.length * 4);
  pdf.setDrawColor.apply(pdf, COLORS.line);
  pdf.line(14, y + height, 196, y + height);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  setColor(pdf, 'setTextColor', COLORS.muted);
  pdf.text(String(index + 1), x[0] + 2, y + 4);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.2);
  setColor(pdf, 'setTextColor', COLORS.ink);
  pdf.text(nameLines, x[1] + 2, y + 4);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text(line.unit || '-', x[2] + 2, y + 4);
  pdf.text(String(line.required), x[4] - 2, y + 4, { align: 'right' });
  pdf.text(String(line.issued), x[5] - 2, y + 4, { align: 'right' });
  pdf.setFont('helvetica', 'bold');
  pdf.text(String(line.outstanding), x[6] - 2, y + 4, { align: 'right' });
  pdf.setDrawColor(100, 116, 139);
  pdf.rect(x[7] - 9, y + 1, 4, 4);
  return height;
}
function generatePickingListPdf(input, jsPDF) {
  var d = normalizePickingList(input);
  if (!d.lines.length) throw new Error('Tidak ada material yang menunggu pengambilan.');
  var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  var pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setProperties({
    title: 'Material Picking List - ' + d.orderNo,
    subject: 'Daftar pengambilan material produksi CSK',
    author: COMPANY.name,
    creator: 'CSK Business OS'
  });
  var y = drawPickingHeader(pdf, d, false);
  setColor(pdf, 'setFillColor', COLORS.paper);
  pdf.roundedRect(14, y, 182, 22, 2, 2, 'F');
  drawText(pdf, 'PROYEK', 18, y + 6, 6, 'bold', COLORS.orange);
  drawText(pdf, d.projectName, 18, y + 12, 9, 'bold', COLORS.ink, 105);
  drawText(pdf, 'PROJECT ID: ' + (d.projectId || '-'), 18, y + 18, 6.2, 'normal', COLORS.muted, 105);
  drawText(pdf, 'SALES ORDER', 137, y + 6, 6, 'bold', COLORS.orange);
  drawText(pdf, d.orderNo, 137, y + 13, 7.2, 'bold', COLORS.ink, 54);
  y += 31;
  drawText(pdf, 'PETUNJUK GUDANG', 14, y + 3, 6.3, 'bold', COLORS.orange);
  drawText(pdf, 'Ambil material sesuai sisa reservasi. Periksa jenis, satuan, dan kuantitas fisik sebelum diserahkan ke tim produksi.', 14, y + 8, 6.8, 'normal', COLORS.muted, 180);
  y += 16;
  var x = drawPickingTableHeader(pdf, y);
  y += 5;
  d.lines.forEach(function(line, index) {
    var rowHeight = Math.max(11, 4 + pdf.splitTextToSize(line.name || 'Material', 69).length * 4);
    if (y + rowHeight > pageHeight - 42) {
      pdf.addPage();
      y = drawPickingHeader(pdf, d, true) + 4;
      x = drawPickingTableHeader(pdf, y);
      y += 5;
    }
    y += drawPickingRow(pdf, line, index, y, x);
  });
  if (y + 36 > pageHeight - 24) {
    pdf.addPage();
    y = drawPickingHeader(pdf, d, true) + 8;
  } else {
    y += 9;
  }
  setColor(pdf, 'setFillColor', COLORS.paleOrange);
  pdf.roundedRect(14, y, 182, 13, 2, 2, 'F');
  drawText(pdf, 'Konfirmasi: jumlah yang diambil harus dicatat melalui transaksi Pengeluaran Material pada Inventory CSK.', 18, y + 8, 6.8, 'bold', COLORS.ink, 174);
  y += 23;
  var leftX = 18, rightX = 118;
  drawText(pdf, 'Disiapkan oleh', leftX, y, 7, 'normal', COLORS.muted);
  drawText(pdf, 'Diterima tim produksi', rightX, y, 7, 'normal', COLORS.muted);
  if (d.preparedBy) drawText(pdf, d.preparedBy, leftX, y + 5, 7, 'bold', COLORS.ink);
  pdf.setDrawColor.apply(pdf, COLORS.line);
  pdf.line(leftX, y + 25, 88, y + 25);
  pdf.line(rightX, y + 25, 188, y + 25);
  drawText(pdf, 'Nama & tanda tangan', leftX, y + 30, 6, 'normal', COLORS.muted);
  drawText(pdf, 'Nama & tanda tangan', rightX, y + 30, 6, 'normal', COLORS.muted);
  addFooter(pdf);
  return pdf;
}
async function downloadPickingList(input) {
  try {
    var d = normalizePickingList(input);
    var jsPDF = await loadJsPdf();
    var pdf = generatePickingListPdf(d, jsPDF);
    var filename = pickingListFilename(d);
    pdf.save(filename);
    notify('Picking List PDF berhasil dibuat: ' + filename, false);
    return { ok: true, filename: filename };
  } catch (error) {
    notify('Picking List PDF belum berhasil dibuat. ' + String(error && error.message || error), true);
    return { ok: false, error: String(error && error.message || error) };
  }
}

var api = {
  normalizeDocument: normalizeDocument,
  makeFilename: makeFilename,
  formatRupiah: formatRupiah,
  downloadDocument: downloadDocument,
  generatePdf: generatePdf,
  normalizePickingList: normalizePickingList,
  pickingListFilename: pickingListFilename,
  generatePickingListPdf: generatePickingListPdf,
  downloadPickingList: downloadPickingList
};
if (w) w.CSKPDF = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
