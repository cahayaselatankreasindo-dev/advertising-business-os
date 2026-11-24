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
 const extras=extra||{};
 const defaultCostSource=['issue','return','adjustment_out'].includes(movement)?'moving_average':
   movement==='receipt'&&extras.purchaseOrderId?'purchase_order':'master_fallback';
 return Object.assign({
  id:'ITX-'+id,transactionNo:no,materialId:material.id,materialName:material.name,
  movement:movement,qty:qty,unit:'m2',date:date,projectId:'',projectName:'',
  purchaseOrderId:'',supplier:'',unitCost:100000,totalCost:Math.round(qty*100000),
  costSource:defaultCostSource,costingMethod:'moving_average',reference:'',notes:'',
  createdAt:date+'T08:00:00.000Z',createdBy:'owner@example.test'
 },extras);
}
const opening=transaction('INV-00000001','STK-CSK-2026-00001','opening',5,'2026-11-01');
function stockedFixture(qty){
 const ss=fixture();
 const balance=transaction('INV-STOCK-OPEN1','STK-CSK-2026-00020','opening',qty,'2026-11-01');
 ss.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',balance));
 return ss;
}
let reservedStock=stockedFixture(5);
const reservedIssue=transaction('INV-RESERVED-ISSUE1','STK-CSK-2026-00021','issue',2,'2026-11-03',{projectId:project.id,projectName:project.title});
assert.equal(context.validateInventoryTransactionsBeforeMerge_(reservedStock,[reservedIssue],[],[reservationOrder]),true,'project may issue material within its own reservation');
const excessProjectIssue=transaction('INV-RESERVED-ISSUE2','STK-CSK-2026-00022','issue',5,'2026-11-03',{projectId:project.id,projectName:project.title});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(stockedFixture(5),[excessProjectIssue],[],[reservationOrder]),/INVENTORY_ISSUE_EXCEEDS_PROJECT_RESERVATION/,'project cannot issue more than its remaining HPP reservation');
const unreservedProjectIssue=transaction('INV-RESERVED-ISSUE3','STK-CSK-2026-00023','issue',2,'2026-11-03',{projectId:otherProject.id,projectName:otherProject.title});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(stockedFixture(5),[unreservedProjectIssue],[],[reservationOrder]),/INVENTORY_MOVEMENT_BREACHES_RESERVATION/,'another project cannot consume stock reserved to an active production order');
const reservedAdjustment=transaction('INV-RESERVED-ADJ01','STK-CSK-2026-00024','adjustment_out',2,'2026-11-03',{notes:'Selisih stock opname'});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(stockedFixture(5),[reservedAdjustment],[],[reservationOrder]),/INVENTORY_ADJUSTMENT_BREACHES_RESERVATION/,'stock adjustment cannot reduce stock below active project reservations');
const releasedOrder=Object.assign({},reservationOrder,{status:'quality_check'});
assert.equal(context.validateInventoryTransactionsBeforeMerge_(stockedFixture(5),[unreservedProjectIssue],[],[releasedOrder]),true,'QC releases unissued material back to available stock');
let ss=fixture();
assert.equal(context.validateInventoryTransactionsBeforeMerge_(ss,[opening]),true,'valid opening balance can be recorded');
ss.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',opening));
assert.equal(context.validateInventoryTransactionsBeforeMerge_(ss,[opening]),true,'unchanged existing ledger rows remain syncable');
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(ss,[{...opening,qty:6}]),/INVENTORY_TRANSACTION_IMMUTABLE/,'existing stock transactions cannot be edited');

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
