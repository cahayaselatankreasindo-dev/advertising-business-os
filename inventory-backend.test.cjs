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
const context={Logger:{log(){}},LockService:{getScriptLock(){return{waitLock(){},releaseLock(){}}}}};vm.createContext(context);vm.runInContext(backend,context);
const map=context.FIELD_MAP;
function rowFor(sheetName,record){
 const schema=map[sheetName];
 return schema.fields.map(field=>{
  if(field==='itemsJson'&&record.items)return JSON.stringify(record.items);
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
  Inventory_Transactions:new FakeSheet([map.Inventory_Transactions.headers])
 });
}
const validMasterMaterial={id:'MAT-MASTER-001',sku:'H-H-2X2-1',name:'Hollow hitam 2 × 2 cm, tebal 1 mm',category:'Besi hollow',unit:'m',unitPrice:20000,purchaseUnit:'batang',purchasePrice:120000,conversionFactor:6,supplierName:'Supplier Hollow',priceSource:'Invoice supplier',priceDate:'2026-11-20',status:'active'};
assert.equal(context.validateMaterialsBeforeMerge_(fixture(),[validMasterMaterial]),true,'active master material with verified supplier price and conversion is accepted');
const draftMasterMaterial={id:'MAT-MASTER-002',sku:'PVC-3',name:'PVC board 3 mm',category:'PVC board',unit:'lembar',purchaseUnit:'lembar',conversionFactor:1,unitPrice:0,purchasePrice:0,status:'draft'};
assert.equal(context.validateMaterialsBeforeMerge_(fixture(),[draftMasterMaterial]),true,'draft master material may be imported without fabricated price');
assert.throws(()=>context.validateMaterialsBeforeMerge_(fixture(),[validMasterMaterial,{...validMasterMaterial,id:'MAT-MASTER-003'}]),/DUPLICATE_MATERIAL_SKU/,'duplicate material SKUs are rejected');
assert.throws(()=>context.validateMaterialsBeforeMerge_(fixture(),[{...validMasterMaterial,sku:material.sku}]),/DUPLICATE_MATERIAL_SKU/,'new material cannot reuse a SKU already stored in Google Sheets');
assert.throws(()=>context.validateMaterialsBeforeMerge_(fixture(),[{...validMasterMaterial,unitPrice:25000}]),/ACTIVE_MATERIAL_USAGE_PRICE_MISMATCH/,'active material usage price must equal purchase price divided by conversion');
assert.throws(()=>context.validateMaterialsBeforeMerge_(fixture(),[{...validMasterMaterial,priceSource:''}]),/ACTIVE_MATERIAL_PRICE_SOURCE_REQUIRED/,'active material requires a traceable price source');

const convertedPO={...po,status:'received',items:[{materialId:material.id,qty:2,purchaseUnit:'roll',usageUnit:'m2',conversionFactor:6}]};
const convertedPOFixture=fixture();
const shortConvertedReceipt=transaction('INV-PO-CONVERT-01','STK-CSK-2026-00991','receipt',11,'2026-11-20',{purchaseOrderId:po.id,supplier:po.supplier});
assert.throws(()=>context.validatePurchaseOrderReceiptStatuses_(convertedPOFixture,[convertedPO],[shortConvertedReceipt]),/PURCHASE_ORDER_RECEIPT_INCOMPLETE/,'received PO status requires receipt in stock units after purchase conversion');
const fullConvertedReceipt=transaction('INV-PO-CONVERT-02','STK-CSK-2026-00992','receipt',12,'2026-11-20',{purchaseOrderId:po.id,supplier:po.supplier});
assert.equal(context.validatePurchaseOrderReceiptStatuses_(fixture(),[convertedPO],[fullConvertedReceipt]),true,'converted PO receipt is complete when all 12 stock units are received');

