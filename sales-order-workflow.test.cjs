'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('./sales-order-engine');

const quote={
  id:'QUO-TEST-001',docNo:'QUO-CSK-2026-00001',status:'approved',
  projectId:'PRJ-TEST-001',projectName:'Rak Display Custom',client:'PT Contoh',
  clientPhone:'628123456789',clientEmail:'procurement@example.test',
  total:10000000,dpPercent:50,projectDeadline:'2026-12-15',
  lines:[{id:'L-1',name:'Rak display custom',description:'Acrylic + hollow',qty:2,unit:'unit',unitPrice:5000000}]
};
const project={id:'PRJ-TEST-001',title:'Rak Display Custom'};
const created=E.buildOrder(quote,project,[],{date:'2026-11-20',createdAt:'2026-11-20T06:00:00.000Z'});
assert.equal(created.existing,false);
assert.equal(created.order.status,'awaiting_dp');
assert.equal(created.order.orderNo,'SO-CSK-2026-00001');
assert.equal(created.order.dpRequiredAmount,5000000);
assert.equal(created.order.projectId,project.id);
assert.deepEqual(created.order.items,quote.lines);

const duplicate=E.buildOrder(quote,project,[created.order],{date:'2026-11-20'});
assert.equal(duplicate.existing,true,'one quotation must not create duplicate Sales Orders');
assert.equal(duplicate.order.id,created.order.id);
assert.equal(E.nextOrderNumber([created.order],'2026-11-20'),'SO-CSK-2026-00002');
assert.throws(()=>E.buildOrder({...quote,status:'draft'},project,[]),/harus disetujui/);
assert.throws(()=>E.buildOrder({...quote,projectId:''},null,[]),/Proyek belum terhubung/);

const invoices=[{id:'INV-TEST-001',sourceQuotationId:quote.id,total:10000000}];
const underpaid=E.summarizePayments(quote,invoices,[{id:'PAY-1',invoiceId:'INV-TEST-001',amount:4900000}]);
assert.equal(underpaid.depositSatisfied,false);
assert.equal(underpaid.depositShortfall,100000);
assert.equal(E.availableActions(created.order,underpaid).some(x=>x.status==='ready_production'),false);
assert.throws(()=>E.transition(created.order,'ready_production',underpaid,'Owner'),/DP terverifikasi/);

const dpPaid=E.summarizePayments(quote,invoices,[{id:'PAY-1',invoiceId:'INV-TEST-001',amount:5000000}]);
assert.equal(dpPaid.depositSatisfied,true);
const waitingMaterial=E.transition(created.order,'awaiting_material',dpPaid,'owner@example.test','2026-11-20T06:30:00.000Z','HPP belum tersedia');
assert.equal(waitingMaterial.status,'awaiting_material');
assert.equal(E.statusLabel(waitingMaterial.status),'Menunggu Material');
assert.equal(E.availableActions(waitingMaterial,dpPaid).some(x=>x.status==='ready_production'),true,'material-ready order can be released after stock becomes available');
assert.equal(E.availableActions(created.order,dpPaid).some(x=>x.status==='ready_production'),true);
let order=E.transition(created.order,'ready_production',dpPaid,'owner@example.test','2026-11-20T07:00:00.000Z');
order=E.transition(order,'in_production',dpPaid,'owner@example.test');
order=E.transition(order,'quality_check',dpPaid,'owner@example.test');
assert.equal(E.availableActions(order,dpPaid).some(x=>x.status==='in_production'),true,'QC can return an order to production for rework');
order=E.transition(order,'in_production',dpPaid,'owner@example.test');
order=E.transition(order,'quality_check',dpPaid,'owner@example.test');
order=E.transition(order,'ready_delivery',dpPaid,'owner@example.test');
order=E.transition(order,'delivered',dpPaid,'owner@example.test');
assert.throws(()=>E.transition(order,'closed',dpPaid,'owner@example.test'),/seluruh invoice/);
const fullyPaid=E.summarizePayments(quote,invoices,[{id:'PAY-1',invoiceId:'INV-TEST-001',amount:10000000}]);
order=E.transition(order,'closed',fullyPaid,'owner@example.test');
assert.equal(order.status,'closed');
assert.equal(order.history.length,9);
assert.throws(()=>E.transition(order,'in_production',fullyPaid,'owner@example.test'),/tidak diizinkan/);

