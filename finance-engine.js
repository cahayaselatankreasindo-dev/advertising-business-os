/* CSK Finance reconciliation engine: read-only comparison of Invoice Payments and Finance journals. */
(function(root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CSKFinanceEngine = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function() {
  'use strict';

  function text(value) {
    return String(value === undefined || value === null ? '' : value).trim();
  }

  function dateKey(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
    }
    var raw = text(value);
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  }

  function expectedPaymentJournal(payment) {
    var id = text(payment && payment.id);
    var financeId = text(payment && payment.financeId) || ('FIN-PAY-' + id);
    var paymentDate = dateKey(payment && payment.paymentDate);
    var paymentType = text(payment && payment.paymentType).toLowerCase();
    var amount = Number(payment && payment.amount);
    if (!id || financeId !== 'FIN-PAY-' + id || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) ||
        !Number.isSafeInteger(amount) || amount <= 0 ||
        ['dp', 'installment', 'settlement'].indexOf(paymentType) < 0) {
      return { valid: false, id: id, financeId: financeId };
    }
    var typeLabel = paymentType === 'dp' ? 'DP' : paymentType === 'settlement' ? 'Pelunasan' : 'Cicilan';
    var invoiceNo = text(payment.invoiceNo || payment.invoiceId);
    var reference = text(payment.reference);
    return {
      valid: true,
      id: financeId,
      date: paymentDate,
      type: 'income',
      category: 'Pembayaran Invoice',
      amount: amount,
      description: 'Pembayaran invoice ' + invoiceNo + ' · ' + typeLabel + (reference ? ' · Ref ' + reference : '')
    };
  }

  function matchesJournal(actual, expected) {
    return dateKey(actual && actual.date) === expected.date &&
      text(actual && actual.type).toLowerCase() === expected.type &&
      text(actual && actual.category) === expected.category &&
      Number(actual && actual.amount) === expected.amount &&
      text(actual && actual.description) === expected.description;
  }

  function reconcileInvoicePayments(payments, financeRows) {
    payments = Array.isArray(payments) ? payments : [];
    financeRows = Array.isArray(financeRows) ? financeRows : [];
    var financeById = Object.create(null);
    var expectedIds = Object.create(null);
    var paymentIds = Object.create(null);
    var missing = [];
    var mismatched = [];
    var duplicateFinance = [];
    var orphanFinance = [];
    var invalidPayments = [];
    var duplicatePayments = [];
    var matched = 0;

    financeRows.forEach(function(row) {
      var id = text(row && row.id);
      if (!id) return;
      if (!financeById[id]) financeById[id] = [];
      financeById[id].push(row);
    });

    payments.forEach(function(payment) {
      var expected = expectedPaymentJournal(payment);
      if (!expected.valid) {
        invalidPayments.push(expected.id || expected.financeId || '(tanpa ID)');
        return;
      }
      if (paymentIds[expected.id]) {
        duplicatePayments.push(expected.id);
        return;
      }
      paymentIds[expected.id] = true;
      expectedIds[expected.id] = true;
      var rows = financeById[expected.id] || [];
      if (rows.length === 0) {
        missing.push(expected.id);
      } else if (rows.length > 1) {
        duplicateFinance.push(expected.id);
      } else if (!matchesJournal(rows[0], expected)) {
        mismatched.push(expected.id);
      } else {
        matched++;
      }
    });

    financeRows.forEach(function(row) {
      var id = text(row && row.id);
      if (id.toUpperCase().indexOf('FIN-PAY-') === 0 && !expectedIds[id]) orphanFinance.push(id);
    });

    var issueCount = missing.length + mismatched.length + duplicateFinance.length +
      orphanFinance.length + invalidPayments.length + duplicatePayments.length;
    return {
      totalPaymentRows: payments.length,
      matched: matched,
      missing: missing,
      mismatched: mismatched,
      duplicateFinance: duplicateFinance,
      orphanFinance: orphanFinance,
      invalidPayments: invalidPayments,
      duplicatePayments: duplicatePayments,
      issueCount: issueCount,
      isReconciled: issueCount === 0
    };
  }

  return {
    expectedPaymentJournal: expectedPaymentJournal,
    reconcileInvoicePayments: reconcileInvoicePayments
  };
});
