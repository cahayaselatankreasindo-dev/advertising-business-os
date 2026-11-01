/* HPP core & staging integration tests: CSK pricing rules, arithmetic, safety. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const hpp=require('./hpp-calculator.js');
const repo=__dirname;
function withCosts(q,rows,extras=[]){q.rows=rows;q.extras=extras;return q;}
test('Maklon ready without installation uses exact vendor price, no markup',()=>{
 const q=hpp.create('banner');
 const r=hpp.calc(q);
 assert.equal(r.baseHpp,70000);assert.equal(r.totalHpp,70000);
 assert.equal(r.price,70000);assert.equal(r.profit,0);
 assert.equal(r.markupPercent,0);assert.equal(r.ready,true);
});
test('PVC Board Nulite 5 mm reference price is Rp175,000 per 122 x 244 sheet',()=>{
 const q=hpp.create('rack');
 assert.equal(q.rows[0].unitCost,175000);
 assert.match(q.rows[0].description,/122 × 244/);
 const result=hpp.calc(q);
 assert.equal(result.baseHpp,175000);
 assert.equal(result.price,350000);
 assert.equal(result.missingPrices,1);
 assert.equal(result.ready,false,'unknown labour cost must be called out');
});
test('Installed job: markup 100% only on base HPP, pass-through costs added once',()=>{
 const q=withCosts(hpp.create('blank'),[
  hpp.row({description:'PVC',quantity:2,unitCost:175000,wastePercent:10}),
  hpp.row({category:'Jasa produksi',description:'Fabrication',quantity:1,unitCost:250000}),
  hpp.row({category:'Instalasi HPP',description:'Install labour',quantity:1,unitCost:125000})
 ],[
  hpp.fee({description:'Courier at cost',amount:80000}),
  hpp.fee({description:'Parking at cost',amount:20000})
 ]);
 q.outputQty=5;
 const r=hpp.calc(q);
 assert.equal(r.rows[0].total,385000);
 assert.equal(r.baseHpp,760000);
 assert.equal(r.extraTotal,100000);
 assert.equal(r.totalHpp,860000);
 assert.equal(r.markupPercent,100);
 assert.equal(r.markupAmount,760000);
 assert.equal(r.price,1620000);
 assert.equal(r.hppPerUnit,172000);
 assert.equal(r.pricePerUnit,324000);
 assert.equal(r.profit,760000);
 assert.equal(r.ready,true);
});
test('Vendor-ready job with extra delivery has 0 markup and no profit',()=>{
 const q=hpp.create('banner');
 q.extras=[hpp.fee({description:'Delivery passed through',amount:15000})];
 const r=hpp.calc(q);
 assert.equal(r.baseHpp,70000);
 assert.equal(r.totalHpp,85000);
 assert.equal(r.price,85000);
 assert.equal(r.profit,0);
});
test('Multiple units and waste mean extended unit prices but sale divides by output quantity',()=>{
 const q=hpp.create('blank');q.outputQty=3;
 q.rows=[hpp.row({description:'Acrylic panel',quantity:3,unitCost:60000,wastePercent:10})];
 const r=hpp.calc(q);
 assert.equal(r.baseHpp,198000);
 assert.equal(r.price,396000);
 assert.equal(r.pricePerUnit,132000);
});
test('Input validation rejects negative, impossible, and missing output quantities',()=>{
 const q=hpp.create('blank');q.rows=[hpp.row({description:'PVC',quantity:1,unitCost:175000})];
 for(const v of ['-1','NaN',Number.POSITIVE_INFINITY,1000000000001]){
  q.rows[0].unitCost=v;assert.throws(()=>hpp.calc(q));
 }
 q.rows[0].unitCost=175000;q.outputQty=0;
 assert.throws(()=>hpp.calc(q),/Jumlah hasil harus/);
});
test('Pricing mode must be enumerated and cannot set arbitrary markup',()=>{
 const q=hpp.create('blank');q.mode='custom_magic_500_percent';
 assert.throws(()=>hpp.calc(q),/Jenis pekerjaan/);
});
test('No hidden default supplier price for unknown booth material',()=>{
 const q=hpp.create('booth');const r=hpp.calc(q);
 assert.equal(r.price,0);assert.equal(r.ready,false);assert.equal(r.missingPrices,3);
});
test('HPP data remains outside Google Sheets engine and local CRM database',()=>{
 const sync=require('./sync-safe.js');
 for(const area of Object.keys(sync.DATA)) assert.notEqual(area,'hpp');
 const index=fs.readFileSync(path.join(repo,'index.html'),'utf8');
 assert.match(index,/id="page-hpp"/);
 assert.match(index,/nav\('hpp'\)/);
 assert.match(index,/hpp-calculator\.js/);
 assert.match(index,/hpp-ui\.js/);
 assert.match(index,/CSKHPPUI\.init/);
 const ui=fs.readFileSync(path.join(repo,'hpp-ui.js'),'utf8');
 assert.match(ui,/csk_hpp_local_quotes_v1/);
 assert.doesNotMatch(ui,/\b(fetch|XMLHttpRequest|GoogleSheets|ScriptApp|MailApp)\s*\(/);
});
test('HPP UI JS syntax and vendor reference prices are valid',()=>{
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(path.join(repo,'hpp-ui.js'),'utf8')));
 assert.ok(hpp.PRESETS.banner.rows.some(x=>x.unitCost===70000));
 assert.ok(hpp.PRESETS.rack.rows.some(x=>x.unitCost===175000));
});
