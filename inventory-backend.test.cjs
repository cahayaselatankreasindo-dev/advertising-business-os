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
let uuidCounter=0;
const context={Logger:{log(){}},Utilities:{getUuid(){uuidCounter++;return '00000000-0000-4000-8000-'+String(uuidCounter).padStart(12,'0');},formatDate(date,zone,format){return '2026-11-25';}},Session:{getScriptTimeZone(){return 'UTC';}},LockService:{getScriptLock(){return{waitLock(){},releaseLock(){}};}}};vm.createContext(context);vm.runInContext(backend,context);
const map=context.FIELD_MAP;
function rowFor(sheetName,record){
 const schema=map[sheetName];
 return schema.fields.map(field=>{
  if(field==='itemsJson'&&record.items)return JSON.stringify(record.items);
  if(field==='sourceCostSheetSnapshotJson'&&record.sourceCostSheetSnapshot)return JSON.stringify(record.sourceCostSheetSnapshot);
  return record[field]===undefined?'':record[field];
 });
}
const material={id:'MAT-INV-001',name:'Akrilik Clear 3mm',unit:'m2',unitPrice:100000,updatedAt:'2026-11-20',sku:'ACR-03',status:'active'};
const project={id:'PRJ-INV-001',title:'Rak Display Custom',client:'PT Contoh',value:10000000,status:'plan'};
const po={id:'PO-INV-001',projectId:project.id,projectName:project.title,supplier:'Supplier A',date:'2026-11-19',itemsJson:JSON.stringify([{materialId:material.id,name:material.name,qty:4,unit:'m2',unitPrice:100000}]),total:400000,status:'ordered',inventoryControlVersion:1,createdAt:'2026-11-19T08:00:00.000Z',updatedAt:'2026-11-19T08:00:00.000Z'};
function fixture(){
 return new FakeSpreadsheet({
  Materials:new FakeSheet([map.Materials.headers,rowFor('Materials',material)]),
  Projects:new FakeSheet([map.Projects.headers,rowFor('Projects',project)]),
  Purchase_Orders:new FakeSheet([map.Purchase_Orders.headers,rowFor('Purchase_Orders',po)]),
  Inventory_Transactions:new FakeSheet([map.Inventory_Transactions.headers]),
  Stock_Reservations:new FakeSheet([map.Stock_Reservations.headers])
 });
}
function transaction(id,no,movement,qty,date,extra){
 return Object.assign({
  id:'ITX-'+id,transactionNo:no,materialId:material.id,materialName:material.name,
  movement:movement,qty:qty,unit:'m2',date:date,projectId:'',projectName:'',
  purchaseOrderId:'',supplier:'',reference:'',notes:'',
  createdAt:date+'T08:00:00.000Z',createdBy:'owner@example.test'
 },extra||{});
}
const opening=transaction('INV-00000001','STK-CSK-2026-00001','opening',5,'2026-11-01');
let ss=fixture();
assert.equal(context.validateInventoryTransactionsBeforeMerge_(ss,[opening]),true,'valid opening balance can be recorded');
ss.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',opening));
assert.equal(context.validateInventoryTransactionsBeforeMerge_(ss,[opening]),true,'unchanged existing ledger rows remain syncable');
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(ss,[{...opening,qty:6}]),/INVENTORY_TRANSACTION_IMMUTABLE/,'existing stock transactions cannot be edited');

const secondOpening=transaction('INV-00000002','STK-CSK-2026-00002','opening',2,'2026-11-02');
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(ss,[opening,secondOpening]),/INVENTORY_OPENING_ALREADY_EXISTS/,'one opening balance is allowed per material');

const issue=transaction('INV-00000003','STK-CSK-2026-00003','issue',6,'2026-11-03',{projectId:project.id,projectName:project.title});
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


