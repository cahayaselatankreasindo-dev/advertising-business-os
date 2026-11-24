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
assert.equal(balances['MAT-ACR'],4);
assert.equal(E.getBalance('MAT-ACR',balances),4);
assert.equal(E.getBalance('MAT-HOL',balances),0);
assert.equal(E.nextTransactionNumber(ledger,'2026-11-20'),'STK-CSK-2026-00006');

assert.throws(()=>E.calculateBalances(materials,[receipt,{...opening,date:'2026-11-06',createdAt:'2026-11-06T08:00:00.000Z'}]),/transaksi stok pertama/,'opening balance must be the first ledger movement');
assert.throws(()=>E.calculateBalances(materials,[opening,{...opening,id:'ITX-SECOND-00001',transactionNo:'STK-CSK-2026-00009'}]),/satu kali/,'one opening balance per material');
assert.throws(()=>E.calculateBalances(materials,[tx('00000006','STK-CSK-2026-00006','issue',6,'2026-11-02',{projectId:'PRJ-001'})]),/Stok tidak mencukupi/,'stock cannot go negative');

const created=E.validateTransaction({
 materialId:'MAT-ACR',movement:'issue',qty:1,unit:'m2',date:'2026-11-15',
 projectId:'PRJ-001',notes:''
},{materials,projects,transactions:ledger});
assert.equal(created.transaction.projectName,'Rak Display Custom');
assert.equal(created.balances['MAT-ACR'],3);
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

const demand=E.calculateHppRequirements({
 projectId:'PRJ-001',
 items:[
  {itemType:'material',materialId:'MAT-ACR',name:'Acrylic full sheet',qty:2,unit:'lembar'},
  {itemType:'material',materialId:'MAT-HOL',name:'Hollow',qty:3,unit:'m'},
  {itemType:'service',serviceId:'SVC-1',qty:1,unit:'job'}
 ]},
 [
  {...materials[0],purchaseUnit:'lembar',conversionFactor:2.9768},
  materials[1]
 ],{'MAT-ACR':4,'MAT-HOL':5});
assert.equal(demand.requirements.length,2);
assert.equal(demand.requirements[0].materialId,'MAT-ACR');
assert.ok(Math.abs(demand.requirements[0].required-5.9536)<1e-9);
assert.ok(Math.abs(demand.requirements[0].shortage-1.9536)<1e-9);
assert.equal(demand.requirements[1].shortage,0);
assert.equal(demand.ready,false,'short material stock is flagged before production release');
const mismatch=E.calculateHppRequirements({items:[{itemType:'material',materialId:'MAT-ACR',qty:2,unit:'box'}]},materials,{});
assert.equal(mismatch.ready,false);
assert.match(mismatch.errors[0],/tidak cocok/);

// A later Material Master conversion change must not rewrite the approved HPP demand.
const historicalDemand=E.calculateHppRequirements({
 projectId:'PRJ-OLD',
 items:[{itemType:'material',materialId:'MAT-ACR',name:'Akrilik Clear 3mm',qty:2,unit:'lembar',materialSnapshot:{name:'Akrilik Clear 3mm (snapshot)',unit:'m2',purchaseUnit:'lembar',conversionFactor:4}}]
},[{...materials[0],purchaseUnit:'lembar',conversionFactor:2.5}],{});
assert.equal(historicalDemand.requirements[0].required,8,'HPP snapshot conversion factor takes precedence over the current Material Master');
assert.equal(historicalDemand.requirements[0].name,'Akrilik Clear 3mm (snapshot)','material label follows the saved HPP snapshot');


