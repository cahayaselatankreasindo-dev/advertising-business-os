'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');
function extractFunction(name) {
  const re = new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}');
  const match = source.match(re);
  assert.ok(match, 'backend helper exists: ' + name);
  return match[0];
}

let tables = {};
let failFinanceInsert = false;
const lockStats = { acquired: 0, released: 0 };
function readSheetData(_ss, sheetName) {
  return (tables[sheetName] || []).map(row => ({ ...row }));
}
function ensureSheet(_ss, sheetName) {
  if (!tables[sheetName]) tables[sheetName] = [];
}
function mergeSheet(_ss, sheetName, rows) {
  if (!tables[sheetName]) tables[sheetName] = [];
  for (const row of rows) {
    const index = tables[sheetName].findIndex(existing => String(existing.id) === String(row.id));
    if (index >= 0) tables[sheetName][index] = { ...row };
    else tables[sheetName].push({ ...row });
  }
  return rows.length;
}
function insertRecord(_ss, sheetName, row) {
  if (!tables[sheetName]) tables[sheetName] = [];
  if (sheetName === 'Finance' && failFinanceInsert) {
    failFinanceInsert = false;
    throw new Error('SIMULATED_FINANCE_WRITE_FAILURE');
  }
  if (tables[sheetName].some(existing => String(existing.id) === String(row.id))) {
    throw new Error('DUPLICATE_ID');
  }
  tables[sheetName].push({ ...row });
  return 1;
}
const sandbox = {
  readSheetData,
  ensureSheet,
  mergeSheet,
  insertRecord,
  LockService: {
    getScriptLock() {
      return {
        waitLock(milliseconds) {
          assert.equal(milliseconds, 30000);
          lockStats.acquired += 1;
        },
        releaseLock() { lockStats.released += 1; }
      };
    }
  },
  FIELD_MAP: {
    Invoices: { headers: [] },
    Invoice_Payments: { headers: [] },
    Finance: { headers: [] }
  }
};
vm.runInNewContext(
  extractFunction('assertUniqueCommercialDocumentNumbers_') +
  '\nthis.checkUniqueDocumentNumbers = assertUniqueCommercialDocumentNumbers_;',
  sandbox
);
vm.runInNewContext(
  extractFunction('assertPaidInvoiceChangesAllowed_') +
  '\nthis.checkPaidInvoice = assertPaidInvoiceChangesAllowed_;',
  sandbox
);
vm.runInNewContext(
  extractFunction('assertUniqueInvoiceQuotationSources_') +
  '\nthis.checkUniqueInvoiceQuotationSources = assertUniqueInvoiceQuotationSources_;',
  sandbox
);
vm.runInNewContext(
  extractFunction('assertCommercialRecordDeletionAllowed_') +
  '\nthis.checkDeletion = assertCommercialRecordDeletionAllowed_;',
  sandbox
);
vm.runInNewContext(
  extractFunction('mergeFinanceSafely_') +
  '\nthis.mergeFinanceSafely = mergeFinanceSafely_;',
  sandbox
);
vm.runInNewContext(
  extractFunction('recordInvoicePayment_') +
  '\nthis.recordPayment = recordInvoicePayment_;',
  sandbox
);
const ss = {};
const owner = { email: 'cahayaselatankreasindo@gmail.com' };

// Paid invoice totals and cancellation are immutable; orphaned payment rows are rejected.
tables = {
  Invoices: [{ id: 'INV-001', total: 1000000, status: 'partial' }],
  Invoice_Payments: [{ id: 'PAY-001', invoiceId: 'INV-001', amount: 250000, financeId: 'FIN-PAY-PAY-001' }]
};
assert.equal(sandbox.checkPaidInvoice(ss, [{ id: 'INV-001', total: 1000000, status: 'partial' }]), true);
assert.throws(() => sandbox.checkPaidInvoice(ss, [{ id: 'INV-001', total: 900000, status: 'partial' }]), /PAID_INVOICE_TOTAL_IMMUTABLE/);
assert.throws(() => sandbox.checkPaidInvoice(ss, [{ id: 'INV-001', total: 1000000, status: 'cancelled' }]), /PAID_INVOICE_CANNOT_CANCEL/);