const wasteAdjustedMaterial={...validMasterMaterial,id:'MAT-MASTER-WASTE',sku:'H-H-2X2-WASTE',wasteRate:10,unitPrice:22000};
assert.equal(context.validateMaterialsBeforeMerge_(fixture(),[wasteAdjustedMaterial]),true,'HPP usage price includes the configured material waste allowance');
assert.throws(()=>context.validateMaterialsBeforeMerge_(fixture(),[{...wasteAdjustedMaterial,unitPrice:20000}]),/ACTIVE_MATERIAL_USAGE_PRICE_MISMATCH/,'active material usage price cannot omit its configured waste allowance');

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
const convertedMaterial={...material,unit:'m',purchaseUnit:'batang',conversionFactor:6,purchasePrice:120000,unitPrice:20000};
const convertedPO={...po,items:[{materialId:material.id,sku:'H-H-2X2-1',name:'Hollow hitam 2 × 2 cm, tebal 1 mm',qty:2,unit:'batang',purchaseUnit:'batang',usageUnit:'m',conversionFactor:6,unitPrice:120000,usageUnitPrice:20000}],itemsJson:JSON.stringify([{materialId:material.id,sku:'H-H-2X2-1',name:'Hollow hitam 2 × 2 cm, tebal 1 mm',qty:2,unit:'batang',purchaseUnit:'batang',usageUnit:'m',conversionFactor:6,unitPrice:120000,usageUnitPrice:20000}]),total:240000};
const convertedFixture=fixture();
convertedFixture.sheets.Materials.rows[1]=rowFor('Materials',convertedMaterial);
convertedFixture.sheets.Purchase_Orders.rows[1]=rowFor('Purchase_Orders',{...convertedPO,itemsJson:convertedPO.itemsJson});
const convertedReceipt=transaction('INV-CONVERT-0001','STK-CSK-2026-00021','receipt',6,'2026-11-20',{purchaseOrderId:po.id,supplier:po.supplier,unit:'m'});
assert.equal(context.validateInventoryTransactionsBeforeMerge_(convertedFixture,[convertedReceipt]),true,'one purchased 6m hollow bar is received as six stock meters');
convertedFixture.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',convertedReceipt));
const convertedOverReceipt=transaction('INV-CONVERT-0002','STK-CSK-2026-00022','receipt',7,'2026-11-21',{purchaseOrderId:po.id,supplier:po.supplier,unit:'m'});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(convertedFixture,[convertedReceipt,convertedOverReceipt]),/INVENTORY_RECEIPT_EXCEEDS_PURCHASE_ORDER/,'converted receipts cannot exceed the two ordered 6m bars');
const convertedFullReceipt=transaction('INV-CONVERT-0003','STK-CSK-2026-00023','receipt',12,'2026-11-20',{purchaseOrderId:po.id,supplier:po.supplier,unit:'m'});
const convertedReceivedPO={...convertedPO,status:'received'};
assert.equal(context.validatePurchaseOrderReceiptStatuses_(convertedFixture,[convertedReceivedPO],[convertedFullReceipt]),true,'PO completion compares converted stock meters, not purchase bars');
const cancelledPO={...po,status:'cancelled',items:[{materialId:material.id,qty:4,unit:'m2'}]};
assert.throws(()=>context.validatePurchaseOrderReceiptStatuses_(fixture(),[cancelledPO],[fullPOReceipt]),/PURCHASE_ORDER_CANNOT_CANCEL_AFTER_RECEIPT/,'PO cannot be cancelled after stock receipt');

const receiptFirst=transaction('INV-00000011','STK-CSK-2026-00011','receipt',2,'2026-11-01',{supplier:'Supplier A'});
const openingLater=transaction('INV-00000012','STK-CSK-2026-00012','opening',5,'2026-11-02');
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(fixture(),[receiptFirst,openingLater]),/INVENTORY_OPENING_MUST_BE_FIRST/,'opening balance cannot be entered after stock movements');