const commitmentMaterials=[
 {...materials[0],purchaseUnit:'lembar',conversionFactor:2.5},
 materials[1]
];
const commitmentSheets=[
 {projectId:'PRJ-001',items:[
  {itemType:'material',materialId:'MAT-ACR',name:'Acrylic sheet',qty:2,unit:'lembar'},
  {itemType:'material',materialId:'MAT-HOL',name:'Hollow',qty:4,unit:'m'}
 ]},
 {projectId:'PRJ-002',items:[
  {itemType:'material',materialId:'MAT-ACR',name:'Acrylic panel',qty:1.5,unit:'m2'}
 ]}
];
const activeOrders=[
 {id:'SO-001',projectId:'PRJ-001',projectName:'Project A',status:'in_production'},
 {id:'SO-001B',projectId:'PRJ-001',projectName:'Project A',status:'quality_check'},
 {id:'SO-002',projectId:'PRJ-002',projectName:'Project B',status:'ready_production'},
 {id:'SO-003',projectId:'PRJ-003',projectName:'Awaiting DP',status:'awaiting_dp'},
 {id:'SO-004',projectId:'PRJ-004',projectName:'Delivered',status:'delivered'},
 {id:'SO-005',projectId:'PRJ-005',projectName:'Cancelled',status:'cancelled'}
];
const commitmentLedger=[
 {projectId:'PRJ-001',materialId:'MAT-ACR',movement:'issue',qty:1},
 {projectId:'PRJ-001',materialId:'MAT-ACR',movement:'return',qty:0.25},
 {projectId:'PRJ-002',materialId:'MAT-ACR',movement:'issue',qty:0.5},
 {projectId:'PRJ-001',materialId:'MAT-HOL',movement:'issue',qty:1}
];
const commitments=E.calculateOpenSalesOrderCommitments(
 activeOrders,commitmentSheets,commitmentMaterials,commitmentLedger,
 {'MAT-ACR':6,'MAT-HOL':4}
);
assert.equal(commitments.activeOrderCount,3,'awaiting-DP, delivered, and cancelled orders do not reserve material');
assert.equal(commitments.activeProjectCount,2,'multiple active Sales Orders for one project do not duplicate the project HPP');
assert.equal(commitments.ready,true);
const acrylicCommitment=commitments.requirements.find(x=>x.materialId==='MAT-ACR');
assert.ok(Math.abs(acrylicCommitment.committed-5.25)<1e-9,'purchase-unit conversion and net issue/return movements determine remaining material commitment');
assert.ok(Math.abs(acrylicCommitment.availableAfterCommitments-0.75)<1e-9);
assert.equal(acrylicCommitment.shortage,0);
const hollowCommitment=commitments.requirements.find(x=>x.materialId==='MAT-HOL');
assert.equal(hollowCommitment.committed,3,'project issues reduce outstanding material commitment');
assert.equal(hollowCommitment.availableAfterCommitments,1);

const shortageCommitments=E.calculateOpenSalesOrderCommitments(
 activeOrders,commitmentSheets,commitmentMaterials,commitmentLedger,
 {'MAT-ACR':4,'MAT-HOL':4}
);
assert.ok(Math.abs(shortageCommitments.requirements.find(x=>x.materialId==='MAT-ACR').shortage-1.25)<1e-9,'cross-project commitments surface a shared-stock shortage');

const unresolvedCommitments=E.calculateOpenSalesOrderCommitments(
 activeOrders.concat([{id:'SO-003B',projectId:'PRJ-003',projectName:'Awaiting DP',status:'in_production'}]),
 commitmentSheets,commitmentMaterials,commitmentLedger,{'MAT-ACR':6,'MAT-HOL':4}
);
assert.equal(unresolvedCommitments.ready,false,'an active project without HPP is not silently treated as zero demand');
assert.match(unresolvedCommitments.errors[0],/HPP belum tersedia/);

const snapshotCommitments=E.calculateOpenSalesOrderCommitments([
 {id:'SO-SNAP-A',orderNo:'SO-CSK-2026-00011',projectId:'PRJ-SNAP',projectName:'Project Snapshot',status:'in_production',sourceCostSheetSnapshot:{id:'HPP-SNAP-A',projectId:'PRJ-SNAP',items:[{materialId:'MAT-ACR',name:'Acrylic old A',qty:2,unit:'lembar',materialSnapshot:{unit:'m2',purchaseUnit:'lembar',conversionFactor:4}}]}},
 {id:'SO-SNAP-B',orderNo:'SO-CSK-2026-00012',projectId:'PRJ-SNAP',projectName:'Project Snapshot',status:'quality_check',sourceCostSheetSnapshot:{id:'HPP-SNAP-B',projectId:'PRJ-SNAP',items:[{materialId:'MAT-ACR',name:'Acrylic old B',qty:1,unit:'lembar',materialSnapshot:{unit:'m2',purchaseUnit:'lembar',conversionFactor:3}}]}}
],[{projectId:'PRJ-SNAP',items:[{materialId:'MAT-ACR',name:'Latest HPP',qty:1.5,unit:'m2'}]}],commitmentMaterials,[],{'MAT-ACR':4});
const snapshotAcrylic=snapshotCommitments.requirements.find(x=>x.materialId==='MAT-ACR');
assert.equal(snapshotAcrylic.committed,11,'each active Sales Order contributes its own saved HPP demand, not the latest project HPP');
assert.equal(snapshotAcrylic.shortage,7,'shared stock shortage is calculated from historical Sales Order snapshots');
assert.equal(snapshotCommitments.activeOrderCount,2);
assert.equal(snapshotCommitments.activeProjectCount,1);



