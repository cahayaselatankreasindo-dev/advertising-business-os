'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('./inventory-engine');

const materials=[
 {id:'MAT-ACR',name:'Akrilik Clear 3mm',unit:'m2',unitPrice:100000,sku:'ACR-03',status:'active'},
 {id:'MAT-HOL',name:'Hollow 2x2',unit:'m',unitPrice:50000,sku:'HOL-22',status:'active'}
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

const pricedMaterial={id:'MAT-PRICE',name:'Akrilik Lembaran',unit:'m2',unitPrice:100000,purchaseUnit:'lembar',conversionFactor:3};
const pricedHpp=E.calculateHppRequirements({items:[{
 itemType:'material',materialId:'MAT-PRICE',qty:2,unit:'lembar',unitPrice:300000,subtotal:600000
}]},[pricedMaterial],{});
assert.equal(pricedHpp.requirements[0].required,6,'HPP purchase-unit quantity converts into six stock square metres');
assert.equal(pricedHpp.requirements[0].estimatedTotalCost,600000,'estimated material cost preserves the HPP line subtotal');
assert.equal(pricedHpp.requirements[0].estimatedUnitCost,100000,'estimated unit cost is normalized to the material stock unit');
const unpricedHpp=E.calculateHppRequirements({items:[{
 itemType:'material',materialId:'MAT-PRICE',qty:2,unit:'lembar'
}]},[pricedMaterial],{});
assert.equal(unpricedHpp.requirements[0].estimatedTotalCost,null,'missing HPP price is not silently treated as zero cost');
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
assert.equal(created.transaction.unitCost,100000,'project issue uses the current moving-average cost per stock unit');
assert.equal(created.transaction.totalCost,100000,'issue cost snapshot is stored on the append-only ledger');
assert.equal(created.transaction.costingMethod,'moving_average');
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'receipt',qty:1,unit:'m2',date:'2026-11-12',supplier:'Supplier A',unitCost:120000,reference:'FAKTUR-BACKDATED'
},{materials,projects,transactions:ledger}),/Tanggal transaksi tidak boleh lebih awal/,'backdated stock entries cannot rewrite historical moving-average costs');

assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'opening',qty:2,unit:'m2',date:'2026-11-15',reference:'OPEN-001'
},{materials,projects,transactions:[]}),/Masukkan harga pokok saldo awal/,'opening stock requires an explicitly verified cost');
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'opening',qty:2,unit:'m2',date:'2026-11-15',unitCost:90000
},{materials,projects,transactions:[]}),/dokumen atau dasar penilaian/,'opening valuation requires a source reference');
const openingManual=E.validateTransaction({
 materialId:'MAT-ACR',movement:'opening',qty:2,unit:'m2',date:'2026-11-15',unitCost:90000,reference:'OPEN-VALUATION-001'
},{materials,projects,transactions:[]});
assert.equal(openingManual.transaction.costSource,'opening_manual');
assert.equal(openingManual.transaction.totalCost,180000);
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'receipt',qty:1,unit:'m2',date:'2026-11-15',supplier:'Supplier A'
},{materials,projects,transactions:[]}),/Masukkan harga pokok penerimaan/,'manual receipts require verified supplier invoice cost');
assert.throws(()=>E.validateTransaction({
 materialId:'MAT-ACR',movement:'receipt',qty:1,unit:'m2',date:'2026-11-15',supplier:'Supplier A',unitCost:120000
},{materials,projects,transactions:[]}),/Nomor nota, faktur/,'manual receipts require a supplier document reference');
const manualReceipt=E.validateTransaction({
 materialId:'MAT-ACR',movement:'receipt',qty:1,unit:'m2',date:'2026-11-15',supplier:'Supplier A',unitCost:120000,reference:'FAKTUR-001'
},{materials,projects,transactions:[]});
assert.equal(manualReceipt.transaction.costSource,'manual_receipt');
assert.equal(manualReceipt.transaction.totalCost,120000);