function reservationFixture(stockQty, orderId, reservationQty, secondOrderId) {
 const f=fixture();
 const snapshot={id:'HPP-INV-001',projectId:project.id,projectName:project.title,items:[{itemType:'material',materialId:material.id,name:material.name,qty:reservationQty,unit:'m2'}]};
 const quote={id:'QUO-INV-001',projectId:project.id,docNo:'QUO-CSK-2026-00001',status:'approved',total:1000000,dpPercent:0,linesJson:JSON.stringify([{itemType:'material',materialId:material.id,name:material.name,qty:reservationQty,unit:'m2'}]),sourceCostSheetSnapshotJson:JSON.stringify(snapshot)};
 const order={id:orderId||'SO-INV-00000001',orderNo:'SO-CSK-2026-00001',quotationId:quote.id,quotationNo:quote.docNo,projectId:project.id,projectName:project.title,client:'PT Contoh',clientPhone:'',clientEmail:'',orderDate:'2026-11-20',deliveryDate:'',itemsJson:quote.linesJson,total:1000000,dpPercent:0,dpRequiredAmount:0,status:'ready_production',historyJson:'[]',notes:'',createdAt:'2026-11-20T08:00:00.000Z',updatedAt:'2026-11-20T08:00:00.000Z',sourceCostSheetSnapshotJson:JSON.stringify(snapshot)};
 f.sheets.Commercial_Quotations=new FakeSheet([map.Commercial_Quotations.headers,rowFor('Commercial_Quotations',quote)]);
 f.sheets.Sales_Orders=new FakeSheet([map.Sales_Orders.headers,rowFor('Sales_Orders',order)]);
 f.sheets.Invoices=new FakeSheet([map.Invoices.headers]);
 f.sheets.Invoice_Payments=new FakeSheet([map.Invoice_Payments.headers]);
 f.sheets.Inventory_Reservations=new FakeSheet([map.Inventory_Reservations.headers]);
 const openingTx=transaction('RESV-OPEN-0001','STK-CSK-2026-00100','opening',stockQty,'2026-11-01');
 f.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',openingTx));
 return {ss:f,order:order,quote:quote,snapshot:snapshot};
}
const reserveCase=reservationFixture(5,'SO-INV-00000001',4);
const reserved=context.reserveSalesOrderStock_(reserveCase.ss,reserveCase.order.id,{role:'owner',email:'owner@example.test'});
assert.equal(reserved.status,'reserved','Owner can reserve material for an eligible production order');
assert.equal(reserved.reservations.length,1);
assert.equal(reserved.reservations[0].qty,4);
assert.equal(reserved.reservations[0].status,'active');
const idempotent=context.reserveSalesOrderStock_(reserveCase.ss,reserveCase.order.id,{role:'owner',email:'owner@example.test'});
assert.equal(idempotent.status,'already_reserved','repeated reserve requests do not duplicate active reservations');
assert.equal(reserveCase.ss.sheets.Inventory_Reservations.getLastRow(),2,'idempotent request keeps one reservation row');
assert.throws(()=>context.reserveSalesOrderStock_(reserveCase.ss,reserveCase.order.id,{role:'team',email:'team@example.test'}),/FORBIDDEN_STOCK_RESERVATION/,'Team cannot reserve stock');
const orderStatusColumn=map.Sales_Orders.fields.indexOf('status');
reserveCase.ss.sheets.Sales_Orders.rows[1][orderStatusColumn]='in_production';
assert.equal(context.reserveSalesOrderStock_(reserveCase.ss,reserveCase.order.id,{role:'owner',email:'owner@example.test'}).status,'already_reserved','existing reservation remains idempotent after production starts');
const reservedIssue=transaction('RESV-ISSUE-0001','STK-CSK-2026-00020','issue',2,'2026-11-21',{projectId:project.id,projectName:project.title});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(reserveCase.ss,[reservedIssue],[],[]),/INVENTORY_STOCK_RESERVED/,'stock issue cannot consume quantity reserved for another production order');
const releasedReservationResult=context.releaseSalesOrderReservation_(reserveCase.ss,reserveCase.order.id,'Test release by Owner',{role:'owner',email:'owner@example.test'});
assert.equal(releasedReservationResult.releasedLines,1,'Owner can release all active reservation rows');
assert.equal(reserveCase.ss.sheets.Inventory_Reservations.rows[1][map.Inventory_Reservations.fields.indexOf('status')],'released','released reservation is retained in history');
assert.equal(context.validateInventoryTransactionsBeforeMerge_(reserveCase.ss,[reservedIssue],[],[]),true,'stock issue is allowed after reservation release');
assert.throws(()=>context.reserveSalesOrderStock_(reserveCase.ss,reserveCase.order.id,{role:'owner',email:'owner@example.test'}),/SALES_ORDER_NOT_READY_FOR_RESERVATION/,'a Sales Order already in production cannot be re-reserved after manual release');
const reReserveCase=reservationFixture(5,'SO-INV-00000007',4);
const firstCycle=context.reserveSalesOrderStock_(reReserveCase.ss,reReserveCase.order.id,{role:'owner',email:'owner@example.test'});
context.releaseSalesOrderReservation_(reReserveCase.ss,reReserveCase.order.id,'Test re-reservation cycle',{role:'owner',email:'owner@example.test'});
const secondCycle=context.reserveSalesOrderStock_(reReserveCase.ss,reReserveCase.order.id,{role:'owner',email:'owner@example.test'});
assert.equal(secondCycle.status,'reserved','a released ready-production order can be reserved again');
assert.notEqual(secondCycle.reservations[0].id,firstCycle.reservations[0].id,'new reservation cycle receives a unique immutable ID');