const hppSnapshot={projectId:project.id,items:[{materialId:material.id,name:material.name,qty:3,unit:'m2',materialSnapshot:{unit:'m2',purchaseUnit:'lembar',conversionFactor:2,name:material.name}}]};
const reservableOrder={id:'SO-INV-00000001',orderNo:'SO-CSK-2026-00001',projectId:project.id,projectName:project.title,status:'in_production',sourceCostSheetSnapshotJson:JSON.stringify(hppSnapshot)};
const reservationFixture=fixture();
reservationFixture.sheets.Sales_Orders=new FakeSheet([map.Sales_Orders.headers,rowFor('Sales_Orders',reservableOrder)]);
reservationFixture.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',opening));
const reserved=context.reserveSalesOrderStock_(reservationFixture,reservableOrder.id,{email:'owner@example.test'});
assert.equal(reserved.alreadyReserved,false,'first reservation creates server ledger events');
assert.equal(reserved.reservations.length,1);
assert.equal(reserved.reservations[0].qty,3,'reservation uses saved HPP quantity in stock unit');
const duplicateReserve=context.reserveSalesOrderStock_(reservationFixture,reservableOrder.id,{email:'owner@example.test'});
assert.equal(duplicateReserve.alreadyReserved,true,'repeated reserve is idempotent');
assert.equal(reservationFixture.sheets.Stock_Reservations.getLastRow(),2,'idempotent reserve does not duplicate events');
const blockedIssue=transaction('INV-RES-0001','STK-CSK-2026-00020','issue',3,'2026-11-26',{projectId:project.id,projectName:project.title});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(reservationFixture,[blockedIssue]),/INVENTORY_STOCK_RESERVED/,'manual stock issue cannot consume locked reservation quantity');
const freeIssue=transaction('INV-RES-0002','STK-CSK-2026-00021','issue',2,'2026-11-26',{projectId:project.id,projectName:project.title});
assert.equal(context.validateInventoryTransactionsBeforeMerge_(reservationFixture,[freeIssue]),true,'unreserved free stock remains issuable');
const released=context.releaseSalesOrderStock_(reservationFixture,reservableOrder.id,{email:'owner@example.test'},'Test release');
assert.equal(released.released,true,'release writes an append-only release event');
assert.equal(released.reservations.length,0,'released quantities no longer count as active reservations');
const repeatedRelease=context.releaseSalesOrderStock_(reservationFixture,reservableOrder.id,{email:'owner@example.test'},'Repeated release');
assert.equal(repeatedRelease.released,false,'repeated release is idempotent');
const insufficientFixture=fixture();
insufficientFixture.sheets.Sales_Orders=new FakeSheet([map.Sales_Orders.headers,rowFor('Sales_Orders',reservableOrder)]);
insufficientFixture.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',opening));
const oversizedOrder=Object.assign({},reservableOrder,{id:'SO-INV-00000002',sourceCostSheetSnapshotJson:JSON.stringify({projectId:project.id,items:[{materialId:material.id,name:material.name,qty:6,unit:'m2',materialSnapshot:{unit:'m2'}}]})});
insufficientFixture.sheets.Sales_Orders.appendRow(rowFor('Sales_Orders',oversizedOrder));
assert.throws(()=>context.reserveSalesOrderStock_(insufficientFixture,oversizedOrder.id,{email:'owner@example.test'}),/INSUFFICIENT_FREE_STOCK/,'reservation cannot exceed free physical stock');
const wrongStatus=Object.assign({},reservableOrder,{id:'SO-INV-00000003',status:'ready_production'});
insufficientFixture.sheets.Sales_Orders.appendRow(rowFor('Sales_Orders',wrongStatus));
assert.throws(()=>context.reserveSalesOrderStock_(insufficientFixture,wrongStatus.id,{email:'owner@example.test'}),/SALES_ORDER_NOT_READY_FOR_RESERVATION/,'SO must reach in-production status before reservation');

console.log('CSK Inventory backend validation tests passed.');
