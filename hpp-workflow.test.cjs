'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
function extractFunction(name,asyncFunction){
  const prefix='    '+(asyncFunction?'async ':'')+'function '+name+'(';
  const start=html.indexOf(prefix);
  assert.notEqual(start,-1,'missing inline function '+name);
  const end=html.indexOf('\n    }',start);
  assert.notEqual(end,-1,'could not locate function boundary for '+name);
  return html.slice(start,end+6).replace(/^    /gm,'');
}
function compile(name,asyncFunction,sandbox){
  return vm.runInNewContext('('+extractFunction(name,asyncFunction)+')',sandbox,{filename:'index.html:'+name});
}
const isMaterialSelectable=compile('isMaterialSelectable',false,{Number,String});

const calculateHppTotals=compile('calculateHppTotals',false,{Number,Math});
const marginCheck=calculateHppTotals([{name:'Akrilik',qty:1,unitPrice:1000}],0,0,30);
assert.equal(marginCheck.total,1000);
assert.equal(marginCheck.price,1429,'30 percent gross margin is calculated against selling price, not as a 30 percent markup');
assert.equal(marginCheck.profit,429);
assert.ok(marginCheck.profit/marginCheck.price*100>=30);
assert.throws(()=>calculateHppTotals([{name:'Akrilik',qty:'abc',unitPrice:1000}],0,0,30),/Kuantitas item HPP ke-1/,'invalid HPP quantity is not silently converted to zero');
assert.throws(()=>calculateHppTotals([{name:'Akrilik',qty:1,unitPrice:-1}],0,0,30),/Harga biaya item HPP ke-1/,'negative HPP cost is rejected');
assert.throws(()=>calculateHppTotals([{name:'Akrilik',qty:1,unitPrice:Infinity}],0,0,30),/Harga biaya item HPP ke-1/,'non-finite HPP cost is rejected');

const materialUnitItem={itemType:'material',materialId:'MAT-ACR-03',name:'Akrilik',unit:'lembar',qty:2,unitPrice:100000};
const unitMessages=[];
const unitSandbox={hppLines:[materialUnitItem],showToast(message,isError){unitMessages.push({message,isError:!!isError});},renderHppEstimate(){},Number,String,Math};
compile('setHppLineField',false,unitSandbox)(0,'unit','m2');
assert.equal(materialUnitItem.unit,'lembar','material usage unit cannot be changed without a controlled unit conversion');
assert.equal(unitMessages[0].isError,true);
const serviceUnitItem={itemType:'service',serviceId:'SRV-01',name:'Fabrikasi',unit:'job',qty:1,unitPrice:50000};
unitSandbox.hppLines=[serviceUnitItem];
compile('setHppLineField',false,unitSandbox)(0,'unit','lot');
assert.equal(serviceUnitItem.unit,'lot','service units remain editable');
assert.ok(html.includes('Satuan material mengikuti Master Material'),'material HPP unit is visibly locked to its master unit');
assert.ok(html.includes('Rumus harga penawaran: total HPP ÷ (1 − margin ÷ 100)'),'HPP gross-margin basis is explained beside the input');