const backend=fs.readFileSync('google_apps_script.js','utf8');
const deploy=fs.readFileSync('apps-script/Code.gs','utf8');
const guard=fs.readFileSync('security/guard.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('inventory.js','utf8');
const salesUI=fs.readFileSync('sales-orders.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const auth=fs.readFileSync('backend-auth.test.cjs','utf8');
assert.equal(backend,deploy,'Apps Script canonical and deployment source must remain identical');
assert.match(backend,/Inventory_Transactions:\s*\{/,'inventory ledger schema exists');
assert.match(backend,/validateInventoryTransactionsBeforeMerge_\(ss, payload\.inventoryTransactions, payload\.purchaseOrders/,'backend validates inventory writes');
assert.match(backend,/INVENTORY_TRANSACTION_IMMUTABLE/,'backend prevents edits to existing stock transactions');
assert.match(backend,/INVENTORY_INSUFFICIENT_STOCK/,'backend prevents negative stock');
assert.match(backend,/INVENTORY_RECEIPT_EXCEEDS_PURCHASE_ORDER/,'backend caps receipts to PO quantity');
assert.match(backend,/validatePurchaseOrderReceiptStatuses_/,'backend validates PO completion against inventory receipts');
assert.match(backend,/PURCHASE_ORDER_RECEIPT_INCOMPLETE/,'new versioned POs cannot be marked received before all items are received');
assert.match(backend,/inventoryControlVersion/,'legacy Purchase Orders remain compatible while new POs require receipt control');
assert.match(backend,/INVENTORY_LEDGER_SERVER_ONLY/,'direct insert and delete are blocked');
assert.match(guard,/inventoryTransactions/,'owner sync includes inventory ledger');
assert.match(guard,/inventory/,'inventory navigation is Owner-only');
assert.match(html,/id="page-inventory"/,'inventory page is mounted in Business OS');
assert.match(html,/CSKInventoryBridge/,'inventory uses internal Business OS bridge');
assert.match(html,/costSheets: db\.costSheets \|\| \[\], salesOrders: db\.salesOrders \|\| \[\]/,'inventory bridge supplies HPP and Sales Order data to the commitment monitor');
assert.match(ui,/validateTransaction/,'inventory UI validates transactions before save');
assert.match(ui,/openInventoryReceiptFromPO/,'inventory UI supports PO-linked receiving');
assert.match(ui,/calculateOpenSalesOrderCommitments/,'inventory UI calculates cross-project active Sales Order commitments');
assert.match(ui,/Komitmen Material Sales Order/,'inventory page shows the active production material commitment panel');
assert.match(ui,/Estimasi bebas/,'inventory page distinguishes physical stock from estimated free stock');
assert.match(ui,/monitoring, bukan reservasi stok yang terkunci/,'inventory UI clearly labels commitments as advisory, not locked reservations');
assert.match(ui,/Stock Reservation · Terkunci/,'inventory UI exposes the locked stock reservation panel');
assert.match(ui,/reserve-so/,'inventory UI supports server-side stock reservation');
assert.match(ui,/release-so/,'inventory UI supports reservation release');
assert.match(salesUI,/calculateHppRequirements/,'Sales Order material plan uses HPP and verified unit conversion');
assert.match(salesUI,/createDraftPOFromShortage/,'Sales Order can create supplier-grouped draft POs from HPP shortages');
assert.match(salesUI,/openPurchaseOrderQty/,'shortage planner subtracts quantities already covered by draft or ordered POs');
assert.match(salesUI,/Buat Draft PO dari Kekurangan/,'owner can start purchasing from the shortage panel');
assert.match(salesUI,/belum dikurangi reservasi order lain/,'material planner distinguishes physical stock from reservations');
assert.match(sw,/inventory-engine\.js/,'inventory engine is cached');
assert.match(sw,/inventory\.js/,'inventory UI is cached');
assert.match(auth,/INVENTORY_LEDGER_SERVER_ONLY/,'backend RBAC test covers append-only inventory protection');
console.log('CSK Inventory workflow and integration tests passed.');
