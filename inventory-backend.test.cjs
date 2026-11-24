'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

class FakeRange {
  constructor(sheet,row,col,numRows,numCols){this.sheet=sheet;this.row=row;this.col=col;this.numRows=numRows||1;this.numCols=numCols||1;}
  getValues(){const out=[];for(let r=0;r<this.numRows;r++){const source=this.sheet.rows[this.row-1+r]||[];out.push(Array.from({length:this.numCols},(_,c)=>source[this.col-1+c]===undefined?'':source[this.col-1+c]));}return out;}
  setValues(values){values.forEach((row,r)=>{const target=this.row-1+r;while(this.sheet.rows.length<=target)this.sheet.rows.push([]);row.forEach((v,c)=>{this.sheet.rows[target][this.col-1+c]=v;});});return this;}
  setValue(value){return this.setValues([[value]]);}
  setFontWeight(){return this;}
  setBackground(){return this;}
  setFontColor(){return this;}
}
class FakeSheet {
  constructor(rows){this.rows=(rows||[]).map(row=>row.slice());}
  getLastRow(){return this.rows.length;}
  getLastColumn(){return this.rows.reduce((max,row)=>Math.max(max,row.length),0);}
  getDataRange(){return new FakeRange(this,1,1,this.getLastRow(),this.getLastColumn());}
  getRange(row,col,numRows,numCols){return new FakeRange(this,row,col,numRows,numCols);}
  appendRow(row){this.rows.push(row.slice());}
  setFrozenRows(){}
}
class FakeSpreadsheet {
  constructor(sheets){this.sheets=sheets||{};}
  getSheetByName(name){return this.sheets[name]||null;}
  insertSheet(name){const sheet=new FakeSheet([]);this.sheets[name]=sheet;return sheet;}
}
const backend=fs.readFileSync('google_apps_script.js','utf8');
const context={Logger:{log(){}}};vm.createContext(context);vm.runInContext(backend,context);
const map=context.FIELD_MAP;
function rowFor(sheetName,record){
 const schema=map[sheetName];
 return schema.fields.map(field=>{
  if(field==='itemsJson'&&record.items)return JSON.stringify(record.items);
  if(field==='historyJson'&&record.history)return JSON.stringify(record.history);
  if(field==='materialRequirementsJson'&&record.materialRequirements)return JSON.stringify(record.materialRequirements);
  return record[field]===undefined?'':record[field];
 });
}
const material={id:'MAT-INV-001',name:'Akrilik Clear 3mm',unit:'m2',unitPrice:100000,updatedAt:'2026-11-20',sku:'ACR-03',status:'active'};
const project={id:'PRJ-INV-001',title:'Rak Display Custom',client:'PT Contoh',value:10000000,status:'plan'};
const otherProject={id:'PRJ-INV-002',title:'Booth Event Custom',client:'PT Contoh',value:5000000,status:'plan'};
const reservationOrder={
 id:'SO-INV-00000001',orderNo:'SO-CSK-2026-00001',projectId:project.id,
 projectName:project.title,status:'in_production',
 materialRequirements:[{materialId:material.id,name:material.name,unit:'m2',required:4}]
};
const po={id:'PO-INV-001',projectId:project.id,projectName:project.title,supplier:'Supplier A',date:'2026-11-19',itemsJson:JSON.stringify([{materialId:material.id,name:material.name,qty:4,unit:'m2',unitPrice:100000}]),total:400000,status:'ordered',inventoryControlVersion:1,createdAt:'2026-11-19T08:00:00.000Z',updatedAt:'2026-11-19T08:00:00.000Z'};
function fixture(){
 return new FakeSpreadsheet({
  Materials:new FakeSheet([map.Materials.headers,rowFor('Materials',material)]),
  Projects:new FakeSheet([map.Projects.headers,rowFor('Projects',project),rowFor('Projects',otherProject)]),
  Purchase_Orders:new FakeSheet([map.Purchase_Orders.headers,rowFor('Purchase_Orders',po)]),
  Sales_Orders:new FakeSheet([map.Sales_Orders.headers]),
  Inventory_Transactions:new FakeSheet([map.Inventory_Transactions.headers]),
  Cost_Sheets:new FakeSheet([map.Cost_Sheets.headers])
 });
}
function transaction(id,no,movement,qty,date,extra){
 var source=movement==='opening'?'opening_manual':movement==='receipt'?(extra&&extra.purchaseOrderId?'purchase_order':'manual_receipt'):movement==='adjustment_in'?'opening_manual':movement==='return'?'project_issue_average':'moving_average';
 var reference=movement==='opening'?'OPENING-VALUATION-'+id:movement==='receipt'&&!(extra&&extra.purchaseOrderId)?'SUPPLIER-INVOICE-'+id:movement==='adjustment_in'?'ADJUSTMENT-VALUATION-'+id:'';
 var cost=100000;
 return Object.assign({
  id:'ITX-'+id,transactionNo:no,materialId:material.id,materialName:material.name,
  movement:movement,qty:qty,unit:'m2',date:date,projectId:'',projectName:'',
  purchaseOrderId:'',supplier:'',unitCost:cost,totalCost:Math.round(qty*cost),costSource:source,costingMethod:'moving_average',
  reference:reference,notes:'',createdAt:date+'T08:00:00.000Z',createdBy:'owner@example.test'
 },extra||{});
}

