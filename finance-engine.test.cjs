'use strict';
const assert = require('node:assert/strict');
const { expectedPaymentJournal, reconcileInvoicePayments } = require('./finance-engine.js');

const payment = {
  id: 'PAY-20261125-0001',
  invoiceId: 'INV-001',
  invoiceNo: 'INV-CSK-2026-00001',
  paymentDate: '2026-11-25',
  paymentType: 'dp',
  amount: 250000,
  method: 'transfer',
  reference: 'TRX-001'
};
const expected = {
  id: 'FIN-PAY-PAY-20261125-0001',
  date: '2026-11-25',
  type: 'income',
  category: 'Pembayaran Invoice',
  amount: 250000,
  description: 'Pembayaran invoice INV-CSK-2026-00001 · DP · Ref TRX-001'
};
assert.deepEqual(expectedPaymentJournal(payment), { valid: true, ...expected });

const clean = reconcileInvoicePayments([payment], [expected]);
assert.equal(clean.totalPaymentRows, 1);
assert.equal(clean.matched, 1);
assert.equal(clean.issueCount, 0);
assert.equal(clean.isReconciled, true);

const missing = reconcileInvoicePayments([payment], []);
assert.deepEqual(missing.missing, [expected.id]);
assert.equal(missing.issueCount, 1);

const mismatch = reconcileInvoicePayments([payment], [{ ...expected, amount: 1 }]);
assert.deepEqual(mismatch.mismatched, [expected.id]);
assert.equal(mismatch.issueCount, 1);

const duplicate = reconcileInvoicePayments([payment], [expected, expected]);
assert.deepEqual(duplicate.duplicateFinance, [expected.id]);
assert.equal(duplicate.issueCount, 1);

const orphan = reconcileInvoicePayments([], [{ ...expected, id: 'FIN-PAY-ORPHAN-001' }]);
assert.deepEqual(orphan.orphanFinance, ['FIN-PAY-ORPHAN-001']);
assert.equal(orphan.issueCount, 1);

const invalidPayment = { ...payment, financeId: 'FIN-PAY-WRONG', amount: -5 };
const invalid = reconcileInvoicePayments([invalidPayment], []);
assert.equal(invalid.invalidPayments.length, 1);
assert.equal(invalid.issueCount, 1);

const duplicateLedger = reconcileInvoicePayments([payment, payment], [expected]);
assert.deepEqual(duplicateLedger.duplicatePayments, [expected.id]);
assert.equal(duplicateLedger.issueCount, 1);

const multipleIssues = reconcileInvoicePayments(
  [payment, { ...payment, id: 'PAY-20261125-0002', financeId: 'FIN-PAY-PAY-20261125-0002' }],
  [{ ...expected, amount: 1 }, { ...expected, id: 'FIN-PAY-ORPHAN-002' }]
);
assert.equal(multipleIssues.mismatched.length, 1);
assert.equal(multipleIssues.missing.length, 1);
assert.equal(multipleIssues.orphanFinance.length, 1);
assert.equal(multipleIssues.issueCount, 3);

console.log('CSK Finance Invoice-payment reconciliation tests passed.');