const consumeCase=reservationFixture(5,'SO-INV-00000008',4);
const consumeReservation=context.reserveSalesOrderStock_(consumeCase.ss,consumeCase.order.id,{role:'owner',email:'owner@example.test'}).reservations[0];
const linkedIssueOne=transaction('RESV-CONSUME-0001','STK-CSK-2026-00030','issue',2,'2026-11-21',{projectId:project.id,projectName:project.title,salesOrderId:consumeCase.order.id,reservationId:consumeReservation.id});
assert.equal(context.validateInventoryTransactionsBeforeMerge_(consumeCase.ss,[linkedIssueOne],[],[]),true,'stock issue linked to its exact active reservation is allowed');
consumeCase.ss.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',linkedIssueOne));
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(consumeCase.ss,[{...linkedIssueOne,reservationId:'RSV-FORGED-0001'}],[],[]),/INVENTORY_TRANSACTION_IMMUTABLE/,'reservation references on stock ledger entries cannot be edited');
assert.equal(context.reconcileConsumedReservations_(consumeCase.ss),0,'partial consumption keeps the reservation active');
const linkedIssueTwo=transaction('RESV-CONSUME-0002','STK-CSK-2026-00031','issue',2,'2026-11-22',{projectId:project.id,projectName:project.title,salesOrderId:consumeCase.order.id,reservationId:consumeReservation.id});
assert.equal(context.validateInventoryTransactionsBeforeMerge_(consumeCase.ss,[linkedIssueOne,linkedIssueTwo],[],[]),true,'multiple issue transactions consume the same reservation up to its remaining quantity');
consumeCase.ss.sheets.Inventory_Transactions.appendRow(rowFor('Inventory_Transactions',linkedIssueTwo));
assert.equal(context.reconcileConsumedReservations_(consumeCase.ss),1,'fully consumed reservation is marked consumed');
assert.equal(consumeCase.ss.sheets.Inventory_Reservations.rows[1][map.Inventory_Reservations.fields.indexOf('status')],'consumed','consumed reservation remains in the audit history');
const overConsume=transaction('RESV-CONSUME-0003','STK-CSK-2026-00032','issue',1,'2026-11-23',{projectId:project.id,projectName:project.title,salesOrderId:consumeCase.order.id,reservationId:consumeReservation.id});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(consumeCase.ss,[linkedIssueOne,linkedIssueTwo,overConsume],[],[]),/INVENTORY_SALES_ORDER_RESERVATION_REQUIRED/,'a consumed reservation cannot be used again');
const deliveredOrder={...consumeCase.order,status:'delivered'};
consumeCase.ss.sheets.Sales_Orders.rows[1][map.Sales_Orders.fields.indexOf('status')]='delivered';
assert.equal(context.validateInventoryTransactionsBeforeMerge_(consumeCase.ss,[linkedIssueOne,linkedIssueTwo],[],[deliveredOrder]),true,'existing linked ledger rows remain syncable after the Sales Order is delivered');
const issueAfterDelivery=transaction('RESV-CONSUME-0004','STK-CSK-2026-00033','issue',1,'2026-11-24',{projectId:project.id,projectName:project.title,salesOrderId:consumeCase.order.id,reservationId:consumeReservation.id});
assert.throws(()=>context.validateInventoryTransactionsBeforeMerge_(consumeCase.ss,[issueAfterDelivery],[],[deliveredOrder]),/INVENTORY_SALES_ORDER_NOT_ACTIVE/,'new material issues are blocked after Sales Order delivery');

