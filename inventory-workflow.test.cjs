'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('./inventory-engine');

const materials=[
 {id:'MAT-ACR',name:'Akrilik Clear 3mm',unit:'m2',sku:'ACR-03',status:'active'},
 {id:'MAT-HOL',name:'Hollow 2x2',unit:'m',sku:'HOL-22',status:'active'}
];
const projects=[{id:'PRJ-001',title:'Rak Display Custom'}];
function tx(id,no,movement,qty,date,extra){
 return Object.assign({
  id:'ITX-'+id,transactionNo:no,materialId:'MAT-ACR',movement:movement,qty:qty,unit:'m2',
  date:date,projectId:'',projectName:'',purchaseOrderId:'',supplier:'',reference:'',notes:'',
  createdAt:date+'T08:00:00.000Z',createdBy:'owner@example.test'
 },extra||{});
}
const opening=tx('00000001','STK-CSK-2026-00001','opening',5,'2026-11-01');
const receipt=tx('00000002','STK-CSK-2026-00002','receipt',2,'2026-11-05',{supplier:'Supplier A',reference:'INV-SUP-001'});
const issue=tx('00000003','STK-CSK-2026-00003','issue',3,'2026-11-10',{projectId:'PRJ-001',projectName:'Rak Display Custom'});
const returned=tx('00000004','STK-CSK-2026-00004','return',0.5,'2026-11-12',{projectId:'PRJ-001',projectName:'Rak Display Custom'});
const adjusted=tx('00000005','STK-CSK-2026-00005','adjustment_out',0.5,'2026-11-13',{notes:'Selisih hasil stock opname'});
const ledger=[opening,receipt,issue,returned,adjusted];
const balances=E.calculateBalances(materials,ledger);
assert.equal(balances['MAT-ACR'],3.5);
assert.equal(E.getBalance('MAT-ACR',balances),3.5);
assert.equal(E.getBalance('MAT-HOL',balances),0);
assert.equal(E.nextTransactionNumber(ledger,'2026-11-20'),'STK-CSK-2026-00006');

assert.throws(()=>E.calculateBalances(materials,[receipt,opening]),/transaksi stok pertama/,'opening balance must be the first ledger movement');
assert.throws(()=>E.calculateBalances(materials,[opening,{...opening,id:'ITX-SECOND-00001',transactionNo:'STK-CSK-2026-00009'}]),/satu kali/,'one opening balance per material');
assert.throws(()=>E.calculateBalances(materials,[tx('00000006','STK-CSK-2026-00006','issue',6,'2026-11-02',{projectId:'PRJ-001'})]),/Stok tidak mencukupi/,'stock cannot go negative');

const created=E.validateTransaction({
 materialId:'MAT-ACR',movement:'issue',qty:1,unit:'m2',date:'2026-11-15',
 projectId:'PRJ-001',notes:''
},{materials,projects,transactions:ledger});
assert.equal(created.transaction.projectName,'Rak Display Custom');
assert.equal(created.balances['MAT-ACR'],2.5);
assert.equal(created.transaction.movement,'issue');

assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'issue',qty:1,unit:'m2',date:'2026-11-15',projectId:''
},{materials,projects,transactions:ledger}),/Pilih proyek/);
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'receipt',qty:1,unit:'m2',date:'2026-11-15'
},{materials,projects,transactions:ledger}),/Isi supplier/);
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'receipt',qty:1,unit:'lembar',date:'2026-11-15',supplier:'Supplier'
},{materials,projects,transactions:ledger}),/Satuan harus/);
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'adjustment_out',qty:1,unit:'m2',date:'2026-11-15',notes:''
},{materials,projects,transactions:ledger}),/Alasan penyesuaian/);

const po={id:'PO-001',supplier:'Supplier A',status:'ordered',items:[{materialId:'MAT-ACR',qty:4,unit:'m2'}]};
const poReceipt=E.validateTransaction({
 materialId:'MAT-ACR',movement:'receipt',qty:2,unit:'m2',date:'2026-11-20',
 purchaseOrderId:'PO-001'
},{materials,projects,purchaseOrders:[po],transactions:[]});
assert.equal(poReceipt.transaction.purchaseOrderId,'PO-001');
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'receipt',qty:5,unit:'m2',date:'2026-11-20',
 purchaseOrderId:'PO-001'
},{materials,projects,purchaseOrders:[po],transactions:[poReceipt.transaction]}),/melebihi sisa/);
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'receipt',qty:1,unit:'m2',date:'2026-11-20',
 purchaseOrderId:'PO-001'
},{materials,projects,purchaseOrders:[{...po,status:'draft'}],transactions:[]}),/berstatus Dipesan/);

const backend=fs.readFileSync('google_apps_script.js','utf8');
const deploy=fs.readFileSync('apps-script/Code.gs','utf8');
const guard=fs.readFileSync('security/guard.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('inventory.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const auth=fs.readFileSync('backend-auth.test.cjs','utf8');
assert.equal(backend,deploy,'Apps Script canonical and deployment source must remain identical');
assert.match(backend,/Inventory_Transactions:\s*\{/,'inventory ledger schema exists');
assert.match(backend,/validateInventoryTransactionsBeforeMerge_\(ss, payload\.inventoryTransactions\)/,'backend validates inventory writes');
assert.match(backend,/INVENTORY_TRANSACTION_IMMUTABLE/,'backend prevents edits to existing stock transactions');
assert.match(backend,/INVENTORY_INSUFFICIENT_STOCK/,'backend prevents negative stock');
assert.match(backend,/INVENTORY_RECEIPT_EXCEEDS_PURCHASE_ORDER/,'backend caps receipts to PO quantity');
assert.match(backend,/validatePurchaseOrderReceiptStatuses_/,'backend validates PO completion against inventory receipts');
assert.match(backend,/PURCHASE_ORDER_RECEIPT_INCOMPLETE/,'PO cannot be marked received before all items are received');
assert.match(backend,/INVENTORY_LEDGER_SERVER_ONLY/,'direct insert and delete are blocked');
assert.match(guard,/inventoryTransactions/,'owner sync includes inventory ledger');
assert.match(guard,/inventory/,'inventory navigation is Owner-only');
assert.match(html,/id="page-inventory"/,'inventory page is mounted in Business OS');
assert.match(html,/CSKInventoryBridge/,'inventory uses internal Business OS bridge');
assert.match(ui,/validateTransaction/,'inventory UI validates transactions before save');
assert.match(ui,/openInventoryReceiptFromPO/,'inventory UI supports PO-linked receiving');
assert.match(sw,/inventory-engine\.js/,'inventory engine is cached');
assert.match(sw,/inventory\.js/,'inventory UI is cached');
assert.match(auth,/INVENTORY_LEDGER_SERVER_ONLY/,'backend RBAC test covers append-only inventory protection');
console.log('CSK Inventory workflow and integration tests passed.');