tables.Invoices = [];
tables.Invoice_Payments = [{ id: 'PAY-ORPHAN', invoiceId: 'INV-ORPHAN', amount: 100000 }];
assert.throws(() => sandbox.checkPaidInvoice(ss, [{ id: 'INV-ORPHAN', total: 1000000, status: 'draft' }]), /INVOICE_PAYMENT_ORPHANED/);

// Invoice and Finance rows linked to a payment cannot be deleted independently.
tables.Invoice_Payments = [];
assert.equal(sandbox.checkDeletion(ss, 'Invoices', 'INV-EMPTY'), true);
tables.Invoice_Payments = [{ id: 'PAY-001', invoiceId: 'INV-001', financeId: 'FIN-PAY-PAY-001' }];
assert.throws(() => sandbox.checkDeletion(ss, 'Invoices', 'INV-001'), /INVOICE_HAS_PAYMENTS/);
tables.Invoices = [{ id: 'INV-FROM-Q', sourceQuotationId: 'Q-LINKED' }];
assert.throws(() => sandbox.checkDeletion(ss, 'Commercial_Quotations', 'Q-LINKED'), /QUOTATION_HAS_INVOICE/);
assert.equal(sandbox.checkDeletion(ss, 'Commercial_Quotations', 'Q-UNLINKED'), true);
assert.throws(() => sandbox.checkDeletion(ss, 'Finance', 'FIN-PAY-PAY-001'), /PAYMENT_FINANCE_LEDGER_PROTECTED/);
assert.throws(() => sandbox.checkDeletion(ss, 'Finance', 'FIN-PAY-ORPHAN'), /PAYMENT_FINANCE_LEDGER_PROTECTED/);
assert.equal(sandbox.checkDeletion(ss, 'Finance', 'FIN-EXP-001'), true);

// Generic sync may preserve or safely restore a Finance row only when it exactly matches the payment ledger.
const ledgerPayment = {
  id: 'PAY-SYNC-0001', invoiceId: 'INV-SYNC', invoiceNo: 'INV-CSK-2026-00999',
  paymentDate: '2026-11-11', paymentType: 'dp', amount: 125000,
  method: 'transfer', reference: 'SYNC-REF', notes: '', financeId: 'FIN-PAY-PAY-SYNC-0001'
};
const expectedFinance = {
  id: ledgerPayment.financeId, date: ledgerPayment.paymentDate, type: 'income',
  category: 'Pembayaran Invoice', amount: ledgerPayment.amount,
  description: 'Pembayaran invoice ' + ledgerPayment.invoiceNo + ' · DP · Ref ' + ledgerPayment.reference
};
tables = { Invoice_Payments: [ledgerPayment], Finance: [expectedFinance] };
assert.equal(sandbox.mergeFinanceSafely(ss, [expectedFinance]), 1, 'an unchanged payment journal can be synchronized');
assert.throws(() => sandbox.mergeFinanceSafely(ss, [{ ...expectedFinance, amount: 1 }]), /PAYMENT_FINANCE_LEDGER_IMMUTABLE/, 'generic sync cannot change payment income');
assert.throws(() => sandbox.mergeFinanceSafely(ss, [{ ...expectedFinance, category: 'Pendapatan lain' }]), /PAYMENT_FINANCE_LEDGER_IMMUTABLE/, 'generic sync cannot reclassify payment income');
tables.Finance = [];
assert.equal(sandbox.mergeFinanceSafely(ss, [expectedFinance]), 1, 'a missing payment journal can be safely restored from the authoritative ledger');
assert.equal(tables.Finance.length, 1);
tables.Invoice_Payments = [];
tables.Finance = [];
assert.throws(() => sandbox.mergeFinanceSafely(ss, [expectedFinance]), /PAYMENT_FINANCE_ORPHANED/, 'a forged payment Finance row without a ledger entry is rejected');
assert.equal(sandbox.mergeFinanceSafely(ss, [{ id: 'FIN-EXP-01', date: '2026-11-11', type: 'expense', category: 'Operasional', amount: 50000, description: 'Biaya umum' }]), 1, 'ordinary Finance rows remain synchronizable');