const competing=reservationFixture(5,'SO-INV-00000002',4);
const competingSecond={...competing.order,id:'SO-INV-00000003',orderNo:'SO-CSK-2026-00002',quotationId:'QUO-INV-00002',quotationNo:'QUO-CSK-2026-00002'};
const competingQuote={...competing.quote,id:competingSecond.quotationId,docNo:competingSecond.quotationNo};
competing.ss.sheets.Commercial_Quotations.appendRow(rowFor('Commercial_Quotations',competingQuote));
competing.ss.sheets.Sales_Orders.appendRow(rowFor('Sales_Orders',competingSecond));
assert.equal(context.reserveSalesOrderStock_(competing.ss,competing.order.id,{role:'owner',email:'owner@example.test'}).status,'reserved');
assert.throws(()=>context.reserveSalesOrderStock_(competing.ss,competingSecond.id,{role:'owner',email:'owner@example.test'}),/RESERVATION_STOCK_INSUFFICIENT/,'active reservations reduce stock available to competing Sales Orders');

const shortage=reservationFixture(3,'SO-INV-00000005',4);
assert.throws(()=>context.reserveSalesOrderStock_(shortage.ss,shortage.order.id,{role:'owner',email:'owner@example.test'}),/RESERVATION_STOCK_INSUFFICIENT/,'reservation fails when on-hand stock is insufficient');

const terminal=reservationFixture(5,'SO-INV-00000006',4);
assert.equal(context.reserveSalesOrderStock_(terminal.ss,terminal.order.id,{role:'owner',email:'owner@example.test'}).status,'reserved');
const terminalIssue=transaction('RESV-ISSUE-0002','STK-CSK-2026-00021','issue',2,'2026-11-21',{projectId:project.id,projectName:project.title});
assert.equal(context.validateInventoryTransactionsBeforeMerge_(terminal.ss,[terminalIssue],[],[{id:terminal.order.id,status:'cancelled'}]),true,'same-sync cancellation releases its reservation for inventory issue validation');
assert.equal(context.releaseTerminalSalesOrderReservations_(terminal.ss,[{id:terminal.order.id,status:'cancelled'}],{role:'owner',email:'owner@example.test'}),1,'cancelled Sales Orders automatically release their reservations');
assert.equal(terminal.ss.sheets.Inventory_Reservations.rows[1][map.Inventory_Reservations.fields.indexOf('status')],'released','automatic release keeps reservation audit history');

const deliveredTerminal=reservationFixture(5,'SO-INV-00000009',4);
assert.equal(context.reserveSalesOrderStock_(deliveredTerminal.ss,deliveredTerminal.order.id,{role:'owner',email:'owner@example.test'}).status,'reserved');
const deliveredGenericIssue=transaction('RESV-ISSUE-0003','STK-CSK-2026-00022','issue',2,'2026-11-22',{projectId:project.id,projectName:project.title});
assert.equal(context.validateInventoryTransactionsBeforeMerge_(deliveredTerminal.ss,[deliveredGenericIssue],[],[{id:deliveredTerminal.order.id,status:'delivered'}]),true,'delivered Sales Order reservations no longer block unrelated stock issues');
assert.equal(context.releaseTerminalSalesOrderReservations_(deliveredTerminal.ss,[{id:deliveredTerminal.order.id,status:'delivered'}],{role:'owner',email:'owner@example.test'}),1,'delivered Sales Orders automatically release unused reservations');


const notReady=reservationFixture(5,'SO-INV-00000004',2);
const orderStatusCol=map.Sales_Orders.fields.indexOf('status');
notReady.ss.sheets.Sales_Orders.rows[1][orderStatusCol]='awaiting_dp';
assert.throws(()=>context.reserveSalesOrderStock_(notReady.ss,notReady.order.id,{role:'owner',email:'owner@example.test'}),/SALES_ORDER_NOT_READY_FOR_RESERVATION/,'orders awaiting DP cannot reserve stock');

console.log('CSK Inventory backend validation tests passed.');
