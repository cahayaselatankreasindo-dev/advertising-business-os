'use strict';
const assert=require('node:assert/strict');
const engine=require('./custom-costing-engine');
const approx=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-9,label+': expected '+expected+', got '+actual);

const sheet=engine.calculateSheetCutList({
  sheetWidthMm:1220,sheetHeightMm:2440,kerfMm:3,wasteRate:0,allowRotation:true,
  parts:[{widthMm:500,heightMm:500,qty:8}]
});
assert.equal(sheet.sheetsUsed,1,'eight 500x500 parts fit in one 1220x2440 sheet');
assert.equal(sheet.piecesCount,8);
assert.ok(sheet.yieldPercent>0&&sheet.yieldPercent<100);
assert.equal(sheet.placements.length,8);

const rotatedDefault=engine.calculateSheetCutList({
  sheetWidthMm:100,sheetHeightMm:200,kerfMm:0,
  parts:[{widthMm:150,heightMm:80,qty:1}]
});
assert.equal(rotatedDefault.sheetsUsed,1,'default rotation should allow a component to fit after a 90-degree turn');
assert.equal(rotatedDefault.placements[0].rotated,true,'the placement should report the applied 90-degree rotation');

assert.throws(()=>engine.calculateSheetCutList({
  sheetWidthMm:100,sheetHeightMm:200,kerfMm:0,allowRotation:false,
  parts:[{widthMm:150,heightMm:80,qty:1}]
}),/tidak muat|tidak dapat ditempatkan/,'explicitly disabled rotation must reject a component that only fits when rotated');

const mixed=engine.calculateSheetCutList({
  sheetWidthMm:1220,sheetHeightMm:2440,kerfMm:3,wasteRate:10,allowRotation:true,
  parts:[{widthMm:600,heightMm:400,qty:2},{widthMm:300,heightMm:200,qty:2}]
});
assert.equal(mixed.piecesCount,6,'waste allowance rounds each component quantity upward before nesting');
assert.ok(mixed.sheetsUsed>=1);

assert.throws(()=>engine.calculateSheetCutList({
  sheetWidthMm:500,sheetHeightMm:500,parts:[{widthMm:600,heightMm:600,qty:1}]
}),/tidak muat|tidak dapat ditempatkan/,'oversized sheet part is rejected');

const bars=engine.calculateBarCutList({
  stockLengthMm:6000,kerfMm:3,wasteRate:0,
  cuts:[{lengthMm:2500,qty:2},{lengthMm:1200,qty:1},{lengthMm:500,qty:1}]
});
assert.equal(bars.piecesCount,4);
assert.equal(bars.barsUsed,2,'first-fit decreasing respects stock length and kerf');
assert.ok(bars.offcutLengthMm>=0);

assert.throws(()=>engine.calculateBarCutList({
  stockLengthMm:6000,cuts:[{lengthMm:6500,qty:1}]
}),/melebihi panjang stok/,'cut longer than stock is rejected');

const usedPack=engine.calculatePackCost({
  usageQty:30,packPrice:60000,unitsPerPack:100,mode:'consumption',usageUnit:'pcs',purchaseUnit:'pack'
});
assert.equal(usedPack.lineQty,30);
assert.equal(usedPack.lineUnitPrice,600);
assert.equal(usedPack.totalCost,18000);

const wholePack=engine.calculatePackCost({
  usageQty:130,packPrice:60000,unitsPerPack:100,mode:'whole_pack',usageUnit:'pcs',purchaseUnit:'pack'
});
assert.equal(wholePack.lineQty,2);
assert.equal(wholePack.totalCost,120000);

const area=engine.calculateAreaCost({widthMm:500,heightMm:400,qty:2,wasteRate:10,unitPrice:100000,priceUnit:'m2'});
approx(area.lineQty,0.44,'area conversion to square meters');
approx(area.totalCost,44000,'area cost');

const areaCm=engine.calculateAreaCost({widthMm:100,heightMm:100,qty:1,unitPrice:2,priceUnit:'cm2'});
assert.equal(areaCm.lineQty,100);
assert.equal(areaCm.totalCost,200);

const linear=engine.calculateLinearCost({lengthMm:2500,qty:2,wasteRate:0,unitPrice:12000,priceUnit:'m'});
assert.equal(linear.lineQty,5);
assert.equal(linear.totalCost,60000);

const linearCm=engine.calculateLinearCost({lengthMm:250,qty:2,unitPrice:100,priceUnit:'cm'});
assert.equal(linearCm.lineQty,50);
assert.equal(linearCm.totalCost,5000);

const volume=engine.calculateVolumeCost({widthMm:100,heightMm:100,depthMm:10,qty:2,unitPrice:1000000});
approx(volume.volumeM3,0.0002,'volume conversion to cubic meters');
approx(volume.totalCost,200,'volume cost');

console.log('CSK custom costing engine tests passed.');