const valuationMaterials=[{id:'MAT-WAC',name:'Material WAC',unit:'m2',unitPrice:999}];
const valuationLedger=[
 {id:'WAC-OPEN',materialId:'MAT-WAC',movement:'opening',qty:10,unit:'m2',date:'2026-11-01',unitCost:100,totalCost:1000,costSource:'opening_manual',costingMethod:'moving_average'},
 {id:'WAC-RECEIPT',materialId:'MAT-WAC',movement:'receipt',qty:10,unit:'m2',date:'2026-11-02',unitCost:200,totalCost:2000,costSource:'manual_receipt',costingMethod:'moving_average'},
 {id:'WAC-ISSUE',materialId:'MAT-WAC',movement:'issue',qty:5,unit:'m2',date:'2026-11-03',projectId:'PRJ-WAC',unitCost:150,totalCost:750,costSource:'moving_average',costingMethod:'moving_average'}
];
const valuation=E.calculateInventoryValuation(valuationMaterials,valuationLedger);
assert.equal(valuation.balances['MAT-WAC'],15);
assert.equal(valuation.stockValue['MAT-WAC'],2250);
assert.equal(valuation.averageCost['MAT-WAC'],150,'moving weighted average recalculates after a supplier receipt and material issue');
const costVariance=E.calculateMaterialCostVariance(
 [{materialId:'MAT-WAC',name:'Material WAC',unit:'m2',required:10,estimatedTotalCost:1200}],
 'PRJ-WAC',valuationLedger
);
assert.equal(costVariance.estimatedTotalCost,1200);
assert.equal(costVariance.actualTotalCost,750);
assert.equal(costVariance.varianceCost,-450);
assert.equal(costVariance.complete,true,'actual-versus-estimated material cost is complete when all unit-cost snapshots and HPP estimates exist');
const returnCostMaterials=[{id:'MAT-RET',name:'Material Retur',unit:'m2',unitPrice:999}];
const returnCostProjects=[{id:'PRJ-RET',title:'Project Return Cost'}];
const returnCostLedger=[
 {id:'RET-OPEN',materialId:'MAT-RET',movement:'opening',qty:10,unit:'m2',date:'2026-11-01',unitCost:100,totalCost:1000,costSource:'opening_manual',costingMethod:'moving_average'},
 {id:'RET-ISSUE',materialId:'MAT-RET',movement:'issue',qty:5,unit:'m2',date:'2026-11-02',projectId:'PRJ-RET',unitCost:100,totalCost:500,costSource:'moving_average',costingMethod:'moving_average'},
 {id:'RET-RECEIPT',materialId:'MAT-RET',movement:'receipt',qty:10,unit:'m2',date:'2026-11-03',unitCost:200,totalCost:2000,costSource:'manual_receipt',costingMethod:'moving_average'}
];
const returnedAtIssueCost=E.validateTransaction({
 materialId:'MAT-RET',movement:'return',qty:2,unit:'m2',date:'2026-11-04',projectId:'PRJ-RET'
},{materials:returnCostMaterials,projects:returnCostProjects,transactions:returnCostLedger});
assert.equal(returnedAtIssueCost.transaction.unitCost,100,'project return reverses the weighted-average cost recorded when the material was issued');
assert.equal(returnedAtIssueCost.transaction.totalCost,200);
assert.equal(returnedAtIssueCost.transaction.costSource,'project_issue_average');
const returnValuation=E.calculateInventoryValuation(returnCostMaterials,returnCostLedger.concat([returnedAtIssueCost.transaction]));
assert.equal(returnValuation.balances['MAT-RET'],17);
assert.equal(returnValuation.stockValue['MAT-RET'],2700,'return restores the original issue cost, not the newer average after a later receipt');
const returnCostVariance=E.calculateMaterialCostVariance(
 [{materialId:'MAT-RET',name:'Material Retur',unit:'m2',required:5,estimatedTotalCost:500}],
 'PRJ-RET',returnCostLedger.concat([returnedAtIssueCost.transaction])
);
assert.equal(returnCostVariance.actualTotalCost,300,'project actual material cost nets returns at their original issue value');

const legacyCostMaterial=[{id:'MAT-LEGACY',name:'Legacy Stock',unit:'pcs',unitPrice:2500}];
const legacyCostLedger=[
 {id:'LEGACY-OPEN',materialId:'MAT-LEGACY',movement:'opening',qty:10,unit:'pcs',date:'2026-11-01'},
 {id:'LEGACY-ISSUE',materialId:'MAT-LEGACY',movement:'issue',qty:3,unit:'pcs',date:'2026-11-02',projectId:'PRJ-LEGACY'}
];
const legacyCostVariance=E.calculateMaterialCostVariance(
 [{materialId:'MAT-LEGACY',name:'Legacy Stock',unit:'pcs',required:5,estimatedTotalCost:12500}],
 'PRJ-LEGACY',legacyCostLedger,legacyCostMaterial
);
assert.equal(legacyCostVariance.actualTotalCost,7500,'legacy issues are valued using the replayed moving average when the Master Material cost is available');
assert.equal(legacyCostVariance.estimated,true,'legacy master fallback is clearly marked as estimated');
assert.equal(legacyCostVariance.complete,true,'fallback valuation is complete but explicitly estimated');

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

