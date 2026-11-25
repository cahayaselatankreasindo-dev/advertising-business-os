'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const mirror = fs.readFileSync('google_apps_script.js', 'utf8');
const guard = fs.readFileSync('security/guard.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function extractFunction(source, name) {
  const match = source.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}'));
  assert.ok(match, 'backend function exists: ' + name);
  return match[0];
}

let tables = {};
const lockStats = { acquired: 0, released: 0 };
function readSheetData(_ss, sheetName) {
  return (tables[sheetName] || []).map(row => ({ ...row }));
}
function assertSheetContractReady_(_ss, sheetName) {
  if (!Object.prototype.hasOwnProperty.call(tables, sheetName)) throw new Error('SCHEMA_SETUP_REQUIRED:SHEET_MISSING:' + sheetName);
  return {};
}
function insertRecord(_ss, sheetName, row) {
  if (!tables[sheetName]) throw new Error('SHEET_NOT_FOUND:' + sheetName);
  if (tables[sheetName].some(existing => String(existing.id) === String(row.id))) throw new Error('DUPLICATE_ID');
  tables[sheetName].push({ ...row });
  return 1;
}
const sandbox = {
  LockService: {
    getScriptLock() {
      return {
        waitLock(ms) { assert.equal(ms, 30000); lockStats.acquired += 1; },
        releaseLock() { lockStats.released += 1; }
      };
    }
  },
  readSheetData,
  assertSheetContractReady_,
  insertRecord,
  Utilities: { formatDate(date, _timezone, _pattern) { return date.toISOString().slice(0, 10); } }
};
vm.runInNewContext(
  extractFunction(backend, 'recordFinanceTransaction_') +
  '\nthis.recordFinanceTransaction = recordFinanceTransaction_;',
  sandbox
);
const owner = { email: 'cahayaselatankreasindo@gmail.com', role: 'owner' };
const team = { email: 'zefdas@gmail.com', role: 'team' };
const ss = {};
const transaction = {
  id: 'FIN-MANUAL-20261125-ABC123',
  date: '2026-11-25',
  type: 'expense',
  category: 'Operasional Kantor',
  amount: 150000,
  description: 'Pembelian perlengkapan kantor'
};

