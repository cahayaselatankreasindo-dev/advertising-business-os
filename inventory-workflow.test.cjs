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

const hollowMaterial={id:'MAT-HOLLOW-6M',name:'Hollow hitam 2 × 2 cm, tebal 1 mm',sku:'H-H-2X2-1',unit:'m',purchaseUnit:'batang',conversionFactor:6,unitPrice:20000,purchasePrice:120000,status:'active'};
const hollowPO={id:'PO-HOLLOW-001',supplier:'Supplier Hollow',status:'ordered',items:[{materialId:hollowMaterial.id,sku:hollowMaterial.sku,name:hollowMaterial.name,qty:2,unit:'batang',purchaseUnit:'batang',usageUnit:'m',conversionFactor:6,unitPrice:120000,usageUnitPrice:20000}]};
const hollowReceipt=E.validateTransaction({
 materialId:hollowMaterial.id,movement:'receipt',qty:6,unit:'m',date:'2026-11-20',purchaseOrderId:hollowPO.id
},{materials:[hollowMaterial],projects,purchaseOrders:[hollowPO],transactions:[]});
assert.equal(hollowReceipt.transaction.qty,6,'one 6m bar is received into stock as six meters');
assert.equal(hollowReceipt.transaction.unit,'m','stock ledger always stores usage units');
assert.throws(()=>E.validateTransaction({
 materialId:hollowMaterial.id,movement:'receipt',qty:7,unit:'m',date:'2026-11-21',purchaseOrderId:hollowPO.id
},{materials:[hollowMaterial],projects,purchaseOrders:[hollowPO],transactions:[hollowReceipt.transaction]}),/melebihi sisa/,'receipt cannot exceed two purchased bars after conversion');

const reservationOrder={id:'SO-INV-UI-0001',projectId:'PRJ-001',status:'in_production'};
const reservation={id:'RSV-UI-0001',salesOrderId:reservationOrder.id,materialId:'MAT-ACR',qty:4,unit:'m2',status:'active'};
const reservedOpening=tx('00000020','STK-CSK-2026-00020','opening',5,'2026-11-01');
const linkedIssue=E.validateTransaction({
 materialId:'MAT-ACR',movement:'issue',qty:2,unit:'m2',date:'2026-11-15',
 projectId:'PRJ-001',salesOrderId:reservationOrder.id,reservationId:reservation.id
},{materials,projects,transactions:[reservedOpening],salesOrders:[reservationOrder],inventoryReservations:[reservation]});
assert.equal(linkedIssue.transaction.salesOrderId,reservationOrder.id,'stock issue stores its Sales Order link');
assert.equal(linkedIssue.transaction.reservationId,reservation.id,'stock issue stores the exact reservation row ID');
assert.equal(linkedIssue.balances['MAT-ACR'],3,'linked material issue reduces physical stock');

const linkedReturn=E.validateTransaction({
 materialId:'MAT-ACR',movement:'return',qty:1,unit:'m2',date:'2026-11-16',
 projectId:'PRJ-001',salesOrderId:reservationOrder.id,reservationId:reservation.id
},{materials,projects,transactions:[reservedOpening,linkedIssue.transaction],salesOrders:[reservationOrder],inventoryReservations:[reservation]});
assert.equal(linkedReturn.balances['MAT-ACR'],4,'linked material return restores physical stock');
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'return',qty:3,unit:'m2',date:'2026-11-16',
 projectId:'PRJ-001',salesOrderId:reservationOrder.id,reservationId:reservation.id
},{materials,projects,transactions:[reservedOpening,linkedIssue.transaction],salesOrders:[reservationOrder],inventoryReservations:[reservation]}),/melebihi jumlah yang sudah dikeluarkan/,'return quantity cannot exceed net quantity issued from the reservation');
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'return',qty:1,unit:'m2',date:'2026-11-16',projectId:'PRJ-001'
},{materials,projects,transactions:[reservedOpening,linkedIssue.transaction],salesOrders:[reservationOrder],inventoryReservations:[reservation]}),/harus ditautkan ke Sales Order/,'returns from reserved Sales Order stock must retain their source reservation link');
const reissueAfterReturn=E.validateTransaction({
 materialId:'MAT-ACR',movement:'issue',qty:3,unit:'m2',date:'2026-11-17',
 projectId:'PRJ-001',salesOrderId:reservationOrder.id,reservationId:reservation.id
},{materials,projects,transactions:[reservedOpening,linkedIssue.transaction,linkedReturn.transaction],salesOrders:[reservationOrder],inventoryReservations:[reservation]});
assert.equal(reissueAfterReturn.balances['MAT-ACR'],1,'returned material becomes available for picking again within the same reservation');

