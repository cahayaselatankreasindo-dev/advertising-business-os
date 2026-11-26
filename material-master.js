(function(w){
'use strict';
var rootId='material-master-app',modalId='csk-material-editor',bound=false,query='',category='all',status='all',seedCache=null,stagedPriceImport=null;
function el(id){return w.document.getElementById(id);}
function bridge(){return w.CSKMaterialMasterBridge||null;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function n(v){var x=Number(v);return Number.isFinite(x)?x:0;}
function rupiah(v){return 'Rp '+Math.round(n(v)).toLocaleString('id-ID');}
function notify(message,isError){var b=bridge();if(b&&b.toast)b.toast(message,!!isError);}
function data(){var b=bridge();if(!b)throw new Error('Koneksi master material belum siap.');return b.getData();}
function active(m){var unit=String(m&&m.unit||''),purchaseUnit=String(m&&m.purchaseUnit||unit),buy=n(m&&m.purchasePrice)||(purchaseUnit===unit?n(m&&m.unitPrice):0),rawFactor=m&&m.conversionFactor,factor=rawFactor===undefined||rawFactor===null||rawFactor===''?1:n(rawFactor);return !!m&&String(m.status||'active')==='active'&&n(m.unitPrice)>0&&buy>0&&factor>0&&!!unit&&!!purchaseUnit&&!!String(m.supplierName||'').trim()&&!!String(m.priceSource||'').trim()&&!!String(m.priceDate||'').trim();}
function statusLabel(m){var s=String(m.status||'active');return s==='active'?(active(m)?'Aktif':'Perlu verifikasi'):s==='template'?'Kode kelompok':s==='inactive'?'Nonaktif':'Draft';}
function statusClass(m){var s=String(m.status||'active');return s==='active'?(active(m)?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'):s==='template'?'bg-slate-100 text-slate-600':s==='inactive'?'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-700';}
function getRows(){var d=data();return Array.isArray(d.materials)?d.materials:[];}
function save(nextRows){
 var b=bridge(),before=getRows().slice();
 b.replaceMaterials(nextRows);
 return Promise.resolve(b.save()).catch(function(error){b.replaceMaterials(before);throw error;});
}
function ensureModal(){
 if(el(modalId))return;
 var style=w.document.createElement('style');
 style.textContent='#'+modalId+'{position:fixed;inset:0;z-index:100090;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:12px}#'+modalId+'.hidden{display:none}#'+modalId+' .mm-shell{width:100%;max-width:850px;max-height:94vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.3)}#'+modalId+' .mm-label{display:block;font-size:11px;font-weight:700;color:#475569}#'+modalId+' .mm-input{display:block;width:100%;margin-top:5px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;font-size:12px;color:#0f172a}';
 w.document.head.appendChild(style);
 var modal=w.document.createElement('div');modal.id=modalId;modal.className='hidden';
 modal.innerHTML='<div class="mm-shell"><header class="sticky top-0 z-10 bg-slate-900 text-white p-4 flex items-center justify-between gap-3"><div><div id="mm-title" class="font-bold text-sm">Material CSK</div><div class="text-[10px] text-slate-300 mt-1">Kode, spesifikasi, satuan, konversi, dan harga aktual</div></div><button type="button" data-mm-action="close" class="px-3 py-2 rounded-lg bg-slate-700 text-xs font-bold">Tutup</button></header><form id="mm-form" class="p-4 space-y-4"><input type="hidden" id="mm-id"><div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><label class="mm-label">Kode material / SKU<input id="mm-sku" required maxlength="80" class="mm-input" placeholder="Contoh: H-H-2X2-1"></label><label class="mm-label">Nama material lengkap<input id="mm-name" required maxlength="180" class="mm-input" placeholder="Nama material dengan ukuran/warna/ketebalan"></label><label class="mm-label">Kategori<input id="mm-category" required class="mm-input" placeholder="Contoh: Besi hollow"></label><label class="mm-label">Subkategori<input id="mm-subcategory" class="mm-input" placeholder="Contoh: Hollow hitam"></label><label class="mm-label sm:col-span-2">Spesifikasi teknis<textarea id="mm-spec" rows="2" class="mm-input" placeholder="Ukuran, tebal, warna, panjang, grade, atau tipe"></textarea></label><label class="mm-label">Warna<input id="mm-color" class="mm-input" placeholder="Warna / finishing"></label><label class="mm-label">Ketebalan (mm)<input id="mm-thickness" type="number" min="0" step="0.01" class="mm-input"></label><label class="mm-label">Lebar (mm)<input id="mm-width" type="number" min="0" step="0.01" class="mm-input"></label><label class="mm-label">Panjang (mm)<input id="mm-length" type="number" min="0" step="0.01" class="mm-input"></label><label class="mm-label">Panjang roll (m)<input id="mm-roll-length" type="number" min="0" step="0.01" class="mm-input"></label></div><div class="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 space-y-3"><div class="font-bold text-xs text-indigo-900">Satuan pembelian dan pemakaian</div><div class="grid grid-cols-1 sm:grid-cols-3 gap-3"><label class="mm-label">Satuan beli<input id="mm-purchase-unit" required class="mm-input" placeholder="batang / lembar / roll"></label><label class="mm-label">Satuan pakai / stok<input id="mm-unit" required class="mm-input" placeholder="m / lembar / pcs"></label><label class="mm-label">Faktor konversi<input id="mm-factor" required type="number" min="0.000001" step="any" class="mm-input" placeholder="6"></label></div><p class="text-[10px] text-indigo-800">Faktor konversi berarti jumlah satuan pakai yang diperoleh dari 1 satuan beli. Contoh: 1 batang hollow 6 meter = 6 m.</p></div><div class="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 space-y-3"><div class="font-bold text-xs text-emerald-900">Harga beli dan validasi supplier</div><div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><label class="mm-label">Harga beli per satuan beli (Rp)<input id="mm-purchase-price" type="number" min="0" step="1" class="mm-input" placeholder="Isi setelah ada harga supplier"></label><label class="mm-label">Supplier<input id="mm-supplier" class="mm-input" placeholder="Nama supplier"></label><label class="mm-label">Sumber harga<input id="mm-price-source" class="mm-input" placeholder="Invoice / quotation / price list"></label><label class="mm-label">Tanggal harga<input id="mm-price-date" type="date" class="mm-input"></label><label class="mm-label">Waste / allowance (%)<input id="mm-waste" type="number" min="0" max="100" step="0.1" class="mm-input" value="0"></label><label class="mm-label">Batas minimum stok / reorder point<input id="mm-reorder-point" type="number" min="0" step="any" class="mm-input" placeholder="0 = tidak dipantau"></label></div><div id="mm-price-preview" class="rounded-lg bg-slate-900 text-white p-3 text-xs">Harga per satuan pakai: belum dihitung</div></div><label class="mm-label">Catatan<textarea id="mm-notes" rows="2" class="mm-input"></textarea></label><div class="flex flex-wrap justify-between items-center gap-2 border-t pt-3"><span id="mm-status-note" class="text-[10px] text-slate-500">Material akan berstatus Draft sampai harga dan sumbernya diverifikasi.</span><div class="flex gap-2"><button type="button" data-mm-action="close" class="px-4 py-2 rounded-lg border text-xs font-bold">Batal</button><button type="submit" class="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold">Simpan Material</button></div></div></form></div>';
 modal.addEventListener('click',function(event){var b=event.target.closest('[data-mm-action]');if(!b)return;if(b.dataset.mmAction==='close')modal.classList.add('hidden');});
 modal.addEventListener('submit',function(event){event.preventDefault();saveForm();});
 modal.addEventListener('input',function(event){if(['mm-purchase-price','mm-factor','mm-waste','mm-unit'].indexOf(event.target.id)>=0)updatePricePreview();});
 w.document.body.appendChild(modal);
}
function updatePricePreview(){
 var price=n(el('mm-purchase-price').value),factor=n(el('mm-factor').value),box=el('mm-price-preview');
 if(!price||!factor){box.textContent='Harga per satuan pakai: isi harga beli dan faktor konversi.';return;}
 var waste=n(el('mm-waste').value),base=price/factor,landed=base*(1+waste/100);
  box.textContent='Harga HPP per satuan pakai: '+rupiah(landed)+' / '+el('mm-unit').value+' (dasar '+rupiah(base)+' + allowance '+waste+'%)';
}
function openEditor(id){
 var b=bridge();if(!b||!b.isOwner())return notify('Pengubahan master material hanya dapat dilakukan oleh Owner.',true);
 var rows=getRows(),m=id?rows.find(function(x){return String(x.id)===String(id);}):null;
 ensureModal();
 var modal=el(modalId);modal.classList.remove('hidden');
 el('mm-title').textContent=m?'Edit Master Material':'Tambah Material CSK';
 var fields={id:m&&m.id||'',sku:m&&m.sku||'',name:m&&m.name||'',category:m&&m.category||'',subcategory:m&&m.subcategory||'',spec:m&&m.spec||'',color:m&&m.color||'',thickness:m&&m.thicknessMm||'',width:m&&m.widthMm||'',length:m&&m.lengthMm||'',rollLength:m&&m.rollLengthM||'',purchaseUnit:m&&m.purchaseUnit||m&&m.unit||'',unit:m&&m.unit||'',factor:m&&m.conversionFactor||1,purchasePrice:m&&m.purchasePrice||m&&m.unitPrice||'',supplier:m&&m.supplierName||'',priceSource:m&&m.priceSource||'',priceDate:m&&m.priceDate||'',waste:m&&m.wasteRate||0,reorderPoint:m&&m.reorderPoint||0,notes:m&&m.notes||''};
 Object.keys(fields).forEach(function(key){var node=el('mm-'+key);if(node)node.value=fields[key];});
 var referenced=!!m&&isReferenced(m.id,rows);
 el('mm-sku').disabled=referenced;
 ['mm-unit','mm-purchase-unit','mm-factor'].forEach(function(field){el(field).disabled=referenced;});
 el('mm-status-note').textContent=m&&m.status==='template'?'Kode kelompok. Lengkapi sebagai varian SKU terpisah; kode kelompok tidak dapat diaktifkan.':referenced?'Kode dikunci karena sudah dipakai transaksi. Perubahan nama/spesifikasi tidak mengubah riwayat transaksi.':'Material tetap Draft sampai harga, supplier, sumber harga, tanggal, dan konversi valid.';
 updatePricePreview();
}
function isReferenced(id,rows){
 var d=data();
 return (d.costSheets||[]).some(function(x){return(x.items||[]).some(function(i){return String(i.materialId)===String(id);});})||
 (d.purchaseOrders||[]).some(function(x){return(x.items||[]).some(function(i){return String(i.materialId)===String(id);});})||
 (d.inventoryTransactions||[]).some(function(x){return String(x.materialId)===String(id);})||
 (d.inventoryReservations||[]).some(function(x){return String(x.materialId)===String(id);});
}
async function saveForm(){
 var b=bridge();if(!b||!b.isOwner())return notify('Pengubahan master material hanya dapat dilakukan oleh Owner.',true);
 var d=data(),rows=(d.materials||[]).slice(),id=el('mm-id').value,old=rows.find(function(x){return String(x.id)===String(id);}),sku=el('mm-sku').value.trim().toUpperCase(),name=el('mm-name').value.trim(),cat=el('mm-category').value.trim(),sub=el('mm-subcategory').value.trim(),unit=el('mm-unit').value.trim(),purchaseUnit=el('mm-purchase-unit').value.trim(),factor=n(el('mm-factor').value),price=n(el('mm-purchase-price').value),supplier=el('mm-supplier').value.trim(),source=el('mm-price-source').value.trim(),date=el('mm-price-date').value,waste=n(el('mm-waste').value),reorderPoint=n(el('mm-reorder-point').value);
 if(!sku||!name||!cat||!unit||!purchaseUnit||!Number.isFinite(factor)||factor<=0||!Number.isFinite(price)||price<0||!Number.isFinite(waste)||waste<0||waste>100||!Number.isFinite(reorderPoint)||reorderPoint<0){notify('Kode, nama, kategori, satuan, faktor konversi, dan nilai harga/waste harus valid.',true);return;}
 if(rows.some(function(x){return String(x.sku||'').toUpperCase()===sku&&String(x.id)!==String(id);})){notify('Kode material sudah digunakan. Setiap SKU harus unik.',true);return;}
 if(old&&old.status==='template'){notify('Kode kelompok tidak dapat diaktifkan. Buat atau pilih SKU varian dengan ukuran yang lengkap.',true);return;}
 var referenced=!!old&&isReferenced(old.id,rows);
 if(referenced&&(sku!==String(old.sku||'').toUpperCase()||unit!==String(old.unit||'')||purchaseUnit!==String(old.purchaseUnit||old.unit||'')||factor!==(Number(old.conversionFactor)||1))){notify('SKU, satuan stok, satuan beli, dan faktor konversi dikunci karena material sudah dipakai dalam transaksi. Buat SKU baru jika spesifikasinya berubah.',true);return;}
 var completePrice=price>0&&!!supplier&&!!source&&!!date;
 if(price>0&&!completePrice){notify('Untuk mengaktifkan material, lengkapi supplier, sumber harga, dan tanggal harga.',true);return;}
 if(old&&old.status==='active'&&!completePrice){notify('Material aktif tidak dapat diubah menjadi Draft dengan mengosongkan harga. Nonaktifkan secara eksplisit melalui tombol status.',true);return;}
 var now=new Date().toISOString(),record=Object.assign({},old||{},{
  id:old?old.id:'MAT-CSK-'+sku.replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Date.now(),
  sku:sku,name:name,category:cat,subcategory:sub,spec:el('mm-spec').value.trim(),color:el('mm-color').value.trim(),
  thicknessMm:el('mm-thickness').value===''?'':n(el('mm-thickness').value),widthMm:el('mm-width').value===''?'':n(el('mm-width').value),
  lengthMm:el('mm-length').value===''?'':n(el('mm-length').value),rollLengthM:el('mm-roll-length').value===''?'':n(el('mm-roll-length').value),
  unit:unit,purchaseUnit:purchaseUnit,conversionFactor:factor,purchasePrice:price,unitPrice:price>0?(price/factor)*(1+waste/100):0,
  supplierName:supplier,supplierId:old&&old.supplierId||'',priceSource:source,priceDate:date,costingMethod:old&&old.costingMethod||'direct_unit',
  minimumOrder:old&&old.minimumOrder||1,wasteRate:waste,reorderPoint:reorderPoint,status:completePrice?'active':(old&&old.status==='inactive'?'inactive':'draft'),notes:el('mm-notes').value.trim(),updatedAt:now
 });
 if(old&&old.status==='inactive'&&completePrice)record.status='active';
 if(old&&old.status==='template')record.status='template';
 if(old){var idx=rows.findIndex(function(x){return String(x.id)===String(old.id);});rows[idx]=record;}else rows.push(record);
 try{await save(rows);el(modalId).classList.add('hidden');render();notify('Master material '+sku+' tersimpan. '+(record.status==='active'?'Siap dipakai untuk HPP, PO, dan stok.':'Masih Draft, belum dapat dipakai transaksi.'));}
 catch(error){notify('Gagal menyimpan master material: '+String(error&&error.message||error),true);}
}

function csvCell(value){
 var text=String(value==null?'':value);
 if(/^\s*[=+\-@]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
function buildPriceTemplateCsv(materials){
 var headers=['sku','name','purchase_unit','usage_unit','conversion_factor','purchase_price','supplier_name','price_source','price_date','waste_rate'];
 var rows=[headers];
 (materials||[]).filter(function(m){return m&&m.sku&&m.status!=='template';}).forEach(function(m){
  rows.push([m.sku,m.name||'',m.purchaseUnit||m.unit||'',m.unit||'',m.conversionFactor==null?'':m.conversionFactor,'','','','',m.wasteRate==null?0:m.wasteRate]);
 });
 return '\uFEFF'+rows.map(function(row){return row.map(csvCell).join(';');}).join('\r\n')+'\r\n';
}
function downloadPriceTemplate(){
 var b=bridge();if(!b||!b.isOwner())return notify('Unduh template harga hanya dapat dilakukan oleh Owner.',true);
 try{
  var csv=buildPriceTemplateCsv(getRows()),blob=new w.Blob([csv],{type:'text/csv;charset=utf-8;'}),url=w.URL.createObjectURL(blob),a=w.document.createElement('a');
  a.href=url;a.download='CSK-template-harga-supplier.csv';w.document.body.appendChild(a);a.click();a.remove();
  w.setTimeout(function(){w.URL.revokeObjectURL(url);},1000);
  notify('Template harga supplier berhasil disiapkan. Isi harga dan referensi dokumen supplier sebelum impor.');
 }catch(error){notify('Template harga gagal dibuat: '+String(error&&error.message||error),true);}
}
function parseCsvMatrix(input){
 var text=String(input==null?'':input).replace(/^\uFEFF/,'');
 var firstLine=(text.split(/\r\n|\n|\r/)[0]||''),delimiter=firstLine.split(';').length>firstLine.split(',').length?';':',';
 var rows=[],row=[],field='',quoted=false;
 for(var i=0;i<text.length;i++){
  var ch=text.charAt(i);
  if(ch==='"'){
   if(quoted&&text.charAt(i+1)==='"'){field+='"';i++;}
   else quoted=!quoted;
  }else if(!quoted&&ch===delimiter){row.push(field);field='';}
  else if(!quoted&&(ch==='\n'||ch==='\r')){
   row.push(field);if(row.some(function(v){return String(v).trim()!=='';}))rows.push(row);
   row=[];field='';if(ch==='\r'&&text.charAt(i+1)==='\n')i++;
  }else field+=ch;
 }
 if(quoted)throw new Error('CSV memiliki tanda kutip yang tidak berpasangan.');
 if(field!==''||row.length){row.push(field);if(row.some(function(v){return String(v).trim()!=='';}))rows.push(row);}
 return rows;
}
function normalizedHeader(value){
 return String(value==null?'':value).replace(/^\uFEFF/,'').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}
function canonicalHeader(value){
 var key=normalizedHeader(value),aliases={
  kode:'sku',kode_material:'sku',kode_sku:'sku',material_sku:'sku',
  harga_beli:'purchase_price',harga_beli_rp:'purchase_price',harga_beli_per_satuan_beli:'purchase_price',
  supplier:'supplier_name',nama_supplier:'supplier_name',
  sumber_harga:'price_source',sumber:'price_source',referensi_harga:'price_source',dokumen_sumber:'price_source',
  tanggal_harga:'price_date',tanggal_harga_berlaku:'price_date',
  satuan_beli:'purchase_unit',satuan_pembelian:'purchase_unit',
  satuan_pakai:'usage_unit',satuan_pemakaian:'usage_unit',satuan_stok:'usage_unit',
  faktor_konversi:'conversion_factor',konversi:'conversion_factor',
  waste:'waste_rate',allowance:'waste_rate',waste_rate_percent:'waste_rate',
  nama_material:'name'
 };
 return aliases[key]||key;
}
function parseLocaleNumber(value){
 var text=String(value==null?'':value).trim().replace(/^rp\s*/i,'').replace(/\s/g,'');
 if(!text||! /^[+-]?\d[\d,.-]*$/.test(text))return NaN;
 if(text.indexOf(',')>=0&&text.indexOf('.')>=0){
  if(text.lastIndexOf(',')>text.lastIndexOf('.'))text=text.replace(/\./g,'').replace(',','.');
  else text=text.replace(/,/g,'');
 }else if(text.indexOf(',')>=0){
  var commaParts=text.split(',');
  if(commaParts.length===2&&commaParts[1].length<=2)text=text.replace(',','.');
  else text=text.replace(/,/g,'');
 }else if(text.indexOf('.')>=0){
  var dotParts=text.split('.');
  if(dotParts.length>2||dotParts[dotParts.length-1].length===3)text=text.replace(/\./g,'');
 }
 return Number(text);
}
function normalizePriceDate(value){
 var text=String(value==null?'':value).trim(),match,year,month,day;
 if((match=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text))){year=Number(match[1]);month=Number(match[2]);day=Number(match[3]);}
 else if((match=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(text))){day=Number(match[1]);month=Number(match[2]);year=Number(match[3]);}
 else return '';
 var date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return '';
 return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function validatePriceImport(csvText,materials){
 var matrix;
 try{matrix=parseCsvMatrix(csvText);}catch(error){return{validRows:[],errors:[{row:1,sku:'',reason:String(error&&error.message||error)}],totalRows:0};}
 if(matrix.length<2)return{validRows:[],errors:[{row:1,sku:'',reason:'CSV belum berisi baris harga supplier.'}],totalRows:0};
 var indexes=Object.create(null);
 matrix[0].forEach(function(header,index){var key=canonicalHeader(header);if(key&&!Object.prototype.hasOwnProperty.call(indexes,key))indexes[key]=index;});
 var required=['sku','purchase_price','supplier_name','price_source','price_date'];
 var missing=required.filter(function(key){return indexes[key]===undefined;});
 if(missing.length)return{validRows:[],errors:[{row:1,sku:'',reason:'Kolom wajib belum ada: '+missing.join(', ')}],totalRows:0,missingHeaders:missing};
 var records=matrix.slice(1).map(function(cells,index){return{cells:cells,rowNumber:index+2};}).filter(function(record){return record.cells.some(function(v){return String(v).trim()!=='';});});
 var counts=Object.create(null),bySku=Object.create(null),masterCounts=Object.create(null);
 (materials||[]).forEach(function(m){
  var sku=String(m&&m.sku||'').trim().toUpperCase();
  if(!sku)return;
  masterCounts[sku]=(masterCounts[sku]||0)+1;
  if(m.status!=='template'&&!Object.prototype.hasOwnProperty.call(bySku,sku))bySku[sku]=m;
 });
 records.forEach(function(record){var sku=String(record.cells[indexes.sku]||'').trim().toUpperCase();if(sku)counts[sku]=(counts[sku]||0)+1;});
 var validRows=[],errors=[];
 function cell(record,key){return indexes[key]===undefined?'':String(record.cells[indexes[key]]==null?'':record.cells[indexes[key]]).trim();}
 function sameNumber(left,right){return Math.abs(left-right)<=Math.max(0.000000001,Math.abs(right)*0.000001);}
 records.forEach(function(record){
  var sku=cell(record,'sku').toUpperCase(),material=bySku[sku],reason='',price=parseLocaleNumber(cell(record,'purchase_price'));
  if(!sku)reason='SKU wajib diisi.';
  else if(counts[sku]>1)reason='SKU muncul lebih dari satu kali di CSV; seluruh baris duplikat dilewati.';
  else if(masterCounts[sku]>1)reason='SKU muncul lebih dari satu kali pada Master Material; perbaiki data master sebelum impor.';
  else if(!material)reason='SKU tidak ditemukan atau merupakan kode kelompok/template.';
  else if(!Number.isSafeInteger(price)||price<=0)reason='Harga beli harus berupa Rupiah bulat positif tanpa pecahan.';
  var supplier=cell(record,'supplier_name'),source=cell(record,'price_source'),priceDate=normalizePriceDate(cell(record,'price_date'));
  if(!reason&&(!supplier||supplier.length>180))reason='Nama supplier wajib diisi dan maksimal 180 karakter.';
  if(!reason&&(!source||source.length>240))reason='Sumber harga wajib diisi dan maksimal 240 karakter.';
  if(!reason&&(/^\s*[=+\-@]/.test(supplier)||/^\s*[=+\-@]/.test(source)))reason='Nama supplier dan sumber harga tidak boleh diawali karakter formula spreadsheet.';
  if(!reason&&!priceDate)reason='Tanggal harga tidak valid. Gunakan YYYY-MM-DD atau DD/MM/YYYY.';
  if(!reason){
   var purchaseUnit=cell(record,'purchase_unit'),usageUnit=cell(record,'usage_unit'),factorText=cell(record,'conversion_factor'),wasteText=cell(record,'waste_rate');
   if(purchaseUnit&&purchaseUnit.toLowerCase()!==String(material.purchaseUnit||material.unit||'').trim().toLowerCase())reason='Satuan beli berbeda dari Master Material. Ubah melalui Edit Data, bukan impor harga.';
   if(!reason&&usageUnit&&usageUnit.toLowerCase()!==String(material.unit||'').trim().toLowerCase())reason='Satuan pakai berbeda dari Master Material. Ubah melalui Edit Data, bukan impor harga.';
   var factor=Number(material.conversionFactor),waste=Number(material.wasteRate||0);
   if(!Number.isFinite(factor)||factor<=0)reason='Faktor konversi pada Master Material belum valid.';
   if(!reason&&factorText){var suppliedFactor=parseLocaleNumber(factorText);if(!Number.isFinite(suppliedFactor)||suppliedFactor<=0||!sameNumber(suppliedFactor,factor))reason='Faktor konversi CSV tidak sama dengan Master Material.';}
   if(!reason&&wasteText){var suppliedWaste=parseLocaleNumber(wasteText);if(!Number.isFinite(suppliedWaste)||suppliedWaste<0||suppliedWaste>100||!sameNumber(suppliedWaste,waste))reason='Waste rate CSV tidak sama dengan Master Material.';}
   if(!reason&&material.priceDate){var oldDate=normalizePriceDate(material.priceDate);if(oldDate&&priceDate<oldDate)reason='Tanggal harga lebih lama daripada harga yang sedang tersimpan.';}
  }
  if(reason)errors.push({row:record.rowNumber,sku:sku,reason:reason});
  else validRows.push({row:record.rowNumber,materialId:material.id,sku:sku,purchasePrice:price,supplierName:supplier,priceSource:source,priceDate:priceDate,purchaseUnit:String(material.purchaseUnit||material.unit||''),usageUnit:String(material.unit||''),conversionFactor:Number(material.conversionFactor),wasteRate:Number(material.wasteRate||0),currentStatus:String(material.status||'active'),currentPriceDate:normalizePriceDate(material.priceDate)||''});
 });
 return{validRows:validRows,errors:errors,totalRows:records.length};
}
function applyPriceImport(materials,importRows,updatedAt){
 var rows=(materials||[]).map(function(m){return Object.assign({},m);}),stamp=updatedAt||new Date().toISOString(),seenTargets=Object.create(null),seenSkus=Object.create(null);
 (importRows||[]).forEach(function(entry){
  var targetId=String(entry.materialId||''),targetSku=String(entry.sku||'').toUpperCase();
  if(!targetId||!targetSku||seenTargets[targetId]||seenSkus[targetSku])throw new Error('MATERIAL_IMPORT_DUPLICATE_TARGET:'+targetSku);
  seenTargets[targetId]=true;seenSkus[targetSku]=true;
  var matches=rows.filter(function(m){return String(m.sku||'').toUpperCase()===targetSku;});
  var material=rows.find(function(m){return String(m.id)===targetId;});
  if(!material||matches.length!==1||material.status==='template'||String(material.sku||'').toUpperCase()!==targetSku)throw new Error('MATERIAL_IMPORT_TARGET_INVALID:'+targetSku);
  var factor=Number(material.conversionFactor),waste=Number(material.wasteRate||0),price=Number(entry.purchasePrice);
  var supplier=String(entry.supplierName||'').trim(),source=String(entry.priceSource||'').trim(),priceDate=normalizePriceDate(entry.priceDate);
  if(!Number.isFinite(factor)||factor<=0||!Number.isFinite(waste)||waste<0||waste>100||!Number.isSafeInteger(price)||price<=0)throw new Error('MATERIAL_IMPORT_VALUES_INVALID:'+targetSku);
  if(!supplier||supplier.length>180||!source||source.length>240||/^\s*[=+\-@]/.test(supplier)||/^\s*[=+\-@]/.test(source)||!priceDate)throw new Error('MATERIAL_IMPORT_TEXT_INVALID:'+targetSku);
  function sameNumber(left,right){return Math.abs(left-right)<=Math.max(0.000000001,Math.abs(right)*0.000001);}
  if(entry.purchaseUnit===undefined||String(entry.purchaseUnit).trim().toLowerCase()!==String(material.purchaseUnit||material.unit||'').trim().toLowerCase())throw new Error('MATERIAL_IMPORT_UNIT_CHANGED:'+targetSku);
  if(entry.usageUnit===undefined||String(entry.usageUnit).trim().toLowerCase()!==String(material.unit||'').trim().toLowerCase())throw new Error('MATERIAL_IMPORT_UNIT_CHANGED:'+targetSku);
  if(entry.conversionFactor===undefined||!Number.isFinite(Number(entry.conversionFactor))||!sameNumber(Number(entry.conversionFactor),factor))throw new Error('MATERIAL_IMPORT_CONVERSION_CHANGED:'+targetSku);
  if(entry.wasteRate===undefined||!Number.isFinite(Number(entry.wasteRate))||!sameNumber(Number(entry.wasteRate),waste))throw new Error('MATERIAL_IMPORT_WASTE_CHANGED:'+targetSku);
  if(entry.currentStatus===undefined||String(entry.currentStatus)!==String(material.status||'active'))throw new Error('MATERIAL_IMPORT_STATUS_CHANGED:'+targetSku);
  if(entry.currentPriceDate===undefined||(normalizePriceDate(entry.currentPriceDate)||'')!==(normalizePriceDate(material.priceDate)||''))throw new Error('MATERIAL_IMPORT_PRICE_DATE_CHANGED:'+targetSku);
  if(material.priceDate){var oldDate=normalizePriceDate(material.priceDate);if(oldDate&&priceDate<oldDate)throw new Error('MATERIAL_IMPORT_DATE_OLDER:'+targetSku);}
  material.purchasePrice=price;
  material.unitPrice=(price/factor)*(1+waste/100);
  material.supplierName=supplier;
  material.priceSource=source;
  material.priceDate=priceDate;
  material.updatedAt=stamp;
 });
 return rows;
}
function readPriceFile(file){
 return new Promise(function(resolve,reject){
  if(file&&typeof file.text==='function'){file.text().then(resolve,reject);return;}
  var reader=new w.FileReader();reader.onload=function(){resolve(String(reader.result||''));};reader.onerror=function(){reject(new Error('File CSV tidak dapat dibaca.'));};reader.readAsText(file,'UTF-8');
 });
}
function ensurePriceImportModal(){
 var id='csk-material-price-import';if(el(id))return;
 var modal=w.document.createElement('div');modal.id=id;modal.className='hidden fixed inset-0 z-[100100] bg-slate-950/70 p-3 flex items-center justify-center';
 modal.innerHTML='<div class="w-full max-w-4xl max-h-[94vh] overflow-auto rounded-2xl bg-white shadow-2xl"><header class="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl bg-slate-950 p-4 text-white"><div><div class="text-sm font-bold">Impor Harga Supplier</div><div class="mt-1 text-[10px] text-slate-300">CSV · cocokkan SKU · pratinjau sebelum disimpan</div></div><button type="button" data-mmp-action="close" class="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold">Tutup</button></header><div class="space-y-4 p-4"><div class="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-950"><b>Yang diperbarui:</b> harga beli, harga per satuan pakai, supplier, sumber harga, dan tanggal harga. Satuan, konversi, waste, spesifikasi, serta transaksi historis tidak diubah. SKU Draft tetap Draft dan tidak otomatis diaktifkan.</div><div class="flex flex-wrap items-center gap-2"><button type="button" data-mmp-action="template" class="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white">Unduh template CSV</button><label class="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800">Pilih file CSV<input id="mm-price-file" type="file" accept=".csv,text/csv" class="hidden"></label><span class="text-[10px] text-slate-500">Kolom wajib: sku, purchase_price, supplier_name, price_source, price_date</span></div><div id="mm-price-import-summary" class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">Belum ada file. Unduh template, isi berdasarkan dokumen supplier, lalu pilih file CSV.</div><div id="mm-price-import-preview" class="space-y-3"></div></div><footer class="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-white p-3"><button type="button" data-mmp-action="cancel" class="rounded-lg border px-4 py-2 text-xs font-bold">Batal</button><button type="button" data-mmp-action="apply" disabled class="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white opacity-50">Terapkan harga valid</button></footer></div>';
 modal.addEventListener('click',function(event){
  var button=event.target.closest('[data-mmp-action]');if(!button)return;
  var action=button.dataset.mmpAction;
  if(action==='close'||action==='cancel'){modal.classList.add('hidden');stagedPriceImport=null;}
  if(action==='template')downloadPriceTemplate();
  if(action==='apply')applyPriceImportFromModal();
 });
 modal.addEventListener('change',function(event){if(event.target.id==='mm-price-file'&&event.target.files&&event.target.files[0])handlePriceImportFile(event.target.files[0]);});
 w.document.body.appendChild(modal);
}
function openPriceImport(){
 var b=bridge();if(!b||!b.isOwner())return notify('Impor harga supplier hanya dapat dilakukan oleh Owner.',true);
 ensurePriceImportModal();stagedPriceImport=null;
 el('mm-price-file').value='';el('mm-price-import-summary').textContent='Belum ada file. Unduh template, isi berdasarkan dokumen supplier, lalu pilih file CSV.';
 el('mm-price-import-preview').innerHTML='';var apply=el('csk-material-price-import').querySelector('[data-mmp-action="apply"]');apply.disabled=true;apply.classList.add('opacity-50');
 el('csk-material-price-import').classList.remove('hidden');
}
async function handlePriceImportFile(file){
 var summary=el('mm-price-import-summary'),preview=el('mm-price-import-preview'),apply=el('csk-material-price-import').querySelector('[data-mmp-action="apply"]');
 try{
  summary.textContent='Membaca dan memeriksa '+file.name+'...';preview.innerHTML='';apply.disabled=true;apply.classList.add('opacity-50');
  if(Number(file.size)>1024*1024)throw new Error('Ukuran file CSV melebihi batas 1 MB.');
  var text=await readPriceFile(file);stagedPriceImport={csvText:text,result:validatePriceImport(text,getRows())};
  renderPriceImportPreview(stagedPriceImport.result);
 }catch(error){stagedPriceImport=null;summary.textContent='Gagal membaca CSV: '+String(error&&error.message||error);preview.innerHTML='';}
}
function renderPriceImportPreview(result){
 var summary=el('mm-price-import-summary'),preview=el('mm-price-import-preview'),apply=el('csk-material-price-import').querySelector('[data-mmp-action="apply"]');
 var valid=result.validRows.length,invalid=result.errors.length;
 summary.innerHTML='<div class="flex flex-wrap gap-3"><b class="text-emerald-700">Valid: '+valid+'</b><b class="text-rose-700">Dilewati: '+invalid+'</b><span>Total baris: '+result.totalRows+'</span></div><p class="mt-2 text-[10px] text-slate-600">Hanya baris valid yang akan diterapkan. SKU Draft tetap Draft; tidak ada SKU yang diaktifkan otomatis.</p>';
 var validHtml=result.validRows.slice(0,10).map(function(row){
  var usagePrice=(Number(row.purchasePrice)/Number(row.conversionFactor))*(1+Number(row.wasteRate||0)/100);
  return'<tr class="border-t"><td class="p-2">'+row.row+'</td><td class="p-2 font-semibold">'+esc(row.sku)+'</td><td class="p-2 text-right">'+rupiah(row.purchasePrice)+'</td><td class="p-2 text-right">'+rupiah(usagePrice)+' / '+esc(row.usageUnit)+'</td><td class="p-2">'+esc(row.supplierName)+'</td><td class="p-2">'+esc(row.priceDate)+'</td></tr>';
 }).join('');
 var errorHtml=result.errors.slice(0,12).map(function(row){return'<tr class="border-t"><td class="p-2">'+row.row+'</td><td class="p-2 font-semibold">'+esc(row.sku||'-')+'</td><td class="p-2 text-rose-700">'+esc(row.reason)+'</td></tr>';}).join('');
 preview.innerHTML=(valid?'<div class="overflow-x-auto rounded-xl border"><div class="p-3 text-xs font-bold text-slate-800">Pratinjau baris valid'+(valid>10?' (10 pertama)':'')+'</div><table class="w-full min-w-[560px] text-[11px]"><thead class="bg-slate-50"><tr><th class="p-2 text-left">Baris</th><th class="p-2 text-left">SKU</th><th class="p-2 text-right">Harga beli</th><th class="p-2 text-right">Harga pakai</th><th class="p-2 text-left">Supplier</th><th class="p-2 text-left">Tanggal</th></tr></thead><tbody>'+validHtml+'</tbody></table></div>':'')+(invalid?'<div class="overflow-x-auto rounded-xl border border-rose-100"><div class="p-3 text-xs font-bold text-rose-800">Baris yang dilewati'+(invalid>12?' (12 pertama)':'')+'</div><table class="w-full min-w-[560px] text-[11px]"><thead class="bg-rose-50"><tr><th class="p-2 text-left">Baris</th><th class="p-2 text-left">SKU</th><th class="p-2 text-left">Alasan</th></tr></thead><tbody>'+errorHtml+'</tbody></table></div>':'');
 apply.disabled=!valid;apply.classList.toggle('opacity-50',!valid);apply.textContent=valid?'Terapkan '+valid+' harga valid':'Tidak ada harga valid';
}
async function applyPriceImportFromModal(){
 var b=bridge();if(!b||!b.isOwner())return notify('Impor harga supplier hanya dapat dilakukan oleh Owner.',true);
 if(!stagedPriceImport||!stagedPriceImport.result||!stagedPriceImport.result.validRows.length)return notify('Tidak ada baris harga valid untuk diterapkan.',true);
 var latest=validatePriceImport(stagedPriceImport.csvText,getRows());
 if(JSON.stringify(latest)!==JSON.stringify(stagedPriceImport.result)){
  stagedPriceImport.result=latest;
  renderPriceImportPreview(latest);
  return notify('Master Material berubah sejak pratinjau. Periksa hasil validasi terbaru sebelum menerapkan harga.',true);
 }
 var valid=latest.validRows.length,invalid=latest.errors.length;
 if(!w.confirm('Terapkan '+valid+' harga supplier yang valid? '+invalid+' baris tidak valid akan dilewati. SKU Draft tetap Draft dan tidak diaktifkan otomatis.'))return;
 try{
  var nextRows=applyPriceImport(getRows(),latest.validRows,new Date().toISOString());
  await save(nextRows);el('csk-material-price-import').classList.add('hidden');stagedPriceImport=null;render();
  notify('Impor harga selesai: '+valid+' SKU diperbarui, '+invalid+' baris dilewati. Periksa dokumen sumber sebelum mengaktifkan SKU.');
 }catch(error){notify('Impor harga gagal disimpan: '+String(error&&error.message||error),true);}
}

async function importSeed(){
 var b=bridge();if(!b||!b.isOwner())return notify('Impor master material hanya dapat dilakukan oleh Owner.',true);
 try{
  if(!seedCache){var response=await w.fetch('./data/csk-material-master-seed.json',{cache:'no-cache'});if(!response.ok)throw new Error('File master CSK tidak dapat dimuat.');seedCache=await response.json();}
  var rows=getRows().slice(),known=Object.create(null);rows.forEach(function(m){if(m.sku)known[String(m.sku).toUpperCase()]=true;});
  var added=0,skipped=0,now=new Date().toISOString();
  seedCache.items.forEach(function(item){
   var sku=String(item.sku||'').toUpperCase();if(!sku||known[sku]){skipped++;return;}
   known[sku]=true;
   rows.push(Object.assign({},item,{id:'MAT-CSK-'+sku.replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,''),updatedAt:now,priceDate:'',priceSource:'',supplierName:'',supplierId:'',unitPrice:0,purchasePrice:0,status:item.status==='template'?'template':'draft'}));added++;
  });
  if(!added){notify('Semua SKU master CSK sudah ada. Tidak ada data yang diduplikasi.');return;}
  await save(rows);render();notify('Impor selesai: '+added+' SKU ditambahkan, '+skipped+' SKU dilewati karena sudah terdaftar.');
 }catch(error){notify('Impor master CSK gagal: '+String(error&&error.message||error),true);}
}
async function toggleStatus(id){
 var b=bridge();if(!b||!b.isOwner())return notify('Perubahan status master hanya dapat dilakukan Owner.',true);
 var rows=getRows().map(function(x){return Object.assign({},x);}),m=rows.find(function(x){return String(x.id)===String(id);});if(!m)return;
 if(m.status==='template')return notify('Kode kelompok tidak dapat diaktifkan.',true);
 if(m.status==='active'&&!active(m)){openEditor(id);notify('Lengkapi supplier, sumber harga, dan tanggal harga untuk memverifikasi material ini.',true);return;}
  if(m.status==='active'){if(!w.confirm('Nonaktifkan '+m.sku+'? Riwayat transaksi tetap disimpan.'))return;m.status='inactive';}
 else{
  if(!n(m.purchasePrice)||!n(m.unitPrice)||!m.supplierName||!m.priceSource||!m.priceDate||!m.purchaseUnit||!m.unit||!n(m.conversionFactor))return notify('Lengkapi harga beli, supplier, sumber harga, tanggal, satuan, dan konversi melalui Edit Data sebelum aktivasi.',true);
  m.status='active';
 }
 m.updatedAt=new Date().toISOString();
 try{await save(rows);render();notify('Status '+m.sku+' sekarang '+statusLabel(m)+'.');}catch(error){notify('Gagal memperbarui status: '+String(error&&error.message||error),true);}
}
function render(){
 var root=el(rootId);if(!root)return;
 var rows=getRows(),q=query.toLowerCase(),categories=Array.from(new Set(rows.map(function(x){return String(x.category||'Lainnya');}))).sort();
 var filtered=rows.filter(function(m){
  var hay=[m.sku,m.name,m.category,m.subcategory,m.spec,m.color].join(' ').toLowerCase();
  return(!q||hay.indexOf(q)>=0)&&(category==='all'||m.category===category)&&(status==='all'||(status==='active'?active(m):status==='draft'?(m.status==='draft'||m.status==='template'||(m.status==='active'&&!active(m))):m.status===status));
 }).sort(function(a,b){return String(a.category).localeCompare(String(b.category))||String(a.sku).localeCompare(String(b.sku));});
 var activeCount=rows.filter(active).length,draftCount=rows.filter(function(x){return x.status==='draft'||(x.status==='active'&&!active(x));}).length,templateCount=rows.filter(function(x){return x.status==='template';}).length,priceMissing=rows.filter(function(x){return x.status==='draft'||(x.status==='active'&&!active(x));}).length;
 var b=bridge(),owner=!!(b&&b.isOwner());
 root.innerHTML='<div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div class="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-4 sm:p-5"><div class="flex flex-wrap items-start justify-between gap-3"><div><span class="inline-flex px-2 py-1 rounded-full bg-white/10 text-indigo-100 text-[10px] font-bold uppercase tracking-wide">Master Data CSK</span><h2 class="text-lg font-bold mt-2">Master Bahan Baku CSK</h2><p class="text-xs text-slate-300 mt-1 max-w-2xl">Satu kode untuk satu spesifikasi material. Data draft belum masuk HPP, purchasing, atau stok sebelum harga dan supplier diverifikasi.</p></div><div class="flex flex-wrap gap-2">'+(owner?'<button data-mm-action="download-price-template" class="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-bold">Unduh Template Harga</button><button data-mm-action="import-prices" class="px-3 py-2 rounded-lg bg-emerald-400 text-slate-950 text-xs font-bold">Impor Harga Supplier</button><button data-mm-action="import" class="px-3 py-2 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold">Impor 101 SKU CSK</button><button data-mm-action="add" class="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-bold">+ Material baru</button>':'')+'</div></div><div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4"><div class="rounded-xl bg-white/10 p-3"><div class="text-[10px] text-slate-300">Total master</div><b class="text-xl">'+rows.length+'</b></div><div class="rounded-xl bg-white/10 p-3"><div class="text-[10px] text-slate-300">Aktif</div><b class="text-xl text-emerald-300">'+activeCount+'</b></div><div class="rounded-xl bg-white/10 p-3"><div class="text-[10px] text-slate-300">Draft</div><b class="text-xl text-amber-300">'+draftCount+'</b></div><div class="rounded-xl bg-white/10 p-3"><div class="text-[10px] text-slate-300">Perlu dilengkapi</div><b class="text-xl">'+priceMissing+'</b></div></div></div><div class="p-3 sm:p-4 space-y-3"><div class="grid grid-cols-1 sm:grid-cols-3 gap-2"><input id="mm-search" value="'+esc(query)+'" class="w-full border border-slate-200 rounded-lg p-2.5 text-xs" placeholder="Cari kode, nama, ukuran, warna..."><select id="mm-category-filter" class="w-full border border-slate-200 rounded-lg p-2.5 text-xs"><option value="all">Semua kategori</option>'+categories.map(function(x){return'<option value="'+esc(x)+'" '+(category===x?'selected':'')+'>'+esc(x)+'</option>';}).join('')+'</select><select id="mm-status-filter" class="w-full border border-slate-200 rounded-lg p-2.5 text-xs"><option value="all" '+(status==='all'?'selected':'')+'>Semua status</option><option value="active" '+(status==='active'?'selected':'')+'>Aktif</option><option value="draft" '+(status==='draft'?'selected':'')+'>Draft / template</option><option value="inactive" '+(status==='inactive'?'selected':'')+'>Nonaktif</option></select></div><div class="flex items-center justify-between gap-2"><span class="text-[10px] text-slate-500">Menampilkan '+filtered.length+' dari '+rows.length+' material</span><span class="text-[10px] text-slate-400">Harga ditampilkan per satuan beli / satuan pakai</span></div><div class="overflow-x-auto"><table class="w-full min-w-[850px] text-xs"><thead class="bg-slate-50 text-slate-500"><tr><th class="text-left p-3">Kode / Nama material</th><th class="text-left p-3">Kategori</th><th class="text-left p-3">Satuan beli → pakai</th><th class="text-right p-3">Harga beli</th><th class="text-right p-3">Harga pakai</th><th class="text-center p-3">Status</th><th class="text-right p-3">Aksi</th></tr></thead><tbody>'+filtered.map(function(m){var usable=active(m);return'<tr class="border-t border-slate-100 hover:bg-slate-50/70"><td class="p-3"><b class="text-slate-900">'+esc(m.sku)+'</b><div class="text-[11px] text-slate-600 mt-1">'+esc(m.name)+'</div><div class="text-[10px] text-slate-400 mt-1">'+esc(m.spec||'Spesifikasi belum dilengkapi')+'</div></td><td class="p-3"><div>'+esc(m.category)+'</div><div class="text-[10px] text-slate-400">'+esc(m.subcategory||'')+'</div></td><td class="p-3">'+esc(m.purchaseUnit||'-')+' → '+esc(m.unit||'-')+'<div class="text-[10px] text-slate-400">1 '+esc(m.purchaseUnit||'-')+' = '+esc(m.conversionFactor||'-')+' '+esc(m.unit||'-')+'</div></td><td class="p-3 text-right">'+(n(m.purchasePrice)>0?rupiah(m.purchasePrice):'Belum diisi')+'</td><td class="p-3 text-right">'+(n(m.unitPrice)>0?rupiah(m.unitPrice):'Belum diisi')+'</td><td class="p-3 text-center"><span class="inline-flex px-2 py-1 rounded-full text-[10px] font-bold '+statusClass(m)+'">'+statusLabel(m)+'</span></td><td class="p-3 text-right whitespace-nowrap">'+(owner?'<button data-mm-action="edit" data-id="'+esc(m.id)+'" class="px-2.5 py-1.5 rounded-lg border text-[10px] font-bold">Edit</button> '+(m.status==='active'?'<button data-mm-action="toggle" data-id="'+esc(m.id)+'" class="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-bold">Nonaktifkan</button>':m.status==='template'?'':'<button data-mm-action="toggle" data-id="'+esc(m.id)+'" class="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold">Aktifkan</button>'):'-')+'</td></tr>';}).join('')+'</tbody></table></div><div class="rounded-xl bg-amber-50 border border-amber-100 p-3 text-[10px] text-amber-900"><b>Aturan master:</b> satuan stok mengikuti satuan pemakaian. Pembelian boleh memakai satuan berbeda, lalu dikonversi dengan faktor yang disimpan pada PO. Harga HPP dihitung otomatis: (harga beli ÷ faktor konversi) + waste allowance. Waste juga diperhitungkan pada kebutuhan stok dan reservasi Sales Order. Kode kelompok seperti H-H tidak dapat dipakai untuk transaksi sampai menjadi SKU ukuran yang spesifik.</div></div></div>';
 bind(root);
}
function bind(root){
 if(bound)return;
 root.addEventListener('click',function(event){var b=event.target.closest('[data-mm-action]');if(!b)return;var a=b.dataset.mmAction;if(a==='import')importSeed();if(a==='download-price-template')downloadPriceTemplate();if(a==='import-prices')openPriceImport();if(a==='add')openEditor('');if(a==='edit')openEditor(b.dataset.id);if(a==='toggle')toggleStatus(b.dataset.id);});
 root.addEventListener('input',function(event){if(event.target.id==='mm-search'){query=event.target.value;var p=event.target.selectionStart;render();var node=el('mm-search');node.focus();if(node.setSelectionRange)node.setSelectionRange(p,p);}});
 root.addEventListener('change',function(event){if(event.target.id==='mm-category-filter'){category=event.target.value;render();}if(event.target.id==='mm-status-filter'){status=event.target.value;render();}});
 bound=true;
}
function init(){render();}
w.CSKMaterialMaster={render:init,openEditor:openEditor,toggleStatus:toggleStatus,testUtils:{parseCsvMatrix:parseCsvMatrix,canonicalHeader:canonicalHeader,parseLocaleNumber:parseLocaleNumber,normalizePriceDate:normalizePriceDate,validatePriceImport:validatePriceImport,applyPriceImport:applyPriceImport,buildPriceTemplateCsv:buildPriceTemplateCsv}};
})(typeof window!=='undefined'?window:null);
