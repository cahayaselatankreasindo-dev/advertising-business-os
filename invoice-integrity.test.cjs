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
function readSheetData(_ss, sheetName) { return (tables[sheetName] || []).map(row => ({ ...row })); }
const sandbox = { readSheetData };
vm.runInNewContext(extractFunction('assertPaidInvoiceChangesAllowed_') + '\nthis.checkPaidInvoice = assertPaidInvoiceChangesAllowed_;', sandbox);
vm.runInNewContext(extractFunction('assertCommercialRecordDeletionAllowed_') + '\nthis.checkDeletion = assertCommercialRecordDeletionAllowed_;', sandbox);
const ss = {};

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

tables.Invoice_Payments = [];
assert.equal(sandbox.checkDeletion(ss, 'Invoices', 'INV-EMPTY'), true);
tables.Invoice_Payments = [{ id: 'PAY-001', invoiceId: 'INV-001', financeId: 'FIN-PAY-PAY-001' }];
assert.throws(() => sandbox.checkDeletion(ss, 'Invoices', 'INV-001'), /INVOICE_HAS_PAYMENTS/);
assert.throws(() => sandbox.checkDeletion(ss, 'Finance', 'FIN-PAY-PAY-001'), /PAYMENT_FINANCE_LEDGER_PROTECTED/);
assert.throws(() => sandbox.checkDeletion(ss, 'Finance', 'FIN-PAY-ORPHAN'), /PAYMENT_FINANCE_LEDGER_PROTECTED/);
assert.equal(sandbox.checkDeletion(ss, 'Finance', 'FIN-EXP-001'), true);

console.log('CSK invoice payment ledger integrity checks passed.');