const opening=transaction('INV-00000001','STK-CSK-2026-00001','opening',5,'2026-11-01');
const undocumentedOpening=transaction('INV-OPEN-UNVERIFIED','STK-CSK-2026-00040','opening',5,'2026-11-01',{costSource:'master_fallback',reference:''});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[undocumentedOpening]),/INVALID_INVENTORY_COST_SNAPSHOT/,'backend rejects opening stock valued only from the current Master planning price');
const openingWithoutReference=transaction('INV-OPEN-NOREF','STK-CSK-2026-00041','opening',5,'2026-11-01',{reference:''});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[openingWithoutReference]),/INVENTORY_COST_REFERENCE_REQUIRED/,'opening valuation requires a source document or valuation basis');
const undocumentedReceipt=transaction('INV-RECEIPT-UNVERIFIED','STK-CSK-2026-00042','receipt',1,'2026-11-03',{supplier:'Supplier A',costSource:'master_fallback'});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[undocumentedReceipt]),/INVALID_INVENTORY_COST_SNAPSHOT/,'new supplier receipts cannot silently use the Master planning price as actual cost');
function stockedFixture(qty){
 const ss=fixture();
 const balance=transaction('INV-STOCK-OPEN1','STK-CSK-2026-00020','opening',qty,'2026-11-01');
 ss.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',balance));
 return ss;
}
let reservedStock=stockedFixture(5);
const backdatedMovement=transaction('INV-BACKDATED-0001','STK-CSK-2026-00043','receipt',1,'2026-10-31',{supplier:'Supplier A'});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(stockedFixture(5),[backdatedMovement]),/INVENTORY_TRANSACTION_BACKDATED/,'backend rejects backdated stock transactions that would alter historical weighted-average costs');
const reservedIssue=transaction('INV-RESERVED-ISSUE1','STK-CSK-2026-00021','issue',2,'2026-11-03',{projectId:project.id,projectName:project.title,costSource:'moving_average'});
assert.equal(context.validateInventoryTransactionsBeforeMerge_(reservedStock,[reservedIssue],[],[reservationOrder]),true,'project may issue material within its own reservation');
const issueAtWrongCost=transaction('INV-RESERVED-BADCOST','STK-CSK-2026-00025','issue',2,'2026-11-03',{
 projectId:project.id,projectName:project.title,unitCost:125000,totalCost:250000,costSource:'moving_average'
});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(stockedFixture(5),[issueAtWrongCost],[],[reservationOrder]),/INVENTORY_COST_SNAPSHOT_MISMATCH/,'backend rejects a project issue cost that differs from the current moving weighted average');
const receiptAtWrongPOCost=transaction('INV-PO-BADCOST','STK-CSK-2026-00026','receipt',1,'2026-11-03',{
 purchaseOrderId:po.id,supplier:po.supplier,unitCost:125000,totalCost:125000,costSource:'purchase_order'
});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[receiptAtWrongPOCost]),/INVENTORY_COST_SNAPSHOT_MISMATCH/,'backend enforces the unit cost recorded on the supplier Purchase Order');
const excessProjectIssue=transaction('INV-RESERVED-ISSUE2','STK-CSK-2026-00022','issue',5,'2026-11-03',{projectId:project.id,projectName:project.title,costSource:'moving_average'});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(stockedFixture(5),[excessProjectIssue],[],[reservationOrder]),/INVENTORY_ISSUE_EXCEEDS_PROJECT_RESERVATION/,'project cannot issue more than its remaining HPP reservation');
const unreservedProjectIssue=transaction('INV-RESERVED-ISSUE3','STK-CSK-2026-00023','issue',2,'2026-11-03',{projectId:otherProject.id,projectName:otherProject.title,costSource:'moving_average'});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(stockedFixture(5),[unreservedProjectIssue],[],[reservationOrder]),/INVENTORY_MOVEMENT_BREACHES_RESERVATION/,'another project cannot consume stock reserved to an active production order');
const reservedAdjustment=transaction('INV-RESERVED-ADJ01','STK-CSK-2026-00024','adjustment_out',2,'2026-11-03',{notes:'Selisih stock opname',costSource:'moving_average'});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(stockedFixture(5),[reservedAdjustment],[],[reservationOrder]),/INVENTORY_ADJUSTMENT_BREACHES_RESERVATION/,'stock adjustment cannot reduce stock below active project reservations');
const returnCostFixture=stockedFixture(10);
const issuedAtOldCost=transaction('INV-RETURN-ISSUE1','STK-CSK-2026-00030','issue',5,'2026-11-02',{
 projectId:project.id,projectName:project.title,costSource:'moving_average'
});
const laterReceipt=transaction('INV-RETURN-RECEIPT1','STK-CSK-2026-00031','receipt',10,'2026-11-03',{
 supplier:'Supplier B',unitCost:200000,totalCost:2000000,costSource:'manual_receipt'
});
returnCostFixture.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',issuedAtOldCost));
returnCostFixture.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',laterReceipt));
const validReturnAtIssueCost=transaction('INV-RETURN-VALID1','STK-CSK-2026-00032','return',2,'2026-11-04',{
 projectId:project.id,projectName:project.title,unitCost:100000,totalCost:200000,costSource:'project_issue_average'
});
assert.equal(context.validateInventoryTransactionsBeforeMerge_(returnCostFixture,[validReturnAtIssueCost]),true,'project return is valued at the original weighted-average issue cost after a later receipt changes stock average');
const invalidReturnAtCurrentAverage=transaction('INV-RETURN-INVALID1','STK-CSK-2026-00033','return',2,'2026-11-04',{
 projectId:project.id,projectName:project.title,unitCost:166666.67,totalCost:333333,costSource:'moving_average'
});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(returnCostFixture,[invalidReturnAtCurrentAverage]),/INVENTORY_COST_SNAPSHOT_MISMATCH/,'backend rejects a return valued at the newer warehouse average instead of its original issue cost');
const releasedOrder=Object.assign({},reservationOrder,{status:'quality_check'});
assert.equal(context.validateInventoryTransactionsBeforeMerge_(stockedFixture(5),[unreservedProjectIssue],[],[releasedOrder]),true,'QC releases unissued material back to available stock');
let ss=fixture();
assert.equal(context.validateInventoryTransactionsBeforeMerge_(ss,[opening]),true,'valid opening balance can be recorded');
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[{...opening,reference:''}]),/INVENTORY_COST_REFERENCE_REQUIRED/,'opening cost requires a source document or valuation reference');
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[{...opening,unitCost:0,totalCost:0}]),/INVALID_INVENTORY_COST_SNAPSHOT/,'new stock movements cannot be saved without a valid unit and total cost snapshot');
const manualReceiptNoReference=transaction('INV-MISSING-REF','STK-CSK-2026-00034','receipt',1,'2026-11-20',{supplier:'Supplier A',reference:''});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[manualReceiptNoReference]),/INVENTORY_COST_REFERENCE_REQUIRED/,'manual supplier receipt requires a verifiable document reference');
ss.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',opening));
assert.equal(context.validateInventoryTransactionsBeforeMerge_(ss,[opening]),true,'unchanged existing ledger rows remain syncable');
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(ss,[{...opening,qty:6}]),/INVENTORY_TRANSACTION_IMMUTABLE/,'existing stock transactions cannot be edited');