const verifiedMaterial={
  id:'MAT-ACR-03',sku:'ACR-03',name:'Akrilik bening 3 mm',category:'Akrilik',
  unit:'m2',purchaseUnit:'lembar',purchasePrice:120000,conversionFactor:3.2,
  wasteRate:10,unitPrice:41250,status:'active',supplierName:'Supplier A',
  priceSource:'Invoice pembelian',priceDate:'2026-11-20'
};
assert.equal(isMaterialSelectable(verifiedMaterial),true,'verified material with purchase-to-stock conversion is selectable');
assert.equal(isMaterialSelectable(null),false,'missing material is safely rejected');
assert.equal(isMaterialSelectable({...verifiedMaterial,status:'draft'}),false,'draft material is not selectable');
assert.equal(isMaterialSelectable({...verifiedMaterial,status:'inactive'}),false,'inactive material is not selectable');
assert.equal(isMaterialSelectable({...verifiedMaterial,priceDate:''}),false,'material without a current price date is not selectable');
assert.equal(isMaterialSelectable({...verifiedMaterial,supplierName:''}),false,'material without supplier is not selectable');
assert.equal(isMaterialSelectable({...verifiedMaterial,conversionFactor:-1}),false,'invalid conversion factor is rejected');
assert.equal(isMaterialSelectable({...verifiedMaterial,conversionFactor:0}),false,'an explicit zero conversion factor is not silently treated as one');
assert.equal(isMaterialSelectable({...verifiedMaterial,unitPrice:0}),false,'zero HPP usage price is rejected');
assert.equal(isMaterialSelectable({
  id:'MAT-MANUAL-LEGACY',sku:'MAT-MANUAL-LEGACY',name:'Legacy material',
  unit:'pcs',purchaseUnit:'pcs',purchasePrice:0,conversionFactor:1,
  unitPrice:1100,status:'active'
}),true,'legacy same-unit manual material retains the explicitly supported compatibility path');

function runAddHppLine(selected,materials,services,qty){
  const elements={
    'hpp-material':{value:selected},
    'hpp-qty':{value:String(qty)}
  };
  const lines=[],messages=[];
  let rendered=0;
  const sandbox={
    document:{getElementById(id){return elements[id]||null;}},
    db:{materials:materials,services:services},
    hppLines:lines,
    isMaterialSelectable,
    renderHppEstimate(){rendered++;},
    showToast(message,isError){messages.push({message,isError:!!isError});},
    Number,String,JSON,Object,Array,Math
  };
  const add=compile('addHppLine',false,sandbox);
  add();
  return {lines,messages,rendered};
}
const materialAdded=runAddHppLine('material:'+verifiedMaterial.id,[verifiedMaterial],[],2);
assert.equal(materialAdded.lines.length,1,'verified material can be added to HPP');
assert.equal(materialAdded.lines[0].itemType,'material');
assert.equal(materialAdded.lines[0].subtotal,82500);
assert.equal(materialAdded.lines[0].materialSnapshot.conversionFactor,3.2);
assert.equal(materialAdded.lines[0].materialSnapshot.wasteRate,10);
assert.equal(materialAdded.rendered,1);
const draftAdded=runAddHppLine('material:'+verifiedMaterial.id,[{...verifiedMaterial,status:'draft'}],[],1);
assert.equal(draftAdded.lines.length,0,'draft material cannot be inserted into HPP');
assert.equal(draftAdded.messages[0].isError,true);
const serviceAdded=runAddHppLine('service:SVC-01',[],[
  {id:'SVC-01',name:'Jasa fabrikasi',unit:'job',costPrice:45000,status:'active',recordType:'service'}
],3);
assert.equal(serviceAdded.lines.length,1,'active service with a cost basis can be inserted into HPP');
assert.equal(serviceAdded.lines[0].serviceId,'SVC-01');
assert.equal(serviceAdded.lines[0].itemType,'service');
assert.equal(serviceAdded.lines[0].subtotal,135000);
const productAdded=runAddHppLine('service:PRD-01',[],[
  {id:'PRD-01',name:'Produk signage custom',unit:'unit',costPrice:70000,status:'active',recordType:'product'}
],2);
assert.equal(productAdded.lines.length,1,'active product catalog entries can be used in HPP');
assert.equal(productAdded.lines[0].serviceId,'PRD-01');
assert.equal(productAdded.lines[0].catalogRecordType,'product','product catalog identity is retained in the HPP snapshot');
assert.equal(productAdded.lines[0].subtotal,140000);
const inactiveService=runAddHppLine('service:SVC-02',[],[
  {id:'SVC-02',name:'Jasa nonaktif',unit:'job',costPrice:45000,status:'inactive'}
],1);
assert.equal(inactiveService.lines.length,0,'inactive service cannot be inserted into HPP');

