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
  console.log('CSK HPP selection, service/product costing, and verified save workflow tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
