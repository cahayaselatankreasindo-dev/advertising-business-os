'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('commercial-documents.js', 'utf8');
const elements = Object.create(null);
const messages = [];
const storage = Object.create(null);

function element(id) {
  return {
    id: id || '',
    value: '',
    innerHTML: '',
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    disabled: false,
    classList: {
      add() {},
      remove() {},
      contains() { return false; }
    },
    addEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return element('mock-save-button'); },
    appendChild() {},
    closest() { return null; }
  };
}

const document = {
  head: { appendChild() {} },
  body: {
    appendChild(node) {
      if (node && node.id) elements[node.id] = node;
    }
  },
  createElement() { return element(); },
  getElementById(id) {
    if (id === 'commercial-document-modal' || id === 'commercial-payment-modal') {
      return elements[id] || null;
    }
    if (!elements[id]) elements[id] = element(id);
    return elements[id];
  }
};

const db = {
  leads: [{ id: 'LEAD-01', name: 'PT Simulasi Retail', phone: '081234567890', email: 'procurement@example.test', pic: 'Budi' }],
  clients: [],
  projects: [],
  materials: [{ id: 'MAT-01', name: 'Akrilik 5 mm', unitPrice: 250000, unit: 'lembar', spec: 'Akrilik bening 5 mm' }],
  services: [{ id: 'SRV-01', name: 'Fabrikasi Display', basePrice: 300000, unit: 'jasa', spec: 'Fabrikasi dan finishing' }],
  quotations: [],
  invoices: [],
  invoicePayments: [],
  finance: [],
  quotationSnapshots: [],
  settings: {}
};

async function recordInvoicePayment(payment) {
  const invoice = db.invoices.find(x => String(x.id) === String(payment.invoiceId));
  if (!invoice) throw new Error('INVOICE_NOT_FOUND');
  const existing = db.invoicePayments.find(x => String(x.id) === String(payment.id));
  if (existing) return { payment: existing, duplicate: true };
  const paid = db.invoicePayments
    .filter(x => String(x.invoiceId) === String(invoice.id))
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const balance = Number(invoice.total) - paid;
  if (Number(payment.amount) > balance) throw new Error('PAYMENT_EXCEEDS_BALANCE');
  if (payment.paymentType === 'settlement' && Number(payment.amount) !== balance) throw new Error('SETTLEMENT_MUST_MATCH_BALANCE');
  const financeId = 'FIN-PAY-' + payment.id;
  const row = Object.assign({}, payment, { financeId });
  db.invoicePayments.push(row);
  db.finance.push({
    id: financeId,
    date: payment.paymentDate,
    type: 'income',
    category: 'Pembayaran Invoice',
    amount: Number(payment.amount),
    description: 'Pembayaran invoice ' + invoice.docNo
  });
  return { payment: row, financeId, duplicate: false };
}

const window = {
  document,
  navigator: {},
  sessionStorage: {
    getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
    setItem(key, value) { storage[key] = String(value); },
    removeItem(key) { delete storage[key]; }
  },
  showToast(message, isError) { messages.push({ message, isError: !!isError }); },
  print() {},
  CSKAuth: {
    isReady() { return true; },
    async sync() { return true; },
    async recordInvoicePayment(payment) { return recordInvoicePayment(payment); }
  }
};

const sandbox = {
  window,
  db,
  module: { exports: {} },
  isOwnerSession() { return true; },
  saveDB() {},
  formatRp(value) { return 'Rp ' + Number(value || 0); },
  escapeInvoiceHtml(value) { return String(value == null ? '' : value); },
  console,
  Date,
  Math,
  JSON,
  Number,
  String,
  Object,
  Array,
  RegExp,
  Promise,
  parseFloat,
  setTimeout,
  clearTimeout
};

vm.runInNewContext(source, sandbox, { filename: 'commercial-documents.js' });
assert.equal(typeof window.openCommercialDocumentEditor, 'function');
assert.equal(typeof window.createInvoiceFromQuotation, 'function');
assert.equal(typeof window.createProjectFromInvoice, 'function');

function field(id, value) {
  document.getElementById(id).value = String(value);
}

async function saveCurrentDocument() {
  await window.saveCommercialDocument();
  const last = messages[messages.length - 1];
  assert.ok(last && !last.isError, last ? last.message : 'Expected successful document save');
}

