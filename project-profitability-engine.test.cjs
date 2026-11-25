'use strict';
const assert = require('node:assert/strict');
const engine = require('./project-profitability-engine.js');

const data = {
  projects: [
    { id: 'P-1', title: 'Booth Expo', client: 'PT Contoh', value: 90000000 },
    { id: 'P-2', title: 'Signage', client: 'CV Sinar', value: 25000000 },
    { id: 'P-3', title: 'Proyek Tanpa Nilai' }
  ],
  salesOrders: [
    { id: 'SO-1', quotationId: 'Q-1', projectId: 'P-1', total: 100000000, status: 'In Production', createdAt: '2026-11-01' },
    { id: 'SO-1-DUP', quotationId: 'Q-1', projectId: 'P-1', total: 100000000, status: 'Ready Delivery', createdAt: '2026-11-02' },
    { id: 'SO-CANCEL', quotationId: 'Q-C', projectId: 'P-1', total: 50000000, status: 'Cancelled' },
    { id: 'SO-2', quotationId: 'Q-2', projectId: 'P-2', total: 20000000, status: 'Closed' }
  ],
  costSheets: [
    { id: 'HPP-OLD', projectId: 'P-1', materialTotal: 25000000, labor: 15000000, other: 5000000, total: 45000000, updatedAt: '2026-11-01' },
    { id: 'HPP-NEW', projectId: 'P-1', materialTotal: 30000000, labor: 20000000, other: 10000000, total: 60000000, updatedAt: '2026-11-20' },
    { id: 'HPP-2', projectId: 'P-2', materialTotal: 5000000, labor: 3000000, other: 2000000, total: 10000000, updatedAt: '2026-11-21' }
  ],
  projectCosts: [
    { id: 'C-1', projectId: 'P-1', category: 'Tenaga kerja', amount: 'Rp 12.000.000' },
    { id: 'C-2', projectId: 'P-1', category: 'Vendor', qty: 2, unitPrice: 3000000 },
    { id: 'C-2', projectId: 'P-1', category: 'Vendor', amount: 6000000 },
    { id: 'C-3', projectId: 'P-2', category: 'Transport', amount: 1500000 },
    { id: 'C-BAD', projectId: 'P-1', category: 'Lainnya', amount: 0 }
  ],
  invoices: [
    { id: 'INV-1', projectId: 'P-1', total: 100000000, status: 'Issued' },
    { id: 'INV-2', projectId: 'P-2', total: 20000000, status: 'Issued' },
    { id: 'INV-C', projectId: 'P-1', total: 10000000, status: 'Cancelled' }
  ],
  invoicePayments: [
    { id: 'PAY-1', invoiceId: 'INV-1', amount: 25000000 },
    { id: 'PAY-1', invoiceId: 'INV-1', amount: 25000000 },
    { id: 'PAY-2', invoiceId: 'INV-1', amount: 15000000 },
    { id: 'PAY-3', invoiceId: 'INV-2', amount: 5000000 },
    { id: 'PAY-X', invoiceId: 'INV-C', amount: 9000000 }
  ]
};

const portfolio = engine.calculatePortfolio(data);
assert.equal(portfolio.projects.length, 3);
const booth = portfolio.projects.find(row => row.projectId === 'P-1');
assert.equal(booth.contractValue, 100000000);
assert.equal(booth.revenueSource, 'sales_orders');
assert.equal(booth.salesOrderCount, 1);
assert.equal(booth.duplicateSalesOrderCount, 1);
assert.equal(booth.hpp.total, 60000000);
assert.equal(booth.hpp.materialTotal, 30000000);
assert.equal(booth.recordedCost, 18000000);
assert.equal(booth.recordedCostCount, 2);
assert.equal(booth.invalidCostCount, 1);
assert.equal(booth.estimatedProfit, 40000000);
assert.equal(booth.estimatedMarginPct, 40);
assert.equal(booth.recordedProfit, 82000000);
assert.equal(booth.cashReceived, 40000000);
assert.equal(booth.recordedCostVsHpp, -42000000);
assert.ok(booth.warnings.some(message => message.includes('Sales Order ganda')));
assert.ok(booth.warnings.some(message => message.includes('Biaya material aktual')));

const signage = portfolio.projects.find(row => row.projectId === 'P-2');
assert.equal(signage.contractValue, 20000000);
assert.equal(signage.estimatedProfit, 10000000);
assert.equal(signage.recordedProfit, 18500000);
assert.equal(signage.cashReceived, 5000000);

const fallback = portfolio.projects.find(row => row.projectId === 'P-3');
assert.equal(fallback.contractValue, 0);
assert.equal(fallback.revenueSource, 'none');
assert.equal(fallback.estimatedProfit, null);
assert.equal(fallback.recordedProfit, null);
assert.equal(fallback.hpp, null);

assert.equal(portfolio.totals.projectCount, 3);
assert.equal(portfolio.totals.contractValue, 120000000);
assert.equal(portfolio.totals.estimatedHpp, 70000000);
assert.equal(portfolio.totals.recordedCosts, 19500000);
assert.equal(portfolio.totals.estimatedProfit, 50000000);
assert.equal(portfolio.totals.cashReceived, 45000000);

assert.equal(engine.money('1.250.000'), 1250000);
assert.equal(engine.money('1.250.000,50'), 1250001);
assert.equal(engine.money('1,250,000'), 1250000);
assert.equal(engine.money(-1000), -1000);

const empty = engine.calculatePortfolio({});
assert.equal(empty.projects.length, 0);
assert.equal(empty.totals.projectCount, 0);

console.log('CSK project profitability engine tests passed.');
