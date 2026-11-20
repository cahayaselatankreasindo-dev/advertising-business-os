(function(w){
'use strict';
var modalId='csk-custom-costing-modal',pendingLine=null,activeMaterialId='',activeMethod='sheet';
function el(id){return w.document.getElementById(id);}
function esc(value){return typeof w.escapeInvoiceHtml==='function'?w.escapeInvoiceHtml(value):String(value==null?'':value).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function money(value){return typeof w.formatRp==='function'?w.formatRp(value):'Rp '+Math.round(Number(value)||0).toLocaleString('id-ID');}
function bridge(){return w.CSKCustomCostingBridge||null;}
function notify(message,isError){var b=bridge();if(b&&b.toast)b.toast(message,!!isError);}
function num(id){var node=el(id);return node?Number(node.value):NaN;}
function val(id){var node=el(id);return node?node.value:'';}
function materialList(){var b=bridge();return b?b.getMaterials().filter(function(m){return m.status!=='inactive';}):[];}
function selectedMaterial(){return materialList().find(function(m){return String(m.id)===String(activeMaterialId);})||null;}
function methodFor(material){
  var map={sheet_cutlist:'sheet',roll_width_length:'roll',bar_length_cutlist:'bar',pack_to_piece:'pack',dimension_or_volume:'volume'};
  return map[material&&material.costingMethod]||'direct';
}
function ensureModal(){
  if(el(modalId))return;
  var style=w.document.createElement('style');
  style.textContent='#csk-custom-costing-modal{position:fixed;inset:0;z-index:100090;background:rgba(15,23,42,.78);display:flex;align-items:center;justify-content:center;padding:12px}#csk-custom-costing-modal.hidden{display:none}#csk-custom-costing-modal .cc-shell{width:100%;max-width:900px;max-height:95vh;overflow:hidden;background:#f8fafc;border-radius:18px;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,.3)}#csk-custom-costing-modal .cc-body{overflow:auto;padding:16px}#csk-custom-costing-modal .cc-input{display:block;width:100%;margin-top:5px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:9px;background:white;font-size:12px;color:#0f172a}#csk-custom-costing-modal .cc-label{display:block;font-size:11px;font-weight:700;color:#475569}#csk-custom-costing-modal .cc-btn{min-height:38px;padding:8px 12px;border-radius:9px;font-size:12px;font-weight:700}#csk-custom-costing-modal .cc-part{display:grid;grid-template-columns:1fr 1fr .7fr auto;gap:7px;align-items:end;padding:9px;background:white;border:1px solid #e2e8f0;border-radius:10px;margin-top:8px}#csk-custom-costing-modal .cc-part input{min-width:0}@media(max-width:600px){#csk-custom-costing-modal .cc-part{grid-template-columns:1fr 1fr}.cc-part button{grid-column:2}#csk-custom-costing-modal .cc-body{padding:12px}}';
  w.document.head.appendChild(style);
  var modal=w.document.createElement('div');modal.id=modalId;modal.className='hidden';
  modal.innerHTML='<div class="cc-shell"><header class="bg-slate-900 text-white p-4 flex items-center justify-between gap-3"><div><div class="font-bold text-sm">Custom Material Costing</div><div class="text-[10px] text-slate-300">Kalkulasi potong, dimensi, kemasan, dan pemakaian stok untuk HPP proyek</div></div><button type="button" class="cc-btn bg-slate-700" data-cc-action="close">Tutup</button></header><div class="cc-body space-y-4"><div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><label class="cc-label">Material<select id="cc-material" class="cc-input"></select></label><label class="cc-label">Metode kalkulasi<select id="cc-method" class="cc-input"><option value="sheet">Potong lembar / roll (mm)</option><option value="bar">Potong batang / profil (mm)</option><option value="pack">Kemasan ke satuan pakai</option><option value="area">Luas bidang (m² / cm²)</option><option value="linear">Panjang (meter / cm)</option><option value="volume">Volume (m³)</option><option value="direct">Satuan langsung</option></select></label></div><div id="cc-material-note" class="rounded-lg bg-blue-50 border border-blue-100 p-3 text-[11px] text-blue-900"></div><div id="cc-form" class="space-y-3"></div><div class="flex flex-wrap gap-2"><button type="button" class="cc-btn bg-slate-900 text-white" data-cc-action="calculate">Hitung kebutuhan & biaya</button><button type="button" class="cc-btn bg-slate-100 text-slate-700" data-cc-action="reset">Reset isian</button></div><div id="cc-result" class="hidden rounded-xl border border-emerald-200 bg-emerald-50 p-4"></div><div class="flex justify-end"><button type="button" id="cc-add-line" class="cc-btn bg-emerald-700 text-white" data-cc-action="add-line" disabled>Masukkan ke HPP Proyek</button></div></div><footer class="px-4 py-2 bg-white border-t text-[10px] text-slate-500">Estimasi pemotongan adalah alat bantu perencanaan, bukan nesting/CAM mesin. Periksa arah serat, cacat bahan, toleransi, mata potong, dan kondisi offcut sebelum pembelian/produksi.</footer></div>';
  modal.addEventListener('click',function(event){
    var button=event.target.closest('[data-cc-action]');
    if(!button)return;
    var action=button.dataset.ccAction;
    if(action==='close'){closeCskCustomCosting();return;}
    if(action==='reset'){renderForm();return;}
    if(action==='calculate'){calculate();return;}
    if(action==='add-line'){addLine();return;}
    if(action==='add-part'){addPartRow();return;}
    if(action==='remove-part'){var row=button.closest('.cc-part');if(row)row.remove();return;}
    if(action==='add-cut'){addCutRow();return;}
    if(action==='remove-cut'){var cut=button.closest('.cc-part');if(cut)cut.remove();return;}
  });
  modal.addEventListener('change',function(event){
    if(event.target.id==='cc-material'){activeMaterialId=event.target.value;activeMethod=methodFor(selectedMaterial());el('cc-method').value=activeMethod;renderForm();}
    if(event.target.id==='cc-method'){activeMethod=event.target.value;renderForm();}
  });
  w.document.body.appendChild(modal);
}
function openCskCustomCosting(){
  var b=bridge();
  if(!b){notify('Modul HPP belum siap.',true);return;}
  if(!b.getCurrentProjectId()){notify('Pilih proyek terlebih dahulu sebelum menghitung custom material.',true);return;}
  var materials=materialList();
  if(!materials.length){notify('Belum ada material aktif. Aktifkan material dan harga aktual terlebih dahulu.',true);return;}
  ensureModal();
  var select=el('cc-material');
  select.innerHTML=materials.map(function(m){return'<option value="'+esc(m.id)+'">'+esc(m.name)+' · '+esc(m.unit||'-')+' · '+money(m.unitPrice||0)+'</option>';}).join('');
  activeMaterialId=materials[0].id;activeMethod=methodFor(materials[0]);
  select.value=activeMaterialId;el('cc-method').value=activeMethod;
  el(modalId).classList.remove('hidden');renderForm();
}
function closeCskCustomCosting(){var modal=el(modalId);if(modal)modal.classList.add('hidden');pendingLine=null;}
function field(label,id,value,placeholder,step,min){
  return'<label class="cc-label">'+esc(label)+'<input class="cc-input" id="'+esc(id)+'" type="number" '+(min!==undefined?'min="'+min+'" ':'')+'step="'+(step||'any')+'" value="'+(value==null?'':esc(value))+'" placeholder="'+esc(placeholder||'')+'"></label>';
}
function selectField(label,id,options,selected){
  return'<label class="cc-label">'+esc(label)+'<select class="cc-input" id="'+esc(id)+'">'+options.map(function(o){return'<option value="'+esc(o.value)+'" '+(o.value===selected?'selected':'')+'>'+esc(o.label)+'</option>';}).join('')+'</select></label>';
}
function partRow(width,height,qty,removeAction){
  return'<div class="cc-part"><label class="cc-label">Lebar (mm)<input class="cc-input" data-cc-width type="number" min="1" step="1" value="'+esc(width||'')+'"></label><label class="cc-label">Panjang (mm)<input class="cc-input" data-cc-height type="number" min="1" step="1" value="'+esc(height||'')+'"></label><label class="cc-label">Qty<input class="cc-input" data-cc-qty type="number" min="1" step="1" value="'+esc(qty||1)+'"></label><button type="button" class="cc-btn bg-red-50 text-red-600" data-cc-action="'+removeAction+'">Hapus</button></div>';
}
function cutRow(length,qty,removeAction){
  return'<div class="cc-part"><label class="cc-label">Panjang potong (mm)<input class="cc-input" data-cc-length type="number" min="1" step="1" value="'+esc(length||'')+'"></label><label class="cc-label">Keterangan (opsional)<input class="cc-input" data-cc-label type="text" value="" placeholder="Contoh: kaki rak"></label><label class="cc-label">Qty<input class="cc-input" data-cc-qty type="number" min="1" step="1" value="'+esc(qty||1)+'"></label><button type="button" class="cc-btn bg-red-50 text-red-600" data-cc-action="'+removeAction+'">Hapus</button></div>';
}
function renderForm(){
  var m=selectedMaterial(),box=el('cc-form');if(!m||!box)return;
  pendingLine=null;el('cc-result').classList.add('hidden');el('cc-add-line').disabled=true;
  el('cc-material-note').textContent='Supplier: '+(m.supplierName||'belum dicatat')+' · Harga beli: '+money(m.purchasePrice||0)+' / '+(m.purchaseUnit||'-')+' · Harga pakai: '+money(m.unitPrice||0)+' / '+(m.unit||'-')+'. Pastikan harga dan spesifikasi masih berlaku.';
  var waste=Number(m.wasteRate)||0,method=activeMethod,html='';
  if(method==='sheet'||method==='roll'){
    var sw=Number(m.widthMm)||'',sh=method==='roll'?(Number(m.rollLengthM)||0)*1000:(Number(m.lengthMm)||'');
    html='<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">'+field(method==='roll'?'Lebar roll (mm)':'Lebar lembar (mm)','cc-stock-width',sw,'Contoh 1220',1,1)+field(method==='roll'?'Panjang roll (mm)':'Panjang lembar (mm)','cc-stock-height',sh,'Contoh 2440',1,1)+field('Kerf / mata potong (mm)','cc-kerf',3,'3',0,0)+field('Waste / cadangan (%)','cc-waste',waste,'5',.1,0)+'</div>'+selectField('Perlakuan material',[{value:'whole',label:'Beli lembar/roll utuh (biaya penuh)'},{value:'stock',label:'Gunakan stok/offcut (biaya proporsional luas)'}],'cc-source-mode','whole')+'<div class="flex items-center gap-2 text-xs"><input id="cc-rotate" type="checkbox" checked><label for="cc-rotate">Izinkan komponen diputar 90° (periksa arah serat/tekstur)</label></div><div><div class="flex items-center justify-between"><b class="text-xs">Daftar komponen</b><button type="button" class="cc-btn bg-blue-50 text-blue-700" data-cc-action="add-part">+ Tambah ukuran</button></div><div id="cc-part-rows">'+partRow('','','1','remove-part')+'</div></div>';
  }else if(method==='bar'){
    html='<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">'+field('Panjang stok / batang (mm)', 'cc-stock-length',Number(m.lengthMm)||6000,'6000',1,1)+field('Kerf / mata potong (mm)','cc-kerf',3,'3',0,0)+field('Waste / cadangan (%)','cc-waste',waste,'5',.1,0)+'</div>'+selectField('Perlakuan material',[{value:'whole',label:'Beli batang utuh (biaya penuh)'},{value:'stock',label:'Gunakan stok (biaya proporsional panjang)'}],'cc-source-mode','whole')+'<div><div class="flex items-center justify-between"><b class="text-xs">Daftar potongan profil</b><button type="button" class="cc-btn bg-blue-50 text-blue-700" data-cc-action="add-cut">+ Tambah ukuran</button></div><div id="cc-cut-rows">'+cutRow('','1','remove-cut')+'</div></div>';
  }else if(method==='pack'){
    html='<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">'+field('Jumlah pemakaian (pcs/unit)','cc-usage-qty','','Contoh 30',.01,.01)+field('Isi per kemasan','cc-units-pack',Number(m.conversionFactor)||'','Contoh 100',.01,.01)+field('Harga beli per kemasan (Rp)','cc-pack-price',Number(m.purchasePrice)||'','Harga supplier',1,1)+field('Waste / cadangan (%)','cc-waste',waste,'0',.1,0)+'</div>'+selectField('Perlakuan pembelian',[{value:'consumption',label:'Hitung pemakaian aktual (pro-rata)'},{value:'whole_pack',label:'Hitung pembelian kemasan utuh'}],'cc-source-mode','consumption')+'<p class="text-[10px] text-slate-500">Pro-rata cocok untuk menghitung biaya pemakaian saat sisa kemasan tetap menjadi stok. Pilih kemasan utuh jika proyek memang harus membeli pack/box baru.</p>';
  }else if(method==='area'){
    html='<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">'+field('Lebar bidang (mm)','cc-width','','Contoh 500',1,1)+field('Panjang bidang (mm)','cc-height','','Contoh 800',1,1)+field('Jumlah bidang','cc-qty',1,'1',1,1)+field('Waste (%)','cc-waste',waste,'5',.1,0)+field('Harga per '+(String(m.unit||'m2').toLowerCase().indexOf('cm')>=0?'cm²':'m²')+' (Rp)','cc-unit-price',Number(m.unitPrice)||'','Harga master',1,1)+'</div><div class="text-[10px] text-slate-500">Luas dihitung dari ukuran mm lalu dikonversi ke '+esc(m.unit||'m2')+'.</div>';
  }else if(method==='linear'){
    html='<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">'+field('Panjang potongan (mm)','cc-length','','Contoh 2500',1,1)+field('Jumlah potongan','cc-qty',1,'1',1,1)+field('Waste (%)','cc-waste',waste,'5',.1,0)+field('Harga per '+(String(m.unit||'m').toLowerCase()==='cm'?'cm':'m')+' (Rp)','cc-unit-price',Number(m.unitPrice)||'','Harga master',1,1)+'</div>';
  }else if(method==='volume'){
    html='<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">'+field('Lebar (mm)','cc-width','','',1,1)+field('Tinggi (mm)','cc-height','','',1,1)+field('Tebal / kedalaman (mm)','cc-depth','','',1,1)+field('Jumlah','cc-qty',1,'1',1,1)+field('Waste (%)','cc-waste',waste,'5',.1,0)+field('Harga per m³ (Rp)','cc-unit-price',Number(m.unitPrice)||'','Harga master',1,1)+'</div>';
  }else{
    html='<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">'+field('Jumlah pemakaian','cc-qty',1,'1',.01,.01)+field('Harga per satuan (Rp)','cc-unit-price',Number(m.unitPrice)||'','Harga master',1,1)+'<label class="cc-label">Satuan<input id="cc-unit" class="cc-input" value="'+esc(m.unit||'unit')+'"></label></div>';
  }
  box.innerHTML=html;
}
function addPartRow(){var box=el('cc-part-rows');if(box)box.insertAdjacentHTML('beforeend',partRow('','','1','remove-part'));}
function addCutRow(){var box=el('cc-cut-rows');if(box)box.insertAdjacentHTML('beforeend',cutRow('','1','remove-cut'));}
function readRows(selector,kind){
  return Array.from(el(modalId).querySelectorAll(selector)).map(function(row){
    var qty=Number(row.querySelector('[data-cc-qty]').value);
    if(kind==='part')return{widthMm:Number(row.querySelector('[data-cc-width]').value),heightMm:Number(row.querySelector('[data-cc-height]').value),qty:qty};
    return{lengthMm:Number(row.querySelector('[data-cc-length]').value),qty:qty,label:row.querySelector('[data-cc-label]').value};
  });
}
function makeLine(m,qty,unit,unitPrice,details){
  return{itemType:'material',materialId:m.id,name:m.name+' · '+details.label,unit:unit,qty:qty,unitPrice:unitPrice,subtotal:qty*unitPrice,costingMethod:details.method,costingDetails:details,priceSnapshot:{purchasePrice:Number(m.purchasePrice)||0,unitPrice:Number(m.unitPrice)||0,priceDate:m.priceDate||'',supplierName:m.supplierName||''}};
}
function calculate(){
  var m=selectedMaterial();if(!m){notify('Pilih material terlebih dahulu.',true);return;}
  try{
    var E=w.CSKCustomCostingEngine;if(!E)throw new Error('Mesin kalkulasi belum dimuat.');
    var waste=Number(val('cc-waste')||0),result,line,summary,source=val('cc-source-mode')||'';
    if(activeMethod==='sheet'||activeMethod==='roll'){
      var sw=num('cc-stock-width'),sh=num('cc-stock-height'),kerf=num('cc-kerf')||0;
      result=E.calculateSheetCutList({sheetWidthMm:sw,sheetHeightMm:sh,kerfMm:kerf,wasteRate:waste,allowRotation:el('cc-rotate').checked,parts:readRows('#cc-part-rows .cc-part','part').map(function(p){return p;})});
      var price=Number(m.purchasePrice);if(!Number.isFinite(price)||price<=0)throw new Error('Harga beli per lembar/roll belum diisi dan diverifikasi pada master material.');
      if(source==='stock'){
        var area=result.chargedAreaMm2/1000000,stockArea=result.sheetAreaMm2/1000000;
        line=makeLine(m,area,'m2',price/stockArea,{method:activeMethod,sourceMode:source,label:'Pemakaian stok/offcut',summary:result.sheetsUsed+' lembar/roll ekuivalen; '+result.piecesCount+' komponen; biaya proporsional luas.',result:result,input:{sheetWidthMm:sw,sheetHeightMm:sh,kerfMm:kerf,wasteRate:waste,parts:readRows('[data-cc-width]','part')}});
      }else{
        line=makeLine(m,result.sheetsUsed,m.purchaseUnit|| (activeMethod==='roll'?'roll':'lembar'),price,{method:activeMethod,sourceMode:source,label:activeMethod==='roll'?'Potong roll':'Potong lembar',summary:result.sheetsUsed+' '+(m.purchaseUnit||'lembar/roll')+' dibutuhkan untuk '+result.piecesCount+' komponen; yield '+result.yieldPercent.toFixed(1)+'%.',result:result,input:{sheetWidthMm:sw,sheetHeightMm:sh,kerfMm:kerf,wasteRate:waste,parts:readRows('[data-cc-width]','part')}});
      }
      summary='<b>'+result.sheetsUsed+' lembar/roll</b> · '+result.piecesCount+' komponen · yield '+result.yieldPercent.toFixed(1)+'% · estimasi offcut '+(result.offcutAreaMm2/1000000).toFixed(3)+' m².';
    }else if(activeMethod==='bar'){
      result=E.calculateBarCutList({stockLengthMm:num('cc-stock-length'),kerfMm:num('cc-kerf')||0,wasteRate:waste,cuts:readRows('#cc-cut-rows .cc-part','cut')});
      var barPrice=Number(m.purchasePrice);if(!Number.isFinite(barPrice)||barPrice<=0)throw new Error('Harga beli per batang belum diisi dan diverifikasi pada master material.');
      if(source==='stock'){
        var usedM=result.chargedLengthMm/1000,stockM=num('cc-stock-length')/1000;
        line=makeLine(m,usedM,'m',barPrice/stockM,{method:activeMethod,sourceMode:source,label:'Pemakaian stok profil',summary:result.barsUsed+' batang ekuivalen; '+result.piecesCount+' potongan; biaya proporsional panjang.',result:result,input:{stockLengthMm:num('cc-stock-length'),kerfMm:num('cc-kerf'),wasteRate:waste,cuts:readRows('[data-cc-length]','cut')}});
      }else{
        line=makeLine(m,result.barsUsed,m.purchaseUnit||'batang',barPrice,{method:activeMethod,sourceMode:source,label:'Potong profil',summary:result.barsUsed+' batang dibutuhkan untuk '+result.piecesCount+' potongan.',result:result,input:{stockLengthMm:num('cc-stock-length'),kerfMm:num('cc-kerf'),wasteRate:waste,cuts:readRows('[data-cc-length]','cut')}});
      }
      summary='<b>'+result.barsUsed+' batang</b> · '+result.piecesCount+' potongan · sisa total '+(result.offcutLengthMm/1000).toFixed(2)+' m.';
    }else if(activeMethod==='pack'){
      result=E.calculatePackCost({usageQty:num('cc-usage-qty'),packPrice:num('cc-pack-price'),unitsPerPack:num('cc-units-pack'),mode:source,usageUnit:m.unit||'pcs',purchaseUnit:m.purchaseUnit||'pack',wasteRate:waste});
      line=makeLine(m,result.lineQty,result.lineUnit,result.lineUnitPrice,{method:activeMethod,sourceMode:source,label:'Konversi kemasan',summary:result.packsPurchased+' kemasan ekuivalen untuk '+result.adjustedUsageQty+' '+(m.unit||'pcs')+'.',result:result,input:{usageQty:num('cc-usage-qty'),packPrice:num('cc-pack-price'),unitsPerPack:num('cc-units-pack'),wasteRate:waste}});
      summary='<b>'+money(result.totalCost)+'</b> · '+result.packsPurchased+' kemasan ekuivalen · biaya per '+(m.unit||'pcs')+' '+money(result.unitCost)+'.';
    }else if(activeMethod==='area'){
      var unit=String(m.unit||'m2').toLowerCase().indexOf('cm')>=0?'cm2':'m2';
      result=E.calculateAreaCost({widthMm:num('cc-width'),heightMm:num('cc-height'),qty:num('cc-qty'),wasteRate:waste,unitPrice:num('cc-unit-price'),priceUnit:unit});
      line=makeLine(m,result.lineQty,result.lineUnit,result.lineUnitPrice,{method:activeMethod,label:'Pemakaian luas custom',summary:result.areaM2.toFixed(4)+' m² termasuk waste.',result:result,input:{widthMm:num('cc-width'),heightMm:num('cc-height'),qty:num('cc-qty'),wasteRate:waste}});
      summary='<b>'+result.lineQty.toFixed(2)+' '+result.lineUnit+'</b> · biaya '+money(result.totalCost)+'.';
    }else if(activeMethod==='linear'){
      var linearUnit=String(m.unit||'m').toLowerCase()==='cm'?'cm':'m';
      result=E.calculateLinearCost({lengthMm:num('cc-length'),qty:num('cc-qty'),wasteRate:waste,unitPrice:num('cc-unit-price'),priceUnit:linearUnit});
      line=makeLine(m,result.lineQty,result.lineUnit,result.lineUnitPrice,{method:activeMethod,label:'Pemakaian panjang custom',summary:result.lengthM.toFixed(3)+' meter termasuk waste.',result:result,input:{lengthMm:num('cc-length'),qty:num('cc-qty'),wasteRate:waste}});
      summary='<b>'+result.lineQty.toFixed(2)+' '+result.lineUnit+'</b> · biaya '+money(result.totalCost)+'.';
    }else if(activeMethod==='volume'){
      result=E.calculateVolumeCost({widthMm:num('cc-width'),heightMm:num('cc-height'),depthMm:num('cc-depth'),qty:num('cc-qty'),wasteRate:waste,unitPrice:num('cc-unit-price')});
      line=makeLine(m,result.lineQty,'m3',result.lineUnitPrice,{method:activeMethod,label:'Pemakaian volume custom',summary:result.volumeM3.toFixed(6)+' m³ termasuk waste.',result:result,input:{widthMm:num('cc-width'),heightMm:num('cc-height'),depthMm:num('cc-depth'),qty:num('cc-qty'),wasteRate:waste}});
      summary='<b>'+result.volumeM3.toFixed(6)+' m³</b> · biaya '+money(result.totalCost)+'.';
    }else{
      var qty=num('cc-qty'),unitPrice=num('cc-unit-price'),unit=val('cc-unit')||m.unit||'unit';
      if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(unitPrice)||unitPrice<=0)throw new Error('Jumlah dan harga satuan harus lebih dari nol.');
      result={lineQty:qty,lineUnit:unit,lineUnitPrice:unitPrice,totalCost:qty*unitPrice};
      line=makeLine(m,qty,unit,unitPrice,{method:'direct',label:'Pemakaian satuan langsung',summary:qty+' '+unit+'.',result:result,input:{qty:qty,unit:unit,unitPrice:unitPrice}});
      summary='<b>'+qty+' '+esc(unit)+'</b> · biaya '+money(result.totalCost)+'.';
    }
    line.subtotal=line.qty*line.unitPrice;
    pendingLine=line;
    el('cc-result').innerHTML='<div class="text-[10px] uppercase font-bold tracking-wider text-emerald-800">Hasil estimasi</div><div class="text-sm text-emerald-950 mt-1">'+summary+'</div><div class="text-xs text-emerald-900 mt-2">Biaya masuk HPP: <b>'+money(line.subtotal)+'</b> · '+esc(line.qty.toFixed?line.qty.toFixed(3):line.qty)+' '+esc(line.unit)+' × '+money(line.unitPrice)+'</div><div class="text-[10px] text-emerald-800 mt-2">Rincian kalkulasi tersimpan bersama snapshot HPP proyek.</div>';
    el('cc-result').classList.remove('hidden');el('cc-add-line').disabled=false;
  }catch(error){pendingLine=null;el('cc-add-line').disabled=true;notify(error.message||String(error),true);}
}
function addLine(){
  var b=bridge();if(!pendingLine||!b)return;
  if(!b.addLine(pendingLine))return;
  notify('Hasil custom costing berhasil dimasukkan ke HPP proyek.');
  closeCskCustomCosting();
}
w.openCskCustomCosting=openCskCustomCosting;
w.closeCskCustomCosting=closeCskCustomCosting;
})(window);