const po={id:'PO-001',supplier:'Supplier A',status:'ordered',items:[{materialId:'MAT-ACR',qty:4,unit:'m2',unitPrice:100000}]};
const poReceipt=E.validateTransaction({
 materialId:'MAT-ACR',movement:'receipt',qty:2,unit:'m2',date:'2026-11-20',
 purchaseOrderId:'PO-001'
},{materials,projects,purchaseOrders:[po],transactions:[]});
assert.equal(poReceipt.transaction.purchaseOrderId,'PO-001');
assert.equal(poReceipt.transaction.costSource,'purchase_order');
assert.equal(poReceipt.transaction.unitCost,100000);
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
assert.equal(commitments.activeOrderCount,2,'only ready-production and in-production Sales Orders hold material reservations; QC releases them');
assert.equal(commitments.activeProjectCount,2,'multiple active Sales Orders for one project do not duplicate the project HPP');
assert.equal(commitments.pickingList.length,3,'picking list contains outstanding requirements per active project and material');
assert.equal(commitments.ready,true);
const acrylicCommitment=commitments.requirements.find(x=>x.materialId==='MAT-ACR');
assert.ok(Math.abs(acrylicCommitment.committed-5.25)<1e-9,'purchase-unit conversion and net issue/return movements determine remaining material commitment');
assert.ok(Math.abs(acrylicCommitment.availableAfterCommitments-0.75)<1e-9);
assert.equal(acrylicCommitment.shortage,0);
const hollowCommitment=commitments.requirements.find(x=>x.materialId==='MAT-HOL');
assert.equal(hollowCommitment.committed,3,'project issues reduce outstanding material commitment');
assert.equal(hollowCommitment.availableAfterCommitments,1);

const reservationSnapshot=[{materialId:'MAT-ACR',name:'Akrilik Clear 3mm',unit:'m2',required:5}];
const reservationLedger=[
 {...tx('00000020','STK-CSK-2026-00020','opening',10,'2026-11-01'),materialId:'MAT-ACR'},
 {...tx('00000021','STK-CSK-2026-00021','issue',1,'2026-11-02',{projectId:'PRJ-001'}),materialId:'MAT-ACR'},
 {...tx('00000022','STK-CSK-2026-00022','return',0.25,'2026-11-03',{projectId:'PRJ-001'}),materialId:'MAT-ACR'}
];
const reservedOrders=[{id:'SO-RESERVED-001',orderNo:'SO-CSK-2026-00001',projectId:'PRJ-001',projectName:'Project A',status:'in_production',materialRequirements:reservationSnapshot}];
assert.throws(()=>E.validateTransaction({materialId:'MAT-ACR',movement:'issue',qty:4.5,unit:'m2',date:'2026-11-04',projectId:'PRJ-001'},{materials,projects,transactions:reservationLedger,salesOrders:reservedOrders,costSheets:[]}),/melebihi sisa reservasi/,'project issue cannot exceed its active HPP reservation');
const picked=E.validateTransaction({materialId:'MAT-ACR',movement:'issue',qty:4,unit:'m2',date:'2026-11-04',projectId:'PRJ-001'},{materials,projects,transactions:reservationLedger,salesOrders:reservedOrders,costSheets:[]});
assert.equal(picked.balances['MAT-ACR'],5.25,'valid picking reduces physical stock');
const variance=E.calculateMaterialUsageVariance(reservationSnapshot,'PRJ-001',reservationLedger);
assert.equal(variance[0].netIssuedQty,0.75,'material variance nets project returns against issued quantity');
assert.equal(variance[0].varianceQty,-4.25,'material variance compares net project issue against frozen HPP quantity');
assert.equal(variance[0].state,'under','remaining material requirement is reported as under-plan until production consumption is complete');
assert.throws(()=>E.validateTransaction({materialId:'MAT-ACR',movement:'issue',qty:6,unit:'m2',date:'2026-11-04',projectId:'PRJ-003'},{materials,projects:projects.concat([{id:'PRJ-003',title:'Awaiting DP'}]),transactions:reservationLedger,salesOrders:reservedOrders,costSheets:[]}),/sudah direservasi proyek lain/,'an unreserved project cannot consume stock held for another production project');
assert.throws(()=>E.validateTransaction({materialId:'MAT-ACR',movement:'return',qty:1,unit:'m2',date:'2026-11-04',projectId:'PRJ-001'},{materials,projects,transactions:reservationLedger,salesOrders:reservedOrders,costSheets:[]}),/Retur melebihi material/,'project return cannot exceed previously issued material');

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