(async function main() {
// 1. Create a standalone quotation, select a Lead, and add material and service master items.
window.openCommercialDocumentEditor('quotation');
window.selectCommercialLead('LEAD-01');
field('cd-lead', 'LEAD-01'); // emulate the select element value set by the browser change event
field('cd-number', 'QUO-CSK-2026-00001');
field('cd-date', '2026-11-10');
field('cd-due', '2026-11-24');
field('cd-project-deadline', '2026-12-20');
field('cd-status', 'draft');
field('cd-discount', 50000);
field('cd-tax', 11);
field('cd-dp', 40);
field('cd-master', 'm:MAT-01');
window.addCommercialMasterItem();
window.updateCommercialLine(0, 'qty', 2);
field('cd-master', 's:SRV-01');
window.addCommercialMasterItem();
window.updateCommercialLine(1, 'qty', 1);
assert.equal(db.quotations.length, 0, 'unsaved quotation must not be persisted');
await saveCurrentDocument();

assert.equal(db.quotations.length, 1);
const quotation = db.quotations[0];
assert.equal(quotation.client, 'PT Simulasi Retail');
assert.equal(quotation.leadId, 'LEAD-01');
assert.equal(quotation.lines.length, 2);
assert.equal(quotation.subtotal, 800000);
assert.equal(quotation.discount, 50000);
assert.equal(quotation.taxAmount, 82500);
assert.equal(quotation.total, 832500);
assert.equal(db.projects.length, 0, 'standalone quotation must not require or create a project');
assert.equal(db.finance.length, 0, 'quotation is not cash income');

// 2. Approve quotation, convert once, and ensure repeat conversion reuses the same invoice.
window.openCommercialDocumentEditor('quotation', quotation.id);
field('cd-status', 'approved');
await saveCurrentDocument();
assert.equal(db.quotations[0].status, 'approved');

await window.createInvoiceFromQuotation(quotation.id);
assert.equal(db.invoices.length, 1);
const convertedInvoice = db.invoices[0];
assert.equal(convertedInvoice.sourceQuotationId, quotation.id);
assert.equal(convertedInvoice.quotationId, quotation.id);
assert.equal(convertedInvoice.total, quotation.total);
assert.equal(convertedInvoice.lines.length, quotation.lines.length);
assert.notEqual(convertedInvoice.dueDate, quotation.dueDate, 'invoice payment due date is independent from quotation validity');
assert.equal(convertedInvoice.projectDeadline, '2026-12-20');
assert.equal(db.quotations[0].convertedInvoiceId, convertedInvoice.id);

await window.createInvoiceFromQuotation(quotation.id);
assert.equal(db.invoices.length, 1, 'repeated conversion must not create a second invoice');

// 3. Create project directly from converted invoice; quotation and invoice must share one project.
await window.createProjectFromInvoice(convertedInvoice.id);
assert.equal(db.projects.length, 1);
const linkedProject = db.projects[0];
assert.equal(linkedProject.sourceInvoiceId, convertedInvoice.id);
assert.equal(linkedProject.sourceQuotationId, quotation.id);
assert.equal(convertedInvoice.projectId, linkedProject.id);
assert.equal(db.quotations[0].projectId, linkedProject.id);
await window.createProjectFromQuotation(quotation.id);
assert.equal(db.projects.length, 1, 'quotation and invoice must not create duplicate projects');

// 3a. Editing a linked invoice refreshes commercial project fields without resetting operations.
linkedProject.status = 'active';
linkedProject.sopChecklist = 'Brief:1;Produksi:0;Review:0;Revisi:0;Delivery:0';
window.openCommercialDocumentEditor('invoice', convertedInvoice.id);
field('cd-project', 'Produksi Display Custom');
field('cd-due', '2026-12-05');
field('cd-project-deadline', '2026-12-30');
window.updateCommercialLine(0, 'unitPrice', 300000);
await saveCurrentDocument();
const updatedInvoice = db.invoices.find(x => String(x.id) === String(convertedInvoice.id));
assert.equal(updatedInvoice.total, 943500);
await window.createProjectFromInvoice(updatedInvoice.id);
assert.equal(linkedProject.title, 'Produksi Display Custom');
assert.equal(linkedProject.value, 943500);
assert.equal(linkedProject.suggestedPrice, 943500);
assert.equal(linkedProject.deadline, '2026-12-30');
assert.equal(linkedProject.status, 'active', 'commercial refresh must preserve project status');
assert.equal(linkedProject.sopChecklist, 'Brief:1;Produksi:0;Review:0;Revisi:0;Delivery:0', 'commercial refresh must preserve SOP progress');

// A later quotation action must not overwrite project values sourced from its invoice.
db.quotations[0].projectName = 'Stale quotation title';
db.quotations[0].total = 1;
db.quotations[0].dueDate = '2026-11-24';
await window.createProjectFromQuotation(quotation.id);
assert.equal(linkedProject.title, 'Produksi Display Custom');
assert.equal(linkedProject.value, 943500);
assert.equal(linkedProject.deadline, '2026-12-05');
assert.equal(db.projects.length, 1, 'commercial refresh must not create a duplicate project');

// 4. Create an independent invoice manually, without a project or quotation.
window.openCommercialDocumentEditor('invoice');
field('cd-client', 'CV Invoice Mandiri');
field('cd-phone', '081111222333');
field('cd-project', 'Produksi Rak Display');
field('cd-number', 'INV-CSK-2026-00002');
field('cd-date', '2026-11-10');
field('cd-due', '2026-11-17');
field('cd-project-deadline', '2026-12-01');
field('cd-status', 'draft');
window.addCommercialManualLine();
window.updateCommercialLine(0, 'name', 'Rak display custom');
window.updateCommercialLine(0, 'qty', 2);
window.updateCommercialLine(0, 'unitPrice', 200000);
await saveCurrentDocument();
assert.equal(db.invoices.length, 2);
const standaloneInvoice = db.invoices.find(x => x.docNo === 'INV-CSK-2026-00002');
assert.equal(standaloneInvoice.total, 400000);
assert.equal(standaloneInvoice.sourceQuotationId, '');
assert.equal(standaloneInvoice.projectId, '');
assert.equal(db.finance.length, 0, 'creating an invoice does not create cash income');

// 5. Create a project from standalone invoice and verify the source link is idempotent.
await window.createProjectFromInvoice(standaloneInvoice.id);
const standaloneProject = db.projects.find(x => x.sourceInvoiceId === standaloneInvoice.id);
assert.ok(standaloneProject);
assert.equal(standaloneProject.value, 400000);
assert.equal(standaloneProject.deadline, '2026-12-01');
assert.equal(standaloneInvoice.projectId, standaloneProject.id);
await window.createProjectFromInvoice(standaloneInvoice.id);
assert.equal(db.projects.filter(x => x.sourceInvoiceId === standaloneInvoice.id).length, 1);

// 6. Simulate a stale quotation pointer: source invoice is found and linked rather than duplicated.
db.quotations[0].convertedInvoiceId = '';
await window.createInvoiceFromQuotation(quotation.id);
assert.equal(db.invoices.length, 2, 'sourceQuotationId lookup must recover the existing invoice');
assert.equal(db.quotations[0].convertedInvoiceId, convertedInvoice.id);

// 7. Record DP, installment, and settlement; Finance entries must equal cash received only.
window.openPaymentEditor(standaloneInvoice.id);
field('cp-date', '2026-11-10');
field('cp-type', 'dp');
field('cp-amount', 100000);
field('cp-method', 'transfer');
field('cp-reference', 'TEST-DP');
await window.saveInvoicePayment();
assert.equal(db.invoicePayments.length, 1);
assert.equal(db.finance.length, 1);
assert.equal(db.finance[0].amount, 100000);

window.openPaymentEditor(standaloneInvoice.id);
field('cp-date', '2026-11-11');
field('cp-type', 'installment');
field('cp-amount', 100000);
field('cp-method', 'qris');
field('cp-reference', 'TEST-INSTALLMENT');
await window.saveInvoicePayment();
assert.equal(db.invoicePayments.length, 2);
assert.equal(db.finance.length, 2);

window.openPaymentEditor(standaloneInvoice.id);
field('cp-date', '2026-11-12');
field('cp-type', 'settlement');
field('cp-amount', 200000);
field('cp-method', 'transfer');
field('cp-reference', 'TEST-SETTLEMENT');
await window.saveInvoicePayment();
assert.equal(db.invoicePayments.length, 3);
assert.equal(db.finance.length, 3);
assert.equal(db.finance.reduce((sum, row) => sum + Number(row.amount), 0), 400000);
assert.equal(sandbox.module.exports.summarizeInvoicePayments(standaloneInvoice, db.invoicePayments).status, 'paid');

const finalMessages = messages.filter(x => x.isError);
assert.deepEqual(finalMessages.map(x => x.message), [], 'no simulated workflow step should raise a UI error');
console.log('CSK commercial workflow simulation passed: Lead → Quotation → Invoice → Project → DP → Installment → Settlement → Finance.');
})().catch(error => { console.error(error); process.exitCode = 1; });
