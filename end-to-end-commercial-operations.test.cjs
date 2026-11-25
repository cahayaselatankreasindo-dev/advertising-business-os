'use strict';
const assert = require('node:assert/strict');
const SO = require('./sales-order-engine');
const Inventory = require('./inventory-engine');

const materials = [{
  id: 'MAT-ACR-03', sku: 'ACR-03', name: 'Akrilik Clear 3 mm',
  unit: 'm2', purchaseUnit: 'm2', conversionFactor: 1, wasteRate: 0,
  reorderPoint: 8, status: 'active'
}];
const project = { id: 'PRJ-E2E-001', title: 'Display Booth CSK E2E' };
const quotation = {
  id: 'QUO-E2E-001', docNo: 'QUO-CSK-E2E-001', status: 'approved',
  projectId: project.id, projectName: project.title, client: 'PT Simulasi CSK',
  total: 10000000, dpPercent: 50, projectDeadline: '2026-12-20',
  lines: [{ id: 'LINE-01', name: 'Panel display acrylic', qty: 1, unit: 'job', unitPrice: 10000000 }],
  sourceCostSheetSnapshot: {
    id: 'HPP-E2E-001', projectId: project.id, projectName: project.title,
    updatedAt: '2026-11-25T08:00:00.000Z',
    items: [{
      itemType: 'material', materialId: materials[0].id, name: materials[0].name,
      qty: 3, unit: 'm2',
      materialSnapshot: { name: materials[0].name, unit: 'm2', purchaseUnit: 'm2', conversionFactor: 1, wasteRate: 0 }
    }]
  }
};
const invoice = { id: 'INV-E2E-001', sourceQuotationId: quotation.id, total: quotation.total };
const verifiedDp = [{ id: 'PAY-DP-001', invoiceId: invoice.id, amount: 5000000 }];
const verifiedFullPayment = [{ id: 'PAY-FULL-001', invoiceId: invoice.id, amount: 10000000 }];
const built = SO.buildOrder(quotation, project, [], { date: '2026-11-25', createdAt: '2026-11-25T08:00:00.000Z' });
assert.equal(built.existing, false);
assert.equal(built.order.status, 'awaiting_dp');

const underpaid = SO.summarizePayments(quotation, [invoice], [{ id: 'PAY-DP-PART', invoiceId: invoice.id, amount: 4999999 }]);
assert.throws(() => SO.transition(built.order, 'ready_production', underpaid, 'Owner'), /DP terverifikasi/);

const dpSummary = SO.summarizePayments(quotation, [invoice], verifiedDp);
let order = SO.transition(built.order, 'ready_production', dpSummary, 'Owner', '2026-11-25T09:00:00.000Z');
let orders = [order];
const opening = {
  id: 'ITX-OPEN-E2E', transactionNo: 'STK-CSK-E2E-001', materialId: materials[0].id,
  movement: 'opening', qty: 10, unit: 'm2', date: '2026-11-01', createdAt: '2026-11-01T08:00:00.000Z'
};
let ledger = [opening];
let balances = Inventory.calculateBalances(materials, ledger);
assert.equal(balances[materials[0].id], 10);

let commitments = Inventory.calculateOpenSalesOrderCommitments(orders, [], materials, ledger, balances);
assert.equal(commitments.ready, true);
assert.equal(commitments.activeOrderCount, 1);
assert.equal(commitments.requirements[0].required, 3);
assert.equal(commitments.requirements[0].committed, 3);
assert.equal(commitments.requirements[0].availableAfterCommitments, 7);
let reorder = Inventory.calculateReorderSuggestions(materials, balances, commitments.requirements);
assert.equal(reorder[0].shortage, 1);

const reservation = { id: 'RES-E2E-001', salesOrderId: order.id, projectId: project.id, materialId: materials[0].id, qty: 3, status: 'active' };
const issue = Inventory.validateTransaction({
  id: 'ITX-ISSUE-E2E', transactionNo: 'STK-CSK-E2E-002', materialId: materials[0].id,
  movement: 'issue', qty: 2, unit: 'm2', date: '2026-11-25', projectId: project.id,
  salesOrderId: order.id, reservationId: reservation.id
}, { materials, projects: [project], transactions: ledger, salesOrders: orders, inventoryReservations: [reservation] });
ledger.push(issue.transaction);
balances = issue.balances;
assert.equal(balances[materials[0].id], 8);
commitments = Inventory.calculateOpenSalesOrderCommitments(orders, [], materials, ledger, balances);
assert.equal(commitments.requirements[0].committed, 1);

const returned = Inventory.validateTransaction({
  id: 'ITX-RETURN-E2E', transactionNo: 'STK-CSK-E2E-003', materialId: materials[0].id,
  movement: 'return', qty: 0.5, unit: 'm2', date: '2026-11-25', projectId: project.id,
  salesOrderId: order.id, reservationId: reservation.id
}, { materials, projects: [project], transactions: ledger, salesOrders: orders, inventoryReservations: [reservation] });
ledger.push(returned.transaction);
balances = returned.balances;
assert.equal(balances[materials[0].id], 8.5);

const purchaseOrder = {
  id: 'PO-E2E-001', supplier: 'Supplier Simulasi', status: 'ordered',
  items: [{ materialId: materials[0].id, qty: 1, unit: 'm2' }]
};
const receipt = Inventory.validateTransaction({
  id: 'ITX-RECEIPT-E2E', transactionNo: 'STK-CSK-E2E-004', materialId: materials[0].id,
  movement: 'receipt', qty: 1, unit: 'm2', date: '2026-11-25', purchaseOrderId: purchaseOrder.id
}, { materials, projects: [project], transactions: ledger, purchaseOrders: [purchaseOrder], salesOrders: orders, inventoryReservations: [reservation] });
ledger.push(receipt.transaction);
balances = receipt.balances;
assert.equal(balances[materials[0].id], 9.5);
commitments = Inventory.calculateOpenSalesOrderCommitments(orders, [], materials, ledger, balances);
reorder = Inventory.calculateReorderSuggestions(materials, balances, commitments.requirements);
assert.equal(reorder.length, 0);

order = SO.transition(order, 'in_production', dpSummary, 'Owner');
order = SO.transition(order, 'quality_check', dpSummary, 'Owner');
order = SO.transition(order, 'ready_delivery', dpSummary, 'Owner');
order = SO.transition(order, 'delivered', dpSummary, 'Owner');
orders = [order];
commitments = Inventory.calculateOpenSalesOrderCommitments(orders, [], materials, ledger, balances);
assert.equal(commitments.activeOrderCount, 0);
const fullSummary = SO.summarizePayments(quotation, [invoice], verifiedFullPayment);
order = SO.transition(order, 'closed', fullSummary, 'Owner');
assert.equal(order.status, 'closed');

console.log('CSK end-to-end operations passed: approved quotation → verified DP → production → HPP stock commitment → reserved issue/return → PO receipt → reorder cleared → delivered → fully paid close.');
