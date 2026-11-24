'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('    function renderDashboard() {');
const end = html.indexOf('    // ============== LEADS ==============', start);
assert.ok(start >= 0 && end > start, 'dashboard renderer must remain present and bounded');
const renderer = html.slice(start, end);

function localDate(offset) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

const db = {
  leads: [
    { id: 'L-OVERDUE', name: 'PT Overdue', status: 'new', source: 'Referral', value: 1000000, nextFollowUp: localDate(-2), phone: '08123456789' },
    { id: 'L-TODAY', name: 'PT Today', status: 'contacted', source: 'WhatsApp', value: 2000000, nextFollowUp: localDate(0) },
    { id: 'L-SCHEDULED', name: 'PT Scheduled', status: 'nego', source: 'Instagram', value: 3000000, nextFollowUp: localDate(2) },
    { id: 'L-UNSCHEDULED', name: 'PT Unscheduled', status: 'new', source: 'Website', value: 4000000, nextFollowUp: '' },
    { id: 'L-WON', name: 'PT Won', status: 'won', value: 5000000, nextFollowUp: localDate(-5) },
    { id: 'L-LOST', name: 'PT Lost', status: 'lost', value: 6000000, nextFollowUp: localDate(-5) }
  ],
  projects: [
    { id: 'P-OVERDUE', title: 'Project Overdue', client: 'Client A', status: 'ongoing', deadline: localDate(-2) },
    { id: 'P-TODAY', title: 'Project Today', client: 'Client B', status: 'plan', deadline: localDate(0) },
    { id: 'P-UPCOMING', title: 'Project Upcoming', client: 'Client C', status: 'review', deadline: localDate(2) },
    { id: 'P-NODATE', title: 'Project No Date', client: 'Client D', status: 'plan', deadline: '' },
    { id: 'P-DONE', title: 'Project Done', client: 'Client E', status: 'done', deadline: localDate(-3) }
  ],
  finance: [
    { type: 'income', amount: 1000000 },
    { type: 'expense', amount: 100000 }
  ],
  marketingSpend: [
    { budget: 80000, spent: 50000, leadsGenerated: 2 }
  ]
};
const nodes = Object.create(null);
const document = {
  getElementById(id) {
    if (!nodes[id]) nodes[id] = { innerText: '', innerHTML: '' };
    return nodes[id];
  }
};
const context = {
  db,
  document,
  Date,
  Number,
  String,
  Math,
  JSON,
  escapeInvoiceHtml: escapeHtml,
  formatRp: value => 'Rp ' + Math.round(Number(value || 0)).toLocaleString('id-ID'),
  cleanPhone: value => String(value || '').replace(/\D/g, '')
};
vm.runInNewContext(renderer + '\nrenderDashboard();', context, { filename: 'index.html#renderDashboard' });

assert.equal(nodes['stat-total-leads'].innerText, 6);
assert.equal(nodes['stat-active-leads'].innerText, 4);
assert.equal(nodes['stat-won-leads'].innerText, 1);
assert.equal(nodes['stat-win-rate'].innerText, '17%');
assert.equal(nodes['stat-total-income'].innerText, 'Rp 1.000.000');
assert.equal(nodes['stat-net-profit'].innerText, 'Rp 850.000');
assert.equal(nodes['stat-margin-pct'].innerText, '85%');
assert.equal(nodes['stat-mkt-spend'].innerText, 'Rp 50.000');
assert.equal(nodes['mkt-total-budget'].innerText, 'Rp 80.000');
assert.equal(nodes['mkt-spent'].innerText, 'Rp 50.000');
assert.equal(nodes['mkt-total-leads'].innerText, 2);
assert.equal(nodes['mkt-cpl'].innerText, 'Rp 25.000');

const projectHtml = nodes['dash-projects-list'].innerHTML;
const projectOrder = ['Project Overdue', 'Project Today', 'Project Upcoming', 'Project No Date'];
let previousProjectPosition = -1;
for (const name of projectOrder) {
  const position = projectHtml.indexOf(name);
  assert.ok(position > previousProjectPosition, name + ' should appear in deadline priority order');
  previousProjectPosition = position;
}
assert.ok(!projectHtml.includes('Project Done'), 'completed projects must not appear in the active project queue');
assert.ok(projectHtml.includes('Perencanaan'), 'plan status must not be mislabeled as review');
assert.ok(projectHtml.includes('Review klien'), 'review status must be explicit');
assert.ok(projectHtml.includes('Terlambat'), 'overdue project deadline must be highlighted');

const leadHtml = nodes['dash-leads-list'].innerHTML;
const leadOrder = ['PT Overdue', 'PT Today', 'PT Scheduled', 'PT Unscheduled'];
let previousLeadPosition = -1;
for (const name of leadOrder) {
  const position = leadHtml.indexOf(name);
  assert.ok(position > previousLeadPosition, name + ' should appear in follow-up priority order');
  previousLeadPosition = position;
}
assert.ok(!leadHtml.includes('PT Won') && !leadHtml.includes('PT Lost'), 'closed leads must not appear in follow-up queue');
assert.ok(leadHtml.includes('Follow-up hari ini'), 'today follow-ups must be clearly identified');
assert.ok(leadHtml.includes('Belum dijadwalkan'), 'unscheduled leads must be clearly identified');
assert.ok(leadHtml.includes('rel="noopener noreferrer"'), 'WhatsApp links must not expose the opener window');
console.log('CSK dashboard metrics, project deadlines, and lead follow-up prioritisation tests passed.');