const deliveredOrder={...reservationOrder,status:'delivered'};
const terminalStockIssue=E.validateTransaction({
 materialId:'MAT-ACR',movement:'issue',qty:5,unit:'m2',date:'2026-11-16',projectId:'PRJ-001'
},{materials,projects,transactions:[reservedOpening],salesOrders:[deliveredOrder],inventoryReservations:[reservation]});
assert.equal(terminalStockIssue.balances['MAT-ACR'],0,'stale reservations for delivered Sales Orders do not block stock availability');
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'issue',qty:1,unit:'m2',date:'2026-11-16',projectId:'PRJ-001',
 salesOrderId:deliveredOrder.id,reservationId:reservation.id
},{materials,projects,transactions:[reservedOpening],salesOrders:[deliveredOrder],inventoryReservations:[reservation]}),/Sales Order tidak berada/,'new linked issues are blocked after Sales Order delivery');
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'issue',qty:2,unit:'m2',date:'2026-11-15',projectId:'PRJ-001'
},{materials,projects,transactions:[reservedOpening],inventoryReservations:[reservation]}),/dikunci oleh Sales Order/,'unlinked issue cannot consume reserved stock');
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'issue',qty:5,unit:'m2',date:'2026-11-15',
 projectId:'PRJ-001',salesOrderId:reservationOrder.id,reservationId:reservation.id
},{materials,projects,transactions:[reservedOpening],salesOrders:[reservationOrder],inventoryReservations:[reservation]}),/melebihi sisa reservasi/,'linked issue cannot exceed the reserved quantity');
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'issue',qty:1,unit:'m2',date:'2026-11-15',
 projectId:'PRJ-001',salesOrderId:reservationOrder.id,reservationId:'RSV-WRONG'
},{materials,projects,transactions:[reservedOpening],salesOrders:[reservationOrder],inventoryReservations:[reservation]}),/belum memiliki reservasi aktif/,'linked issue must reference an active reservation row');

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
const inventoryEngineSource=fs.readFileSync('inventory-engine.js','utf8');
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
assert.match(backend,/reserveSalesOrderStock_/,'backend provides an atomic Sales Order stock reservation action');
assert.match(backend,/LockService\.getScriptLock\(\)/,'stock reservation is protected by a script lock');
assert.match(backend,/RESERVATION_STOCK_INSUFFICIENT/,'stock reservation rejects competing orders when free stock is insufficient');
assert.match(backend,/Inventory_Reservations/,'reservation records use a dedicated server-owned sheet');
assert.match(backend,/releaseSalesOrderReservation_/,'Owner can release an active Sales Order reservation');
assert.match(backend,/releaseTerminalSalesOrderReservations_\(ss, payload\.salesOrders, identity, true\)/,'terminal Sales Order status automatically releases active reservations');
assert.match(backend,/reconcileConsumedReservations_\(ss\)/,'fully consumed reservations are closed after stock issues sync');
assert.match(guard,/inventoryTransactions/,'owner sync includes inventory ledger');
assert.match(guard,/inventory/,'inventory navigation is Owner-only');
assert.match(guard,/reserveSalesOrderStock/,'authenticated client exposes verified reserve action');
assert.match(guard,/releaseSalesOrderReservation/,'authenticated client exposes verified release action');
assert.match(guard,/inventoryReservations = identity\.role === 'owner'/,'reservation state is read from cloud and never added to generic sync collections');
assert.match(html,/reserveSalesOrderStock: function/,'Business OS bridge exposes reservation actions to Inventory UI');
assert.match(ui,/renderReservationPanel/,'Inventory UI displays locked Sales Order reservations');
assert.match(ui,/Reservasi Stok Terkunci & Picking List/,'Inventory UI combines locked reservations with a production picking list');
assert.match(ui,/data-inv-action="pick-reservation"/,'each reserved material exposes a direct picking action');
assert.match(ui,/openReservationPick/,'picking action opens a prefilled issue transaction for the selected Sales Order');
assert.match(ui,/prefillReservationId/,'picking transaction preserves the exact server-issued reservation ID');
assert.match(ui,/data-pick-qty/,'picking action caps the suggested issue quantity to the remaining reservation and physical stock');
assert.match(ui,/maximumFractionDigits:4/,'stock quantities display the precision required by material conversion factors');
assert.match(ui,/step="0\.0001"/,'picking form accepts converted stock quantities to four decimal places');
assert.match(ui,/inv-sales-order/,'Inventory issue form supports Sales Order-linked material consumption');
assert.match(ui,/inv-reservation-id/,'Inventory issue form attaches the exact reservation row to each stock issue');
assert.match(inventoryEngineSource,/if\(\['issue','return','adjustment_out'\]\.indexOf\(input\.movement\)>=0\)/,'reservation stock invariant is also enforced for returns');
assert.match(ui,/returning\?Math\.max\(0,netIssued\):remaining/,'return form limits quantity to net material issued from the selected reservation');
assert.match(ui,/Retur ditautkan ke/,'return UI confirms that the material return is linked to the originating Sales Order');
assert.match(backend,/ReservationID/,'inventory ledger schema stores an immutable reservation reference');
assert.match(ui,/data-inv-action="reserve-so"/,'Owner can lock stock from the Inventory page');
assert.match(ui,/data-inv-action="release-so"/,'Owner can release an active stock reservation');
assert.match(ui,/canRelease=String\(order\.status\|\|'\'\)\.toLowerCase\(\)==='ready_production'/,'manual reservation release is limited to orders that have not started production');
assert.match(html,/id="page-inventory"/,'inventory page is mounted in Business OS');
assert.match(html,/CSKInventoryBridge/,'inventory uses internal Business OS bridge');
assert.match(html,/costSheets: db\.costSheets \|\| \[\], salesOrders: db\.salesOrders \|\| \[\]/,'inventory bridge supplies HPP and Sales Order data to the commitment monitor');
assert.match(ui,/validateTransaction/,'inventory UI validates transactions before save');
assert.match(ui,/openInventoryReceiptFromPO/,'inventory UI supports PO-linked receiving');
assert.match(ui,/calculateOpenSalesOrderCommitments/,'inventory UI calculates cross-project active Sales Order commitments');
assert.match(ui,/Komitmen Material Sales Order/,'inventory page shows the active production material commitment panel');
assert.match(ui,/Estimasi bebas/,'inventory page distinguishes physical stock from estimated free stock');
assert.match(ui,/Setiap pengeluaran ditautkan ke Sales Order dan ID reservasi yang tepat/,'inventory UI explains exact Sales Order and reservation linkage for each picking transaction');
assert.match(salesUI,/calculateHppRequirements/,'Sales Order material plan uses HPP and verified unit conversion');
assert.match(salesUI,/createDraftPOFromShortage/,'Sales Order can create supplier-grouped draft POs from HPP shortages');
assert.match(salesUI,/openPurchaseOrderQty/,'shortage planner subtracts quantities already covered by draft or ordered POs');
assert.match(salesUI,/Buat Draft PO dari Kekurangan/,'owner can start purchasing from the shortage panel');
assert.match(salesUI,/belum dikurangi reservasi order lain/,'material planner distinguishes physical stock from reservations');
assert.match(sw,/inventory-engine\.js/,'inventory engine is cached');
assert.match(sw,/inventory\.js/,'inventory UI is cached');
assert.match(auth,/INVENTORY_LEDGER_SERVER_ONLY/,'backend RBAC test covers append-only inventory protection');
console.log('CSK Inventory workflow and integration tests passed.');
