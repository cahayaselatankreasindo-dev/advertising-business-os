(function(w){
'use strict';
var mountId='inventory-app',formOpen=false,filterText='',bound=false,prefillPurchaseOrderId='';
function bridge(){return w.CSKInventoryBridge||null;}
function el(id){return w.document.getElementById(id);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function n(v){var x=Number(v);return Number.isFinite(x)?x:0;}
function qty(v){return n(v).toLocaleString('id-ID',{maximumFractionDigits:3});}
function E(){if(!w.CSKInventoryEngine)throw new Error('Mesin Inventory belum dimuat.');return w.CSKInventoryEngine;}
function data(){var b=bridge();if(!b)throw new Error('Koneksi modul Inventory belum siap.');return b.getData();}
function notify(message,error){var b=bridge();if(b&&b.toast)b.toast(message,!!error);}
function calculate(d){return E().calculateBalances(d.materials,d.inventoryTransactions);}
function movementLabel(type){return E().movementLabel(type);}
function movementClass(type){return ['issue','adjustment_out'].indexOf(type)>=0?'text-red-700':'text-emerald-700';}
function ensureBound(){
 var page=el(mountId);if(!page||bound)return;
 page.addEventListener('click',function(event){
  var b=event.target.closest('[data-inv-action]');if(!b)return;
  var action=b.dataset.invAction;
  if(action==='open'){formOpen=true;renderInventory();}
  if(action==='close'){formOpen=false;prefillPurchaseOrderId='';renderInventory();}
  if(action==='movement'){formOpen=true;prefillPurchaseOrderId='';renderInventory(b.dataset.movement);}
  if(action==='reserve-so'||action==='release-so'){handleStockReservation(b.dataset.salesOrderId,action==='reserve-so'?'reserve':'release',b);}
 });
 page.addEventListener('submit',function(event){
  if(event.target&&event.target.id==='inventory-entry-form'){event.preventDefault();saveInventoryTransaction();}
 });
 page.addEventListener('input',function(event){
  if(event.target&&event.target.id==='inv-search'){var value=event.target.value,position=value.length;filterText=value;if(!formOpen){renderInventory();var input=el('inv-search');if(input){input.focus();if(input.setSelectionRange)input.setSelectionRange(position,position);}}}
 });
 page.addEventListener('change',function(event){
  if(event.target&&event.target.id==='inv-material'){updateUnitHint();}
  if(event.target&&event.target.id==='inv-po'){if(event.target.value)applyPurchaseOrderSelection(event.target.value);else restoreAllMaterialOptions();}
  if(event.target&&event.target.id==='inv-movement'){updateMovementFields();}
 });
 bound=true;
}
function purchaseOrderItems(po){
 if(Array.isArray(po&&po.items))return po.items;
 try{return JSON.parse(po&&po.itemsJson||'[]');}catch(e){return[];}
}
function purchaseOrderReceiptProgress(po,transactions){
 var expected={};
 purchaseOrderItems(po).forEach(function(item){var id=String(item.materialId||'');expected[id]=(expected[id]||0)+n(item.qty);});
 var received={};
 (transactions||[]).filter(function(tx){return String(tx.purchaseOrderId||'')===String(po&&po.id)&&tx.movement==='receipt';}).forEach(function(tx){var id=String(tx.materialId||'');received[id]=(received[id]||0)+n(tx.qty);});
 var keys=Object.keys(expected);
 var total=keys.reduce(function(sum,id){return sum+expected[id];},0);
 var done=keys.reduce(function(sum,id){return sum+Math.min(expected[id],received[id]||0);},0);
 return{complete:keys.length>0&&keys.every(function(id){return(received[id]||0)+0.000001>=expected[id];}),total:total,received:done,remaining:Math.max(0,total-done)};
}
function restoreAllMaterialOptions(){
 var d=data(),select=el('inv-material'),qtyInput=el('inv-qty');
 if(!select)return;
 select.innerHTML='<option value="">Pilih material</option>'+d.materials.slice().sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''));}).map(function(m){return'<option value="'+esc(m.id)+'">'+esc(m.name)+' · '+esc(m.unit||'-')+'</option>';}).join('');
 if(qtyInput){qtyInput.disabled=false;qtyInput.removeAttribute('max');}
 var supplier=el('inv-supplier');if(supplier)supplier.value='';
 var save=el('inv-save');if(save)save.disabled=false;
 updateUnitHint();
}
function applyPurchaseOrderSelection(poId){
 var d=data(),po=d.purchaseOrders.find(function(p){return String(p.id)===String(poId);});
 if(!po)return notify('Purchase Order tidak ditemukan.',true);
 if(String(po.status||'').toLowerCase()!=='ordered')return notify('Purchase Order harus berstatus Dipesan untuk mencatat penerimaan.',true);
 if(el('inv-movement'))el('inv-movement').value='receipt';
 if(el('inv-po'))el('inv-po').value=po.id;
 if(el('inv-supplier'))el('inv-supplier').value=po.supplier||'';
 var items=purchaseOrderItems(po),progress=purchaseOrderReceiptProgress(po,d.inventoryTransactions);
 var select=el('inv-material'),qtyInput=el('inv-qty'),remaining=[];
 items.forEach(function(item){
  var already=(d.inventoryTransactions||[]).filter(function(tx){return String(tx.purchaseOrderId||'')===String(po.id)&&String(tx.materialId)===String(item.materialId)&&tx.movement==='receipt';}).reduce(function(sum,tx){return sum+n(tx.qty);},0);
  var left=Math.max(0,n(item.qty)-already);
  if(left>0){var m=d.materials.find(function(x){return String(x.id)===String(item.materialId);});if(m)remaining.push({material:m,qty:left});}
 });
 if(select){
  select.innerHTML=remaining.length?remaining.map(function(x){return'<option value="'+esc(x.material.id)+'">'+esc(x.material.name)+' · sisa '+qty(x.qty)+' '+esc(x.material.unit||'')+'</option>';}).join(''):'<option value="">Semua item PO sudah diterima</option>';
  if(remaining.length)select.value=remaining[0].material.id;
 }
 if(qtyInput){qtyInput.disabled=!remaining.length;qtyInput.value=remaining.length?remaining[0].qty:'';if(remaining.length)qtyInput.max=remaining[0].qty;else qtyInput.removeAttribute('max');}
 var save=el('inv-save');if(save)save.disabled=!remaining.length;
 var hint=el('inv-unit-hint');if(hint)hint.textContent=remaining.length?'Penerimaan PO '+po.id+'. '+remaining.length+' jenis material masih memiliki sisa. Kuantitas maksimum mengikuti sisa tiap material.':'Seluruh kuantitas PO sudah tercatat sebagai penerimaan.';
 updateMovementFields();updateUnitHint();
}
function updateUnitHint(){
 var d=data(),m=d.materials.find(function(x){return String(x.id)===String(el('inv-material')&&el('inv-material').value);});
 var hint=el('inv-unit-hint');if(hint)hint.textContent=m?'Satuan stok: '+(m.unit||'-')+'. Kuantitas wajib dicatat dalam satuan ini.':'Pilih material untuk melihat satuan stok.';
 var poId=el('inv-po')&&el('inv-po').value,qtyInput=el('inv-qty');
 if(poId&&m&&qtyInput){
  var po=d.purchaseOrders.find(function(p){return String(p.id)===String(poId);});
  var ordered=purchaseOrderItems(po).filter(function(item){return String(item.materialId)===String(m.id);}).reduce(function(sum,item){return sum+n(item.qty);},0);
  var received=(d.inventoryTransactions||[]).filter(function(tx){return String(tx.purchaseOrderId||'')===String(poId)&&String(tx.materialId)===String(m.id)&&tx.movement==='receipt';}).reduce(function(sum,tx){return sum+n(tx.qty);},0);
  var remaining=Math.max(0,ordered-received);qtyInput.max=remaining;
  if(Number(qtyInput.value)>remaining)qtyInput.value=remaining;
 }
}
function updateMovementFields(){
 var type=el('inv-movement')&&el('inv-movement').value;
 var project=el('inv-project-wrap'),supplier=el('inv-supplier-wrap'),po=el('inv-po-wrap'),notes=el('inv-notes-wrap');
 if(project)project.style.display=['issue','return'].indexOf(type)>=0?'':'none';
 if(supplier)supplier.style.display=type==='receipt'?'':'none';
 if(po)po.style.display=type==='receipt'?'':'none';
 if(notes)notes.style.display=['adjustment_in','adjustment_out'].indexOf(type)>=0?'':'';
 var submit=el('inv-save');if(submit)submit.textContent=type==='opening'?'Simpan Saldo Awal':type==='receipt'?'Catat Penerimaan':type==='issue'?'Catat Pengeluaran':type==='return'?'Catat Retur':'Simpan Penyesuaian';
}
function formHtml(d,defaultMovement){
 var materials=d.materials.slice().sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''));});
 var projects=d.projects.slice().sort(function(a,b){return String(a.title||'').localeCompare(String(b.title||''));});
 var purchaseOrders=(d.purchaseOrders||[]).filter(function(p){return String(p.status||'').toLowerCase()==='ordered';});
 var types=Object.keys(E().MOVEMENTS);
 var options=types.map(function(t){return'<option value="'+t+'" '+(t===(defaultMovement||'opening')?'selected':'')+'>'+esc(movementLabel(t))+'</option>';}).join('');
 return'<section class="bg-white border border-slate-200 rounded-2xl p-4 mb-5"><div class="flex justify-between items-start gap-3"><div><h2 class="font-bold text-sm">Catat Pergerakan Stok</h2><p class="text-xs text-slate-500 mt-1">Setiap transaksi tersimpan sebagai ledger permanen dan tidak dapat diedit atau dihapus.</p></div><button type="button" data-inv-action="close" class="px-3 py-2 border rounded-lg text-xs">Tutup</button></div><form id="inventory-entry-form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4"><label class="block text-[11px] font-bold text-slate-600">Jenis transaksi<select id="inv-movement" class="mt-1 w-full border rounded-lg p-2.5 text-xs">'+options+'</select></label><label class="block text-[11px] font-bold text-slate-600">Material<select id="inv-material" required class="mt-1 w-full border rounded-lg p-2.5 text-xs"><option value="">Pilih material</option>'+materials.map(function(m){return'<option value="'+esc(m.id)+'">'+esc(m.name)+' · '+esc(m.unit||'-')+'</option>';}).join('')+'</select></label><label class="block text-[11px] font-bold text-slate-600">Kuantitas<input id="inv-qty" type="number" min="0.001" step="0.001" required class="mt-1 w-full border rounded-lg p-2.5 text-xs" placeholder="Contoh: 25"></label><div id="inv-unit-hint" class="sm:col-span-2 lg:col-span-3 rounded-lg bg-blue-50 p-2.5 text-[11px] text-blue-800">Pilih material untuk melihat satuan stok.</div><label class="block text-[11px] font-bold text-slate-600">Tanggal transaksi<input id="inv-date" type="date" required value="'+E().localDate()+'" class="mt-1 w-full border rounded-lg p-2.5 text-xs"></label><label id="inv-project-wrap" class="block text-[11px] font-bold text-slate-600">Proyek<select id="inv-project" class="mt-1 w-full border rounded-lg p-2.5 text-xs"><option value="">Pilih proyek</option>'+projects.map(function(p){return'<option value="'+esc(p.id)+'">'+esc(p.title||p.client||p.id)+'</option>';}).join('')+'</select></label><label id="inv-supplier-wrap" class="block text-[11px] font-bold text-slate-600">Supplier<input id="inv-supplier" class="mt-1 w-full border rounded-lg p-2.5 text-xs" placeholder="Nama supplier"></label><label id="inv-po-wrap" class="block text-[11px] font-bold text-slate-600">Purchase Order<select id="inv-po" class="mt-1 w-full border rounded-lg p-2.5 text-xs"><option value="">Tanpa PO</option>'+purchaseOrders.map(function(p){return'<option value="'+esc(p.id)+'">'+esc(p.id)+' · '+esc(p.supplier||'Supplier')+' · '+esc(p.projectName||'')+'</option>';}).join('')+'</select></label><label class="block text-[11px] font-bold text-slate-600">Referensi / dokumen<input id="inv-reference" class="mt-1 w-full border rounded-lg p-2.5 text-xs" placeholder="No. surat jalan / nota / bukti"></label><label id="inv-notes-wrap" class="block text-[11px] font-bold text-slate-600 sm:col-span-2">Catatan / alasan<input id="inv-notes" class="mt-1 w-full border rounded-lg p-2.5 text-xs" placeholder="Wajib untuk penyesuaian stok"></label><div class="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center justify-between gap-2"><p class="text-[10px] text-slate-500">Saldo awal hanya boleh satu kali dan harus menjadi transaksi pertama material. Pengeluaran/retur wajib dikaitkan ke proyek.</p><button id="inv-save" type="submit" class="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-bold">Simpan Saldo Awal</button></div></form></section>';
}
async function saveInventoryTransaction(){
 var b=bridge(),button=el('inv-save'),d=null,added=null;
 try{
  if(!b||!b.isOwner())throw new Error('Transaksi stok hanya dapat dicatat oleh Owner.');
  d=data();var material=d.materials.find(function(m){return String(m.id)===String(el('inv-material').value);});
  var identity=b.getIdentity();
  var result=E().validateTransaction({
   materialId:el('inv-material').value,movement:el('inv-movement').value,qty:el('inv-qty').value,
   unit:material&&material.unit,date:el('inv-date').value,projectId:el('inv-project').value,
   supplier:el('inv-supplier').value,purchaseOrderId:el('inv-po').value,
   reference:el('inv-reference').value,notes:el('inv-notes').value,
   createdBy:identity&&identity.email||'Owner'
  },{materials:d.materials,projects:d.projects,purchaseOrders:d.purchaseOrders,transactions:d.inventoryTransactions});
  added=result.transaction;d.inventoryTransactions.unshift(added);
  if(button){button.disabled=true;button.textContent='Menyimpan & memverifikasi...';}
  var changedPO=null,previousPOState=null,poComplete=false;
  if(result.transaction.purchaseOrderId){changedPO=d.purchaseOrders.find(function(p){return String(p.id)===String(result.transaction.purchaseOrderId);});if(changedPO){previousPOState={status:changedPO.status,updatedAt:changedPO.updatedAt};poComplete=purchaseOrderReceiptProgress(changedPO,d.inventoryTransactions).complete;if(poComplete){changedPO.status='received';changedPO.updatedAt=new Date().toISOString();}}}
  try{await b.save();}catch(syncError){var rollbackIndex=d.inventoryTransactions.findIndex(function(x){return String(x.id)===String(added.id);});if(rollbackIndex>=0)d.inventoryTransactions.splice(rollbackIndex,1);if(changedPO&&previousPOState){changedPO.status=previousPOState.status;changedPO.updatedAt=previousPOState.updatedAt;}throw syncError;}
  formOpen=false;prefillPurchaseOrderId='';renderInventory();
  notify(result.transaction.transactionNo+' berhasil dicatat dan diverifikasi. Stok '+result.transaction.materialName+' sekarang '+qty(result.balances[result.transaction.materialId])+' '+result.transaction.unit+(poComplete?'. Seluruh item PO telah diterima; status PO diperbarui.':'.'));
 }catch(error){if(added&&d&&Array.isArray(d.inventoryTransactions)){var rollbackIndex=d.inventoryTransactions.findIndex(function(x){return String(x.id)===String(added.id);});if(rollbackIndex>=0)d.inventoryTransactions.splice(rollbackIndex,1);}notify(error.message||String(error),true);}
 finally{var current=el('inv-save');if(current){current.disabled=false;updateMovementFields();}}
}
function renderCommitmentPanel(report){
 var shortages=report.requirements.filter(function(row){return row.shortage>0;}).length;
 var html='<section class="bg-white border border-slate-200 rounded-2xl p-4 mb-5"><div class="flex flex-wrap justify-between items-start gap-3"><div><h2 class="font-bold text-sm">Komitmen Material Sales Order</h2><p class="text-[11px] text-slate-500 mt-1">Kebutuhan gabungan proyek yang siap produksi atau sedang berjalan.</p></div><div class="flex gap-2 text-[10px]"><span class="rounded-full bg-blue-50 text-blue-700 px-2 py-1">'+report.activeOrderCount+' order aktif</span><span class="rounded-full bg-violet-50 text-violet-700 px-2 py-1">'+report.activeProjectCount+' proyek</span></div></div>';
 if(report.errors.length)html+='<div class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800"><b>Perhitungan belum lengkap.</b><ul class="list-disc pl-4 mt-1">'+report.errors.map(function(error){return'<li>'+esc(error)+'</li>';}).join('')+'</ul><p class="mt-2">Jangan menganggap stok bebas tersedia sebelum HPP dan konversi semua proyek aktif dilengkapi.</p></div>';
 if(!report.requirements.length){
  html+='<div class="mt-3 rounded-lg border border-dashed p-5 text-center text-xs text-slate-500">'+(report.activeOrderCount?'Belum ada kebutuhan material yang berhasil dihitung. Periksa HPP proyek aktif.':'Belum ada Sales Order pada tahap Siap Produksi, Dalam Produksi, Quality Control, atau Siap Dikirim.')+'</div>';
 }else{
  html+='<div class="mt-3 flex flex-wrap gap-2 text-[10px]"><span class="rounded-lg bg-slate-50 px-2 py-1">Material kekurangan: <b class="'+(shortages?'text-red-700':'text-emerald-700')+'">'+shortages+'</b></span><span class="rounded-lg bg-slate-50 px-2 py-1">Status: <b>'+(report.ready?'Perhitungan lengkap':'Perlu pemeriksaan')+'</b></span></div>';
  html+='<div class="overflow-x-auto mt-3"><table class="w-full min-w-[760px] text-[11px]"><thead class="bg-slate-50 text-slate-500"><tr><th class="text-left p-2">Material</th><th class="text-left p-2">Satuan</th><th class="text-right p-2">Stok fisik</th><th class="text-right p-2">Komitmen aktif</th><th class="text-right p-2">Estimasi bebas</th><th class="text-right p-2">Kekurangan</th></tr></thead><tbody>'+report.requirements.map(function(row){
   var freeClass=row.availableAfterCommitments<0?'text-red-700':'text-emerald-700';
   return'<tr class="border-t"><td class="p-2"><b>'+esc(row.name)+'</b><div class="text-[10px] text-slate-400">'+esc(row.projects.map(function(project){return project.projectName;}).join(', '))+'</div></td><td class="p-2">'+esc(row.unit)+'</td><td class="p-2 text-right">'+qty(row.onHand)+'</td><td class="p-2 text-right font-semibold">'+qty(row.committed)+'</td><td class="p-2 text-right font-bold '+freeClass+'">'+qty(row.availableAfterCommitments)+'</td><td class="p-2 text-right font-bold '+(row.shortage>0?'text-red-700':'text-emerald-700')+'">'+(row.shortage>0?qty(row.shortage):'0')+'</td></tr>';
  }).join('')+'</tbody></table></div>';
 }
 html+='<p class="text-[10px] text-slate-400 mt-3">Komitmen dihitung dari HPP terbaru proyek dengan status Siap Produksi, Dalam Produksi, Quality Control, dan Siap Dikirim. Pengeluaran serta retur material proyek mengurangi atau menambah kebutuhan tersisa. Ini adalah monitoring, bukan reservasi stok yang terkunci; perubahan HPP dapat mengubah estimasi.</p></section>';
 return html;
}
function activeReservationMap(rows){
 var out={};(Array.isArray(rows)?rows:[]).forEach(function(row){var key=String(row.salesOrderId||'')+'|'+String(row.materialId||'');if(!out[key])out[key]={salesOrderId:String(row.salesOrderId||''),materialName:String(row.materialName||''),unit:String(row.unit||''),qty:0};out[key].qty+=(String(row.eventType)==='reserve'?1:(String(row.eventType)==='release'?-1:0))*Math.max(0,n(row.qty));});Object.keys(out).forEach(function(k){out[k].qty=Math.max(0,out[k].qty);});return out;
}
function handleStockReservation(id,mode,button){
 var b=bridge(),auth=w.CSKAuth;if(!b||!b.isOwner()||!auth)return notify('Reservasi stok hanya dapat dikelola oleh Owner.',true);
 if(button){button.disabled=true;button.textContent='Memproses...';}
 Promise.resolve().then(function(){return mode==='reserve'?auth.reserveSalesOrderStock(id):auth.releaseSalesOrderStock(id,'Dilepas oleh Owner dari modul Inventory');})
 .then(function(){notify(mode==='reserve'?'Reservasi stok berhasil dikunci di Google Sheets.':'Reservasi stok berhasil dilepas.');renderInventory();})
 .catch(function(error){notify(error&&error.message||String(error),true);renderInventory();});
}
function renderReservationPanel(d){
 var map=activeReservationMap(d.stockReservations||[]),orders=(d.salesOrders||[]).filter(function(o){return String(o.status||'').toLowerCase()==='in_production';});
 var count=Object.keys(map).filter(function(k){return map[k].qty>0.000001;}).length;
 var html='<section class="bg-white border border-emerald-200 rounded-2xl p-4 mb-5"><div class="flex flex-wrap justify-between gap-3"><div><h2 class="font-bold text-sm">Stock Reservation · Terkunci</h2><p class="text-[11px] text-slate-500 mt-1">Alokasi fisik disimpan di server. Hanya SO berstatus Dalam Produksi yang dapat dikunci.</p></div><span class="rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 text-[10px] font-bold">'+count+' alokasi aktif</span></div>';
 if(!bOwner())return html+'<p class="mt-3 text-xs text-slate-500">Aksi reservasi hanya tersedia untuk Owner.</p></section>';
 if(!orders.length)html+='<div class="mt-3 rounded-lg border border-dashed p-4 text-center text-xs text-slate-500">Belum ada SO berstatus Dalam Produksi.</div>';
 else html+='<div class="mt-3 space-y-2">'+orders.map(function(o){var lines=Object.keys(map).map(function(k){return map[k];}).filter(function(x){return x.salesOrderId===String(o.id)&&x.qty>0.000001;}),active=lines.length>0;return'<div class="rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3"><div class="min-w-0 flex-1"><b class="text-xs">'+esc(o.orderNo||o.id)+' · '+esc(o.projectName||'Proyek')+'</b><div class="text-[10px] text-slate-500 mt-1">'+(active?lines.map(function(x){return esc(x.materialName)+' '+qty(x.qty)+' '+esc(x.unit);}).join(' · '):'Belum ada stok yang dikunci')+'</div></div>'+(active?'<button data-inv-action="release-so" data-sales-order-id="'+esc(o.id)+'" class="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-[11px] font-bold">Lepas Reservasi</button>':'<button data-inv-action="reserve-so" data-sales-order-id="'+esc(o.id)+'" class="px-3 py-2 rounded-lg bg-emerald-700 text-white text-[11px] font-bold">Reservasi Stok</button>')+'</div>';}).join('')+'</div>';
 html+='<p class="text-[10px] text-slate-400 mt-3">Menggunakan snapshot HPP pada SO. SO dibatalkan, dikirim, atau ditutup akan melepas reservasi otomatis. Pengeluaran stok yang menyentuh alokasi terkunci ditolak sampai Material Picking diaktifkan.</p></section>';return html;
}
function bOwner(){var b=bridge();return !!(b&&b.isOwner());}