// A confirmed payment creates exactly one ledger row and one Finance income row.
tables = {
  Invoices: [{ id: 'INV-100', docNo: 'INV-CSK-2026-00100', total: 1000000, status: 'draft' }],
  Invoice_Payments: [],
  Finance: []
};
const dp = {
  id: 'PAY-20261109-0001', invoiceId: 'INV-100', paymentDate: '2026-11-09',
  paymentType: 'dp', amount: 300000, method: 'transfer', reference: 'TRX-001', notes: 'DP pertama'
};
const first = sandbox.recordPayment(ss, dp, owner);
assert.equal(first.duplicate, false);
assert.equal(tables.Invoice_Payments.length, 1);
assert.equal(tables.Finance.length, 1);
assert.equal(tables.Finance[0].id, 'FIN-PAY-' + dp.id);
assert.equal(tables.Finance[0].type, 'income');
assert.equal(tables.Finance[0].amount, 300000);

// Retrying the same payment ID is idempotent; changing its payload is a conflict.
const duplicate = sandbox.recordPayment(ss, dp, owner);
assert.equal(duplicate.duplicate, true);
assert.equal(tables.Invoice_Payments.length, 1);
assert.equal(tables.Finance.length, 1);
assert.throws(() => sandbox.recordPayment(ss, { ...dp, amount: 350000 }, owner), /PAYMENT_ID_CONFLICT/);

// Overpayment and a second DP are rejected; exact settlement clears the remaining balance.
assert.throws(() => sandbox.recordPayment(ss, {
  ...dp, id: 'PAY-20261109-0002', paymentType: 'installment', amount: 700001
}, owner), /PAYMENT_EXCEEDS_BALANCE/);
assert.throws(() => sandbox.recordPayment(ss, {
  ...dp, id: 'PAY-20261109-0003', amount: 100000
}, owner), /DP_ALREADY_RECORDED/);
const settlement = sandbox.recordPayment(ss, {
  ...dp, id: 'PAY-20261109-0004', paymentType: 'settlement', amount: 700000,
  reference: 'TRX-002', notes: 'Pelunasan'
}, owner);
assert.equal(settlement.duplicate, false);
assert.equal(tables.Invoice_Payments.length, 2);
assert.equal(tables.Finance.length, 2);
assert.equal(tables.Finance.reduce((sum, row) => sum + Number(row.amount), 0), 1000000);
assert.throws(() => sandbox.recordPayment(ss, {
  ...dp, id: 'PAY-20261109-0005', paymentType: 'installment', amount: 1
}, owner), /INVOICE_ALREADY_PAID/);

// If Finance fails after the ledger write, retrying the same ID repairs Finance without duplicating the ledger.
tables = {
  Invoices: [{ id: 'INV-RETRY', docNo: 'INV-CSK-2026-00101', total: 250000, status: 'draft' }],
  Invoice_Payments: [],
  Finance: []
};
const retryPayment = {
  id: 'PAY-20261109-RETRY1', invoiceId: 'INV-RETRY', paymentDate: '2026-11-09',
  paymentType: 'dp', amount: 100000, method: 'qris', reference: 'QR-001', notes: 'DP QRIS'
};
failFinanceInsert = true;
assert.throws(() => sandbox.recordPayment(ss, retryPayment, owner), /SIMULATED_FINANCE_WRITE_FAILURE/);
assert.equal(tables.Invoice_Payments.length, 1);
assert.equal(tables.Finance.length, 0);
const repaired = sandbox.recordPayment(ss, retryPayment, owner);
assert.equal(repaired.duplicate, true);
assert.equal(tables.Invoice_Payments.length, 1);
assert.equal(tables.Finance.length, 1);
assert.equal(tables.Finance[0].amount, 100000);
assert.equal(tables.Finance[0].id, 'FIN-PAY-' + retryPayment.id);

