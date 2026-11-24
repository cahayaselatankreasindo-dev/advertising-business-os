(function(w){
'use strict';
var rootId='sales-orders-app',filter='all',bound=false;
function bridge(){return w.CSKSalesOrderBridge||null;}
function el(id){return w.document.getElementById(id);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function money(v){return typeof w.formatRp==='function'?w.formatRp(v):'Rp '+Math.round(Number(v)||0).toLocaleString('id-ID');}
function n(v){var x=Number(v);return Number.isFinite(x)?x:0;}
function E(){if(!w.CSKSalesOrderEngine)throw new Error('Mesin Sales Order belum dimuat.');return w.CSKSalesOrderEngine;}
function data(){var b=bridge();if(!b)throw new Error('Koneksi modul Business OS belum siap.');return b.getData();}
function notify(msg,error){var b=bridge();if(b&&b.toast)b.toast(msg,!!error);}
function summary(order,d){return E().summarizePayments({id:order.quotationId,total:order.total,dpPercent:order.dpPercent,convertedInvoiceId:(d.quotations.find(function(q){return String(q.id)===String(order.quotationId);})||{}).convertedInvoiceId},d.invoices,d.invoicePayments);}
function quoteFor(id,d){return d.quotations.find(function(q){return String(q.id)===String(id);})||null;}
function invoiceForQuote(id,d){return d.invoices.filter(function(i){return String(i.sourceQuotationId||i.quotationId||'')===String(id);});}
function statusPill(status){
 var styles={awaiting_dp:'bg-amber-100 text-amber-800',ready_production:'bg-blue-100 text-blue-800',in_production:'bg-cyan-100 text-cyan-800',quality_check:'bg-violet-100 text-violet-800',ready_delivery:'bg-indigo-100 text-indigo-800',delivered:'bg-emerald-100 text-emerald-800',closed:'bg-slate-900 text-white',cancelled:'bg-red-100 text-red-700'};
 return'<span class="inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold '+(styles[status]||'bg-slate-100 text-slate-700')+'">'+esc(E().statusLabel(status))+'</span>';
}
function ensureBound(){
 var page=el(rootId);if(!page||bound)return;
 page.addEventListener('click',function(event){
  var button=event.target.closest('[data-so-action]');if(!button)return;
  var action=button.dataset.soAction,id=button.dataset.id,status=button.dataset.status;
  if(action==='create')createSalesOrderFromQuotation(id);
  if(action==='create-po')createDraftPOFromShortage(id);
  if(action==='transition')updateSalesOrderStatus(id,status);
  if(action==='invoice')openInvoiceForQuotation(id);
  if(action==='project')openProject(id);
  if(action==='filter'){filter=status||'all';renderSalesOrders();}
 });
 bound=true;
}
async function persist(){
 var b=bridge();if(!b)throw new Error('Koneksi Business OS tidak tersedia.');
 await b.save();
}
async function createSalesOrderFromQuotation(quotationId){
 var b=bridge();
 try{
  if(!b||!b.isOwner())throw new Error('Sales Order hanya dapat dibuat oleh Owner.');
  var d=data(),q=quoteFor(quotationId,d);if(!q)throw new Error('Quotation tidak ditemukan.');
  var old=d.salesOrders.find(function(x){return String(x.quotationId)===String(q.id);});
  if(old){notify('Quotation ini sudah memiliki Sales Order '+old.orderNo+'.');renderSalesOrders();return old;}
  if(String(q.status||'').toLowerCase()!=='approved')throw new Error('Quotation harus berstatus Disetujui.');
  var project=d.projects.find(function(p){return String(p.id)===String(q.projectId||'');});
  if(!project){
   if(typeof w.createProjectFromQuotation!=='function')throw new Error('Modul proyek belum tersedia.');
   var linked=await w.createProjectFromQuotation(q.id);
   if(!linked)throw new Error('Proyek belum berhasil disimpan dan diverifikasi. Sales Order belum dibuat.');
   d=data();q=quoteFor(quotationId,d);project=d.projects.find(function(p){return String(p.id)===String(q&&q.projectId||'');});
  }
  if(!project)throw new Error('Proyek belum terhubung dengan quotation.');
  var currentHpp=(d.costSheets||[]).find(function(x){return String(x.projectId)===String(q.projectId||project.id);})||null;
  var built=E().buildOrder(q,project,d.salesOrders,{date:E().localDate(),sourceCostSheetSnapshot:q.sourceCostSheetSnapshot||currentHpp});
  if(built.existing){notify('Sales Order sudah tersedia.');renderSalesOrders();return built.order;}
  d.salesOrders.unshift(built.order);
  await persist();
  renderSalesOrders();
  notify('Sales Order '+built.order.orderNo+' berhasil dibuat dan diverifikasi.');
  return built.order;
 }catch(error){notify(error.message||String(error),true);return null;}
}
async function updateSalesOrderStatus(id,nextStatus){
 var b=bridge();
 try{
  if(!b||!b.isOwner())throw new Error('Perubahan Sales Order hanya dapat dilakukan Owner.');
  var d=data(),order=d.salesOrders.find(function(x){return String(x.id)===String(id);});
  if(!order)throw new Error('Sales Order tidak ditemukan.');
  var q=quoteFor(order.quotationId,d),payment=summary(order,d);
  var identity=b.getIdentity();
  var updated=E().transition(order,nextStatus,payment,identity&&identity.email||'Owner',new Date().toISOString());
  var index=d.salesOrders.findIndex(function(x){return String(x.id)===String(id);});
  d.salesOrders[index]=updated;
  var project=d.projects.find(function(p){return String(p.id)===String(order.projectId);});
  if(project){
   var projectStatus={ready_production:'plan',in_production:'ongoing',quality_check:'review',ready_delivery:'review',delivered:'done',closed:'done',cancelled:'cancelled'};
   if(projectStatus[nextStatus])project.status=projectStatus[nextStatus];
  }
  await persist();
  renderSalesOrders();
  notify('Status '+order.orderNo+' diperbarui menjadi '+E().statusLabel(nextStatus)+'.');
 }catch(error){
  var message=error.message||String(error);
  if(message.indexOf('SALES_ORDER_STOCK_RESERVATION_REQUIRED')>=0)message='Stok material belum dikunci. Buka Inventory & Stok, klik Kunci Stok pada Sales Order ini, lalu ubah status menjadi Dalam Produksi.';
  notify(message,true);
 }
}
function openInvoiceForQuotation(id){
 var d=data(),q=quoteFor(id,d);
 if(!q)return notify('Quotation tidak ditemukan.',true);
 if(typeof w.createInvoiceFromQuotation!=='function')return notify('Modul invoice belum tersedia.',true);
 w.createInvoiceFromQuotation(id);
}
function openProject(id){
 var d=data(),order=d.salesOrders.find(function(x){return String(x.id)===String(id);});
 if(!order)return;
 if(typeof w.nav==='function')w.nav('projects');
 notify('Proyek: '+(order.projectName||order.projectId));
}
function openPurchaseOrderQty(projectId,materialId,d){
 return(d.purchaseOrders||[]).filter(function(po){return String(po.projectId)===String(projectId)&&['draft','ordered'].indexOf(String(po.status||'').toLowerCase())>=0;}).reduce(function(sum,po){
  var ordered=(Array.isArray(po.items)?po.items:[]).filter(function(item){return String(item.materialId)===String(materialId);}).reduce(function(total,item){return total+n(item.qty)*(Number(item.conversionFactor)||1);},0);
  var received=(d.inventoryTransactions||[]).filter(function(tx){return String(tx.purchaseOrderId||'')===String(po.id)&&String(tx.materialId)===String(materialId)&&tx.movement==='receipt';}).reduce(function(total,tx){return total+n(tx.qty);},0);
  return sum+Math.max(0,ordered-received);
 },0);
}
async function createDraftPOFromShortage(salesOrderId){
 var b=bridge(),created=[];
 try{
  if(!b||!b.isOwner())throw new Error('Draft Purchase Order hanya dapat dibuat oleh Owner.');
  var d=data(),order=d.salesOrders.find(function(x){return String(x.id)===String(salesOrderId);});
  if(!order)throw new Error('Sales Order tidak ditemukan.');
  var sheet=order.sourceCostSheetSnapshot||(d.costSheets||[]).find(function(x){return String(x.projectId)===String(order.projectId);});
  if(!sheet)throw new Error('Snapshot HPP Sales Order belum tersedia. Lengkapi HPP dan buat ulang Sales Order dari quotation yang sesuai.');
  var balances=w.CSKInventoryEngine.calculateBalances(d.materials||[],d.inventoryTransactions||[]);
  var plan=w.CSKInventoryEngine.calculateHppRequirements(sheet,d.materials||[],balances);
  if(plan.errors.length)throw new Error('Perbaiki konversi HPP terlebih dahulu: '+plan.errors.join(' '));
  var shortages=plan.requirements.filter(function(x){return x.shortage>0;});
  if(!shortages.length){notify('Tidak ada kekurangan material yang perlu dibelikan.');return;}
  var groups={};
  shortages.forEach(function(row){
   var material=d.materials.find(function(m){return String(m.id)===String(row.materialId);});
   if(!material)throw new Error('Material '+row.name+' tidak ditemukan.');
   var supplier=String(material.supplierName||'').trim(),purchasePrice=E().purchasePriceForUnit(material),conversionFactor=Number(material.conversionFactor),purchaseUnit=String(material.purchaseUnit||material.unit||'').trim();
   if(!supplier)throw new Error('Supplier belum diisi untuk '+material.name+'. Lengkapi Master Material sebelum membuat PO.');
   if(!Number.isFinite(purchasePrice)||purchasePrice<=0||!Number.isFinite(conversionFactor)||conversionFactor<=0||!purchaseUnit)throw new Error('Harga beli, satuan pembelian, atau faktor konversi belum valid untuk '+material.name+'.');
   if(!material.priceDate||!material.priceSource)throw new Error('Sumber dan tanggal harga belum dicatat untuk '+material.name+'. Perbarui Master Material sebelum membuat PO.');
   var openQty=openPurchaseOrderQty(order.projectId,material.id,d);
   var buyStockQty=Math.max(0,row.shortage-openQty);
   if(buyStockQty<=0)return;
   var purchaseQty=E().purchaseQuantityForStock(buyStockQty,material);
   if(purchaseQty<=0)return;
   if(!groups[supplier])groups[supplier]=[];
   groups[supplier].push({materialId:material.id,name:material.name,unit:purchaseUnit,qty:purchaseQty,purchaseUnit:purchaseUnit,usageUnit:material.unit,conversionFactor:conversionFactor,unitPrice:purchasePrice,subtotal:purchaseQty*purchasePrice,priceSnapshot:{purchasePrice:purchasePrice,purchaseUnit:purchaseUnit,usageUnit:material.unit,conversionFactor:conversionFactor,baseUsageUnitPrice:purchasePrice/conversionFactor,hppUsageUnitPrice:material.unitPrice,priceSource:material.priceSource,priceDate:material.priceDate}});
  });
  var suppliers=Object.keys(groups);
  if(!suppliers.length){notify('Kekurangan material sudah tercakup dalam Draft/PO berjalan untuk proyek ini.');return;}
  var now=new Date().toISOString(),date=E().localDate();
  suppliers.forEach(function(supplier,index){
   var items=groups[supplier],total=items.reduce(function(sum,item){return sum+item.subtotal;},0);
   created.push({id:'PO-CSK-'+Date.now()+'-'+(index+1),projectId:order.projectId,projectName:order.projectName||'',supplier:supplier,date:date,items:items,total:total,status:'draft',inventoryControlVersion:1,createdAt:now,updatedAt:now});
  });
  created.forEach(function(po){d.purchaseOrders.unshift(po);});
  try{await b.save();}catch(syncError){created.forEach(function(po){var i=d.purchaseOrders.findIndex(function(x){return String(x.id)===String(po.id);});if(i>=0)d.purchaseOrders.splice(i,1);});throw syncError;}
  renderSalesOrders();
  notify(created.length+' Draft Purchase Order dibuat dari kekurangan HPP. Periksa kembali harga, supplier, dan kuantitas sebelum diterbitkan.');
 }catch(error){notify(error.message||String(error),true);}
}
function materialPlanHtml(order,d,balances){
 var sheet=order.sourceCostSheetSnapshot||(d.costSheets||[]).find(function(x){return String(x.projectId)===String(order.projectId);});
 if(!sheet)return'<div class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">Snapshot HPP belum tersedia. Lengkapi HPP sebelum membuat Sales Order baru.</div>';
 if(!w.CSKInventoryEngine)return'';
 var plan=w.CSKInventoryEngine.calculateHppRequirements(sheet,d.materials,balances);
 if(!plan.requirements.length&&!plan.errors.length)return'<div class="mt-3 rounded-lg border p-3 text-[11px] text-slate-500">HPP belum memiliki baris material yang dapat dihitung.</div>';
 var rows=plan.requirements.map(function(item){
  var pendingPO=openPurchaseOrderQty(order.projectId,item.materialId,d),toBuy=Math.max(0,item.shortage-pendingPO);
  return'<tr class="border-t"><td class="py-2 pr-3"><b>'+esc(item.name)+'</b><div class="text-[10px] text-slate-400">'+esc(item.unit)+'</div></td><td class="py-2 text-right">'+qtyFormat(item.required)+'</td><td class="py-2 text-right">'+qtyFormat(item.onHand)+'</td><td class="py-2 text-right font-bold '+(item.shortage>0?'text-red-700':'text-emerald-700')+'">'+(item.shortage>0?qtyFormat(item.shortage):'Cukup')+'</td><td class="py-2 text-right text-blue-700">'+(pendingPO>0?qtyFormat(pendingPO):'-')+'</td><td class="py-2 text-right font-bold '+(toBuy>0?'text-amber-700':'text-emerald-700')+'">'+(toBuy>0?qtyFormat(toBuy):'-')+'</td></tr>';
 }).join('');
 var errorHtml=plan.errors.length?'<ul class="list-disc pl-4 mt-2 text-[10px] text-amber-800">'+plan.errors.map(function(e){return'<li>'+esc(e)+'</li>';}).join('')+'</ul>':'';
 var hasBuyableShortage=plan.requirements.some(function(x){return x.shortage>openPurchaseOrderQty(order.projectId,x.materialId,d);});
 var hasShortage=plan.requirements.some(function(x){return x.shortage>0;});
 var poButton=plan.errors.length===0&&hasBuyableShortage?'<button data-so-action="create-po" data-id="'+esc(order.id)+'" class="mt-3 px-3 py-2 rounded-lg bg-emerald-700 text-white text-[11px] font-bold">Buat Draft PO dari Kekurangan</button>':hasShortage&&plan.errors.length===0?'<p class="mt-3 text-[10px] text-blue-700">Kekurangan stok sudah tercakup dalam Draft/PO berjalan.</p>':'';
 var state=plan.errors.length?'<span class="text-amber-700 font-bold">Konversi perlu diperbaiki</span>':plan.ready?'<span class="text-emerald-700 font-bold">Stok saat ini mencukupi</span>':hasBuyableShortage?'<span class="text-amber-700 font-bold">Perlu pembelian</span>':'<span class="text-blue-700 font-bold">PO sedang berjalan</span>';
 var snapshotLabel=order.sourceCostSheetSnapshot?'Snapshot HPP '+String(order.sourceCostSheetSnapshot.updatedAt||'').slice(0,10):'HPP aktif (Sales Order lama)';
 return'<details class="mt-3 rounded-xl border border-slate-200 p-3"><summary class="cursor-pointer text-xs font-bold text-slate-700">Kebutuhan material · '+snapshotLabel+' · '+plan.requirements.length+' jenis · '+state+'</summary><div class="overflow-x-auto mt-2"><table class="w-full text-[11px] min-w-[620px]"><thead class="text-slate-500"><tr><th class="text-left py-2">Material</th><th class="text-right py-2">Kebutuhan</th><th class="text-right py-2">Stok fisik</th><th class="text-right py-2">Kekurangan</th><th class="text-right py-2">Sudah dipesan</th><th class="text-right py-2">Perlu PO</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+errorHtml+poButton+'<p class="text-[10px] text-slate-400 mt-2">Perhitungan memakai konversi satuan dari Master Material. Draft PO dibuat per supplier dan belum diterbitkan. Stok yang ditampilkan adalah stok fisik, belum dikurangi reservasi order lain. Belum ada penguncian stok otomatis.</p></details>';
}
function qtyFormat(value){return Number(value||0).toLocaleString('id-ID',{maximumFractionDigits:3});}
function quoteCandidates(d){
 return d.quotations.filter(function(q){
  return String(q.status||'').toLowerCase()==='approved'&&!d.salesOrders.some(function(s){return String(s.quotationId)===String(q.id);});
 }).sort(function(a,b){return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));});
}
function renderSalesOrders(){
 var page=el(rootId);if(!page)return;
 try{
  var d=data(),engine=E(),orders=(d.salesOrders||[]).slice().sort(function(a,b){return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));});
  var stockBalances=w.CSKInventoryEngine?w.CSKInventoryEngine.calculateBalances(d.materials||[],d.inventoryTransactions||[]):{};
  var counts={};Object.keys(engine.LABELS).forEach(function(s){counts[s]=orders.filter(function(o){return o.status===s;}).length;});
  var active=filter==='all'?orders:orders.filter(function(o){return o.status===filter;});
  var candidates=quoteCandidates(d);
  var stats=[
   ['Menunggu DP',counts.awaiting_dp,'amber'],['Siap Produksi',counts.ready_production,'blue'],
   ['Dalam Produksi',counts.in_production,'cyan'],['Quality Control',counts.quality_check,'violet'],
   ['Siap Dikirim',counts.ready_delivery,'indigo'],['Selesai / Ditutup',counts.closed+counts.delivered,'emerald']
  ];
  var html='<div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mb-5">'+stats.map(function(x){return'<div class="bg-white border border-slate-200 rounded-xl p-3"><div class="text-[10px] text-slate-500">'+x[0]+'</div><b class="text-xl text-slate-900">'+x[1]+'</b></div>';}).join('')+'</div>';
  html+='<section class="bg-white border border-slate-200 rounded-2xl p-4 mb-5"><div class="flex flex-wrap justify-between items-start gap-3"><div><h2 class="font-bold text-sm">Quotation siap dikonversi</h2><p class="text-xs text-slate-500 mt-1">Hanya quotation berstatus Disetujui yang dapat menjadi Sales Order.</p></div><span class="text-xs text-slate-500">'+candidates.length+' menunggu konversi</span></div>';
  if(!candidates.length)html+='<div class="mt-3 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">Belum ada quotation disetujui yang belum memiliki Sales Order.</div>';
  else html+='<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">'+candidates.map(function(q){return'<article class="border border-slate-200 rounded-xl p-3"><div class="flex justify-between gap-3"><div class="min-w-0"><b class="text-sm">'+esc(q.docNo||q.id)+'</b><div class="text-xs text-slate-600 mt-1">'+esc(q.client||'-')+' · '+esc(q.projectName||'-')+'</div><div class="text-[11px] text-slate-400 mt-1">'+esc(q.date||'-')+' · DP '+Number(q.dpPercent||0)+'%</div></div><b class="text-sm whitespace-nowrap">'+money(q.total)+'</b></div><button data-so-action="create" data-id="'+esc(q.id)+'" class="mt-3 w-full min-h-10 rounded-lg bg-slate-900 text-white text-xs font-bold">Buat Sales Order</button></article>';}).join('')+'</div>';
  html+='</section><section><div class="flex flex-wrap items-center justify-between gap-2 mb-3"><div><h2 class="font-bold text-sm">Daftar Sales Order</h2><p class="text-xs text-slate-500 mt-1">Satu Sales Order untuk setiap quotation yang disetujui.</p></div><select id="so-filter" class="border border-slate-300 rounded-lg p-2 text-xs" aria-label="Filter status">'+['all'].concat(Object.keys(engine.LABELS)).map(function(s){return'<option value="'+s+'" '+(filter===s?'selected':'')+'>'+(s==='all'?'Semua status':esc(engine.statusLabel(s)))+'</option>';}).join('')+'</select></div>';
  if(!active.length)html+='<div class="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500">Belum ada Sales Order pada filter ini.</div>';
  else html+=active.map(function(order){
   var pay=summary(order,d),actions=engine.availableActions(order,pay),invoice=invoiceForQuote(order.quotationId,d),shortfall=Math.max(0,Number(order.dpRequiredAmount||0)-pay.paid);
   var latest=(Array.isArray(order.history)?order.history:[]).slice(-3).reverse();
   var history=latest.map(function(h){return'<li class="text-[10px] text-slate-500">'+esc(h.date||'')+' · '+esc(engine.statusLabel(h.status))+(h.note?' — '+esc(h.note):'')+'</li>';}).join('');
   var actionHtml=actions.map(function(a){var color=a.status==='cancelled'?'bg-red-50 text-red-700':a.status==='closed'?'bg-slate-900 text-white':'bg-blue-50 text-blue-700';return'<button data-so-action="transition" data-id="'+esc(order.id)+'" data-status="'+esc(a.status)+'" class="px-3 py-2 rounded-lg text-[11px] font-bold '+color+'">'+esc(a.label)+'</button>';}).join('');
   var invoiceButton=invoice.length?'<button data-so-action="invoice" data-id="'+esc(order.quotationId)+'" class="px-3 py-2 rounded-lg border text-[11px] font-bold">Buka Invoice</button>':'<button data-so-action="invoice" data-id="'+esc(order.quotationId)+'" class="px-3 py-2 rounded-lg border text-[11px] font-bold">Buat Invoice</button>';
   return'<article class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"><div class="flex flex-wrap justify-between gap-3"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><b class="text-sm">'+esc(order.orderNo||order.id)+'</b>'+statusPill(order.status)+'</div><div class="text-sm font-semibold text-slate-800 mt-2">'+esc(order.projectName||'-')+'</div><div class="text-xs text-slate-500">'+esc(order.client||'-')+' · Quotation '+esc(order.quotationNo||order.quotationId)+'</div><div class="text-[10px] text-slate-400 mt-1">Order '+esc(order.orderDate||'-')+' · Target kirim '+esc(order.deliveryDate||'Belum ditentukan')+'</div></div><div class="text-right"><div class="text-[10px] text-slate-500">Nilai pesanan</div><b class="text-lg">'+money(order.total)+'</b></div></div><div class="grid grid-cols-2 sm:grid-cols-4 gap-2"><div class="bg-slate-50 rounded-lg p-2"><div class="text-[10px] text-slate-500">DP '+Number(order.dpPercent||0)+'%</div><b class="text-xs">'+money(order.dpRequiredAmount)+'</b></div><div class="bg-slate-50 rounded-lg p-2"><div class="text-[10px] text-slate-500">Pembayaran masuk</div><b class="text-xs">'+money(pay.paid)+'</b></div><div class="bg-slate-50 rounded-lg p-2"><div class="text-[10px] text-slate-500">Kekurangan DP</div><b class="text-xs '+(shortfall?'text-amber-700':'text-emerald-700')+'">'+money(shortfall)+'</b></div><div class="bg-slate-50 rounded-lg p-2"><div class="text-[10px] text-slate-500">Sisa seluruh invoice</div><b class="text-xs">'+money(pay.invoiceBalance)+'</b></div></div><div class="text-[11px] text-slate-500">'+pay.invoiceCount+' invoice terkait · '+(pay.depositSatisfied?'DP memenuhi syarat':'Produksi menunggu DP terverifikasi')+'</div>'+materialPlanHtml(order,d,stockBalances)+'<div class="flex flex-wrap gap-2">'+invoiceButton+'<button data-so-action="project" data-id="'+esc(order.id)+'" class="px-3 py-2 rounded-lg border text-[11px] font-bold">Buka Proyek</button>'+actionHtml+'</div>'+(history?'<details class="border-t pt-2"><summary class="text-[11px] font-semibold text-slate-600 cursor-pointer">Riwayat perubahan status</summary><ul class="mt-2 space-y-1">'+history+'</ul></details>':'')+'</article>';
  }).join('');
  html+='</section>';
  page.innerHTML=html;
  var select=el('so-filter');if(select)select.addEventListener('change',function(){filter=this.value;renderSalesOrders();});
  ensureBound();
 }catch(error){page.innerHTML='<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">'+esc(error.message||String(error))+'</div>';}
}
w.renderSalesOrders=renderSalesOrders;
w.createSalesOrderFromQuotation=createSalesOrderFromQuotation;
w.updateSalesOrderStatus=updateSalesOrderStatus;
})(window);