const wacOpening=transaction('INV-WAC-OPEN01','STK-CSK-2026-00101','opening',10,'2026-11-01',{unitCost:100000,totalCost:1000000});
const wacReceipt=transaction('INV-WAC-REC01','STK-CSK-2026-00102','receipt',10,'2026-11-02',{supplier:'Supplier C',unitCost:200000,totalCost:2000000,costSource:'manual_receipt'});
const wacIssue=transaction('INV-WAC-ISS01','STK-CSK-2026-00103','issue',5,'2026-11-03',{projectId:project.id,projectName:project.title,unitCost:150000,totalCost:750000,costSource:'moving_average'});
assert.equal(context.validateInventoryTransactionsBeforeMerge_(fixture(),[wacOpening,wacReceipt,wacIssue]),true,'server accepts a sequence of documented movements using the recalculated moving weighted average');
const wacServer=context.calculateInventoryValuationServer_([material],[wacOpening,wacReceipt,wacIssue]);
assert.equal(wacServer.stockValue[material.id],2250000);
assert.equal(wacServer.averageCost[material.id],150000);
assert.equal(wacServer.estimated[material.id],false,'documented purchase costs are not marked as estimated');

const secondOpening=transaction('INV-00000002','STK-CSK-2026-00002','opening',2,'2026-11-02');
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(ss,[opening,secondOpening]),/INVENTORY_OPENING_ALREADY_EXISTS/,'one opening balance is allowed per material');