assert.equal(lockStats.acquired, lockStats.released, 'every payment path releases the Apps Script lock');
console.log('CSK invoice payment ledger integrity and idempotent recovery checks passed.');


// Commercial document numbers are unique per document type and remain editable for the same ID.
tables = {
  Commercial_Quotations: [
    { id: 'Q-001', docNo: 'QUO-CSK-2026-00001' },
    { id: 'Q-002', docNo: 'QUO-CSK-2026-00002' }
  ],
  Invoices: [{ id: 'I-001', docNo: 'INV-CSK-2026-00001' }]
};
assert.equal(sandbox.checkUniqueDocumentNumbers(ss, 'Commercial_Quotations', [
  { id: 'Q-001', docNo: 'QUO-CSK-2026-00001' },
  { id: 'Q-002', docNo: 'QUO-CSK-2026-00003' }
]), true);
assert.throws(() => sandbox.checkUniqueDocumentNumbers(ss, 'Commercial_Quotations', [
  { id: 'Q-001', docNo: 'QUO-CSK-2026-00001' },
  { id: 'Q-003', docNo: 'quo-csk-2026-00001' }
]), /DUPLICATE_DOCUMENT_NUMBER/);
assert.throws(() => sandbox.checkUniqueDocumentNumbers(ss, 'Commercial_Quotations', [
  { id: 'Q-003', docNo: 'QUO-CSK-2026-00002' }
]), /DUPLICATE_DOCUMENT_NUMBER/);
assert.throws(() => sandbox.checkUniqueDocumentNumbers(ss, 'Invoices', [
  { id: 'I-002', docNo: '' }
]), /DOCUMENT_NUMBER_REQUIRED/);
assert.equal(sandbox.checkUniqueDocumentNumbers(ss, 'Invoices', [
  { id: 'I-001', docNo: 'INV-CSK-2026-00009' }
]), true);
assert.match(source, /function mergeCommercialQuotationsSafely_\(/);
assert.match(source, /assertUniqueCommercialDocumentNumbers_\(ss, "Invoices", incomingInvoices\)/);


// One quotation can produce at most one invoice, including concurrent or stale-client syncs.
tables = {
  Invoices: [{ id: 'INV-FROM-Q1', sourceQuotationId: 'Q-001', quotationId: 'Q-001', docNo: 'INV-CSK-2026-00001' }]
};
assert.equal(sandbox.checkUniqueInvoiceQuotationSources(ss, [
  { id: 'INV-FROM-Q1', sourceQuotationId: 'Q-001', quotationId: 'Q-001' }
]), true, 'same invoice ID may be safely re-synced');
assert.throws(() => sandbox.checkUniqueInvoiceQuotationSources(ss, [
  { id: 'INV-FROM-Q2', sourceQuotationId: 'Q-001', quotationId: 'Q-001' }
]), /DUPLICATE_QUOTATION_CONVERSION/, 'a second invoice cannot reuse an already converted quotation');
assert.equal(sandbox.checkUniqueInvoiceQuotationSources(ss, [
  { id: 'INV-STANDALONE', docNo: 'INV-CSK-2026-00002' }
]), true, 'standalone invoices remain independent of quotations');
assert.throws(() => sandbox.checkUniqueInvoiceQuotationSources(ss, [
  { id: 'INV-Q2-A', sourceQuotationId: 'Q-002' },
  { id: 'INV-Q2-B', sourceQuotationId: 'Q-002' }
]), /DUPLICATE_QUOTATION_CONVERSION/, 'two invoices in one sync cannot originate from the same quotation');
assert.match(source, /assertUniqueInvoiceQuotationSources_\(ss, incomingInvoices\)/, 'invoice merge enforces one invoice per quotation');