const engineSource=fs.readFileSync('inventory-engine.js','utf8');
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
assert.match(backend,/INVENTORY_ISSUE_EXCEEDS_PROJECT_RESERVATION/,'backend caps material picking to the active project reservation');
assert.match(backend,/INVENTORY_MOVEMENT_BREACHES_RESERVATION/,'backend prevents other projects from consuming reserved stock');
assert.match(backend,/validatePurchaseOrderReceiptStatuses_/,'backend validates PO completion against inventory receipts');
assert.match(backend,/PURCHASE_ORDER_RECEIPT_INCOMPLETE/,'new versioned POs cannot be marked received before all items are received');
assert.match(backend,/inventoryControlVersion/,'legacy Purchase Orders remain compatible while new POs require receipt control');
assert.match(backend,/INVENTORY_LEDGER_SERVER_ONLY/,'direct insert and delete are blocked');
assert.match(guard,/inventoryTransactions/,'owner sync includes inventory ledger');
assert.match(guard,/inventory/,'inventory navigation is Owner-only');
assert.match(html,/id="page-inventory"/,'inventory page is mounted in Business OS');
assert.match(html,/CSKInventoryBridge/,'inventory uses internal Business OS bridge');
assert.match(ui,/validateTransaction/,'inventory UI validates transactions before save');
assert.match(ui,/inv-unit-cost/,'inventory UI captures purchase and opening stock unit cost');
assert.match(ui,/unitCost:/,'inventory UI passes unit-cost snapshots into the ledger');
assert.match(ui,/input.required=manualRequired/,'manual opening and receipt costs are required in the inventory form');
assert.match(ui,/reference.required=referenceRequired/,'manual inventory costs require a document reference in the UI');
assert.match(ui,/Moving Weighted Average/,'inventory stock valuation is labelled with its costing method');
assert.match(ui,/Nilai stok/,'inventory balances display the monetary value of stock');
assert.match(backend,/INVALID_INVENTORY_COST_SNAPSHOT/,'server rejects missing or malformed inventory cost snapshots');
assert.match(ui,/openInventoryReceiptFromPO/,'inventory UI supports PO-linked receiving');
assert.match(ui,/calculateOpenSalesOrderCommitments/,'inventory UI calculates cross-project active Sales Order commitments');
assert.match(ui,/calculateInventoryValuation/,'inventory UI calculates moving-average stock valuation');
assert.match(engineSource,/Tanggal transaksi tidak boleh lebih awal/,'client engine prevents backdated stock valuation changes');
assert.match(backend,/INVENTORY_TRANSACTION_BACKDATED/,'Apps Script independently rejects backdated stock movements');
assert.match(ui,/Nilai persediaan · WAC/,'inventory dashboard shows indicative inventory value');
assert.match(ui,/Biaya rata-rata \/ unit/,'inventory dashboard shows moving-average unit cost');
assert.match(ui,/Sumber biaya/,'inventory ledger exposes the source of each cost snapshot');
assert.match(backend,/opening:\["opening_manual"\]/,'backend requires a documented cost basis for opening balances');
assert.match(backend,/receipt:\["purchase_order","manual_receipt"\]/,'backend rejects undocumented fallback pricing for new supplier receipts');
assert.match(ui,/Reservasi Material & Picking List/,'inventory page shows locked material reservations and production picking list');
assert.match(ui,/Stok tersedia/,'inventory page distinguishes physical stock from stock available after reservations');
assert.match(ui,/data-inv-action="pick"/,'inventory picking list can prefill a project-linked stock issue');
assert.match(ui,/applyPickingPrefill/,'picking action opens a prefilled issue transaction');
assert.match(ui,/sisa reservasi/,'picking form displays the remaining project reservation');
assert.match(salesUI,/calculateHppRequirements/,'Sales Order material plan uses HPP and verified unit conversion');
assert.match(salesUI,/createDraftPOFromShortage/,'Sales Order can create supplier-grouped draft POs from HPP shortages');
assert.match(salesUI,/openPurchaseOrderQty/,'shortage planner subtracts quantities already covered by draft or ordered POs');
assert.match(salesUI,/Buat Draft PO dari Kekurangan/,'owner can start purchasing from the shortage panel');
assert.match(salesUI,/Reservasi lain/,'Sales Order material planner deducts stock reserved by other production projects');
assert.match(salesUI,/Selisih vs HPP/,'Sales Order shows net material issue variance against the frozen HPP plan');
assert.match(salesUI,/calculateMaterialCostVariance/,'Sales Order compares material issue costs with frozen HPP estimates');
assert.match(salesUI,/Biaya material tercatat/,'Sales Order shows recorded material cost without claiming supplier invoice reconciliation is complete');
assert.match(salesUI,/Moving Weighted Average/,'Sales Order identifies the inventory valuation method used for recorded material cost');
assert.match(salesUI,/belum menggantikan rekonsiliasi faktur supplier/,'Sales Order discloses that PO pricing is not supplier invoice matching');
assert.match(sw,/inventory-engine\.js/,'inventory engine is cached');
assert.match(sw,/inventory\.js/,'inventory UI is cached');
assert.match(auth,/INVENTORY_LEDGER_SERVER_ONLY/,'backend RBAC test covers append-only inventory protection');
console.log('CSK Inventory workflow and integration tests passed.');