function saveScenario({cloudConfigured=true,syncResult=true,isOwner=true,existingSheet=true}={}){
  const project={id:'PRJ-01',title:'Display Booth',hpp:111,estimatedCost:111,suggestedPrice:222};
  const oldSheet={id:'HPP-PRJ-01',projectId:'PRJ-01',projectName:'Display Booth',items:[{name:'old'}],total:111,price:222};
  const db={projects:[project],costSheets:existingSheet?[oldSheet]:[],settings:cloudConfigured?{googleSheetUrl:'https://script.google.test'}:{}};
  const hppLines=[{itemType:'material',materialId:'MAT-01',name:'Akrilik',qty:2,unit:'lembar',unitPrice:50000,materialSnapshot:{conversionFactor:3.2}}];
  const messages=[],saveCalls=[],elements={'hpp-project':{value:'PRJ-01'}};
  let rendered=0,syncCalls=0;
  const sandbox={
    document:{getElementById(id){return elements[id]||null;}},
    db,hppLines,hppSaveInProgress:false,
    isOwnerSession(){return isOwner;},
    calculateHpp(){return{materialTotal:100000,labor:20000,other:5000,margin:30,total:125000,price:178572,profit:53572};},
    saveDB(skipCloud){saveCalls.push(skipCloud);},
    window:{CSKAuth:{isReady(){return true;},async sync(){syncCalls++;return syncResult;}}},
    renderHppSaved(){rendered++;},
    showToast(message,isError){messages.push({message,isError:!!isError});},
    Number,String,JSON,Object,Array,Date,Math,Promise
  };
  const save=compile('saveHppEstimate',true,sandbox);
  return save().then(()=>({db,project,messages,saveCalls,syncCalls,rendered,oldSheet}));
}
function deleteScenario({cloudConfigured=true,syncResult=true,isOwner=true,selected=true}={}){
  const project={id:'PRJ-01',title:'Display Booth',hpp:111,estimatedCost:111,suggestedPrice:222};
  const oldSheet={id:'HPP-PRJ-01',projectId:'PRJ-01',projectName:'Display Booth',items:[{name:'old'}],total:111,price:222};
  const db={projects:[project],costSheets:[oldSheet],settings:cloudConfigured?{googleSheetUrl:'https://script.google.test'}:{}};
  const elements={
    'hpp-project':{value:selected?'PRJ-01':'PRJ-02'},
    'hpp-labor':{value:'50000'},'hpp-other':{value:'10000'},'hpp-margin':{value:'35'}
  };
  const messages=[],saveCalls=[];
  let syncCalls=0,renderedSaved=0,renderedEstimate=0;
  const sandbox={
    document:{getElementById(id){return elements[id]||null;}},
    db,hppLines:[{itemType:'material',name:'Akrilik',qty:2,unitPrice:50000}],
    hppSaveInProgress:false,
    isOwnerSession(){return isOwner;},
    confirm(){return true;},
    saveDB(skipCloud){saveCalls.push(skipCloud);},
    window:{CSKAuth:{isReady(){return true;},async sync(){syncCalls++;return syncResult;}}},
    renderHppSaved(){renderedSaved++;},renderHppEstimate(){renderedEstimate++;},
    showToast(message,isError){messages.push({message,isError:!!isError});},
    Number,String,JSON,Object,Array,Date,Math,Promise
  };
  const remove=compile('deleteHppEstimate',true,sandbox);
  return remove('PRJ-01').then(()=>({db,project,elements,messages,saveCalls,syncCalls,renderedSaved,renderedEstimate,oldSheet,hppLines:sandbox.hppLines}));
}
(async function main(){
  const success=await saveScenario({cloudConfigured:true,syncResult:true});
  assert.equal(success.db.costSheets[0].total,125000,'new HPP snapshot replaces the previous project HPP');
  assert.equal(success.project.suggestedPrice,178572);
  assert.deepEqual(success.saveCalls,[true],'HPP save suppresses unverified background sync');
  assert.equal(success.syncCalls,1,'HPP save awaits one explicit cloud verification');
  assert.equal(success.rendered,1);
  assert.match(success.messages[0].message,/terverifikasi di Google Sheets/);
  const failed=await saveScenario({cloudConfigured:true,syncResult:false});
  assert.equal(JSON.stringify(failed.db.costSheets[0]),JSON.stringify(failed.oldSheet),'failed cloud verification restores the prior HPP snapshot');
  assert.equal(failed.project.hpp,111,'failed cloud verification restores project HPP fields');
  assert.equal(failed.project.suggestedPrice,222);
  assert.equal(failed.saveCalls.length,2,'rollback is persisted locally after cloud verification fails');
  assert.equal(failed.rendered,0);
  assert.equal(failed.messages[0].isError,true);
  assert.match(failed.messages[0].message,/belum tersimpan ke cloud/);
  const offline=await saveScenario({cloudConfigured:false});
  assert.equal(offline.db.costSheets[0].total,125000,'offline HPP remains available locally');
  assert.equal(offline.syncCalls,0,'offline mode does not attempt a cloud call');
  assert.match(offline.messages[0].message,/tersimpan secara lokal/);
  const denied=await saveScenario({isOwner:false});
  assert.equal(denied.db.costSheets[0].total,111,'Team cannot save HPP');
  assert.equal(denied.saveCalls.length,0);
  assert.equal(denied.messages[0].isError,true);

  const deleted=await deleteScenario({cloudConfigured:true,syncResult:true,selected:true});
  assert.equal(deleted.db.costSheets.length,0,'verified cloud deletion removes the HPP snapshot');
  assert.equal('hpp' in deleted.project,false,'verified cloud deletion clears project HPP fields');
  assert.equal(deleted.hppLines.length,0,'deleting the selected HPP clears its working lines');
  assert.equal(deleted.elements['hpp-labor'].value,0);
  assert.equal(deleted.syncCalls,1);
  assert.equal(deleted.saveCalls.length,1);
  assert.match(deleted.messages[0].message,/terverifikasi di Google Sheets/);

  const deleteFailed=await deleteScenario({cloudConfigured:true,syncResult:false,selected:true});
  assert.equal(deleteFailed.db.costSheets.length,1,'failed cloud deletion restores the HPP snapshot');
  assert.equal(JSON.stringify(deleteFailed.db.costSheets[0]),JSON.stringify(deleteFailed.oldSheet));
  assert.equal(deleteFailed.project.hpp,111,'failed cloud deletion restores project HPP fields');
  assert.equal(deleteFailed.project.suggestedPrice,222);
  assert.equal(deleteFailed.hppLines.length,1,'failed cloud deletion restores the working HPP lines');
  assert.equal(deleteFailed.elements['hpp-labor'].value,'50000');
  assert.equal(deleteFailed.saveCalls.length,2,'rollback is persisted locally after cloud deletion fails');
  assert.equal(deleteFailed.messages[0].isError,true);

  const deleteOffline=await deleteScenario({cloudConfigured:false,selected:false});
  assert.equal(deleteOffline.db.costSheets.length,0,'offline HPP deletion remains local');
  assert.equal(deleteOffline.syncCalls,0);
  assert.match(deleteOffline.messages[0].message,/penyimpanan lokal/);

  const deleteDenied=await deleteScenario({isOwner:false});
  assert.equal(deleteDenied.db.costSheets.length,1,'Team cannot delete HPP');
  assert.equal(deleteDenied.saveCalls.length,0);
  assert.equal(deleteDenied.messages[0].isError,true);
  console.log('CSK HPP selection, service/product costing, verified save, and verified delete workflow tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
