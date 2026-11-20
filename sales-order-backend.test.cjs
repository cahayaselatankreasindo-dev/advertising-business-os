'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

class FakeRange {
  constructor(sheet,row,col,numRows,numCols){this.sheet=sheet;this.row=row;this.col=col;this.numRows=numRows||1;this.numCols=numCols||1;}
  getValues(){
    const out=[];
    for(let r=0;r<this.numRows;r++){
      const source=this.sheet.rows[this.row-1+r]||[];
      out.push(Array.from({length:this.numCols},(_,c)=>source[this.col-1+c]===undefined?'':source[this.col-1+c]));
    }
    return out;
  }
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
const context={Logger:{log(){}}};
vm.createContext(context);
vm.runInContext(backend,context);
const map=context.FIELD_MAP;
function rowFor(sheetName,record){
  const schema=map[sheetName];
  return schema.fields.map(field=>{
    if(field==='linesJson'&&record.lines)return JSON.stringify(record.lines);
    if(field==='itemsJson'&&record.items)return JSON.stringify(record.items);
    if(field==='historyJson'&&record.history)return JSON.stringify(record.history);
    return record[field]===undefined?'':record[field];
  });
}
const quote={
  id:'QUO-BACKEND-001',projectId:'PRJ-BACKEND-001',leadId:'',
  projectName:'Rak Display Custom',client:'PT Contoh',clientPhone:'628123456789',
  clientEmail:'procurement@example.test',clientAddress:'',contactPerson:'',
  docNo:'QUO-CSK-2026-00001',date:'2026-11-20',dueDate:'2026-12-04',
  lines:[{id:'L-1',name:'Rak display custom',qty:2,unit:'unit',unitPrice:5000000}],
  subtotal:10000000,discount:0,taxRate:0,taxAmount:0,total:10000000,dpPercent:50,
  terms:'',paymentTerms:'',notes:'',status:'approved',convertedInvoiceId:'',
  createdAt:'2026-11-20T06:00:00.000Z',updatedAt:'2026-11-20T06:00:00.000Z',projectDeadline:'2026-12-15'
};
const project={id:'PRJ-BACKEND-001',title:'Rak Display Custom',client:'PT Contoh',value:10000000,status:'plan'};
function fixture(){
  return new FakeSpreadsheet({
    Commercial_Quotations:new FakeSheet([map.Commercial_Quotations.headers,rowFor('Commercial_Quotations',quote)]),
    Projects:new FakeSheet([map.Projects.headers,rowFor('Projects',project)]),
    Invoices:new FakeSheet([map.Invoices.headers]),
    Invoice_Payments:new FakeSheet([map.Invoice_Payments.headers])
  });
}
function order(status){
  return{
    id:'SO-TEST-00000001',orderNo:'SO-CSK-2026-00001',quotationId:quote.id,
    quotationNo:quote.docNo,projectId:project.id,projectName:quote.projectName,
    client:quote.client,clientPhone:quote.clientPhone,clientEmail:quote.clientEmail,
    orderDate:'2026-11-20',deliveryDate:'2026-12-15',items:quote.lines,total:quote.total,
    dpPercent:50,dpRequiredAmount:5000000,status:status||'awaiting_dp',
    history:[{status:status||'awaiting_dp'}],notes:'',
    createdAt:'2026-11-20T06:00:00.000Z',updatedAt:'2026-11-20T06:00:00.000Z'
  };
}
let ss=fixture();
assert.equal(context.validateSalesOrdersBeforeMerge_(ss,[order()]),true,'approved quotation can create one awaiting-DP Sales Order');
assert.throws(()=>context.validateSalesOrdersBeforeMerge_(fixture(),[order('ready_production')]),/INVALID_INITIAL_SALES_ORDER_STATUS/,'DP-required order cannot start in production-ready state');

let badQuote=fixture();
badQuote.sheets.Commercial_Quotations.rows[1][map.Commercial_Quotations.fields.indexOf('status')]='draft';
assert.throws(()=>context.validateSalesOrdersBeforeMerge_(badQuote,[order()]),/SALES_ORDER_REQUIRES_APPROVED_QUOTATION/,'draft quotation cannot create Sales Order');

let badProject=fixture();
const noProject={...order(),projectId:'MISSING-PROJECT'};
assert.throws(()=>context.validateSalesOrdersBeforeMerge_(badProject,[noProject]),/SALES_ORDER_PROJECT_REQUIRED/,'Sales Order requires a real linked project');

let badItems=fixture();
const changedItems={...order(),items:[{id:'L-X',name:'Changed line',qty:1,unit:'unit',unitPrice:1}]};
assert.throws(()=>context.validateSalesOrdersBeforeMerge_(badItems,[changedItems]),/SALES_ORDER_ITEMS_SNAPSHOT_MISMATCH/,'Sales Order lines must match approved quotation snapshot');

let duplicate=fixture();
assert.throws(()=>context.validateSalesOrdersBeforeMerge_(duplicate,[order(),{...order(),id:'SO-TEST-00000002',orderNo:'SO-CSK-2026-00002'}]),/DUPLICATE_SALES_ORDER_FOR_QUOTATION/,'one quotation cannot create two Sales Orders');

ss=fixture();
const initial=order();
context.validateSalesOrdersBeforeMerge_(ss,[initial]);
ss.sheets.Sales_Orders.appendRow(rowFor('Sales_Orders',{
  ...initial,itemsJson:JSON.stringify(initial.items),historyJson:JSON.stringify(initial.history)
}));
assert.throws(()=>context.validateSalesOrdersBeforeMerge_(ss,[{...initial,status:'ready_production'}]),/SALES_ORDER_DP_NOT_VERIFIED/,'backend blocks production release without verified DP');

ss.sheets.Invoices.appendRow(rowFor('Invoices',{
  id:'INV-BACKEND-001',projectId:project.id,quotationId:quote.id,sourceQuotationId:quote.id,
  docNo:'INV-CSK-2026-00001',total:10000000,status:'sent'
}));
ss.sheets.Invoice_Payments.appendRow(rowFor('Invoice_Payments',{
  id:'PAY-BACKEND-001',invoiceId:'INV-BACKEND-001',invoiceNo:'INV-CSK-2026-00001',
  paymentDate:'2026-11-20',paymentType:'dp',amount:5000000,method:'transfer'
}));
assert.equal(context.validateSalesOrdersBeforeMerge_(ss,[{...initial,status:'ready_production'}]),true,'verified DP releases production');
assert.throws(()=>context.validateSalesOrdersBeforeMerge_(ss,[{...initial,status:'quality_check'}]),/INVALID_SALES_ORDER_STATUS_TRANSITION/,'backend blocks skipped production stages');

const delivered={...initial,status:'delivered'};
ss.sheets.Sales_Orders.rows[1][map.Sales_Orders.fields.indexOf('status')]='delivered';
assert.throws(()=>context.validateSalesOrdersBeforeMerge_(ss,[{...delivered,status:'closed'}]),/SALES_ORDER_CANNOT_CLOSE_WITH_UNPAID_INVOICE/,'backend blocks closing while invoice balance remains');
ss.sheets.Invoice_Payments.appendRow(rowFor('Invoice_Payments',{
  id:'PAY-BACKEND-002',invoiceId:'INV-BACKEND-001',invoiceNo:'INV-CSK-2026-00001',
  paymentDate:'2026-11-21',paymentType:'settlement',amount:5000000,method:'transfer'
}));
assert.equal(context.validateSalesOrdersBeforeMerge_(ss,[{...delivered,status:'closed'}]),true,'fully paid order can be closed');

console.log('CSK Sales Order backend validation tests passed.');
