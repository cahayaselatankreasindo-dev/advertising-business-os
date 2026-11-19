(function(w){
'use strict';
var catalogData = null;
var activeMode = 'material';
var selectedFamily = null;
var modalId = 'csk-catalog-manager';
function el(id){return w.document.getElementById(id);}
function esc(value){
  return typeof w.escapeInvoiceHtml === 'function'
    ? w.escapeInvoiceHtml(value)
    : String(value == null ? '' : value).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});
}
function say(message,isError){if(typeof w.showToast==='function')w.showToast(message,!!isError);}
function ownerOnly(){if(typeof w.isOwnerSession==='function'&&w.isOwnerSession())return true;say('Katalog dan master data hanya dapat dikelola Owner.',true);return false;}
function getDb(){return typeof db!=='undefined'?db:(w.db||null);}
function todayISO(){var d=new Date();return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function rupiah(value){return typeof w.formatRp==='function'?w.formatRp(value):'Rp '+Math.round(Number(value)||0).toLocaleString('id-ID');}
function loadCatalog(){
  if(catalogData)return Promise.resolve(catalogData);
  return w.fetch('./data/advertising-catalog-seed.json',{cache:'no-cache'}).then(function(response){
    if(!response.ok)throw new Error('Katalog referensi tidak dapat dimuat ('+response.status+').');
    return response.json();
  }).then(function(data){
    if(!data||!Array.isArray(data.materialFamilies)||!Array.isArray(data.serviceFamilies))throw new Error('Struktur katalog referensi tidak valid.');
    catalogData=data;return data;
  });
}
function ensureModal(){
  if(el(modalId))return;
  var style=w.document.createElement('style');
  style.textContent='#csk-catalog-manager{position:fixed;inset:0;z-index:100080;background:rgba(15,23,42,.78);display:flex;align-items:center;justify-content:center;padding:12px}#csk-catalog-manager.hidden{display:none}#csk-catalog-manager .cm-shell{width:100%;max-width:1180px;max-height:94vh;overflow:hidden;background:#f8fafc;border-radius:18px;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,.28)}#csk-catalog-manager .cm-body{display:grid;grid-template-columns:310px minmax(0,1fr);min-height:0;overflow:hidden}#csk-catalog-manager .cm-input{display:block;width:100%;margin-top:5px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:9px;background:white;font-size:12px;color:#0f172a}#csk-catalog-manager .cm-label{display:block;font-size:11px;font-weight:700;color:#475569}#csk-catalog-manager .cm-card{display:block;width:100%;text-align:left;background:#fff;border:1px solid #e2e8f0;border-radius:11px;padding:11px;margin-top:8px}#csk-catalog-manager .cm-card.active{border-color:#e56b18;background:#fff7ed;box-shadow:0 0 0 1px #e56b18 inset}#csk-catalog-manager .cm-btn{min-height:38px;padding:8px 12px;border-radius:9px;font-size:12px;font-weight:700}#csk-catalog-manager .cm-scroll{overflow:auto;min-height:0}@media(max-width:760px){#csk-catalog-manager .cm-body{grid-template-columns:1fr;overflow:auto}#csk-catalog-manager .cm-list-pane{max-height:230px;border-right:0!important;border-bottom:1px solid #e2e8f0}#csk-catalog-manager .cm-detail-pane{overflow:visible!important}#csk-catalog-manager .cm-shell{max-height:96vh}}';
  w.document.head.appendChild(style);
  var modal=w.document.createElement('div');modal.id=modalId;modal.className='hidden';
  modal.innerHTML='<div class="cm-shell"><header class="bg-slate-900 text-white p-4 flex items-center justify-between gap-3"><div><div class="text-sm font-bold">CSK Catalog Manager</div><div class="text-[10px] text-slate-300">Referensi bahan dan jasa advertising - aktifkan hanya setelah harga diverifikasi</div></div><button type="button" class="cm-btn bg-slate-700 text-white" data-cm-action="close">Tutup</button></header><div class="flex gap-2 p-3 bg-white border-b"><button type="button" class="cm-btn" data-cm-mode="material">Bahan baku</button><button type="button" class="cm-btn" data-cm-mode="service">Jasa / layanan</button></div><div class="cm-body"><aside class="cm-list-pane cm-scroll border-r p-3 bg-slate-50"><input id="cm-search" class="cm-input mt-0" placeholder="Cari bahan, jenis, atau kategori..."><div id="cm-family-list" class="mt-2"></div></aside><section class="cm-detail-pane cm-scroll p-4"><div id="cm-family-detail"><div class="text-sm text-slate-500 p-6 text-center">Pilih keluarga bahan atau jasa di sebelah kiri.</div></div></section></div><footer class="px-4 py-2 bg-white border-t text-[10px] text-slate-500">Template referensi belum memiliki harga. Item tidak akan masuk ke quotation sampai supplier, sumber harga, satuan, dan konversinya dilengkapi.</footer></div>';
  modal.addEventListener('click',function(event){
    var button=event.target.closest('[data-cm-action],[data-cm-mode],[data-cm-family]');
    if(!button)return;
    if(button.dataset.cmAction==='close'){closeCskCatalogManager();return;}
    if(button.dataset.cmMode){activeMode=button.dataset.cmMode;selectedFamily=null;renderCatalogModal();return;}
    if(button.dataset.cmFamily){selectFamily(button.dataset.cmFamily);return;}
    if(button.dataset.cmAction==='save-material'){saveMaterialFromCatalog();return;}
    if(button.dataset.cmAction==='save-service'){saveServiceFromCatalog();return;}
  });
  modal.addEventListener('change',function(event){
    if(event.target.matches('[data-cm-attribute]'))updateVariantPreview();
    if(event.target.id==='cm-purchase-price'||event.target.id==='cm-conversion-factor')updatePurchasePricePreview();
  });
  modal.addEventListener('input',function(event){
    if(event.target.id==='cm-search')renderFamilyList();
    if(event.target.id==='cm-purchase-price'||event.target.id==='cm-conversion-factor')updatePurchasePricePreview();
  });
  w.document.body.appendChild(modal);
}
function familyRows(){
  if(!catalogData)return[];
  return activeMode==='material'?catalogData.materialFamilies:catalogData.serviceFamilies;
}
function renderCatalogModal(){
  ensureModal();
  var modal=el(modalId);modal.classList.remove('hidden');
  var buttons=modal.querySelectorAll('[data-cm-mode]');
  buttons.forEach(function(button){
    var active=button.dataset.cmMode===activeMode;
    button.className='cm-btn '+(active?'bg-orange-600 text-white':'bg-slate-100 text-slate-700');
  });
  if(el('cm-search'))el('cm-search').value='';
  renderFamilyList();
  if(selectedFamily)renderFamilyDetail();
  else el('cm-family-detail').innerHTML='<div class="text-sm text-slate-500 p-6 text-center">Pilih keluarga '+(activeMode==='material'?'bahan baku':'jasa')+' di sebelah kiri untuk melihat varian dan mengaktifkan SKU.</div>';
}
function renderFamilyList(){
  var box=el('cm-family-list');if(!box)return;
  var q=(el('cm-search')?el('cm-search').value:'').trim().toLowerCase();
  var rows=familyRows().filter(function(row){return[row.familyName,row.name,row.category,row.description,row.familyCode,row.serviceCode].some(function(v){return String(v||'').toLowerCase().indexOf(q)>=0;});});
  box.innerHTML=rows.map(function(row){
    var id=activeMode==='material'?row.familyCode:row.serviceCode;
    var title=row.familyName||row.name;
    return '<button type="button" class="cm-card '+(selectedFamily===id?'active':'')+'" data-cm-family="'+esc(id)+'"><b class="block text-xs text-slate-800">'+esc(title)+'</b><span class="block text-[10px] text-slate-500 mt-1">'+esc(row.category)+'</span><span class="block text-[10px] text-slate-400 mt-1">'+esc(id)+'</span></button>';
  }).join('')||'<div class="text-xs text-slate-400 text-center py-6">Tidak ada keluarga yang cocok.</div>';
}
function getSelectedFamily(){
  return familyRows().find(function(row){return(activeMode==='material'?row.familyCode:row.serviceCode)===selectedFamily;})||null;
}
function selectFamily(id){selectedFamily=id;renderFamilyList();renderFamilyDetail();}
function attributeOptions(value){
  return value.map(function(option){
    var stored=typeof option==='object'?JSON.stringify(option):String(option);
    var label=typeof option==='object'?(option.code||[option.widthMm,option.lengthMm].filter(Boolean).join(' x ')+' mm'):String(option);
    return '<option value="'+esc(stored)+'">'+esc(label)+'</option>';
  }).join('');
}
function attributeLabel(key){
  var labels={thicknessMm:'Ketebalan (mm)',grammageGsm:'Gramatur (gsm)',sheetSizes:'Ukuran lembar',rollWidthsMm:'Lebar roll (mm)',rollLengthsM:'Panjang roll (m)',colors:'Warna',color:'Warna',finish:'Finishing',type:'Jenis',types:'Jenis',profile:'Profil',wallThicknessMm:'Tebal dinding (mm)',standardLengthMm:'Panjang batang (mm)',aluminiumSkinMm:'Ketebalan kulit aluminium (mm)',material:'Material',diameterMm:'Diameter (mm)',lengthMm:'Panjang (mm)',voltage:'Tegangan (V)',powerW:'Daya (W)',capacityW:'Kapasitas (W)',outputVoltage:'Tegangan output (V)',inputVoltage:'Tegangan input',plies:'Jumlah ply',textures:'Tekstur',adhesive:'Jenis perekat',species:'Jenis kayu',grade:'Grade',moistureContent:'Kondisi kadar air',sizesMm2:'Ukuran kabel (mm2)',grit:'Grit amplas'};
  return labels[key]||key.replace(/([A-Z])/g,' $1').replace(/^./,function(s){return s.toUpperCase();});
}
function renderAttributeControls(attributes){
  return Object.keys(attributes||{}).filter(function(key){return Array.isArray(attributes[key])&&attributes[key].length;}).map(function(key){
    return '<label class="cm-label">'+esc(attributeLabel(key))+'<select class="cm-input" data-cm-attribute="'+esc(key)+'">'+attributeOptions(attributes[key])+'</select></label>';
  }).join('');
}
function parseSelectedAttributes(){
  var selected={};
  el(modalId).querySelectorAll('[data-cm-attribute]').forEach(function(select){
    var raw=select.value;
    try{selected[select.dataset.cmAttribute]=raw.charAt(0)==='{'?JSON.parse(raw):raw;}catch(e){selected[select.dataset.cmAttribute]=raw;}
  });
  return selected;
}
function prettyAttribute(key,value){
  if(value&&typeof value==='object')return value.code||[value.widthMm,value.lengthMm].filter(Boolean).join(' x ')+' mm';
  var suffix={thicknessMm:' mm',grammageGsm:' gsm',rollWidthsMm:' mm',rollLengthsM:' m',wallThicknessMm:' mm',standardLengthMm:' mm',aluminiumSkinMm:' mm',powerW:' W',capacityW:' W',voltage:' V',outputVoltage:' V',sizesMm2:' mm2'};
  return String(value)+(suffix[key]||'');
}
function buildVariant(family){
  var attrs=parseSelectedAttributes(),parts=[],spec=[];
  Object.keys(attrs).forEach(function(key){
    var value=attrs[key];var label=prettyAttribute(key,value);
    parts.push(label);spec.push(attributeLabel(key)+': '+label);
  });
  var suffix=parts.map(function(x){return String(x).replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'');}).filter(Boolean).join('-').toUpperCase();
  var sku=(family.familyCode+(suffix?'-'+suffix:'')).replace(/[^A-Z0-9-]/g,'').slice(0,80);
  var name=(family.familyName||family.name)+(parts.length?' - '+parts.join(' / '):'');
  return{sku:sku,name:name,spec:spec.join('; '),attributes:attrs};
}
function renderFamilyDetail(){
  var family=getSelectedFamily(),box=el('cm-family-detail');if(!family||!box)return;
  if(activeMode==='material'){
    box.innerHTML='<div class="space-y-4"><div><div class="text-[10px] uppercase font-bold tracking-wider text-orange-600">'+esc(family.category)+'</div><h3 class="text-lg font-bold text-slate-900">'+esc(family.familyName)+'</h3><p class="text-xs text-slate-500 mt-1">'+esc(family.description||'')+'</p><div class="text-[10px] text-slate-500 mt-2">Metode costing: <b>'+esc(family.costingMethod)+'</b></div></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-3">'+renderAttributeControls(family.attributes)+'</div><div class="border-t pt-4"><h4 class="text-sm font-bold mb-3">Aktivasi SKU dengan harga aktual</h4><div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><label class="cm-label sm:col-span-2">SKU<input id="cm-sku" class="cm-input"></label><label class="cm-label sm:col-span-2">Nama material<input id="cm-name" class="cm-input"></label><label class="cm-label">Kategori<input id="cm-category" class="cm-input" readonly></label><label class="cm-label">Metode costing<input id="cm-costing" class="cm-input" readonly></label><label class="cm-label">Supplier<input id="cm-supplier" class="cm-input" placeholder="Nama supplier"></label><label class="cm-label">Sumber harga<input id="cm-price-source" class="cm-input" placeholder="Invoice / quotation supplier / price list"></label><label class="cm-label">Harga beli (Rp)<input id="cm-purchase-price" type="number" min="1" step="1" class="cm-input" placeholder="Harga per satuan beli"></label><label class="cm-label">Tanggal harga<input id="cm-price-date" type="date" class="cm-input" value="'+todayISO()+'"></label><label class="cm-label">Satuan beli<input id="cm-purchase-unit" class="cm-input"></label><label class="cm-label">Satuan pakai<input id="cm-usage-unit" class="cm-input"></label><label class="cm-label">Konversi (satuan pakai per 1 satuan beli)<input id="cm-conversion-factor" type="number" min="0.000001" step="any" class="cm-input" value="1"></label><label class="cm-label">Waste / allowance (%)<input id="cm-waste-rate" type="number" min="0" max="100" step=".1" class="cm-input" value="0"></label><label class="cm-label sm:col-span-2">Spesifikasi<input id="cm-spec" class="cm-input"></label></div><div id="cm-price-preview" class="mt-3 rounded-xl bg-slate-900 text-white p-3 text-xs">Harga per satuan pakai: -</div><div class="flex justify-end gap-2 mt-4"><button class="cm-btn bg-emerald-700 text-white" data-cm-action="save-material">Aktifkan dan Simpan Material</button></div></div></div>';
    el('cm-category').value=family.category;el('cm-costing').value=family.costingMethod;
    var buy=String(family.purchaseUnit||'lembar').split(' atau ')[0];
    var use=String(family.usageUnit||'pcs').split(' atau ')[0];
    el('cm-purchase-unit').value=buy;el('cm-usage-unit').value=use;
    el('cm-conversion-factor').value=buy.toLowerCase()===use.toLowerCase()?'1':'';
    updateVariantPreview();updatePurchasePricePreview();
  }else{
    box.innerHTML='<div class="space-y-4"><div><div class="text-[10px] uppercase font-bold tracking-wider text-violet-600">'+esc(family.category)+'</div><h3 class="text-lg font-bold text-slate-900">'+esc(family.name)+'</h3><p class="text-xs text-slate-500 mt-1">Basis biaya: '+esc(family.costBasis)+'</p></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><label class="cm-label">Nama layanan<input id="cm-service-name" class="cm-input" value="'+esc(family.name)+'"></label><label class="cm-label">Satuan<select id="cm-service-unit" class="cm-input">'+family.unitOptions.map(function(unit){return'<option value="'+esc(unit)+'">'+esc(unit)+'</option>';}).join('')+'</select></label><label class="cm-label">Harga jual dasar (Rp)<input id="cm-service-price" type="number" min="1" class="cm-input"></label><label class="cm-label">Biaya dasar / HPP jasa (Rp)<input id="cm-service-cost" type="number" min="0" class="cm-input"></label><label class="cm-label">Supplier / pelaksana (opsional)<input id="cm-service-supplier" class="cm-input"></label><label class="cm-label">SKU layanan<input id="cm-service-sku" class="cm-input" value="'+esc(family.serviceCode)+'"></label><label class="cm-label sm:col-span-2">Spesifikasi dan basis perhitungan<textarea id="cm-service-spec" rows="3" class="cm-input">'+esc(family.costBasis)+'</textarea></label></div><div class="flex justify-end mt-3"><button class="cm-btn bg-violet-700 text-white" data-cm-action="save-service">Aktifkan dan Simpan Jasa</button></div></div>';
  }
}
function updateVariantPreview(){
  var family=getSelectedFamily();if(!family||activeMode!=='material')return;
  var variant=buildVariant(family);
  if(el('cm-sku'))el('cm-sku').value=variant.sku;
  if(el('cm-name'))el('cm-name').value=variant.name;
  if(el('cm-spec'))el('cm-spec').value=[family.description,variant.spec].filter(Boolean).join(' | ');
}
function updatePurchasePricePreview(){
  var price=Number(el('cm-purchase-price')&&el('cm-purchase-price').value),factor=Number(el('cm-conversion-factor')&&el('cm-conversion-factor').value);
  var box=el('cm-price-preview');if(!box)return;
  if(!Number.isFinite(price)||price<=0||!Number.isFinite(factor)||factor<=0){box.textContent='Harga per satuan pakai: masukkan harga beli dan faktor konversi yang valid.';return;}
  box.textContent='Harga per satuan pakai: '+rupiah(price/factor)+' ('+rupiah(price)+' / '+factor+')';
}
function saveMaterialFromCatalog(){
  if(!ownerOnly())return;
  var family=getSelectedFamily();if(!family)return;
  var sku=el('cm-sku').value.trim().toUpperCase(),name=el('cm-name').value.trim(),supplier=el('cm-supplier').value.trim(),source=el('cm-price-source').value.trim(),price=Number(el('cm-purchase-price').value),factor=Number(el('cm-conversion-factor').value),unit=el('cm-usage-unit').value.trim(),purchaseUnit=el('cm-purchase-unit').value.trim(),date=el('cm-price-date').value,waste=Number(el('cm-waste-rate').value);
  if(!sku||!name||!supplier||!source||!date||!unit||!purchaseUnit||!Number.isFinite(price)||price<=0||!Number.isFinite(factor)||factor<=0||!Number.isFinite(waste)||waste<0||waste>100){say('Lengkapi SKU, nama, supplier, sumber dan tanggal harga, satuan, harga beli, faktor konversi, serta waste yang valid.',true);return;}
  var database=getDb();if(!database){say('Database aplikasi belum siap.',true);return;}
  var materials=Array.isArray(database.materials)?database.materials:(database.materials=[]);
  if(materials.some(function(item){return String(item.sku||'').toUpperCase()===sku;})){say('SKU sudah terdaftar. Gunakan SKU yang berbeda atau edit material yang ada.',true);return;}
  var familyAttributes=parseSelectedAttributes(),variant=buildVariant(family),purchasePrice=Math.round(price),unitPrice=purchasePrice/factor,now=new Date().toISOString();
  var record={
    id:'MAT-'+Date.now()+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),
    sku:sku,name:name,category:family.category,subcategory:family.familyName,
    spec:el('cm-spec').value.trim(),brand:familyAttributes.brand||'',grade:familyAttributes.grade||'',unit:unit,unitPrice:unitPrice,
    purchaseUnit:purchaseUnit,purchasePrice:purchasePrice,conversionFactor:factor,
    costingMethod:family.costingMethod,supplierName:supplier,supplierId:'',
    thicknessMm:familyAttributes.thicknessMm||'',widthMm:familyAttributes.sheetSizes&&familyAttributes.sheetSizes.widthMm||familyAttributes.rollWidthsMm||'',
    lengthMm:familyAttributes.sheetSizes&&familyAttributes.sheetSizes.lengthMm||familyAttributes.rollLengthsM||familyAttributes.standardLengthMm||'',diameterMm:familyAttributes.diameterMm||'',color:familyAttributes.colors||familyAttributes.color||'',
    minimumOrder:1,wasteRate:waste,priceSource:source,priceDate:date,status:'active',notes:'Diaktifkan dari katalog referensi CSK.',updatedAt:now
  };
  materials.push(record);
  if(typeof w.saveDB==='function')w.saveDB();
  if(typeof w.renderHpp==='function')w.renderHpp();
  say('Material '+sku+' berhasil diaktifkan. Harga pakai '+rupiah(unitPrice)+'/'+unit+'.');
  closeCskCatalogManager();
}
function saveServiceFromCatalog(){
  if(!ownerOnly())return;
  var family=getSelectedFamily();if(!family)return;
  var name=el('cm-service-name').value.trim(),sku=el('cm-service-sku').value.trim().toUpperCase(),unit=el('cm-service-unit').value,basePrice=Number(el('cm-service-price').value),costPrice=Number(el('cm-service-cost').value),supplier=el('cm-service-supplier').value.trim(),spec=el('cm-service-spec').value.trim();
  if(!name||!sku||!unit||!Number.isFinite(basePrice)||basePrice<=0||!Number.isFinite(costPrice)||costPrice<0){say('Isi nama, SKU, satuan, harga jual, dan biaya dasar jasa dengan benar.',true);return;}
  var database=getDb();if(!database){say('Database aplikasi belum siap.',true);return;}
  var services=Array.isArray(database.services)?database.services:(database.services=[]);
  if(services.some(function(item){return String(item.sku||'').toUpperCase()===sku;})){say('SKU jasa sudah terdaftar.',true);return;}
  services.push({id:'SVC-'+Date.now()+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),sku:sku,name:name,category:family.category,spec:spec,unit:unit,basePrice:Math.round(basePrice),costPrice:Math.round(costPrice),costingMethod:family.serviceCode,supplierName:supplier,status:'active',updatedAt:new Date().toISOString()});
  if(typeof w.saveDB==='function')w.saveDB();
  if(typeof w.renderServices==='function')w.renderServices();
  say('Jasa '+sku+' berhasil ditambahkan ke katalog.');
  closeCskCatalogManager();
}
function openCskCatalogManager(mode){
  if(!ownerOnly())return;
  activeMode=mode==='service'?'service':'material';selectedFamily=null;
  loadCatalog().then(function(){renderCatalogModal();}).catch(function(error){say(String(error&&error.message||error),true);});
}
function closeCskCatalogManager(){var modal=el(modalId);if(modal)modal.classList.add('hidden');selectedFamily=null;}
w.openCskCatalogManager=openCskCatalogManager;
w.closeCskCatalogManager=closeCskCatalogManager;
})(typeof window!=='undefined'?window:null);