tables = { Finance: [], Invoice_Payments: [] };
const first = sandbox.recordFinanceTransaction(ss, transaction, owner);
assert.equal(first.duplicate, false);
assert.equal(tables.Finance.length, 1);
assert.deepEqual({ ...tables.Finance[0] }, transaction);
const retry = sandbox.recordFinanceTransaction(ss, transaction, owner);
assert.equal(retry.duplicate, true, 'retrying the exact same ID and payload is idempotent');
assert.equal(tables.Finance.length, 1, 'idempotent retry never duplicates a Finance row');
tables.Finance[0].date = new Date('2026-11-25T00:00:00.000Z');
assert.equal(sandbox.recordFinanceTransaction(ss, transaction, owner).duplicate, true, 'idempotent retry normalizes Google Sheets Date cells using the spreadsheet timezone');
tables.Finance[0].date = transaction.date;
assert.throws(() => sandbox.recordFinanceTransaction(ss, { ...transaction, amount: 175000 }, owner), /FINANCE_ID_CONFLICT/);
assert.throws(() => sandbox.recordFinanceTransaction(ss, { ...transaction, id: 'FIN-PAY-PAY-00000001' }, owner), /INVALID_FINANCE_ID/);
assert.throws(() => sandbox.recordFinanceTransaction(ss, { ...transaction, id: 'FIN-MANUAL-20261125-BADTYPE', type: 'transfer' }, owner), /INVALID_FINANCE_TYPE/);
assert.throws(() => sandbox.recordFinanceTransaction(ss, { ...transaction, id: 'FIN-MANUAL-20261125-BADDATE', date: '2026-02-30' }, owner), /INVALID_FINANCE_DATE/);
assert.throws(() => sandbox.recordFinanceTransaction(ss, { ...transaction, id: 'FIN-MANUAL-20261125-ZERO000', amount: 0 }, owner), /INVALID_FINANCE_AMOUNT/);
assert.throws(() => sandbox.recordFinanceTransaction(ss, { ...transaction, id: 'FIN-MANUAL-20261125-NEG000', amount: -1 }, owner), /INVALID_FINANCE_AMOUNT/);
assert.throws(() => sandbox.recordFinanceTransaction(ss, { ...transaction, id: 'FIN-MANUAL-20261125-DEC000', amount: 1.5 }, owner), /INVALID_FINANCE_AMOUNT/);
assert.throws(() => sandbox.recordFinanceTransaction(ss, { ...transaction, id: 'FIN-MANUAL-20261125-NOCAT00', category: ' ' }, owner), /INVALID_FINANCE_CATEGORY/);
assert.throws(() => sandbox.recordFinanceTransaction(ss, { ...transaction, id: 'FIN-MANUAL-20261125-NODESC0', description: ' ' }, owner), /INVALID_FINANCE_DESCRIPTION/);
assert.throws(() => sandbox.recordFinanceTransaction(ss, { ...transaction, id: 'FIN-MANUAL-20261125-LONGTXT', description: 'x'.repeat(501) }, owner), /INVALID_FINANCE_DESCRIPTION/);
assert.throws(() => sandbox.recordFinanceTransaction(ss, transaction, team), /FORBIDDEN_FINANCE_WRITE/);
tables.Invoice_Payments = [{ id: 'PAY-EXISTING-001', financeId: transaction.id }];
assert.throws(() => sandbox.recordFinanceTransaction(ss, transaction, owner), /FINANCE_PAYMENT_ID_RESERVED/);
tables.Invoice_Payments = [];
tables.Finance = [{ ...transaction }, { ...transaction }];
assert.throws(() => sandbox.recordFinanceTransaction(ss, transaction, owner), /FINANCE_DUPLICATE_ID/);
assert.equal(lockStats.acquired, lockStats.released, 'every manual Finance write releases the Apps Script lock');

assert.equal(backend, mirror, 'Apps Script source and deployment mirror remain byte-for-byte identical');
assert.ok(backend.includes('case "record_finance_transaction"'), 'backend exposes a dedicated Finance write action');
assert.ok(backend.includes('if (action === "record_finance_transaction")'), 'payload guard restricts Finance write action');
assert.ok(backend.includes('if (action === "insert" && String(payload.sheet || "") === "Finance")'), 'generic insert cannot bypass the validated Finance endpoint');
assert.ok(guard.includes('async function recordFinanceTransaction(transaction)'), 'authenticated client has a Finance write workflow');
assert.ok(guard.includes('recordFinanceTransaction: recordFinanceTransaction'), 'Finance write workflow is exposed through CSKAuth');
assert.ok(guard.includes('FINANCE_TRANSACTION_NOT_VERIFIED_CHECK_AND_RETRY'), 'Finance write requires read-back verification');
assert.ok(html.includes('async function submitFinance(e)'), 'Finance form waits for its save operation');
assert.ok(html.includes('await window.CSKAuth.recordFinanceTransaction(fin)'), 'cloud Finance entries use the verified backend write');
assert.ok(html.includes('FIN-MANUAL-'), 'manual Finance IDs are separate from Invoice payment journal IDs');
assert.ok(html.includes('async function deleteFinance(id)'), 'Finance deletion waits for cloud confirmation');
assert.ok(html.includes("await deleteOnCloud('Finance',id)"), 'Finance deletion verifies cloud removal before local removal');
assert.ok(html.includes("paymentLinked=String(f.id||'').toUpperCase().indexOf('FIN-PAY-')===0"), 'Invoice payment journal rows are marked as protected in Finance');
assert.ok(html.includes('Ledger Invoice'), 'Finance UI explains why linked payment rows cannot be deleted');

console.log('CSK Finance manual-entry and payment-ledger integrity tests passed.');
