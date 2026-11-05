'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
new vm.Script(backend, { filename: 'apps-script/Code.gs' });

class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    Object.assign(this, { sheet, row, col, numRows, numCols });
  }
  getValues() {
    return Array.from({ length: this.numRows }, (_, r) =>
      Array.from({ length: this.numCols }, (_, c) =>
        this.sheet.rows[this.row - 1 + r]?.[this.col - 1 + c] ?? ''
      )
    );
  }
  setValues(values) {
    values.forEach((row, r) => {
      const targetRow = this.row - 1 + r;
      if (!this.sheet.rows[targetRow]) this.sheet.rows[targetRow] = [];
      row.forEach((value, c) => {
        this.sheet.rows[targetRow][this.col - 1 + c] = value;
      });
    });
    return this;
  }
  setValue(value) {
    return this.setValues([[value]]);
  }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
}
class FakeSheet {
  constructor(rows) { this.rows = rows.map(row => row.slice()); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows[0]?.length || 0; }
  getDataRange() { return new FakeRange(this, 1, 1, this.getLastRow(), this.getLastColumn()); }
  getRange(row, col, numRows = 1, numCols = 1) {
    return new FakeRange(this, row, col, numRows, numCols);
  }
  appendRow(row) { this.rows.push(row.slice()); }
  setFrozenRows() {}
}
class FakeSpreadsheet {
  constructor(sheets) { this.sheets = sheets; }
  getSheetByName(name) { return this.sheets[name] || null; }
}
function fixture({ leadId = 'lead-1', leadStatus = 'won', projectRows = [], clientRows = [], financeRows = [] } = {}) {
  const context = {};
  vm.createContext(context);
  vm.runInContext(backend, context);
  const map = context.FIELD_MAP;
  const lead = [
    leadId, '2026-11-05', 'PT Contoh Klien', '628123456789',
    'Referensi', 8000000, leadStatus, 'Paket branding',
    '', '', '', '', '', '', ''
  ];
  const sheets = {
    Leads: new FakeSheet([map.Leads.headers, lead]),
    Projects: new FakeSheet([map.Projects.headers, ...projectRows]),
    Clients: new FakeSheet([map.Clients.headers, ...clientRows]),
    Finance: new FakeSheet([map.Finance.headers, ...financeRows])
  };
  return { context, ss: new FakeSpreadsheet(sheets), sheets };
}
const dp = ['DP-1', '2026-11-01', 'income', 'DP Proyek', 4000000, 'DP 50% diterima'];
const first = fixture({ financeRows: [dp] });
const firstResult = first.context.autoTriggerPillars(first.ss);
assert.equal(firstResult.financeCreated, 0, 'Deal Won must never create cash income');
assert.equal(firstResult.projectCreated, 1, 'first conversion creates one project');
assert.equal(firstResult.clientCreated, 1, 'first conversion creates one client');
assert.equal(first.sheets.Projects.rows.length, 2);
assert.equal(first.sheets.Projects.rows[1][0], 'AUTO-PRJ-LEAD-lead-1');
assert.match(String(first.sheets.Projects.rows[1][6]), /\[LEAD-lead-1\]/);
assert.equal(first.sheets.Clients.rows.length, 2);
assert.equal(first.sheets.Clients.rows[1][0], 'AUTO-CLI-LEAD-lead-1');
assert.equal(Number(first.sheets.Clients.rows[1][3]), 1);
assert.equal(Number(first.sheets.Clients.rows[1][4]), 8000000);
assert.equal(first.sheets.Finance.rows.length, 2, 'existing DP remains unchanged');
const secondResult = first.context.autoTriggerPillars(first.ss);
assert.equal(secondResult.projectCreated, 0, 'repeated trigger creates no second project');
assert.equal(secondResult.clientCreated, 0, 'repeated trigger creates no second client');
assert.equal(first.sheets.Projects.rows.length, 2);
assert.equal(first.sheets.Clients.rows.length, 2);
assert.equal(first.sheets.Finance.rows.length, 2);

const linkedProject = [
  'PROJECT-EXISTING', 'Branding Identity', 'PT Contoh Klien', 8000000,
  'ongoing', '2026-11-20', 'Already linked [LEAD-lead-2]',
  'Brief:0;Produksi:0', ''
];
const linked = fixture({ leadId: 'lead-2', projectRows: [linkedProject] });
const linkedResult = linked.context.autoTriggerPillars(linked.ss);
assert.equal(linkedResult.projectCreated, 0, 'existing linked project is reused');
assert.equal(linkedResult.clientCreated, 1, 'missing client is repaired');
assert.equal(linked.sheets.Projects.rows.length, 2);
assert.equal(linked.sheets.Clients.rows.length, 2);

const frontendMatch = html.match(/function convertLeadToWon\(id\) \{[\s\S]*?\n    \}/);
assert.ok(frontendMatch, 'frontend conversion function exists');
const frontendDb = {
  leads: [{
    id: 'lead-3', name: 'PT Contoh Klien', phone: '628123456789',
    value: 8000000, source: 'Referensi', notes: 'Paket branding', status: 'new'
  }],
  clients: [],
  projects: [],
  finance: []
};
let saveCount = 0;
let lastToast = '';
const frontendContext = {
  db: frontendDb,
  saveDB: () => { saveCount++; },
  showToast: message => { lastToast = message; }
};
vm.createContext(frontendContext);
vm.runInContext(frontendMatch[0], frontendContext);
frontendContext.convertLeadToWon('lead-3');
assert.equal(frontendDb.leads[0].status, 'won');
assert.equal(frontendDb.projects.length, 1);
assert.equal(frontendDb.projects[0].id, 'AUTO-PRJ-LEAD-lead-3');
assert.match(frontendDb.projects[0].notes, /\[LEAD-lead-3\]/);
assert.equal(frontendDb.clients.length, 1);
assert.equal(frontendDb.clients[0].id, 'AUTO-CLI-LEAD-lead-3');
assert.equal(frontendDb.clients[0].projectsCount, 1);
assert.equal(frontendDb.clients[0].totalSpend, 8000000);
assert.equal(frontendDb.finance.length, 0, 'frontend conversion does not invent a payment');
frontendContext.convertLeadToWon('lead-3');
assert.equal(frontendDb.projects.length, 1, 'repeated UI conversion does not duplicate projects');
assert.equal(frontendDb.clients.length, 1, 'repeated UI conversion does not duplicate clients');
assert.equal(frontendDb.clients[0].projectsCount, 1, 'client totals are not double counted');
assert.equal(frontendDb.clients[0].totalSpend, 8000000);
assert.equal(saveCount, 2);
assert.match(lastToast, /pembayaran diterima/i);

console.log('CSK deal conversion regression checks passed.');
