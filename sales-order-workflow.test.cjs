'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('./sales-order-engine');

const quote={
  id:'QUO-TEST-001',docNo:'QUO-CSK-2026-00001',status:'approved',
  projectId:'PRJ-TEST-001',projectName:'Rak Display Custom',client:'PT Contoh',
  clientPhone:'628123456789',clientEmail:'procurement@example.test',
  total:10000000,dpPercent:50,projectDeadline:'2026-12-15',
  sourceCostSheetSnapshot:{id:'HPP-PRJ-TEST-001',projectId:'PRJ-TEST-001',projectName:'Rak Display Custom',items:[{materialId:'MAT-01',name:'Akrilik 3 mm',qty:2,unit:'lembar',materialSnapshot:{unit:'m2',purchaseUnit:'lembar',conversionFactor:3.2}}],materialTotal:100000,labor:0,other:0,margin:30,total:100000,price:142858,profit:42858,updatedAt:'2026-11-20T06:00:00.000Z'},
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
assert.deepEqual(created.order.sourceCostSheetSnapshot,quote.sourceCostSheetSnapshot,'Sales Order keeps the exact HPP snapshot used by its approved quotation');
quote.sourceCostSheetSnapshot.items[0].qty=99;
assert.equal(created.order.sourceCostSheetSnapshot.items[0].qty,2,'Sales Order HPP snapshot is a detached immutable copy');

const duplicate=E.buildOrder(quote,project,[created.order],{date:'2026-11-20'});
assert.equal(duplicate.existing,true,'one quotation must not create duplicate Sales Orders');
assert.equal(duplicate.order.id,created.order.id);
assert.equal(E.nextOrderNumber([created.order],'2026-11-20'),'SO-CSK-2026-00002');
assert.throws(()=>E.buildOrder({...quote,status:'draft'},project,[]),/harus disetujui/);
assert.throws(()=>E.buildOrder({...quote,projectId:''},null,[]),/Proyek belum terhubung/);
const legacyQuote={...quote,id:'QUO-LEGACY-001',projectId:project.id};delete legacyQuote.sourceCostSheetSnapshot;
const legacySnapshot={id:'HPP-LEGACY-001',projectId:project.id,items:[{materialId:'MAT-01',qty:1,unit:'m2'}],total:100,price:200,updatedAt:'2026-11-20T07:00:00.000Z'};
const legacyOrder=E.buildOrder(legacyQuote,project,[],{date:'2026-11-20',sourceCostSheetSnapshot:legacySnapshot});
assert.deepEqual(legacyOrder.order.sourceCostSheetSnapshot,legacySnapshot,'legacy quotations capture the current HPP snapshot at Sales Order creation');

const invoices=[{id:'INV-TEST-001',sourceQuotationId:quote.id,total:10000000}];
const underpaid=E.summarizePayments(quote,invoices,[{id:'PAY-1',invoiceId:'INV-TEST-001',amount:4900000}]);
assert.equal(underpaid.depositSatisfied,false);
assert.equal(underpaid.depositShortfall,100000);
assert.equal(E.availableActions(created.order,underpaid).some(x=>x.status==='ready_production'),false);
assert.throws(()=>E.transition(created.order,'ready_production',underpaid,'Owner'),/DP terverifikasi/);

const dpPaid=E.summarizePayments(quote,invoices,[{id:'PAY-1',invoiceId:'INV-TEST-001',amount:5000000}]);
assert.equal(dpPaid.depositSatisfied,true);
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
assert.match(ui,/purchasePrice\/conversionFactor/,'draft PO unit cost uses base purchase price converted to stock units, not waste-loaded HPP price');
assert.match(ui,/baseUsageUnitPrice/,'draft PO retains a traceable base purchase-unit cost snapshot');
assert.match(ui,/purchaseQty=buyStockQty\/conversionFactor/,'stock shortages are converted back to supplier purchase quantities');
assert.match(ui,/purchaseUnit:purchaseUnit,usageUnit:material\.unit,conversionFactor:conversionFactor/,'draft PO preserves purchase-to-stock conversion metadata for receiving');
assert.match(ui,/qty\)\*\(Number\(item\.conversionFactor\)\|\|1\)/,'open PO commitments are converted into stock units before subtracting from shortages');
assert.match(ui,/Math\.ceil\(purchaseQty-0\.0000001\)/,'indivisible supplier packages are rounded up to whole purchase units');
const sw=fs.readFileSync('sw.js','utf8');
const auth=fs.readFileSync('backend-auth.test.cjs','utf8');
assert.equal(backend,deploy,'canonical Apps Script and deployment copy must stay identical');
assert.match(backend,/Sales_Orders:\s*\{/,'Sales Orders schema exists in backend');
assert.match(backend,/validateSalesOrdersBeforeMerge_\(ss, payload\.salesOrders\)/,'server validates Sales Order writes');
assert.match(backend,/SALES_ORDER_DP_NOT_VERIFIED/,'backend enforces verified DP before production');
assert.match(backend,/SALES_ORDER_STOCK_RESERVATION_REQUIRED/,'backend blocks production start until HPP material reservations exist');
assert.match(ui,/Stok material belum dikunci/,'Sales Order UI guides the Owner to reserve material before starting production');
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
