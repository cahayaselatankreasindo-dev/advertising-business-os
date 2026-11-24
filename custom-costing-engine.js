'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CSKCustomCostingEngine=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  function positive(value,label){
    const n=Number(value);
    if(!Number.isFinite(n)||n<=0)throw new Error(label+' harus lebih dari nol.');
    return n;
  }
  function nonNegative(value,label){
    const n=Number(value);
    if(!Number.isFinite(n)||n<0)throw new Error(label+' tidak boleh negatif.');
    return n;
  }
  function getBaseUsageUnitPrice(material){
    if(!material||typeof material!=='object')throw new Error('Data material tidak tersedia.');
    const unit=String(material.unit||'').trim();
    const purchaseUnit=String(material.purchaseUnit||unit).trim();
    const purchasePrice=Number(material.purchasePrice);
    const factor=Number(material.conversionFactor)||1;
    const unitPrice=Number(material.unitPrice);
    const waste=Number(material.wasteRate)||0;
    if(!Number.isFinite(waste)||waste<0||waste>100)throw new Error('Waste master harus 0 sampai 100 persen.');
    if(Number.isFinite(purchasePrice)&&purchasePrice>0){
      if(!Number.isFinite(factor)||factor<=0||!unit||!purchaseUnit)throw new Error('Faktor konversi material belum valid.');
      return purchasePrice/factor;
    }
    if(purchaseUnit!==unit||!Number.isFinite(unitPrice)||unitPrice<=0)throw new Error('Harga dasar per satuan pakai belum tersedia.');
    return unitPrice/(1+waste/100);
  }
  function wasteAdjustedQty(qty,waste){
    const q=positive(qty,'Kuantitas');
    const w=nonNegative(waste||0,'Waste');
    if(w>100)throw new Error('Waste maksimal 100%.');
    return Math.ceil(q*(1+w/100));
  }
  function intersects(a,b){
    return !(b.x>=a.x+a.w||b.x+b.w<=a.x||b.y>=a.y+a.h||b.y+b.h<=a.y);
  }
  function contains(a,b){
    return b.x>=a.x&&b.y>=a.y&&b.x+b.w<=a.x+a.w&&b.y+b.h<=a.y+a.h;
  }
  function pruneFreeRects(rects){
    for(let i=0;i<rects.length;i++){
      if(!rects[i])continue;
      for(let j=i+1;j<rects.length;j++){
        if(!rects[j])continue;
        if(contains(rects[i],rects[j])){rects[j]=null;continue;}
        if(contains(rects[j],rects[i])){rects[i]=null;break;}
      }
    }
    return rects.filter(Boolean);
  }
  function splitFreeRects(freeRects,used){
    const next=[];
    freeRects.forEach(function(free){
      if(!intersects(free,used)){next.push(free);return;}
      if(used.x>free.x&&used.x<free.x+free.w)next.push({x:free.x,y:free.y,w:used.x-free.x,h:free.h});
      if(used.x+used.w<free.x+free.w)next.push({x:used.x+used.w,y:free.y,w:free.x+free.w-(used.x+used.w),h:free.h});
      if(used.y>free.y&&used.y<free.y+free.h)next.push({x:free.x,y:free.y,w:free.w,h:used.y-free.y});
      if(used.y+used.h<free.y+free.h)next.push({x:free.x,y:used.y+used.h,w:free.w,h:free.y+free.h-(used.y+used.h)});
    });
    return pruneFreeRects(next.filter(r=>r.w>0&&r.h>0));
  }
  function findSheetPosition(bin,width,height,allowRotation){
    let best=null;
    bin.freeRects.forEach(function(free){
      const orientations=[{w:width,h:height,rotated:false}];
      if(allowRotation&&width!==height)orientations.push({w:height,h:width,rotated:true});
      orientations.forEach(function(o){
        if(o.w>free.w||o.h>free.h)return;
        const leftoverW=free.w-o.w,leftoverH=free.h-o.h;
        const shortSide=Math.min(leftoverW,leftoverH),longSide=Math.max(leftoverW,leftoverH);
        if(!best||shortSide<best.shortSide||(shortSide===best.shortSide&&longSide<best.longSide)){
          best={x:free.x,y:free.y,w:o.w,h:o.h,rotated:o.rotated,shortSide,longSide};
        }
      });
    });
    return best;
  }
  function calculateSheetCutList(input){
    const sheetW=positive(input.sheetWidthMm,'Lebar lembar/roll');
    const sheetH=positive(input.sheetHeightMm,'Panjang lembar/roll');
    const kerf=nonNegative(input.kerfMm||0,'Lebar mata potong');
    const waste=nonNegative(input.wasteRate||0,'Waste');
    const allowRotation=input.allowRotation!==false;
    if(waste>100)throw new Error('Waste maksimal 100%.');
    if(!Array.isArray(input.parts)||!input.parts.length)throw new Error('Masukkan minimal satu ukuran komponen.');
    const pieces=[];
    input.parts.forEach(function(part,index){
      const w=positive(part.widthMm,'Lebar komponen');
      const h=positive(part.heightMm,'Panjang komponen');
      const qty=wasteAdjustedQty(part.qty,waste);
      if(qty>5000||pieces.length+qty>5000)throw new Error('Maksimal 5.000 potong per perhitungan.');
      for(let i=0;i<qty;i++)pieces.push({widthMm:w,heightMm:h,partIndex:index+1,area:w*h});
    });
    pieces.sort((a,b)=>b.area-a.area);
    const bins=[];
    const placements=[];
    for(const piece of pieces){
      const packedW=piece.widthMm+kerf,packedH=piece.heightMm+kerf;
      if(packedW>sheetW||packedH>sheetH){
        if(!allowRotation||packedH>sheetW||packedW>sheetH)throw new Error('Komponen '+piece.widthMm+' × '+piece.heightMm+' mm tidak muat pada lembar '+sheetW+' × '+sheetH+' mm.');
      }
      let chosenBin=-1,chosen=null;
      for(let i=0;i<bins.length;i++){
        const candidate=findSheetPosition(bins[i],packedW,packedH,allowRotation);
        if(candidate&&(!chosen||candidate.shortSide<chosen.shortSide||(candidate.shortSide===chosen.shortSide&&candidate.longSide<chosen.longSide))){
          chosenBin=i;chosen=candidate;
        }
      }
      if(!chosen){
        const bin={freeRects:[{x:0,y:0,w:sheetW,h:sheetH}],placements:[],chargedArea:0,actualArea:0};
        chosen=findSheetPosition(bin,packedW,packedH,allowRotation);
        if(!chosen)throw new Error('Ukuran komponen tidak dapat ditempatkan pada lembar.');
        bins.push(bin);chosenBin=bins.length-1;
      }
      const bin=bins[chosenBin];
      const used={x:chosen.x,y:chosen.y,w:chosen.w,h:chosen.h};
      bin.freeRects=splitFreeRects(bin.freeRects,used);
      bin.placements.push({x:chosen.x,y:chosen.y,widthMm:chosen.rotated?piece.heightMm:piece.widthMm,heightMm:chosen.rotated?piece.widthMm:piece.heightMm,rotated:chosen.rotated,partIndex:piece.partIndex});
      bin.chargedArea+=chosen.w*chosen.h;
      bin.actualArea+=piece.area;
      placements.push({sheet:chosenBin+1,x:chosen.x,y:chosen.y,widthMm:chosen.rotated?piece.heightMm:piece.widthMm,heightMm:chosen.rotated?piece.widthMm:piece.heightMm,rotated:chosen.rotated,partIndex:piece.partIndex});
    }
    const sheetArea=sheetW*sheetH;
    const actualArea=pieces.reduce((sum,p)=>sum+p.area,0);
    const chargedArea=bins.reduce((sum,b)=>sum+b.chargedArea,0);
    const totalArea=bins.length*sheetArea;
    return {
      sheetsUsed:bins.length,piecesCount:pieces.length,actualAreaMm2:actualArea,chargedAreaMm2:chargedArea,
      offcutAreaMm2:Math.max(0,totalArea-chargedArea),yieldPercent:totalArea?actualArea/totalArea*100:0,
      placements,perSheet:bins.map((b,i)=>({sheet:i+1,pieces:b.placements.length,usedAreaMm2:b.actualArea,offcutAreaMm2:Math.max(0,sheetArea-b.chargedArea)})),
      sheetAreaMm2:sheetArea
    };
  }
  function calculateBarCutList(input){
    const stock=positive(input.stockLengthMm,'Panjang stok/batang');
    const kerf=nonNegative(input.kerfMm||0,'Lebar mata potong');
    const waste=nonNegative(input.wasteRate||0,'Waste');
    if(waste>100)throw new Error('Waste maksimal 100%.');
    if(!Array.isArray(input.cuts)||!input.cuts.length)throw new Error('Masukkan minimal satu ukuran potongan.');
    const pieces=[];
    input.cuts.forEach(function(cut,index){
      const length=positive(cut.lengthMm,'Panjang potongan');
      const qty=wasteAdjustedQty(cut.qty,waste);
      if(length+kerf>stock)throw new Error('Potongan '+length+' mm melebihi panjang stok '+stock+' mm.');
      if(qty>5000||pieces.length+qty>5000)throw new Error('Maksimal 5.000 potong per perhitungan.');
      for(let i=0;i<qty;i++)pieces.push({lengthMm:length,partIndex:index+1});
    });
    pieces.sort((a,b)=>b.lengthMm-a.lengthMm);
    const bins=[];
    pieces.forEach(function(piece){
      const required=piece.lengthMm+kerf;
      let bin=bins.find(x=>x.remainingMm>=required);
      if(!bin){bin={remainingMm:stock,pieces:[]};bins.push(bin);}
      bin.remainingMm-=required;
      bin.pieces.push(piece);
    });
    const chargedLength=pieces.reduce((sum,p)=>sum+p.lengthMm+kerf,0);
    const actualLength=pieces.reduce((sum,p)=>sum+p.lengthMm,0);
    return {barsUsed:bins.length,piecesCount:pieces.length,actualLengthMm:actualLength,chargedLengthMm:chargedLength,offcutLengthMm:bins.reduce((sum,b)=>sum+b.remainingMm,0),perBar:bins.map((b,i)=>({bar:i+1,pieces:b.pieces.length,offcutMm:b.remainingMm}))};
  }
  function calculatePackCost(input){
    const qty=positive(input.usageQty,'Jumlah pemakaian');
    const packPrice=positive(input.packPrice,'Harga beli per kemasan');
    const units=positive(input.unitsPerPack,'Isi per kemasan');
    const waste=nonNegative(input.wasteRate||0,'Waste');
    if(waste>100)throw new Error('Waste maksimal 100%.');
    const adjusted=qty*(1+waste/100);
    const unitCost=packPrice/units;
    if(input.mode==='whole_pack'){
      const packs=Math.ceil(adjusted/units);
      return {lineQty:packs,lineUnit:input.purchaseUnit||'pack',lineUnitPrice:packPrice,totalCost:packs*packPrice,usageQty:qty,adjustedUsageQty:adjusted,unitsPerPack:units,packsPurchased:packs,unitCost};
    }
    return {lineQty:adjusted,lineUnit:input.usageUnit||'pcs',lineUnitPrice:unitCost,totalCost:adjusted*unitCost,usageQty:qty,adjustedUsageQty:adjusted,unitsPerPack:units,packsPurchased:Math.ceil(adjusted/units),unitCost};
  }
  function calculateAreaCost(input){
    const w=positive(input.widthMm,'Lebar komponen'),h=positive(input.heightMm,'Panjang komponen'),qty=positive(input.qty,'Jumlah komponen');
    const waste=nonNegative(input.wasteRate||0,'Waste');if(waste>100)throw new Error('Waste maksimal 100%.');
    const areaM2=(w*h*qty/1000000)*(1+waste/100);
    const basis=String(input.priceUnit||'m2').toLowerCase();
    const lineQty=basis.indexOf('cm')>=0?areaM2*10000:areaM2;
    return {lineQty,lineUnit:basis.indexOf('cm')>=0?'cm2':'m2',lineUnitPrice:positive(input.unitPrice,'Harga per satuan luas'),totalCost:lineQty*Number(input.unitPrice),areaM2};
  }
  function calculateLinearCost(input){
    const length=positive(input.lengthMm,'Panjang komponen'),qty=positive(input.qty,'Jumlah komponen');
    const waste=nonNegative(input.wasteRate||0,'Waste');if(waste>100)throw new Error('Waste maksimal 100%.');
    const meters=length*qty/1000*(1+waste/100),basis=String(input.priceUnit||'m').toLowerCase();
    const isCm=basis==='cm'||basis==='cm.';
    const lineQty=isCm?meters*100:meters;
    return {lineQty,lineUnit:isCm?'cm':'m',lineUnitPrice:positive(input.unitPrice,'Harga per satuan panjang'),totalCost:lineQty*Number(input.unitPrice),lengthM:meters};
  }
  function calculateVolumeCost(input){
    const w=positive(input.widthMm,'Lebar'),h=positive(input.heightMm,'Tinggi'),d=positive(input.depthMm,'Tebal/kedalaman'),qty=positive(input.qty,'Jumlah');
    const waste=nonNegative(input.wasteRate||0,'Waste');if(waste>100)throw new Error('Waste maksimal 100%.');
    const volumeM3=w*h*d*qty/1000000000*(1+waste/100);
    return {lineQty:volumeM3,lineUnit:'m3',lineUnitPrice:positive(input.unitPrice,'Harga per m3'),totalCost:volumeM3*Number(input.unitPrice),volumeM3};
  }
  return {getBaseUsageUnitPrice,calculateSheetCutList,calculateBarCutList,calculatePackCost,calculateAreaCost,calculateLinearCost,calculateVolumeCost};
});
