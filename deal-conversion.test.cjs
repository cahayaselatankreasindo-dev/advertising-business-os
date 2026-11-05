'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const backend = fs.readFileSync('google_apps_script.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
new vm.Script(backend, { filename: 'google_apps_script.js' });

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'missing function ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('unterminated function ' + name);
}

// Backend automation: disabled by default, and deterministic when explicitly enabled.
let automationEnabled = true;
const backendContext = {
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: key => key === 'AUTO_PROJECT_FROM_WON' && automationEnabled ? 'true' : null
    })
  }
};
vm.createContext(backendContext);
vm.runInContext(backend, backendContext);

const leads = [{
  id: 'lead-42',
  name: 'PT Contoh Klien',
  value: 8000000,
  status: 'won'
}];
const projects = [];
const leadSheet = { getLastRow: () => leads.length + 1 };
const projectSheet = {
  getLastRow: () => projects.length + 1,
  getRange: (row, col, numRows) => ({
    getValues: () => Array.from({ length: numRows }, (_, i) => [
      projects[row - 2 + i] ? projects[row - 2 + i].id : ''
    ])
  })
};
const ss = {
  getSheetByName: name => name === 'Leads' ? leadSheet : name === 'Projects' ? projectSheet : null
};
backendContext.readSheetData = (_ss, name) => name === 'Leads' ? leads.slice() : projects.slice();
backendContext.hasTokenInSheet = (_ss, _sheet, token) =>
  projects.some(project => String(project.notes || '').includes(token));
backendContext.insertRecord = (_ss, _sheet, record) => { projects.push({ ...record }); };
const first = backendContext.autoTriggerPillars(ss);
assert.equal(first.financeCreated, 0, 'Deal Won must never fabricate cash income');
assert.equal(first.projectCreated, 1);
assert.equal(projects.length, 1);
assert.equal(projects[0].id, 'AUTO-PRJ-LEAD-lead-42');
assert.match(projects[0].notes, /\[LEAD-lead-42\]/);
const second = backendContext.autoTriggerPillars(ss);
assert.equal(second.projectCreated, 0, 'repeated backend trigger must be idempotent');
assert.equal(projects.length, 1);
automationEnabled = false;
assert.equal(backendContext.autoTriggerPillars(ss).disabled, true, 'automation remains opt-in');

// Frontend conversion: stable project/client IDs, repair on repeat, and client totals.
const frontendContext = {
  db: {
    leads: [{
      id: 'lead-42', name: 'PT Contoh Klien', phone: '628123456789',
      source: 'Referral', value: 8000000, notes: 'Paket branding', status: 'new'
    }],
    clients: [],
    projects: [],
    finance: []
  },
  saveCount: 0,
  toast: '',
  saveDB: () => { frontendContext.saveCount++; },
  showToast: message => { frontendContext.toast = message; }
};
vm.createContext(frontendContext);
const frontendFunctions = [
  extractFunction(html, 'stableLeadEntityId'),
  extractFunction(html, 'normalizedClientName'),
  extractFunction(html, 'convertLeadToWon')
].join('\n');
vm.runInContext(frontendFunctions, frontendContext);
frontendContext.convertLeadToWon('lead-42');
assert.equal(frontendContext.db.leads[0].status, 'won');
assert.equal(frontendContext.db.projects.length, 1);
assert.equal(frontendContext.db.projects[0].id, 'AUTO-PRJ-LEAD-lead-42');
assert.match(frontendContext.db.projects[0].notes, /\[LEAD-lead-42\]/);
assert.equal(frontendContext.db.clients.length, 1);
assert.equal(frontendContext.db.clients[0].id, 'AUTO-CLI-LEAD-lead-42');
assert.equal(frontendContext.db.clients[0].projectsCount, 1);
assert.equal(frontendContext.db.clients[0].totalSpend, 8000000);
assert.equal(frontendContext.db.finance.length, 0);
frontendContext.convertLeadToWon('lead-42');
assert.equal(frontendContext.db.projects.length, 1);
assert.equal(frontendContext.db.clients.length, 1);
assert.equal(frontendContext.db.clients[0].projectsCount, 1);
assert.equal(frontendContext.db.clients[0].totalSpend, 8000000);

// Existing linked project/client are reused and client aggregates are repaired.
frontendContext.db.leads.push({
  id: 'lead-43', name: 'PT   CONTOH KLIEN', phone: '628999',
  source: 'Referral', value: 2000000, notes: '', status: 'won'
});
frontendContext.db.projects.push({
  id: 'PROJECT-OLD', title: 'Retainer', client: 'pt contoh klien',
  value: 1000000, status: 'ongoing', deadline: '',
  notes: 'Existing record [LEAD-lead-43]', sopChecklist: ''
});
frontendContext.db.clients[0].projectsCount = 0;
frontendContext.db.clients[0].totalSpend = 0;
frontendContext.convertLeadToWon('lead-43');
assert.equal(frontendContext.db.projects.length, 2, 'linked project is reused');
assert.equal(frontendContext.db.clients.length, 1, 'normalized existing client is reused');
assert.equal(frontendContext.db.clients[0].projectsCount, 2);
assert.equal(frontendContext.db.clients[0].totalSpend, 9000000);

console.log('CSK Deal Won idempotency and cash-accounting checks passed.');