const noDpQuote={...quote,id:'QUO-TEST-002',dpPercent:0};
const noDp=E.buildOrder(noDpQuote,project,[],{date:'2026-11-20'});
assert.equal(noDp.order.status,'ready_production');
assert.equal(noDp.order.dpRequiredAmount,0);

const backend=fs.readFileSync('google_apps_script.js','utf8');
const deploy=fs.readFileSync('apps-script/Code.gs','utf8');
const guard=fs.readFileSync('security/guard.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('sales-orders.js','utf8');
const pdf=fs.readFileSync('csk-pdf.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const auth=fs.readFileSync('backend-auth.test.cjs','utf8');
assert.equal(backend,deploy,'canonical Apps Script and deployment copy must stay identical');
assert.match(backend,/Sales_Orders:\s*\{/,'Sales Orders schema exists in backend');
assert.match(backend,/validateSalesOrdersBeforeMerge_\(ss, payload\.salesOrders, payload\.inventoryTransactions/,'server validates Sales Order writes with inventory balances');
assert.match(backend,/SALES_ORDER_DP_NOT_VERIFIED/,'backend enforces verified DP before production');
assert.match(backend,/awaiting_material/,'backend supports orders waiting for material availability');
assert.match(ui,/prepareInitialMaterialReservation/,'Sales Order creation automatically checks and reserves HPP materials');
assert.match(ui,/estimatedUnitCost/,'Sales Order freezes estimated material unit costs with HPP quantity snapshots');
assert.match(ui,/estimatedTotalCost/,'Sales Order freezes estimated material total costs for later actual-cost comparison');
assert.match(ui,/calculateMaterialCostVariance/,'Sales Order compares actual material issue cost with the frozen HPP estimate');
assert.match(ui,/data-so-action="usage-report"/,'Sales Order material panel exposes a quantity reconciliation PDF action');
assert.match(ui,/downloadMaterialUsageReport/,'Sales Order builds a project-specific material usage report from the stock ledger');
assert.match(pdf,/generateMaterialUsagePdf/,'PDF engine supports HPP versus net material issue reconciliation');
assert.match(ui,/Snapshot HPP \(dibekukan\)/,'material report identifies the frozen HPP source when available');
assert.match(ui,/Reservasi material otomatis dibuat/,'Sales Order history records automatic material reservation');
assert.match(backend,/SALES_ORDER_CANNOT_CLOSE_WITH_UNPAID_INVOICE/,'backend blocks closing with unpaid invoice');
assert.match(backend,/salesOrders: readSheetData\(ss, "Sales_Orders"\)/,'owner get_data includes Sales Orders');
assert.match(guard,/salesOrders/,'owner sync includes Sales Orders');
assert.match(guard,/sales-orders/,'Sales Order page is Owner-only in client navigation');
assert.match(html,/id="page-sales-orders"/,'Sales Order page is mounted in Business OS');
assert.match(html,/CSKSalesOrderBridge/,'Sales Order uses the internal Business OS data bridge');
assert.match(ui,/createProjectFromQuotation/,'Sales Order creation links to the approved project');
assert.match(sw,/sales-order-engine\.js/,'Sales Order engine is cached by internal app service worker');
assert.match(sw,/sales-orders\.js/,'Sales Order UI is cached by internal app service worker');
assert.match(auth,/FORBIDDEN_COLLECTION:salesOrders/,'backend RBAC test covers Team denial');
console.log('CSK Sales Order workflow and integration tests passed.');