function renderInventory(defaultMovement){
 var page=el(mountId);if(!page)return;
 try{
  var d=data(),balances=calculate(d),materials=d.materials.slice().sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''));}),commitments=E().calculateOpenSalesOrderCommitments(d.salesOrders||[],d.costSheets||[],d.materials||[],d.inventoryTransactions||[],balances),commitmentMap=Object.create(null);commitments.requirements.forEach(function(row){commitmentMap[String(row.materialId)]=row;});
  var activeMaterials=materials.filter(function(m){return m.status!=='inactive';});
  var stocked=materials.filter(function(m){return E().getBalance(m.id,balances)>0;});
  var transactions=E().sortTransactions(d.inventoryTransactions).reverse();
  var filtered=materials.filter(function(m){return String(m.name||'').toLowerCase().includes(filterText.toLowerCase())||String(m.sku||'').toLowerCase().includes(filterText.toLowerCase());});
  var html='<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5"><div class="bg-white border rounded-xl p-3"><div class="text-[10px] text-slate-500">Material aktif</div><b class="text-xl">'+activeMaterials.length+'</b></div><div class="bg-white border rounded-xl p-3"><div class="text-[10px] text-slate-500">Material ada stok</div><b class="text-xl">'+stocked.length+'</b></div><div class="bg-white border rounded-xl p-3"><div class="text-[10px] text-slate-500">Transaksi ledger</div><b class="text-xl">'+transactions.length+'</b></div><div class="bg-white border rounded-xl p-3"><div class="text-[10px] text-slate-500">Proyek terhubung</div><b class="text-xl">'+new Set(transactions.filter(function(t){return t.projectId;}).map(function(t){return String(t.projectId);})).size+'</b></div></div>';
  html+='<div class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-900 mb-4"><b>Aturan satuan:</b> stok dicatat menggunakan satuan pemakaian pada Master Material, bukan otomatis satuan pembelian. Konversi pembelian/pack dan penerimaan PO akan diintegrasikan pada tahap Purchasing berikutnya. Tidak ada stok awal yang diasumsikan; saldo mulai dari nol sampai transaksi dicatat.</div>';
  html+=renderCommitmentPanel(commitments);
  html+=renderReservationPanel(d);
   if(formOpen)html+=formHtml(d,defaultMovement);
  html+='<section class="bg-white border rounded-2xl p-4 mb-5"><div class="flex flex-wrap justify-between items-center gap-3"><div><h2 class="font-bold text-sm">Saldo Stok Material</h2><p class="text-xs text-slate-500 mt-1">Saldo dihitung dari seluruh transaksi masuk dan keluar.</p></div><div class="flex flex-wrap gap-2"><button data-inv-action="movement" data-movement="opening" class="px-3 py-2 rounded-lg border text-[11px] font-bold">+ Saldo Awal</button><button data-inv-action="movement" data-movement="receipt" class="px-3 py-2 rounded-lg bg-emerald-700 text-white text-[11px] font-bold">+ Terima Barang</button><button data-inv-action="movement" data-movement="issue" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-[11px] font-bold">− Keluarkan Stok</button><button data-inv-action="open" class="px-3 py-2 rounded-lg border text-[11px] font-bold">Transaksi Lain</button></div></div><input id="inv-search" value="'+esc(filterText)+'" class="mt-3 w-full border rounded-lg p-2.5 text-xs" placeholder="Cari nama material atau SKU..."><div class="overflow-x-auto mt-3"><table class="w-full text-xs min-w-[650px]"><thead class="bg-slate-50 text-slate-500"><tr><th class="text-left p-3">Material</th><th class="text-left p-3">Kategori</th><th class="text-left p-3">Satuan stok</th><th class="text-right p-3">Stok fisik</th><th class="text-right p-3">Komitmen aktif</th><th class="text-right p-3">Estimasi bebas</th><th class="text-left p-3">Status master</th></tr></thead><tbody>'+filtered.map(function(m){var balance=E().getBalance(m.id,balances),commitment=commitmentMap[String(m.id)],committed=commitment?commitment.committed:0,free=balance-committed;return'<tr class="border-t"><td class="p-3"><b>'+esc(m.name||'-')+'</b><div class="text-[10px] text-slate-400">'+esc(m.sku||m.id)+'</div></td><td class="p-3">'+esc(m.category||'-')+'</td><td class="p-3">'+esc(m.unit||'-')+'</td><td class="p-3 text-right font-bold '+(balance>0?'text-emerald-700':'text-slate-400')+'">'+qty(balance)+'</td><td class="p-3 text-right">'+qty(committed)+'</td><td class="p-3 text-right font-bold '+(free<0?'text-red-700':'text-emerald-700')+'">'+qty(free)+'</td><td class="p-3">'+(m.status==='inactive'?'<span class="text-red-600">Nonaktif</span>':'<span class="text-emerald-700">Aktif</span>')+'</td></tr>';}).join('')+'</tbody></table></div></section>';
  html+='<section class="bg-white border rounded-2xl p-4"><div class="flex flex-wrap justify-between items-center gap-2"><div><h2 class="font-bold text-sm">Riwayat Pergerakan Stok</h2><p class="text-xs text-slate-500 mt-1">Ledger bersifat append-only; koreksi dilakukan melalui transaksi penyesuaian.</p></div><span class="text-[10px] text-slate-400">Menampilkan 50 transaksi terakhir</span></div>';
  if(!transactions.length)html+='<div class="border border-dashed rounded-xl p-8 mt-3 text-center text-xs text-slate-500">Belum ada transaksi stok. Catat saldo awal atau penerimaan barang untuk memulai.</div>';
  else html+='<div class="overflow-x-auto mt-3"><table class="w-full text-xs min-w-[760px]"><thead class="bg-slate-50 text-slate-500"><tr><th class="text-left p-3">Tanggal / No.</th><th class="text-left p-3">Material</th><th class="text-left p-3">Jenis</th><th class="text-right p-3">Qty</th><th class="text-left p-3">Referensi</th><th class="text-left p-3">Catatan</th></tr></thead><tbody>'+transactions.slice(0,50).map(function(t){var signed=['issue','adjustment_out'].indexOf(t.movement)>=0?'-':'+';return'<tr class="border-t"><td class="p-3">'+esc(t.date||'-')+'<div class="text-[10px] text-slate-400">'+esc(t.transactionNo||t.id)+'</div></td><td class="p-3"><b>'+esc(t.materialName||t.materialId)+'</b><div class="text-[10px] text-slate-400">'+esc(t.projectName||t.supplier||'')+'</div></td><td class="p-3">'+esc(movementLabel(t.movement))+'</td><td class="p-3 text-right font-bold '+movementClass(t.movement)+'">'+signed+qty(t.qty)+' '+esc(t.unit||'')+'</td><td class="p-3">'+esc(t.reference||t.purchaseOrderId||'-')+'</td><td class="p-3">'+esc(t.notes||'-')+'</td></tr>';}).join('')+'</tbody></table></div>';
  html+='</section>';
  page.innerHTML=html;
  ensureBound();
  updateUnitHint();
  updateMovementFields();
  if(formOpen&&prefillPurchaseOrderId)applyPurchaseOrderSelection(prefillPurchaseOrderId);
 }catch(error){page.innerHTML='<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">'+esc(error.message||String(error))+'</div>';}
}
w.renderInventory=renderInventory;
w.openInventoryReceiptFromPO=function(poId){
 var b=bridge();if(!b||!b.isOwner())return notify('Penerimaan stok hanya dapat dicatat oleh Owner.',true);
 prefillPurchaseOrderId=String(poId||'');formOpen=true;
 if(typeof w.nav==='function')w.nav('inventory');
 renderInventory('receipt');
};
})(window);