const issue=transaction('INV-00000003','STK-CSK-2026-00003','issue',6,'2026-11-03',{projectId:project.id,projectName:project.title,costSource:'master_fallback'});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[issue]),/INVENTORY_INSUFFICIENT_STOCK/,'negative inventory is blocked');
const issueNoProject=transaction('INV-00000004','STK-CSK-2026-00004','issue',1,'2026-11-03');
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[issueNoProject]),/INVENTORY_PROJECT_REQUIRED/,'project issue must be linked to a real project');

const wrongUnit=transaction('INV-00000005','STK-CSK-2026-00005','receipt',1,'2026-11-03',{supplier:'Supplier A',unit:'lembar'});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[wrongUnit]),/INVENTORY_UNIT_MISMATCH/,'stock movement must use the material stock unit');
const adjustment=transaction('INV-00000006','STK-CSK-2026-00006','adjustment_out',1,'2026-11-03');
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[adjustment]),/INVENTORY_ADJUSTMENT_REASON_REQUIRED/,'stock adjustment requires a reason');
const badDate=transaction('INV-00000007','STK-CSK-2026-00007','receipt',1,'2026-02-30',{supplier:'Supplier A'});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[badDate]),/INVALID_INVENTORY_DATE/,'invalid calendar dates are rejected');

const receipt=transaction('INV-00000008','STK-CSK-2026-00008','receipt',3,'2026-11-20',{purchaseOrderId:po.id,supplier:po.supplier});
ss=fixture();
assert.equal(context.validateInventoryTransactionsBeforeMerge_(ss,[receipt]),true,'receipt within PO quantity is accepted');
ss.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',receipt));
const overReceipt=transaction('INV-00000009','STK-CSK-2026-00009','receipt',2,'2026-11-21',{purchaseOrderId:po.id,supplier:po.supplier});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(ss,[receipt,overReceipt]),/INVENTORY_RECEIPT_EXCEEDS_PURCHASE_ORDER/,'cumulative PO receipts cannot exceed ordered quantity');

const draftPoFixture=fixture();
draftPoFixture.sheets.Purchase_Orders.rows[1][map.Purchase_Orders.fields.indexOf('status')]='draft';
const draftPoReceipt=transaction('INV-00000010','STK-CSK-2026-00010','receipt',1,'2026-11-20',{purchaseOrderId:po.id,supplier:po.supplier});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(draftPoFixture,[draftPoReceipt]),/INVENTORY_PURCHASE_ORDER_NOT_READY_FOR_RECEIPT/,'draft PO cannot be received');

const legacyFixture=fixture();
legacyFixture.sheets.Purchase_Orders.rows[1][map.Purchase_Orders.fields.indexOf('inventoryControlVersion')]=0;
const legacyReceivedPO={...po,status:'received',inventoryControlVersion:0,items:[{materialId:material.id,qty:4,unit:'m2'}]};
assert.equal(context.validatePurchaseOrderReceiptStatuses_(legacyFixture,[legacyReceivedPO],[]),true,'legacy received POs without inventory version do not block first sync');
const receivedPO={...po,status:'received',items:[{materialId:material.id,qty:4,unit:'m2'}]};
assert.throws(()=>context.validatePurchaseOrderReceiptStatuses_(fixture(),[receivedPO],[]),/PURCHASE_ORDER_RECEIPT_INCOMPLETE/,'PO cannot be marked received before all stock is received');
const fullPOReceipt=transaction('INV-PO-FULL-0001','STK-CSK-2026-00011','receipt',4,'2026-11-20',{purchaseOrderId:po.id,supplier:po.supplier});
assert.equal(context.validatePurchaseOrderReceiptStatuses_(fixture(),[receivedPO],[fullPOReceipt]),true,'fully received PO can be marked received');
const cancelledPO={...po,status:'cancelled',items:[{materialId:material.id,qty:4,unit:'m2'}]};
assert.throws(()=>context.validatePurchaseOrderReceiptStatuses_(fixture(),[cancelledPO],[fullPOReceipt]),/PURCHASE_ORDER_CANNOT_CANCEL_AFTER_RECEIPT/,'PO cannot be cancelled after stock receipt');

const receiptFirst=transaction('INV-00000011','STK-CSK-2026-00011','receipt',2,'2026-11-01',{supplier:'Supplier A'});
const openingLater=transaction('INV-00000012','STK-CSK-2026-00012','opening',5,'2026-11-02');
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[receiptFirst,openingLater]),/INVENTORY_OPENING_MUST_BE_FIRST/,'opening balance cannot be entered after stock movements');

console.log('CSK Inventory backend validation tests passed.');
